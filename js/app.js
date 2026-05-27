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
    // Propagate to all open report iframes
    document.querySelectorAll('.report-body iframe').forEach((f) => {
      try { f.contentWindow && f.contentWindow.postMessage({ type: 'noisefit-theme', theme: t }, '*'); } catch (e) {}
    });
  }

  // initialize from current attr (set by inline script before paint)
  applyTheme(document.documentElement.getAttribute('data-theme') || 'light');

  themeBtn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });

  // When a report iframe announces it's ready, push current theme to it
  window.addEventListener('message', (ev) => {
    if (ev.data && ev.data.type === 'noisefit-report-ready' && ev.source) {
      const t = document.documentElement.getAttribute('data-theme') || 'light';
      try { ev.source.postMessage({ type: 'noisefit-theme', theme: t }, '*'); } catch (e) {}
    }
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
  // ------------------------------------------------------------------
  // 7. Results analytics — render model cards & sweep chart
  // ------------------------------------------------------------------

  const resultsData = (() => {
    const el = document.getElementById('results-data');
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) { return null; }
  })();

  if (resultsData) {
    const modelGrid = document.getElementById('modelGrid');

    // helper to escape HTML
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // Per-model summary cards
    if (modelGrid) {
      const cardHtml = resultsData.models.map((m) => {
        const base = m.configs.find((c) => c.kind === 'base');
        const fit  = m.configs.find((c) => c.kind === 'fit');
        const best = m.configs.find((c) => c.best) || m.configs.filter((c) => c.kind === 'noise').sort((a, b) => b.pct - a.pct)[0];
        const delta = best && base ? (best.pct - base.pct) : 0;
        const rows = [
          base && { ...base, label: 'Base' },
          fit  && { ...fit,  label: 'Base FiT' },
          best && { ...best, label: best.label + ' · NoiseFiT', best: true }
        ].filter(Boolean);
        return `
          <article class="model-card">
            <div class="mc-head">
              <div class="mc-name">${esc(m.name)}<em>${esc(m.spec)}</em></div>
              <div class="mc-best">Best NoiseFiT<b>${best ? best.pct.toFixed(1) + '%' : '—'}</b></div>
            </div>
            <div class="mc-delta">
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,8 6,4 10,8"/></svg>
              +${delta.toFixed(1)} pp vs Base
            </div>
            <div class="mc-bars">
              ${rows.map((r) => `
                <div class="mc-row ${r.best ? 'best' : ''}" data-kind="${esc(r.kind)}">
                  <span class="lbl">${esc(r.label)}</span>
                  <div class="mc-bar"><i data-pct="${r.pct}"></i></div>
                  <span class="val">${r.pct.toFixed(1)}%</span>
                </div>
              `).join('')}
            </div>
          </article>
        `;
      }).join('');
      modelGrid.innerHTML = cardHtml;
    }

    // Per-family confidence-interval visualization (replaces full sweep)
    const ciRows = document.getElementById('ciRows');
    if (ciRows) {
      const rowsHtml = resultsData.models.map((m) => {
        const base = m.configs.find((c) => c.kind === 'base');
        const fit  = m.configs.find((c) => c.kind === 'fit');
        const noise = m.configs.filter((c) => c.kind === 'noise').map((c) => c.pct);
        if (!noise.length) return '';
        const min = Math.min(...noise);
        const max = Math.max(...noise);
        const mean = noise.reduce((a, b) => a + b, 0) / noise.length;
        const beats = base ? (max - base.pct).toFixed(1) : null;
        return `
          <div class="ci-row">
            <div class="ci-name">${esc(m.name)}<em>${esc(m.spec)}</em></div>
            <div class="ci-axis" aria-label="NoiseFiT range">
              <div class="ci-gridlines" aria-hidden="true"><i></i></div>
              <div class="ci-band" style="left:${min}%;right:${(100 - max).toFixed(2)}%" title="NoiseFiT range ${min.toFixed(1)}% – ${max.toFixed(1)}%"></div>
              <div class="ci-mean" style="left:${mean.toFixed(2)}%" title="NoiseFiT mean ${mean.toFixed(1)}%"></div>
              ${fit ? `<div class="ci-marker fit" style="left:${fit.pct}%" title="Base FiT ${fit.pct.toFixed(1)}%"></div>` : ''}
              ${base ? `<div class="ci-marker base" style="left:${base.pct}%" title="Base ${base.pct.toFixed(1)}%"></div>` : ''}
            </div>
            <div class="ci-stats">
              <div class="ci-stat"><span class="lbl">Base</span><span class="val">${base ? base.pct.toFixed(1) + '%' : '—'}</span></div>
              <div class="ci-stat"><span class="lbl">Base FiT</span><span class="val">${fit ? fit.pct.toFixed(1) + '%' : '—'}</span></div>
              <div class="ci-stat win">
                <span class="lbl">NoiseFiT best</span>
                <span class="val">${max.toFixed(1)}%</span>
                ${beats !== null ? `<span class="delta">+${beats} pp</span>` : ''}
              </div>
            </div>
          </div>
        `;
      }).join('');
      ciRows.innerHTML = rowsHtml;
    }

    // Animate bars on scroll into view
    const bars = document.querySelectorAll('.mc-bar > i');
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const pct = parseFloat(e.target.dataset.pct);
            if (isFinite(pct)) e.target.style.width = pct + '%';
            io.unobserve(e.target);
          }
        });
      }, { threshold: 0.15 });
      bars.forEach((b) => io.observe(b));
    } else {
      bars.forEach((b) => { b.style.width = (parseFloat(b.dataset.pct) || 0) + '%'; });
    }
  }

  // ------------------------------------------------------------------
  // 8. Paper · Benchmarks & Ablations
  // ------------------------------------------------------------------

  const benchData = (() => {
    const el = document.getElementById('bench-data');
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) { return null; }
  })();

  if (benchData) {
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // --- Metric uplift strip ---
    const msBars = document.getElementById('msBars');
    if (msBars) {
      const maxDelta = Math.max(...benchData.metricUplifts.map((m) => m.delta));
      msBars.innerHTML = benchData.metricUplifts.map((m) => {
        const ratio = Math.min(1, m.delta / maxDelta);
        return `
          <div class="ms-cell ${m.highlight ? 'highlight' : ''}" style="--bar:${ratio.toFixed(3)}">
            <div>
              <span class="ms-name">${esc(m.name)}<span class="ms-blurb">${esc(m.blurb)}</span></span>
            </div>
            <div class="ms-num"><em>+${m.delta.toFixed(2)}</em><small>%</small></div>
          </div>
        `;
      }).join('');

      // animate via IntersectionObserver
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) { e.target.classList.add('in-view'); io.unobserve(e.target); }
          });
        }, { threshold: 0.3 });
        msBars.querySelectorAll('.ms-cell').forEach((c) => io.observe(c));
      } else {
        msBars.querySelectorAll('.ms-cell').forEach((c) => c.classList.add('in-view'));
      }
    }

    // --- Champion table ---
    const champTable = document.getElementById('champTable');
    if (champTable && benchData.champion) {
      const { headers, rows } = benchData.champion;
      let html = '<thead><tr>';
      headers.forEach((h) => { html += `<th>${esc(h)}</th>`; });
      html += '</tr></thead><tbody>';
      rows.forEach((r) => {
        html += `<tr><td>${esc(r.arch)}</td><td>${esc(r.cfg)}</td>`;
        // vals contains [MMLU-Pro, BBH, GPQA, Math, IFEval, MUSR, TfQA-MC, HaluEval, Avg] — last is Avg
        r.vals.forEach((v, i) => {
          const cls = (i === r.vals.length - 1) ? 'avg-cell' : '';
          html += `<td class="${cls}">${v.toFixed(2)}</td>`;
        });
        html += `<td class="delta-cell">+${r.delta.toFixed(2)}</td>`;
        html += '</tr>';
      });
      html += '</tbody>';
      champTable.innerHTML = html;
    }

    // --- Method comparison ---
    const methodTable = document.getElementById('methodTable');
    if (methodTable && benchData.methodComparison) {
      let html = `
        <thead><tr>
          <th>Method</th><th>ARC</th><th>HellaSwag</th><th>MMLU</th><th>TfQA</th><th>Avg</th><th>Δ</th>
        </tr></thead><tbody>
      `;
      benchData.methodComparison.forEach((r) => {
        const avgCls = r.kind === 'best' ? 'avg-cell' : '';
        const deltaCls = r.delta == null ? '' : (r.delta > 0 ? 'delta pos' : 'delta neg');
        const deltaText = r.delta == null ? '—' : (r.delta > 0 ? '+' : '') + r.delta.toFixed(2);
        html += `<tr class="kind-${r.kind}">
          <td>${esc(r.name)}</td>
          <td>${r.arc.toFixed(2)}</td>
          <td>${r.hella.toFixed(2)}</td>
          <td>${r.mmlu.toFixed(2)}</td>
          <td>${r.tqa.toFixed(2)}</td>
          <td class="${avgCls}">${r.avg.toFixed(2)}</td>
          <td class="${deltaCls}">${deltaText}</td>
        </tr>`;
      });
      html += '</tbody>';
      methodTable.innerHTML = html;
    }

    // --- Loss ablation ---
    const lossList = document.getElementById('lossList');
    if (lossList && benchData.lossAblation) {
      const maxAvg = Math.max(...benchData.lossAblation.map((r) => r.avg));
      lossList.innerHTML = benchData.lossAblation.map((r) => {
        const ratio = (r.avg / maxAvg) * 100;
        const dtxt = r.delta == null || r.delta === 0 ? '—' : (r.delta > 0 ? '+' : '') + r.delta.toFixed(2);
        const dcls = r.delta == null ? '' : (r.delta > 0 ? 'pos' : 'neg');
        return `
          <div class="loss-row kind-${r.kind}">
            <div class="lname">${esc(r.name)}</div>
            <div class="loss-bar"><i data-pct="${ratio.toFixed(2)}"></i></div>
            <div class="lval">${r.avg.toFixed(2)}</div>
            <div class="ldelta ${dcls}">${dtxt}</div>
          </div>
        `;
      }).join('');
    }

    // --- Footprint ---
    const footprintRows = document.getElementById('footprintRows');
    if (footprintRows && benchData.footprint) {
      const maxRuntime = Math.max(...benchData.footprint.map((r) => r.runtime));
      const maxMem = Math.max(...benchData.footprint.map((r) => r.mem));
      let html = `
        <div class="fp-head-row">
          <span>Method</span>
          <span>Runtime · h (rel. to BaseFiT)</span>
          <span>Peak GPU memory · %</span>
          <span>TruthfulQA</span>
          <span>Δ TQA</span>
        </div>
      `;
      benchData.footprint.forEach((r) => {
        const rtRatio = (r.runtime / maxRuntime) * 100;
        const memRatio = (r.mem / maxMem) * 100;
        const dcls = r.delta == null || r.delta === 0 ? '' : (r.delta > 0 ? 'pos' : 'neg');
        const dtxt = r.delta == null || r.delta === 0 ? '—' : (r.delta > 0 ? '+' : '') + r.delta.toFixed(2);
        html += `
          <div class="fp-row kind-${r.kind}">
            <div class="fp-name">${esc(r.name)}</div>
            <div class="fp-meter">
              <div class="fp-meter-bar"><i data-pct="${rtRatio.toFixed(2)}"></i></div>
              <div class="fp-meter-val">${r.runtime.toFixed(2)}h · ${r.rel.toFixed(2)}×</div>
            </div>
            <div class="fp-meter">
              <div class="fp-meter-bar"><i data-pct="${memRatio.toFixed(2)}"></i></div>
              <div class="fp-meter-val">${r.mem.toFixed(1)}%</div>
            </div>
            <div class="fp-tqa">${r.tqa.toFixed(2)}<em> /100</em></div>
            <div class="fp-delta ${dcls}">${dtxt}</div>
          </div>
        `;
      });
      footprintRows.innerHTML = html;
    }

    // Animate all bench bars
    const benchBars = document.querySelectorAll('#bench .loss-bar > i, #bench .fp-meter-bar > i');
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const pct = parseFloat(e.target.dataset.pct);
            if (isFinite(pct)) e.target.style.width = pct + '%';
            io.unobserve(e.target);
          }
        });
      }, { threshold: 0.15 });
      benchBars.forEach((b) => io.observe(b));
    } else {
      benchBars.forEach((b) => { b.style.width = (parseFloat(b.dataset.pct) || 0) + '%'; });
    }
  }
})();
