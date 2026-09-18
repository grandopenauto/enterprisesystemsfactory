(() => {
  const LIVE_EMAIL = 'highestdegreepriorities@gmail.com';

  const track = (eventName, params = {}) => {
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, params);
    }
  };

  document.getElementById('year').textContent = new Date().getFullYear();

  // Replace the retired contact mailbox in rendered contact links and structured data.
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

  const watchedFields = ['systemType', 'outcome', 'currentState', 'notes'].map(id => document.getElementById(id));
  watchedFields.forEach(field => {
    if (!field) return;
    field.addEventListener('input', updateProgress);
    field.addEventListener('change', updateProgress);
  });

  function updateProgress() {
    const values = [
      briefPath.value,
      document.getElementById('systemType').value,
      document.getElementById('outcome').value.trim(),
      document.getElementById('currentState').value,
      document.getElementById('notes').value.trim()
    ];
    const complete = values.filter(Boolean).length;
    progress.style.width = `${Math.max(8, (complete / values.length) * 100)}%`;
  }

  briefForm.addEventListener('submit', event => {
    event.preventDefault();

    if (!briefPath.value) {
      choiceButtons[0].focus();
      alert('Choose Build It, Build + Operate It, or Operate It first.');
      return;
    }

    const systemType = document.getElementById('systemType').value;
    const outcome = document.getElementById('outcome').value.trim();
    const currentState = document.getElementById('currentState').value;
    const notes = document.getElementById('notes').value.trim() || 'None provided';
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

    title.textContent = `${label} — starting recommendation`;
    text.textContent = brief;
    const subject = `ESF System Brief — ${label}`;
    emailBrief.href = `mailto:${LIVE_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(brief)}`;
    result.hidden = false;
    result.scrollIntoView({ behavior: 'smooth', block: 'center' });

    track('esf_brief_generated', {
      engagement_path: briefPath.value,
      system_type: systemType,
      current_state: currentState
    });
  });

  emailBrief.addEventListener('click', () => track('esf_brief_email_clicked', { engagement_path: briefPath.value }));

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
