/* =========================================================
   NoiseFiT — front-end logic
   ========================================================= */

(function () {
  'use strict';

  // ------------------------------------------------------------------
  // 1. Render model sections from the JSON data block
  // ------------------------------------------------------------------

  const data = JSON.parse(document.getElementById('report-data').textContent);
  const mount = document.getElementById('modelMount');

  const CAT_META = {
    perf: { label: 'Performance', sub: 'Aggregate metrics across runs' },
    intl: { label: 'Internals',   sub: 'Geometry of the hidden state' },
    conf: { label: 'Configurations', sub: 'Per-noise-setting deep dives' }
  };

  const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  data.sections.forEach((sec, secIdx) => {
    // Group reports by category
    const groups = { perf: [], intl: [], conf: [] };
    sec.reports.forEach((r) => groups[r.c].push(r));

    const sectionEl = document.createElement('section');
    sectionEl.className = 'section';
    sectionEl.id = sec.id;

    const idxStr = String(secIdx + 1).padStart(2, '0');

    // Section header
    let html = `
      <header class="section-head">
        <div class="idx">FAMILY · ${idxStr} / ${String(data.sections.length).padStart(2,'0')}</div>
        <h2 class="name">${escapeHtml(sec.name)} <em>${escapeHtml(sec.italic)}</em></h2>
        <div class="meta">
          ${sec.reports.length} reports
          <strong>${escapeHtml(sec.size)}</strong>
        </div>
      </header>

      <div class="tabs" role="tablist">
    `;

    const cats = ['perf', 'intl', 'conf'].filter((c) => groups[c].length > 0);
    cats.forEach((c, i) => {
      html += `
        <button class="tab ${i === 0 ? 'is-active' : ''}" role="tab" data-cat="${c}">
          ${CAT_META[c].label}
          <span class="count">${groups[c].length}</span>
        </button>
      `;
    });

    html += `</div>`;

    // Panels
    cats.forEach((c, i) => {
      html += `<div class="reports tab-panel ${i === 0 ? 'is-active' : ''}" data-panel="${c}">`;

      groups[c].forEach((r, j) => {
        const num = String(j + 1).padStart(2, '0');
        const badgeClass = c;
        const badgeText = r.n ? r.n : CAT_META[c].label;

        html += `
          <article class="report" data-src="${escapeHtml(r.f)}">
            <div class="report-head" tabindex="0" role="button" aria-expanded="false">
              <span class="report-num">${num}</span>
              <div>
                <div class="report-title">${escapeHtml(r.t)}</div>
                <span class="report-sub">${escapeHtml(r.f.split('/').pop())}</span>
              </div>
              <span class="report-badge ${badgeClass}">${escapeHtml(badgeText)}</span>
              <span class="chev" aria-hidden="true">
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="2,4 6,8 10,4"></polyline>
                </svg>
              </span>
            </div>
            <div class="report-body"></div>
          </article>
        `;
      });

      html += `</div>`;
    });

    sectionEl.innerHTML = html;
    mount.appendChild(sectionEl);
  });

  // ------------------------------------------------------------------
  // 2. Tab switching within each model section
  // ------------------------------------------------------------------

  document.querySelectorAll('.section').forEach((sec) => {
    const tabs = sec.querySelectorAll('.tab');
    const panels = sec.querySelectorAll('.tab-panel');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const cat = tab.dataset.cat;
        tabs.forEach((t) => t.classList.toggle('is-active', t === tab));
        panels.forEach((p) => p.classList.toggle('is-active', p.dataset.panel === cat));
      });
    });
  });

  // ------------------------------------------------------------------
  // 3. Lazy iframe loading on card open
  // ------------------------------------------------------------------

  function toggleReport(card) {
    const isOpen = card.classList.contains('is-open');
    card.classList.toggle('is-open');
    card.querySelector('.report-head').setAttribute('aria-expanded', String(!isOpen));

    if (!isOpen) {
      const body = card.querySelector('.report-body');
      if (!body.dataset.loaded) {
        const src = card.dataset.src;
        const filename = src.split('/').pop();
        body.innerHTML = `
          <div class="iframe-frame">
            <div class="iframe-loading">Loading report…</div>
            <iframe src="${src}" frameborder="0" allowfullscreen loading="lazy"></iframe>
          </div>
          <div class="iframe-meta">
            <span>${filename}</span>
            <a href="${src}" target="_blank" rel="noopener">Open in new tab ↗</a>
          </div>
        `;
        body.dataset.loaded = '1';

        // Hide spinner when iframe loads
        const iframe = body.querySelector('iframe');
        const spinner = body.querySelector('.iframe-loading');
        iframe.addEventListener('load', () => spinner && (spinner.style.opacity = '0'));
      }
    }
  }

  document.addEventListener('click', (e) => {
    const head = e.target.closest('.report-head');
    if (head) {
      const card = head.closest('.report');
      toggleReport(card);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const head = document.activeElement && document.activeElement.classList.contains('report-head')
        ? document.activeElement : null;
      if (head) {
        e.preventDefault();
        toggleReport(head.closest('.report'));
      }
    }
  });

  // ------------------------------------------------------------------
  // 4. Theme toggle (with localStorage persistence)
  // ------------------------------------------------------------------

  const themeBtn = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');
  const themeLabel = document.getElementById('themeLabel');

  const ICON_SUN = `
    <circle cx="12" cy="12" r="4"></circle>
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path>
  `;
  const ICON_MOON = `
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
  `;

  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    themeIcon.innerHTML = t === 'dark' ? ICON_MOON : ICON_SUN;
    themeLabel.textContent = t === 'dark' ? 'Dark' : 'Light';
    try { localStorage.setItem('noisefit-theme', t); } catch (e) {}
  }

  // initialize from current attr (set by inline script before paint)
  applyTheme(document.documentElement.getAttribute('data-theme') || 'light');

  themeBtn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });

  // ------------------------------------------------------------------
  // 5. Sticky-nav scroll effect + active-section highlighting
  // ------------------------------------------------------------------

  let scrolled = false;
  window.addEventListener('scroll', () => {
    const s = window.scrollY > 24;
    if (s !== scrolled) {
      scrolled = s;
      document.body.classList.toggle('scrolled', s);
    }
  }, { passive: true });

  const navLinks = Array.from(document.querySelectorAll('.nav a'));
  const targets = navLinks
    .map((a) => document.getElementById(a.dataset.target))
    .filter(Boolean);

  function updateActiveNav() {
    const y = window.scrollY + 140;
    let active = targets[0];
    for (const el of targets) {
      if (el.offsetTop <= y) active = el; else break;
    }
    navLinks.forEach((a) => {
      a.classList.toggle('is-active', a.dataset.target === (active && active.id));
    });
  }
  window.addEventListener('scroll', updateActiveNav, { passive: true });
  updateActiveNav();

  // ------------------------------------------------------------------
  // 6. Noise / signal canvas — clean wave vs. noisy wave
  // ------------------------------------------------------------------

  const canvas = document.getElementById('noiseCanvas');
  const freqOut = document.getElementById('freqReadout');
  const panel = document.getElementById('noisePanel');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    let t0 = performance.now();
    let mouseX = 0.5, mouseY = 0.5;
    let targetMouseX = 0.5;

    function resize() {
      const r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    panel.addEventListener('mousemove', (e) => {
      const r = panel.getBoundingClientRect();
      targetMouseX = (e.clientX - r.left) / r.width;
      mouseY = (e.clientY - r.top) / r.height;
    });
    panel.addEventListener('mouseleave', () => { targetMouseX = 0.5; });

    // simple value-noise
    const seeds = new Array(256).fill(0).map(() => Math.random());
    function noise(x) {
      const i = Math.floor(x);
      const f = x - i;
      const a = seeds[i % 256];
      const b = seeds[(i + 1) % 256];
      const s = f * f * (3 - 2 * f);
      return a + (b - a) * s;
    }

    function getCSS(name) {
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }

    function frame(now) {
      const t = (now - t0) / 1000;
      mouseX += (targetMouseX - mouseX) * 0.06;
      const freq = 0.6 + mouseX * 1.6; // 0.6 - 2.2
      const noiseAmp = 0.06 + mouseY * 0.22;

      ctx.clearRect(0, 0, W, H);

      const ink   = getCSS('--ink-3') || '#5a5d68';
      const inkSoft = getCSS('--ink-4') || '#9095a1';
      const accent = getCSS('--accent') || '#5cdb1f';
      const rule   = getCSS('--rule')  || 'rgba(0,0,0,0.08)';

      const midY = H / 2;
      const amp = H * 0.18;
      const steps = Math.max(120, Math.floor(W));

      // axis baseline
      ctx.strokeStyle = rule;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(W, midY);
      ctx.stroke();

      // dotted ticks
      ctx.fillStyle = inkSoft;
      for (let i = 0; i < 12; i++) {
        const x = (i / 12) * W;
        ctx.fillRect(x, midY - 2, 1, 4);
      }

      // 1. noisy underlying wave (faint)
      ctx.beginPath();
      ctx.lineWidth = 1;
      ctx.strokeStyle = ink;
      ctx.globalAlpha = 0.45;
      for (let i = 0; i <= steps; i++) {
        const x = (i / steps) * W;
        const phase = (i / steps) * freq * Math.PI * 4 + t * 1.4;
        const n = (noise(i * 0.18 + t * 2.5) - 0.5) * 2 * noiseAmp;
        const y = midY + Math.sin(phase) * amp + n * amp * 2.4;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;

      // 2. clean signal — the underlying "truth" (accent, bold)
      ctx.beginPath();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = accent;
      for (let i = 0; i <= steps; i++) {
        const x = (i / steps) * W;
        const phase = (i / steps) * freq * Math.PI * 4 + t * 1.4;
        const y = midY + Math.sin(phase) * amp;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // glow
      ctx.save();
      ctx.shadowColor = accent;
      ctx.shadowBlur = 18;
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = accent;
      ctx.stroke();
      ctx.restore();

      // 3. dotted samples — discrete observations
      ctx.fillStyle = accent;
      const N = 14;
      for (let i = 0; i < N; i++) {
        const x = ((i + 0.5) / N) * W;
        const phase = ((i + 0.5) / N) * freq * Math.PI * 4 + t * 1.4;
        const n = (noise(i * 1.7 + t * 1.5) - 0.5) * 2 * noiseAmp;
        const y = midY + Math.sin(phase) * amp + n * amp * 2.2;
        ctx.beginPath();
        ctx.arc(x, y, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }

      if (freqOut) freqOut.textContent = `f = ${freq.toFixed(2)} Hz`;

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
})();
