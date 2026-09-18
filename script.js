(() => {
  const LIVE_EMAIL = 'highestdegreepriorities@gmail.com';
  const CROSSDOCK_ENDPOINT = 'https://script.google.com/macros/s/AKfycbx_Qi8Tvr-MU-tM1qxb_3okRF0IRTnflWdEFEE1WhTkCdgvJqgHXXpo-V0ufTlQuHFk/exec';

  const track = (eventName, params = {}) => {
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, params);
    }
  };

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  document.querySelectorAll('a[href^="mailto:contact@highestdegreepriorities.com"]').forEach(link => {
    link.href = link.href.replace('contact@highestdegreepriorities.com', LIVE_EMAIL);
    if ((link.textContent || '').trim() === 'contact@highestdegreepriorities.com') link.textContent = LIVE_EMAIL;
  });

  document.querySelectorAll('script[type="application/ld+json"]').forEach(node => {
    if ((node.textContent || '').includes('contact@highestdegreepriorities.com')) {
      node.textContent = node.textContent.replaceAll('contact@highestdegreepriorities.com', LIVE_EMAIL);
    }
  });

  const menuToggle = document.querySelector('.menu-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
      const open = navLinks.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', String(open));
    });
    navLinks.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
    }));
  }

  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  document.querySelectorAll('[data-track]').forEach(el => {
    el.addEventListener('click', () => track(el.dataset.track, {
      page_location: window.location.href,
      link_text: (el.textContent || '').trim().slice(0, 120)
    }));
  });

  const briefForm = document.getElementById('systemBrief');
  const briefPath = document.getElementById('briefPath');
  const choiceButtons = [...document.querySelectorAll('[data-brief-choice]')];
  const progress = document.getElementById('briefProgress');
  const result = document.getElementById('briefResult');
  const title = document.getElementById('briefTitle');
  const text = document.getElementById('briefText');
  const emailBrief = document.getElementById('emailBrief');
  const copyBrief = document.getElementById('copyBrief');

  if (!briefForm || !briefPath || !progress || !result || !title || !text || !emailBrief || !copyBrief) return;

  const submitButton = briefForm.querySelector('button[type="submit"]');
  const originalFormNote = briefForm.querySelector('.form-note');

  if (!document.getElementById('customerName')) {
    const identity = document.createDocumentFragment();

    const addField = (labelText, id, type, placeholder, required = false) => {
      const label = document.createElement('label');
      label.htmlFor = id;
      label.textContent = labelText;
      const input = document.createElement('input');
      input.id = id;
      input.name = id;
      input.type = type;
      input.placeholder = placeholder;
      input.required = required;
      identity.append(label, input);
    };

    addField('Your name', 'customerName', 'text', 'Name', true);
    addField('Company / organization', 'company', 'text', 'Company (optional)', false);
    addField('Best email', 'customerEmail', 'email', 'you@company.com', true);
    addField('Phone', 'customerPhone', 'tel', 'Optional', false);

    const website = document.createElement('input');
    website.id = 'website';
    website.name = 'website';
    website.type = 'text';
    website.tabIndex = -1;
    website.autocomplete = 'off';
    website.setAttribute('aria-hidden', 'true');
    website.style.position = 'absolute';
    website.style.left = '-10000px';
    website.style.width = '1px';
    website.style.height = '1px';
    identity.appendChild(website);

    briefForm.insertBefore(identity, submitButton);
  }

  if (originalFormNote) {
    originalFormNote.textContent = 'This builds your starting brief in the browser. Nothing is sent until you choose Submit System Brief.';
  }

  emailBrief.removeAttribute('href');
  emailBrief.setAttribute('role', 'button');
  emailBrief.setAttribute('tabindex', '0');
  emailBrief.innerHTML = 'Submit System Brief <span>→</span>';

  let currentBrief = null;

  const pathLabels = {
    build: 'BUILD IT',
    'build-operate': 'BUILD + OPERATE IT',
    operate: 'OPERATE IT'
  };

  const pathRecommendations = {
    build: 'Factory search → reuse / assemble / extend / custom build → validate → deploy → handoff',
    'build-operate': 'Factory search → build/assemble → validate → deploy → managed operation → evidence → improvement',
    operate: 'Audit → stabilize → integrate → validate → operate → monitor → improve'
  };

  function setPath(path, shouldScroll = false) {
    if (!pathLabels[path]) return;
    briefPath.value = path;
    choiceButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.briefChoice === path));
    updateProgress();
    track('esf_path_selected', { path });
    if (shouldScroll) document.getElementById('start').scrollIntoView({ behavior: 'smooth' });
  }

  choiceButtons.forEach(btn => btn.addEventListener('click', () => setPath(btn.dataset.briefChoice)));

  document.querySelectorAll('.choose-path').forEach(btn => {
    btn.addEventListener('click', () => setPath(btn.dataset.choice, true));
  });

  document.querySelectorAll('[data-prefill]').forEach(el => {
    el.addEventListener('click', () => setPath(el.dataset.prefill));
  });

  const watchedIds = ['systemType', 'outcome', 'currentState', 'notes', 'customerName', 'company', 'customerEmail', 'customerPhone'];
  watchedIds.map(id => document.getElementById(id)).forEach(field => {
    if (!field) return;
    field.addEventListener('input', updateProgress);
    field.addEventListener('change', updateProgress);
  });

  function updateProgress() {
    const requiredValues = [
      briefPath.value,
      document.getElementById('systemType').value,
      document.getElementById('outcome').value.trim(),
      document.getElementById('currentState').value,
      document.getElementById('customerName').value.trim(),
      document.getElementById('customerEmail').value.trim()
    ];
    const complete = requiredValues.filter(Boolean).length;
    progress.style.width = `${Math.max(8, (complete / requiredValues.length) * 100)}%`;
  }

  function makeManifestId() {
    const now = new Date();
    const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('');
    const bytes = new Uint8Array(4);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
    else bytes.forEach((_, i) => { bytes[i] = Math.floor(Math.random() * 256); });
    const suffix = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    return `ESF-${date}-${suffix}`;
  }

  function contactValues() {
    return {
      customer_name: document.getElementById('customerName').value.trim(),
      company: document.getElementById('company').value.trim(),
      email: document.getElementById('customerEmail').value.trim(),
      phone: document.getElementById('customerPhone').value.trim(),
      website: document.getElementById('website').value.trim()
    };
  }

  briefForm.addEventListener('submit', event => {
    event.preventDefault();

    if (!briefPath.value) {
      choiceButtons[0].focus();
      alert('Choose Build It, Build + Operate It, or Operate It first.');
      return;
    }
    if (!briefForm.reportValidity()) return;

    const systemType = document.getElementById('systemType').value;
    const outcome = document.getElementById('outcome').value.trim();
    const currentState = document.getElementById('currentState').value;
    const notes = document.getElementById('notes').value.trim() || 'None provided';
    const contact = contactValues();
    const label = pathLabels[briefPath.value];
    const recommendation = pathRecommendations[briefPath.value];

    const brief = [
      'ENTERPRISE SYSTEMS FACTORY — STARTING BRIEF',
      '',
      `Preferred path: ${label}`,
      `System / situation: ${systemType}`,
      `Current state: ${currentState}`,
      `Operating outcome: ${outcome}`,
      `Additional context: ${notes}`,
      '',
      `Suggested production path: ${recommendation}`,
      '',
      'Next review: confirm fit, existing reusable capability, missing components, integrations, controls, operating ownership, measurable baseline and commercial scope.'
    ].join('\n');

    currentBrief = {
      preferred_path: briefPath.value,
      system_type: systemType,
      current_state: currentState,
      operating_outcome: outcome,
      additional_context: notes === 'None provided' ? '' : notes,
      suggested_production_path: recommendation,
      contact,
      brief
    };

    title.textContent = `${label} — starting recommendation`;
    text.textContent = brief;
    result.hidden = false;
    result.scrollIntoView({ behavior: 'smooth', block: 'center' });

    track('esf_brief_generated', {
      engagement_path: briefPath.value,
      system_type: systemType,
      current_state: currentState
    });
  });

  async function submitBrief(event) {
    if (event) event.preventDefault();
    if (!currentBrief) {
      briefForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!CROSSDOCK_ENDPOINT) {
      window.location.href = `mailto:${LIVE_EMAIL}?subject=${encodeURIComponent('Enterprise Systems Factory System Brief')}&body=${encodeURIComponent(currentBrief.brief)}`;
      return;
    }

    const manifestId = makeManifestId();
    const params = new URLSearchParams({
      manifest_id: manifestId,
      customer_name: currentBrief.contact.customer_name,
      company: currentBrief.contact.company,
      email: currentBrief.contact.email,
      phone: currentBrief.contact.phone,
      preferred_path: currentBrief.preferred_path,
      system_type: currentBrief.system_type,
      current_state: currentBrief.current_state,
      operating_outcome: currentBrief.operating_outcome,
      additional_context: currentBrief.additional_context,
      website: currentBrief.contact.website
    });

    const original = emailBrief.innerHTML;
    emailBrief.setAttribute('aria-disabled', 'true');
    emailBrief.textContent = 'Submitting…';

    try {
      await fetch(CROSSDOCK_ENDPOINT, {
        method: 'POST',
        mode: 'no-cors',
        body: params
      });
      title.textContent = `Submission sent — ${manifestId}`;
      emailBrief.textContent = 'System brief submitted ✓';
      emailBrief.removeAttribute('tabindex');
      track('esf_brief_submitted', {
        manifest_id: manifestId,
        engagement_path: currentBrief.preferred_path,
        system_type: currentBrief.system_type
      });
    } catch (err) {
      emailBrief.innerHTML = original;
      emailBrief.removeAttribute('aria-disabled');
      const fallback = document.createElement('p');
      fallback.className = 'form-note';
      fallback.textContent = `Automatic submission could not complete. Please email ${LIVE_EMAIL}.`;
      emailBrief.parentElement.appendChild(fallback);
      track('esf_brief_submit_failed', { engagement_path: currentBrief.preferred_path });
    }
  }

  emailBrief.addEventListener('click', submitBrief);
  emailBrief.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') submitBrief(event);
  });

  copyBrief.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text.textContent);
      const original = copyBrief.textContent;
      copyBrief.textContent = 'Copied ✓';
      track('esf_brief_copied', { engagement_path: briefPath.value });
      setTimeout(() => copyBrief.textContent = original, 1600);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(text);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
  });

  const sections = [...document.querySelectorAll('section[id]')];
  const seen = new Set();
  const sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !seen.has(entry.target.id)) {
        seen.add(entry.target.id);
        track('esf_section_view', { section_id: entry.target.id });
      }
    });
  }, { threshold: 0.45 });
  sections.forEach(section => sectionObserver.observe(section));

  updateProgress();
})();
