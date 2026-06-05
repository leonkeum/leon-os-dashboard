    /* ══════════════════════════════
       SIDE PROJECTS
    ══════════════════════════════ */
    (function () {
      const LS_KEY = 'leon-side-projects';

      const DEFAULTS = [
        {
          id: 'sp1',
          name: 'Clothing Brand',
          concept: 'Streetwear basics line leveraging the @2.chicos audience',
          cost: '€2,000 – 5,000',
          model: 'D2C dropshipping + limited drops',
          revenue: '€800 – 3,000 / mo',
          time: '6 – 12 months',
          viability: 7,
        },
        {
          id: 'sp2',
          name: 'Content Creator App',
          concept: 'Niche mobile tool for short-form video planning & caption generation',
          cost: '€5,000 – 15,000',
          model: 'Freemium subscription',
          revenue: '€1,500 – 8,000 / mo',
          time: '12 – 18 months',
          viability: 6,
        },
        {
          id: 'sp3',
          name: 'Creative Agency BCN',
          concept: 'Paid video & social campaigns for local brands via @2.chicos',
          cost: '€500 – 1,000',
          model: 'Project-based retainer',
          revenue: '€2,000 – 6,000 / mo',
          time: '2 – 4 months',
          viability: 9,
        },
      ];

      function ls()     { try { const v = localStorage.getItem(LS_KEY); return v ? JSON.parse(v) : JSON.parse(JSON.stringify(DEFAULTS)); } catch (_) { return JSON.parse(JSON.stringify(DEFAULTS)); } }
      function lsSave(v){ try { localStorage.setItem(LS_KEY, JSON.stringify(v)); } catch (_) {} }

      let projects = ls();

      function scoreClass(n) { return n >= 8 ? 'green' : n >= 5 ? 'amber' : 'red'; }

      function render() {
        const grid = document.getElementById('sp-grid');
        if (!grid) return;
        grid.innerHTML = '';

        projects.forEach(p => {
          const cls  = scoreClass(p.viability);
          const card = document.createElement('div');
          card.className = 'sp-card';
          card.innerHTML = `
            <div class="sp-card-top">
              <div class="sp-meta">
                <div class="sp-title">${p.name}</div>
                <div class="sp-concept">${p.concept}</div>
              </div>
              <div class="sp-score-wrap">
                <div class="sp-score ${cls}">${p.viability}</div>
                <div class="sp-score-denom">/ 10</div>
              </div>
            </div>
            <div class="sp-divider"></div>
            <div class="sp-details">
              <div>
                <div class="sp-detail-label">Startup cost</div>
                <div class="sp-detail-value">${p.cost}</div>
              </div>
              <div>
                <div class="sp-detail-label">Revenue model</div>
                <div class="sp-detail-value">${p.model}</div>
              </div>
              <div>
                <div class="sp-detail-label">Monthly potential</div>
                <div class="sp-detail-value">${p.revenue}</div>
              </div>
              <div>
                <div class="sp-detail-label">Time to profit</div>
                <div class="sp-detail-value">${p.time}</div>
              </div>
            </div>
            <div class="sp-card-footer">
              <button class="sp-del" data-id="${p.id}">Remove</button>
            </div>`;
          grid.appendChild(card);
        });

        grid.querySelectorAll('.sp-del').forEach(btn => {
          btn.addEventListener('click', () => {
            projects = projects.filter(p => p.id !== btn.dataset.id);
            lsSave(projects);
            render();
          });
        });
      }

      /* ── Add form ── */
      const toggleBtn = document.getElementById('sp-toggle');
      const form      = document.getElementById('sp-form');

      toggleBtn.addEventListener('click', () => {
        const open = form.classList.toggle('open');
        toggleBtn.textContent = open ? '✕ Cancel' : '+ New project idea';
      });

      document.getElementById('sp-submit').addEventListener('click', () => {
        const name      = document.getElementById('sp-name').value.trim();
        const concept   = document.getElementById('sp-concept').value.trim();
        const cost      = document.getElementById('sp-cost').value.trim();
        const model     = document.getElementById('sp-model').value.trim();
        const revenue   = document.getElementById('sp-revenue').value.trim();
        const time      = document.getElementById('sp-time').value.trim();
        const viability = parseInt(document.getElementById('sp-viability').value, 10);

        if (!name || !concept) return;

        projects.push({
          id: Date.now().toString(),
          name, concept,
          cost:     cost     || '—',
          model:    model    || '—',
          revenue:  revenue  || '—',
          time:     time     || '—',
          viability: isNaN(viability) ? 5 : Math.min(10, Math.max(1, viability)),
        });

        lsSave(projects);
        render();
        window.renderTimerList?.(); // sync timer list

        ['sp-name','sp-concept','sp-cost','sp-model','sp-revenue','sp-time','sp-viability']
          .forEach(id => { document.getElementById(id).value = ''; });
        form.classList.remove('open');
        toggleBtn.textContent = '+ New project idea';
      });

      /* ── Lazy init ── */
      const sec = document.getElementById('section-side-projects');
      let inited = false;
      if (sec) {
        new MutationObserver(() => {
          if (sec.classList.contains('active') && !inited) { inited = true; render(); }
        }).observe(sec, { attributes: true, attributeFilter: ['class'] });
        if (sec.classList.contains('active')) { inited = true; render(); }
      }
    })();

       SIDE PROJECTS — TIMER + REPORTS
    ══════════════════════════════ */
    try { (function () {
      const LS_SESSIONS = 'leon-sp-sessions-v1';
      const COLORS = ['#4f7ec9','#4daa7d','#c9a032','#c94f4f','#9b7ac9','#4fc9c9','#c94fa0','#7ac94f'];

      function loadSessions() { try { return JSON.parse(localStorage.getItem(LS_SESSIONS)||'[]'); } catch(_) { return []; } }
      function saveSessions(d){ try { localStorage.setItem(LS_SESSIONS, JSON.stringify(d)); } catch(_) {} }

      const LS_ACTIVE = 'leon-sp-active-timer';
      let timerInterval = null;

      // Restore timer state from sessionStorage (survives F5, not tab close)
      let activeTimer = (() => {
        try { const v = sessionStorage.getItem(LS_ACTIVE); return v ? JSON.parse(v) : null; } catch(_) { return null; }
      })();
      function persistTimer(t) { try { if(t) sessionStorage.setItem(LS_ACTIVE,JSON.stringify(t)); else sessionStorage.removeItem(LS_ACTIVE); } catch(_) {} }
      if (activeTimer) { timerInterval = setInterval(tickTimer, 1000); } // resume tick if was running

      // SP section tab switching
      document.querySelectorAll('.sp-section-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          document.querySelectorAll('.sp-section-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          document.querySelectorAll('.sp-pane').forEach(p => p.classList.remove('active'));
          const target = document.getElementById(`sp-pane-${tab.dataset.spTab}`);
          if (target) target.classList.add('active');
          if (tab.dataset.spTab === 'reports') renderReports();
        });
      });

      // Helper: format ms to h/m string
      function fmtMs(ms) {
        const totalS = Math.floor(ms / 1000);
        const h = Math.floor(totalS / 3600);
        const m = Math.floor((totalS % 3600) / 60);
        const s = totalS % 60;
        if (h > 0) return `${h}h${String(m).padStart(2,'0')}m`;
        return `${m}m${String(s).padStart(2,'0')}s`;
      }
      function fmtH(ms) {
        const h = ms / 3600000;
        return h < 1 ? `${Math.round(h*60)}m` : `${h.toFixed(1)}h`;
      }

      // Get project list from existing SP data (same key as original SP module)
      function getProjects() {
        try {
          const raw = localStorage.getItem('leon-side-projects');
          if (raw) return JSON.parse(raw);
          // Fall back to defaults stored by the existing SP module
          return [];
        } catch(_) { return []; }
      }

      function renderTimerList() {
        const container = document.getElementById('sp-timer-list');
        if (!container) return;
        const projects = getProjects();
        if (!projects.length) {
          container.innerHTML = '<div class="sp-no-sessions" style="margin-bottom:16px">Add a project below to start tracking time.</div>';
          return;
        }
        const sessions = loadSessions();
        container.innerHTML = '';
        projects.forEach((proj, idx) => {
          const color = COLORS[idx % COLORS.length];
          const projSessions = sessions.filter(s => s.project === proj.name);
          const totalMs = projSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
          const isRunning = activeTimer?.projectName === proj.name;
          const elapsed = isRunning ? Date.now() - activeTimer.startTime : 0;
          const row = document.createElement('div');
          row.className = `sp-proj-row${isRunning?' timing':''}`;
          row.dataset.project = proj.name;
          row.innerHTML = `
            <div class="sp-proj-dot" style="background:${color}"></div>
            <div class="sp-proj-info">
              <div class="sp-proj-name">${proj.name}</div>
              <div class="sp-proj-sub">${proj.concept||''}</div>
            </div>
            <div class="sp-proj-elapsed${isRunning?' timing':''}" id="elapsed-${idx}">
              ${isRunning ? fmtMs(elapsed) : (totalMs > 0 ? fmtH(totalMs) : '0h')}
            </div>
            <button class="sp-start-btn${isRunning?' timing':''}" data-idx="${idx}" data-project="${proj.name}">
              ${isRunning ? '⏹ Stop' : '▶ Start'}
            </button>`;
          const btn = row.querySelector('.sp-start-btn');
          btn?.addEventListener('click', () => {
            if (isRunning) { stopTimer(proj.name); }
            else { startTimer(proj.name); }
          });
          container.appendChild(row);
        });
      }

      function localDsTimer(d) {
        return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
      }

      function startTimer(name) {
        if (activeTimer) stopTimer(activeTimer.projectName);
        activeTimer = { projectName: name, startTime: Date.now() };
        persistTimer(activeTimer);
        clearInterval(timerInterval);
        timerInterval = setInterval(tickTimer, 1000);
        renderTimerList();
      }

      function stopTimer(name) {
        if (!activeTimer || activeTimer.projectName !== name) return;
        const duration = Date.now() - activeTimer.startTime;
        const sessions = loadSessions();
        sessions.push({ id:Date.now(), project:name, duration, date:localDsTimer(new Date()) });
        saveSessions(sessions);
        activeTimer = null;
        persistTimer(null);
        clearInterval(timerInterval);
        renderTimerList();
      }

      function tickTimer() {
        if (!activeTimer) return;
        const projects = getProjects();
        const idx = projects.findIndex(p => p.name === activeTimer.projectName);
        if (idx < 0) return;
        const el = document.getElementById(`elapsed-${idx}`);
        if (el) el.textContent = fmtMs(Date.now() - activeTimer.startTime);
      }

      // Reports
      function renderReports() {
        const sessions = loadSessions();
        const projects = getProjects();
        const totalMs = sessions.reduce((s,x) => s + (x.duration||0), 0);
        const today = new Date().toISOString().slice(0,10);
        const todayMs = sessions.filter(s => s.date === today).reduce((s,x) => s + (x.duration||0), 0);

        const totEl = document.getElementById('sp-total-hours');
        if (totEl) totEl.textContent = fmtH(totalMs);
        const tdEl = document.getElementById('sp-today-hours');
        if (tdEl) tdEl.textContent = fmtH(todayMs);
        const pcEl = document.getElementById('sp-proj-count');
        if (pcEl) pcEl.textContent = [...new Set(sessions.map(s=>s.project))].length;

        // Bar chart — last 7 days
        const barRow = document.getElementById('sp-bar-row');
        if (barRow) {
          const dayMs = [];
          const labels = [];
          for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate()-i);
            const ds = d.toISOString().slice(0,10);
            const ms = sessions.filter(s=>s.date===ds).reduce((s,x)=>s+(x.duration||0),0);
            dayMs.push(ms); labels.push(['Su','Mo','Tu','We','Th','Fr','Sa'][d.getDay()]);
          }
          const maxMs = Math.max(...dayMs, 1);
          barRow.innerHTML = dayMs.map((ms, i) => {
            const pct = (ms / maxMs) * 100;
            return `<div class="sp-bar-col-wrap">
              <div class="sp-bar-val-lbl">${ms>0?fmtH(ms):''}</div>
              <div class="sp-bar-block" style="height:${pct}%;background:var(--blue);opacity:${labels[i]==='Su'||labels[i]==='Sa'?'0.5':'1'}"></div>
              <div class="sp-bar-day-lbl">${labels[i]}</div>
            </div>`;
          }).join('');
        }

        // Donut chart
        const donutSvg = document.getElementById('sp-donut-svg');
        const donutLegend = document.getElementById('sp-donut-legend');
        if (!donutSvg || !donutLegend) return;
        if (!sessions.length) { donutLegend.innerHTML = '<div class="sp-no-sessions">No sessions yet.<br>Start a timer to track time.</div>'; return; }

        const byProject = {};
        sessions.forEach(s => { if (!byProject[s.project]) byProject[s.project]=0; byProject[s.project]+=(s.duration||0); });
        const projEntries = Object.entries(byProject).sort((a,b)=>b[1]-a[1]).slice(0,8);
        const total = projEntries.reduce((s,[,v])=>s+v,0);

        // SVG donut
        const cx=55,cy=55,r=40,sw=18;
        const circ = 2*Math.PI*r;
        let offset = 0;
        let paths = '';
        projEntries.forEach(([name, ms], i) => {
          const frac = ms / total;
          const arc = frac * circ;
          const col = COLORS[i % COLORS.length];
          paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${col}" stroke-width="${sw}"
            stroke-dasharray="${arc.toFixed(2)} ${circ.toFixed(2)}"
            stroke-dashoffset="${(-offset*circ).toFixed(2)}"
            transform="rotate(-90 ${cx} ${cy})"/>`;
          offset += frac;
        });
        donutSvg.innerHTML = `
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#1e1e1e" stroke-width="${sw}"/>
          ${paths}
          <text x="${cx}" y="${cy+4}" text-anchor="middle" fill="#888" font-size="11" font-weight="600">${fmtH(total)}</text>`;

        // Legend
        donutLegend.innerHTML = projEntries.map(([name, ms], i) =>
          `<div class="sp-donut-row">
            <div class="sp-donut-dot" style="background:${COLORS[i%COLORS.length]}"></div>
            <div class="sp-donut-name">${name}</div>
            <div class="sp-donut-time">${fmtH(ms)}</div>
          </div>`).join('');
      }

      // Init on section open
      const sec = document.getElementById('section-side-projects');
      if (sec) {
        new MutationObserver(() => {
          if (sec.classList.contains('active')) { renderTimerList(); }
        }).observe(sec, { attributes:true, attributeFilter:['class'] });
        if (sec.classList.contains('active')) renderTimerList();
      }

      // Also hook into existing project render — update timer list when projects change
      const origSpRender = window.renderSPGrid;
      window.renderTimerList = renderTimerList;
    })(); } catch(e) { console.error('[Side Projects]', e); }

