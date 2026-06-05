    try { (function () {
      const LS_KEY    = 'leon-life-goals';
      const LS_STREAK = 'leon-first-opened';

      /* ── Streak: days since first open ── */
      const todayStr = new Date().toISOString().slice(0, 10);
      let firstOpened = localStorage.getItem(LS_STREAK);
      if (!firstOpened) { firstOpened = todayStr; localStorage.setItem(LS_STREAK, todayStr); }
      const streakDays = Math.max(0, Math.floor(
        (new Date(todayStr) - new Date(firstOpened)) / 86400000
      ));

      /* ── Defaults ── */
      const DEFAULTS = [
        { id: 'lg1', title: 'Finish Ciclo Superior at Euroaula',    category: 'Career',   due: '2026-06-30', progress: 75, notes: '' },
        { id: 'lg2', title: 'Grow @2.chicos to 15k followers',      category: 'Career',   due: '2026-12-31', progress: 56, notes: '' },
        { id: 'lg3', title: 'Land first paid brand deal',           category: 'Money',    due: '2026-08-31', progress: 20, notes: '' },
        { id: 'lg4', title: 'Master Frog Stand to Handstand',       category: 'Health',   due: '2026-09-30', progress: 15, notes: '' },
        { id: 'lg5', title: 'Save €1,000',                          category: 'Money',    due: '2026-10-31', progress: 30, notes: '' },
      ];

      function ls() {
        const yearStart = new Date().getFullYear() + '-01-01';
        try {
          const v   = localStorage.getItem(LS_KEY);
          const raw = v ? JSON.parse(v) : JSON.parse(JSON.stringify(DEFAULTS));
          return raw.map(g => {
            /* if startDate was missing, this is pre-auto-progress data:
               assign Jan 1 as start and clear manualProgress so auto drives it */
            if (!g.startDate) {
              g.startDate      = yearStart;
              g.manualProgress = null;   /* wipe old hardcoded value → auto takes over */
            }
            if (g.manualProgress === undefined) g.manualProgress = null;
            return g;
          });
        } catch (_) {
          return JSON.parse(JSON.stringify(DEFAULTS)).map(g =>
            ({ ...g, startDate: yearStart, manualProgress: null })
          );
        }
      }
      function lsSave(v) { try { localStorage.setItem(LS_KEY, JSON.stringify(v)); } catch (_) {} }

      /* ── Auto-progress helpers ── */
      function autoProgress(g) {
        if (!g.startDate) return null;
        const start = new Date(g.startDate + 'T00:00:00');
        const due   = new Date(g.due       + 'T00:00:00');
        const today = new Date(); today.setHours(0,0,0,0);
        const total = due - start;
        if (total <= 0) return 100;
        return Math.min(100, Math.max(0, Math.round((today - start) / total * 100)));
      }
      function displayProgress(g) {
        const m = g.manualProgress;
        if (m !== null && m !== undefined) return m;
        const a = autoProgress(g);
        return a !== null ? a : (g.progress || 0);
      }

      let goals = ls();

      const CAT = {
        Money:    { bg: 'rgba(77,170,125,0.14)',  fg: '#4daa7d' },
        Health:   { bg: 'rgba(201,96,79,0.14)',   fg: '#c9604f' },
        Career:   { bg: 'rgba(79,126,201,0.14)',  fg: '#4f7ec9' },
        Personal: { bg: 'rgba(150,110,201,0.14)', fg: '#9b7ac9' },
      };

      function catColor(c) { return CAT[c] || { bg: '#1a1a1a', fg: '#555' }; }

      function daysLeft(due) {
        const t = new Date(); t.setHours(0,0,0,0);
        return Math.round((new Date(due + 'T00:00:00') - t) / 86400000);
      }

      function fmtDue(due) {
        return new Date(due + 'T00:00:00').toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
      }

      function daysTag(n) {
        if (n < 0)  return { text: Math.abs(n) + 'd overdue', cls: 'red' };
        if (n === 0) return { text: 'Due today', cls: 'red' };
        if (n <= 14) return { text: n + 'd left', cls: 'amber' };
        return { text: n + 'd left', cls: 'muted' };
      }

      function setSliderBg(el, val) {
        el.style.background =
          `linear-gradient(to right,#4daa7d 0%,#4daa7d ${val}%,#1e1e1e ${val}%)`;
      }

      function render() {
        /* streak counter */
        const streakEl = document.getElementById('lg-streak');
        if (streakEl) streakEl.textContent = streakDays;

        const grid = document.getElementById('goals-grid');
        if (!grid) return;
        grid.innerHTML = '';

        [...goals]
          .sort((a, b) => a.due < b.due ? -1 : 1)
          .forEach(g => {
            const col   = catColor(g.category);
            const dl    = daysLeft(g.due);
            const tag   = daysTag(dl);
            const autoP = autoProgress(g);           /* null if no startDate */
            const dispP = displayProgress(g);        /* what the slider shows */

            const card = document.createElement('div');
            card.className = 'goal-card';
            card.innerHTML = `
              <div>
                <div class="goal-title-row">
                  <span class="goal-title">${g.title}</span>
                  <div class="goal-card-actions">
                    <button class="goal-edit-btn" title="Edit deadline">✎</button>
                    <button class="goal-del" title="Delete">×</button>
                  </div>
                </div>
                <div class="goal-meta-row" style="margin-top:6px">
                  <span class="goal-cat" style="background:${col.bg};color:${col.fg}">${g.category}</span>
                  <span class="goal-due" id="due-${g.id}">${fmtDue(g.due)}</span>
                  <span class="goal-days goal-days-${tag.cls}" id="daytag-${g.id}">${tag.text}</span>
                </div>
                <div class="goal-edit-form" id="edit-form-${g.id}">
                  <span class="goal-edit-label">New deadline</span>
                  <input type="date" class="goal-edit-date" value="${g.due}">
                  <button class="goal-edit-save">Save</button>
                  <button class="goal-edit-cancel">Cancel</button>
                </div>
              </div>
              <div class="goal-slider-row">
                <div class="goal-slider-wrap">
                  ${autoP !== null ? `<div class="goal-auto-tick" style="left:${autoP}%" title="Expected: ${autoP}%"></div>` : ''}
                  <input type="range" class="goal-progress" min="0" max="100" value="${dispP}">
                </div>
                <span class="goal-pct" id="pct-${g.id}">${dispP}%</span>
              </div>
              <textarea class="goal-notes" data-id="${g.id}" placeholder="Notes…">${g.notes || ''}</textarea>`;

            grid.appendChild(card);

            const slider  = card.querySelector('.goal-progress');
            const editBtn = card.querySelector('.goal-edit-btn');
            const delBtn  = card.querySelector('.goal-del');
            const editForm = card.querySelector('.goal-edit-form');
            const editDate = card.querySelector('.goal-edit-date');
            setSliderBg(slider, dispP);

            /* ── Slider: manual override ── */
            slider.addEventListener('input', () => {
              const v = +slider.value;
              setSliderBg(slider, v);
              const pctEl = document.getElementById(`pct-${g.id}`);
              if (pctEl) pctEl.textContent = v + '%';
              const goal = goals.find(x => x.id === g.id);
              if (goal) { goal.manualProgress = v; goal.progress = v; lsSave(goals); }
            });

            /* ── Edit deadline ── */
            editBtn.addEventListener('click', () => {
              const open = editForm.classList.toggle('open');
              editBtn.classList.toggle('active', open);
              if (open) editDate.focus();
            });
            editForm.querySelector('.goal-edit-cancel').addEventListener('click', () => {
              editForm.classList.remove('open');
              editBtn.classList.remove('active');
            });
            editForm.querySelector('.goal-edit-save').addEventListener('click', () => {
              const newDue = editDate.value;
              if (!newDue) return;
              const goal = goals.find(x => x.id === g.id);
              if (!goal) return;
              goal.due = newDue;
              /* clear manual override so auto-progress recalculates from new deadline */
              goal.manualProgress = null;
              if (!goal.startDate) goal.startDate = new Date().getFullYear() + '-01-01';
              lsSave(goals);
              render();
            });

            /* ── Notes ── */
            card.querySelector('.goal-notes').addEventListener('blur', e => {
              const goal = goals.find(x => x.id === g.id);
              if (goal) { goal.notes = e.target.value; lsSave(goals); }
            });

            /* ── Delete ── */
            delBtn.addEventListener('click', () => {
              goals = goals.filter(x => x.id !== g.id);
              lsSave(goals);
              render();
            });
          });
      }

      /* ── Add form ── */
      const toggleBtn = document.getElementById('lg-toggle');
      const lgForm    = document.getElementById('lg-form');

      toggleBtn.addEventListener('click', () => {
        const open = lgForm.classList.toggle('open');
        toggleBtn.textContent = open ? '✕ Cancel' : '+ Add goal';
      });

      document.getElementById('lg-submit').addEventListener('click', () => {
        const title    = document.getElementById('lg-title').value.trim();
        const category = document.getElementById('lg-category').value;
        const due      = document.getElementById('lg-date').value;
        const progress = Math.min(100, Math.max(0,
          parseInt(document.getElementById('lg-progress').value, 10) || 0
        ));
        if (!title || !due) return;

        goals.push({ id: Date.now().toString(), title, category, due,
          startDate: todayStr, manualProgress: null, progress: 0, notes: '' });
        lsSave(goals);
        render();

        document.getElementById('lg-title').value    = '';
        document.getElementById('lg-date').value     = '';
        document.getElementById('lg-progress').value = '';
        lgForm.classList.remove('open');
        toggleBtn.textContent = '+ Add goal';
      });

      /* ── Lazy init ── */
      const sec = document.getElementById('section-life-goals');
      let inited = false;
      if (sec) {
        new MutationObserver(() => {
          if (sec.classList.contains('active') && !inited) { inited = true; render(); }
        }).observe(sec, { attributes: true, attributeFilter: ['class'] });
        if (sec.classList.contains('active')) { inited = true; render(); }
      }
    })(); } catch(e) { console.error('[Life Goals]', e); }