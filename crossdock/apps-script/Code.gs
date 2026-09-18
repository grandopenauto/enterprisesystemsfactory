const ESF = Object.freeze({
  spreadsheetId: '1_AyMgLDm7VkaxYxYBn4hRObx7nTqQmpLrPY1CyO_FOM',
  manifestsSheet: 'Manifests',
  eventsSheet: 'Events',
  quarantineSheet: 'Quarantine',
  configSheet: 'Config',
  timeZone: 'America/Los_Angeles',
  maxPostBytes: 16384,
  manifestIdPattern: /^ESF-\d{8}-[A-Z0-9]{8}$/,
  allowedPaths: ['build', 'build-operate', 'operate']
});

function doGet() {
  return json_({
    ok: true,
    service: 'ESF-CrossDock-Receiver',
    version: '1.0.0',
    status: 'ready'
  });
}

function doPost(e) {
  const receivedAt = new Date();
  let raw = '';
  try {
    raw = e && e.postData && e.postData.contents ? String(e.postData.contents) : '';
    if (raw.length > ESF.maxPostBytes) {
      quarantine_('payload_too_large', raw, receivedAt);
      return json_({ok: false, error: 'invalid_request'});
    }

    const payload = parsePayload_(e, raw);
    if (payload.website) {
      quarantine_('honeypot_triggered', raw, receivedAt);
      return json_({ok: true, accepted: true});
    }

    const clean = validateAndSanitize_(payload);
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const ss = SpreadsheetApp.openById(ESF.spreadsheetId);
      const manifests = requiredSheet_(ss, ESF.manifestsSheet);
      const events = requiredSheet_(ss, ESF.eventsSheet);
      const cfg = config_(ss);

      const manifestId = uniqueManifestId_(manifests, clean.manifest_id, receivedAt, cfg.manifest_prefix || 'ESF');
      const stamp = Utilities.formatDate(receivedAt, ESF.timeZone, "yyyy-MM-dd'T'HH:mm:ssXXX");
      const suggestedPath = suggestedProductionPath_(clean.preferred_path);

      manifests.appendRow([
        safeCell_(manifestId),
        safeCell_(stamp),
        'NEW',
        safeCell_(cfg.source || 'enterprisesystemsfactory.com'),
        safeCell_(clean.customer_name),
        safeCell_(clean.company),
        safeCell_(clean.email),
        safeCell_(clean.phone),
        safeCell_(clean.preferred_path),
        safeCell_(clean.system_type),
        safeCell_(clean.current_state),
        safeCell_(clean.operating_outcome),
        safeCell_(clean.additional_context),
        safeCell_(suggestedPath),
        'PENDING',
        '',
        '',
        'Review new intake',
        safeCell_(stamp)
      ]);

      const eventId = 'EVT-' + Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase();
      events.appendRow([
        eventId,
        manifestId,
        stamp,
        'RECEIVED',
        'ESF-CrossDock-Receiver',
        '',
        'NEW',
        'Public system brief accepted into receiving dock.'
      ]);

      notify_(cfg.notification_email, manifestId, clean, stamp);
      return json_({ok: true, accepted: true, manifest_id: manifestId, received_at: stamp});
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    try {
      quarantine_('receiver_error:' + safeReason_(err && err.message), raw, receivedAt);
    } catch (_) {}
    console.error(err && err.stack ? err.stack : err);
    return json_({ok: false, error: 'intake_unavailable'});
  }
}

function parsePayload_(e, raw) {
  const type = e && e.postData && e.postData.type ? String(e.postData.type).toLowerCase() : '';
  if (type.indexOf('application/json') >= 0 && raw) {
    return JSON.parse(raw);
  }
  return Object.assign({}, e && e.parameter ? e.parameter : {});
}

function validateAndSanitize_(p) {
  const out = {
    manifest_id: text_(p.manifest_id, 40, false),
    customer_name: text_(p.customer_name, 120, true),
    company: text_(p.company, 160, false),
    email: text_(p.email, 254, true).toLowerCase(),
    phone: text_(p.phone, 40, false),
    preferred_path: text_(p.preferred_path, 40, true),
    system_type: text_(p.system_type, 160, true),
    current_state: text_(p.current_state, 160, true),
    operating_outcome: text_(p.operating_outcome, 2000, true),
    additional_context: text_(p.additional_context, 4000, false)
  };

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) throw new Error('invalid_email');
  if (ESF.allowedPaths.indexOf(out.preferred_path) < 0) throw new Error('invalid_path');
  if (out.manifest_id && !ESF.manifestIdPattern.test(out.manifest_id)) throw new Error('invalid_manifest_id');
  return out;
}

function text_(value, maxLength, required) {
  let s = value == null ? '' : String(value);
  s = s.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  if (required && !s) throw new Error('missing_required_field');
  if (s.length > maxLength) s = s.slice(0, maxLength);
  return s;
}

function safeCell_(value) {
  const s = value == null ? '' : String(value);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function uniqueManifestId_(sheet, candidate, now, prefix) {
  let id = candidate || newManifestId_(now, prefix);
  for (let i = 0; i < 4; i++) {
    const found = sheet.getRange('A:A').createTextFinder(id).matchEntireCell(true).findNext();
    if (!found) return id;
    id = newManifestId_(now, prefix);
  }
  throw new Error('manifest_id_collision');
}

function newManifestId_(now, prefix) {
  const date = Utilities.formatDate(now, ESF.timeZone, 'yyyyMMdd');
  const suffix = Utilities.getUuid().replace(/-/g, '').slice(0, 8).toUpperCase();
  return String(prefix || 'ESF').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) + '-' + date + '-' + suffix;
}

function suggestedProductionPath_(path) {
  if (path === 'build') return 'Factory search → reuse / assemble / extend / custom build → validate → deploy → handoff';
  if (path === 'build-operate') return 'Factory search → build/assemble → validate → deploy → managed operation → evidence → improvement';
  return 'Audit → stabilize → integrate → validate → operate → monitor → improve';
}

function requiredSheet_(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('missing_sheet:' + name);
  return sheet;
}

function config_(ss) {
  const sheet = requiredSheet_(ss, ESF.configSheet);
  const last = Math.max(sheet.getLastRow(), 1);
  const rows = last > 1 ? sheet.getRange(2, 1, last - 1, 2).getDisplayValues() : [];
  const cfg = {};
  rows.forEach(function(row) {
    if (row[0]) cfg[String(row[0]).trim()] = String(row[1] || '').trim();
  });
  return cfg;
}

function notify_(to, manifestId, clean, stamp) {
  if (!to) return;
  const body = [
    'A new Enterprise Systems Factory brief entered the CrossDock.',
    '',
    'Manifest: ' + manifestId,
    'Received: ' + stamp,
    'Path: ' + clean.preferred_path,
    'Customer: ' + clean.customer_name,
    'Company: ' + (clean.company || '(not provided)'),
    '',
    'Review the ESF-CrossDock-Intake → Manifests sheet for the full brief.'
  ].join('\n');
  MailApp.sendEmail({
    to: to,
    subject: 'ESF CrossDock — new manifest ' + manifestId,
    body: body,
    name: 'Enterprise Systems Factory'
  });
}

function quarantine_(reason, raw, when) {
  const ss = SpreadsheetApp.openById(ESF.spreadsheetId);
  const sheet = requiredSheet_(ss, ESF.quarantineSheet);
  const stamp = Utilities.formatDate(when || new Date(), ESF.timeZone, "yyyy-MM-dd'T'HH:mm:ssXXX");
  const excerpt = String(raw || '').replace(/[\u0000-\u001F\u007F]/g, ' ').slice(0, 500);
  sheet.appendRow([stamp, safeCell_(safeReason_(reason)), 'enterprisesystemsfactory.com', safeCell_(excerpt), 'NEW']);
}

function safeReason_(value) {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9:_\-.]/g, '_').slice(0, 160);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
