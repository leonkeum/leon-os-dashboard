       MOVEMENT — calisthenics skills (dynamic + persisted)
    ══════════════════════════════ */
    try { (function () {
      const LS_KEY        = 'leon-cali-skills';
      const STATUS_CYCLE  = ['not-started', 'drilling', 'almost', 'unlocked'];
      const STATUS_LABELS = { 'not-started': 'Not started', drilling: 'Drilling', almost: 'Almost', unlocked: 'Unlocked' };

      const DEFAULTS = [
        { id: 'cs1', name: 'Frog Stand',      status: 'drilling',    notes: '', scary: false },
        { id: 'cs2', name: 'Frog Stand → HS', status: 'not-started', notes: '', scary: false },
        { id: 'cs3', name: 'Handstand Hold',  status: 'almost',      notes: '', scary: false },
        { id: 'cs4', name: 'Backflip',        status: 'not-started', notes: '', scary: true  },
      ];

      function load() {
        try { const v = localStorage.getItem(LS_KEY); return v ? JSON.parse(v) : JSON.parse(JSON.stringify(DEFAULTS)); }
        catch(_) { return JSON.parse(JSON.stringify(DEFAULTS)); }
      }
      function save(d) { try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch(_) {} }

      let skills = load();

      function makeCard(s) {
        const card = document.createElement('div');
        card.className    = 'skill-card';
        card.dataset.status = s.status;

        card.innerHTML = `
          <div class="skill-card-top">
            <div class="skill-name-wrap">
              <span class="skill-name">${s.name}</span>
              ${s.scary ? `<div class="skill-scary-row"><span style="font-size:11px;line-height:1">🔥</span><span class="skill-scary">scary</span></div>` : ''}
            </div>
            <div class="cs-card-actions">
              <span class="status-badge ${s.status}">${STATUS_LABELS[s.status]}</span>
              <button class="cs-del-btn" title="Remove">×</button>
            </div>
          </div>
          <div class="skill-bar-track"><div class="skill-bar-fill"></div></div>
          <textarea class="skill-notes" placeholder="Notes…">${s.notes || ''}</textarea>`;

        card.querySelector('.status-badge').addEventListener('click', () => {
          const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(s.status) + 1) % STATUS_CYCLE.length];
          s.status = next;
          save(skills);
          render();
        });

        card.querySelector('.skill-notes').addEventListener('blur', e => {
          s.notes = e.target.value;
          save(skills);
        });

        card.querySelector('.cs-del-btn').addEventListener('click', () => {
          if (!confirm(`Remove "${s.name}"?`)) return;
          skills = skills.filter(x => x.id !== s.id);
          save(skills);
          render();
        });

        return card;
      }

      function render() {
        const grid    = document.getElementById('skill-grid');
        const achGrid = document.getElementById('cs-achieved-grid');
        const achSec  = document.getElementById('cs-achieved-section');
        const countEl = document.getElementById('cs-achieved-count');
        if (!grid || !achGrid) return;

        grid.innerHTML    = '';
        achGrid.innerHTML = '';

        const active   = skills.filter(s => s.status !== 'unlocked');
        const achieved = skills.filter(s => s.status === 'unlocked');

        active.forEach(s   => grid.appendChild(makeCard(s)));
        achieved.forEach(s => achGrid.appendChild(makeCard(s)));

        if (countEl) countEl.textContent = achieved.length;
        if (achSec)  achSec.style.display = achieved.length ? '' : 'none';
      }

      /* ── Add form ── */
      const addBtn    = document.getElementById('cs-add-btn');
      const addForm   = document.getElementById('cs-add-form');
      const nameInput = document.getElementById('cs-add-name');

      addBtn?.addEventListener('click', () => {
        const open = addForm.classList.toggle('open');
        if (open) nameInput?.focus();
        addBtn.textContent = open ? '✕ Cancel' : '+ Add';
      });

      document.getElementById('cs-add-cancel')?.addEventListener('click', () => {
        addForm.classList.remove('open');
        addBtn.textContent = '+ Add';
        if (nameInput) nameInput.value = '';
      });

      function doAdd() {
        const name  = nameInput?.value.trim();
        if (!name) return;
        const scary = document.getElementById('cs-add-scary')?.checked || false;
        skills.push({ id: Date.now().toString(), name, status: 'not-started', notes: '', scary });
        save(skills);
        render();
        if (nameInput) nameInput.value = '';
        document.getElementById('cs-add-scary').checked = false;
        addForm.classList.remove('open');
        addBtn.textContent = '+ Add';
      }

      document.getElementById('cs-add-submit')?.addEventListener('click', doAdd);
      nameInput?.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });

      /* ── Achieved toggle ── */
      document.getElementById('cs-achieved-toggle')?.addEventListener('click', function() {
        const achGrid = document.getElementById('cs-achieved-grid');
        const chevron = this.querySelector('.cs-toggle-chevron');
        if (!achGrid) return;
        const open = achGrid.classList.toggle('open');
        if (chevron) chevron.style.transform = open ? 'rotate(180deg)' : '';
      });

      render();
    })(); } catch(e) { console.error('[Calisthenics Skills]', e); }

    /* ── Log session (calisthenics practice — persisted) ── */
    const LS_SESSIONS  = 'leon-skill-sessions';
    const toggleLogBtn = document.getElementById('toggle-log');
    const logForm      = document.getElementById('log-form');
    const logDateEl    = document.getElementById('log-date');

    // Load persisted sessions
    let sessions = [];
    try { sessions = JSON.parse(localStorage.getItem(LS_SESSIONS) || '[]'); } catch(_) {}

    function saveSessions() {
      try { localStorage.setItem(LS_SESSIONS, JSON.stringify(sessions)); } catch(_) {}
    }

    if (logDateEl) logDateEl.value = new Date().toISOString().slice(0, 10);

    toggleLogBtn?.addEventListener('click', () => {
      const open = logForm.classList.toggle('open');
      toggleLogBtn.textContent = open ? '✕ Cancel' : '+ Log session';
    });

    let selectedFeel = '';
    document.querySelectorAll('.feel-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.feel-btn').forEach(b => b.classList.remove('sel'));
        btn.classList.add('sel');
        selectedFeel = btn.dataset.feel;
      });
    });

    document.getElementById('log-submit')?.addEventListener('click', () => {
      const date  = logDateEl?.value;
      const skill = document.getElementById('log-skill')?.value;
      const dur   = document.getElementById('log-dur')?.value;
      const notes = document.getElementById('log-notes')?.value.trim() || '';
      if (!date || !skill || !dur) return;

      sessions.unshift({ date, skill, dur: +dur, feel: selectedFeel || 'OK', notes });
      saveSessions();
      renderSessions();

      document.getElementById('log-skill').value = '';
      document.getElementById('log-dur').value   = '';
      const notesEl = document.getElementById('log-notes');
      if (notesEl) notesEl.value = '';
      document.querySelectorAll('.feel-btn').forEach(b => b.classList.remove('sel'));
      selectedFeel = '';
      logForm.classList.remove('open');
      toggleLogBtn.textContent = '+ Log session';
    });

    function renderSessions() {
      const list  = document.getElementById('session-list');
      const noMsg = document.getElementById('no-sessions-msg');
      if (!list) return;
      list.querySelectorAll('.session-item').forEach(el => el.remove());
      if (noMsg) noMsg.style.display = sessions.length ? 'none' : '';

      sessions.slice(0, 20).forEach(s => {
        const d    = new Date(s.date + 'T00:00:00');
        const dStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const fc   = (s.feel || 'OK').toLowerCase().replace(/\s+/g, '-');
        const el   = document.createElement('div');
        el.className = 'session-item';
        el.innerHTML = `
          <div class="si-main-row">
            <span class="si-date">${dStr}</span>
            <span class="si-skill">${s.skill}</span>
            <span class="si-dur">${s.dur} min</span>
            <span class="si-feel ${fc}">${s.feel || 'OK'}</span>
          </div>
          ${s.notes ? `<div class="si-notes">${s.notes}</div>` : ''}`;
        list.appendChild(el);
      });
    }

    renderSessions(); // show persisted sessions on load

    /* ══════════════════════════════
       SCHOOL
    ══════════════════════════════ */
    try { (function () {
      const LS_KEY = 'leon-school-v2';

      const DEFAULTS = [
        { id:'def1', subject:'Inma Cabrera',      title:'Diseño y elaboración de material de comunicación', due:'2026-05-18', status:'in-progress' },
        { id:'def2', subject:'Relaciones Públicas', title:'EJERCICIO CONGRESO',                              due:'2026-05-18', status:'not-started' },
        { id:'def3', subject:'Digitalización',     title:'ACTIVIDAD PACKAGING',                             due:'2026-05-20', status:'not-started' },
        { id:'def4', subject:'Digitalización',     title:'FIDELIZACIÓN',                                    due:'2026-05-20', status:'not-started' },
        { id:'def5', subject:'Inglés (Dafne)',     title:'Written exam 2 — Upper Intermediate',             due:'2026-06-01', status:'not-started', type:'exam' },
        { id:'def6', subject:'Inglés (Dafne)',     title:'Listening test 4 — Upper Intermediate',           due:'2026-06-01', status:'not-started', type:'exam' },
      ];

      let assignments;
      try {
        const raw = localStorage.getItem(LS_KEY);
        assignments = raw ? JSON.parse(raw) : DEFAULTS.slice();
      } catch (_) {
        assignments = DEFAULTS.slice();
      }

      function save() {
        try { localStorage.setItem(LS_KEY, JSON.stringify(assignments)); } catch (_) {}
      }

      // Hash-based subject colour from a fixed palette
      const PALETTE = [
        { bg: 'rgba(201,160,50,0.14)',  fg: '#c9a032' },
        { bg: 'rgba(79,126,201,0.14)',  fg: '#4f7ec9' },
        { bg: 'rgba(150,110,201,0.14)', fg: '#9b7ac9' },
        { bg: 'rgba(77,170,125,0.14)',  fg: '#4daa7d' },
        { bg: 'rgba(201,96,79,0.14)',   fg: '#c9604f' },
        { bg: 'rgba(79,170,201,0.14)',  fg: '#4faac9' },
      ];

      function subjectColor(name) {
        let h = 0;
        for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
        return PALETTE[h % PALETTE.length];
      }

      function daysUntil(due) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        return (new Date(due + 'T00:00:00') - today) / 86400000;
      }

      function isUrgent(a)      { return a.status !== 'done' && daysUntil(a.due) <= 3; }
      function isDueThisWeek(a) { const d = daysUntil(a.due); return a.status !== 'done' && d >= 0 && d <= 7; }

      function fmtDue(due) {
        return new Date(due + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
      }

      function sortedAssignments() {
        const active = assignments.filter(a => a.status !== 'done').sort((a, b) => a.due < b.due ? -1 : 1);
        const done   = assignments.filter(a => a.status === 'done').sort((a, b) => a.due < b.due ? -1 : 1);
        return [...active, ...done];
      }

      const STATUS_LABELS = { 'not-started': 'Not started', 'in-progress': 'In progress', 'done': 'Done' };

      function render() {
        document.getElementById('sc-total').textContent = assignments.length;
        document.getElementById('sc-week').textContent  = assignments.filter(isDueThisWeek).length;
        document.getElementById('sc-done').textContent  = assignments.filter(a => a.status === 'done').length;

        const wrap = document.getElementById('assignments-wrap');
        wrap.innerHTML = '';

        if (!assignments.length) {
          wrap.innerHTML = '<div class="no-assignments">No assignments yet.</div>';
          return;
        }

        sortedAssignments().forEach(a => {
          const col   = subjectColor(a.subject);
          const card  = document.createElement('div');
          const urgent = isUrgent(a);
          const isDone = a.status === 'done';

          card.className = `assign-card${urgent ? ' urgent' : ''}${isDone ? ' done' : ''}`;

          const opts = ['not-started', 'in-progress', 'done']
            .map(s => `<option value="${s}"${a.status === s ? ' selected' : ''}>${STATUS_LABELS[s]}</option>`)
            .join('');

          card.innerHTML = `
            <span class="assign-subject" style="background:${col.bg};color:${col.fg}">${a.subject}</span>
            ${a.type==='exam'?'<span class="assign-exam-badge">EXAM</span>':''}
            <span class="assign-title">${a.title}</span>
            <span class="assign-due">${fmtDue(a.due)}</span>
            <select class="assign-status-sel" data-id="${a.id}">${opts}</select>`;

          wrap.appendChild(card);
        });

        wrap.querySelectorAll('.assign-status-sel').forEach(sel => {
          sel.addEventListener('change', () => {
            const a = assignments.find(x => x.id === sel.dataset.id);
            if (a) { a.status = sel.value; save(); render(); }
          });
        });
      }

      // Add assignment form
      const toggleBtn  = document.getElementById('toggle-assign');
      const assignForm = document.getElementById('assign-form');

      toggleBtn.addEventListener('click', () => {
        const open = assignForm.classList.toggle('open');
        toggleBtn.textContent = open ? '✕ Cancel' : '+ Add assignment';
        if (open) document.getElementById('as-due').value = new Date().toISOString().slice(0, 10);
      });

      document.getElementById('as-submit').addEventListener('click', () => {
        const subject = document.getElementById('as-subject').value.trim();
        const title   = document.getElementById('as-title').value.trim();
        const due     = document.getElementById('as-due').value;
        const status  = document.getElementById('as-status').value;
        if (!subject || !title || !due) return;

        assignments.push({ id: Date.now().toString(), subject, title, due, status });
        save();
        render();

        document.getElementById('as-subject').value = '';
        document.getElementById('as-title').value   = '';
        document.getElementById('as-due').value     = '';
        document.getElementById('as-status').value  = 'not-started';
        assignForm.classList.remove('open');
        toggleBtn.textContent = '+ Add assignment';
      });

      render();
    })(); } catch(e) { console.error('[School]', e); }

    /* ══════════════════════════════
       @2.CHICOS  (handled by initChicosSection at bottom of file)
    ══════════════════════════════ */
    /* @2.Chicos: see initChicosSection() at bottom of file */
