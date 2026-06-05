
    /* ══════════════════════════════
       TODAY DASHBOARD
    ══════════════════════════════ */
    try { (function () {
      const TODAY = new Date().toISOString().slice(0, 10);

      /* ── Helpers: read each section's data ── */
      function getGIFD() {
        try {
          const entries = JSON.parse(localStorage.getItem('los-gifd-current') || '[]');
          return entries.find(e => e.date === TODAY) || null;
        } catch(_) { return null; }
      }

      function getWorkout() {
        try {
          const d = JSON.parse(localStorage.getItem('leon-workout-v3') || '{}');
          return (d.sessions || []).find(s => s.date === TODAY) || null;
        } catch(_) { return null; }
      }

      function getSleep() {
        // Read from v2 first (Sleep OS), fall back to v1
        try {
          const d2 = JSON.parse(localStorage.getItem('leon-sleep-v2') || '{"entries":[]}');
          const entry = d2.entries.find(e => e.date === TODAY);
          if (entry) return { date: TODAY, hours: entry.actual, quality: entry.quality, bedtime: entry.bedtime, waketime: entry.waketime };
        } catch(_) {}
        try {
          const d = JSON.parse(localStorage.getItem('leon-sleep-v1') || '{}');
          return d.date === TODAY ? d : null;
        } catch(_) { return null; }
      }

      function getNutrition() {
        try {
          const d = JSON.parse(localStorage.getItem('leon-nutrition-v2') || '{}');
          return d[TODAY] || null;
        } catch(_) { return null; }
      }

      function getCalendar() {
        try {
          const blocks = JSON.parse(localStorage.getItem('leon-calendar-v2') || 'null');
          if (!blocks) return [];
          const dayMap = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
          const todayName = dayMap[new Date().getDay()];
          return blocks.filter(b =>
            (b.date === TODAY) || (!b.date && b.day === todayName)
          ).sort((a, b) => (a.start || '').localeCompare(b.start || ''));
        } catch(_) { return []; }
      }

      /* ── Render ── */
      function render() {
        const gifd  = getGIFD();
        const wo    = getWorkout();
        const sleep = getSleep();
        const nutr  = getNutrition();

        // Score sync
        const score = parseInt(document.getElementById('daily-score-badge')?.dataset.score || '0', 10);
        const scoreBig  = document.getElementById('today-score-big');
        const scoreFill = document.getElementById('today-progress-fill');
        const scoreSub  = document.getElementById('today-score-sub');

        if (scoreBig) {
          const cls = score >= 70 ? 'green' : score >= 35 ? 'amber' : score > 0 ? 'red' : 'zero';
          scoreBig.textContent = score;
          scoreBig.className = `today-score-num ${cls}`;
        }
        if (scoreFill) {
          const pct = Math.min(100, score);
          const col = score >= 70 ? 'var(--green)' : score >= 35 ? 'var(--amber)' : 'var(--red)';
          scoreFill.style.width = pct + '%';
          scoreFill.style.background = pct > 0 ? col : '#1a1a1a';
        }

        // Score sub-text
        const parts = [];
        if (gifd)  parts.push('GIFD ✓');
        if (wo)    parts.push('Workout ✓');
        if (sleep) parts.push('Sleep ✓');
        if (nutr)  parts.push('Nutrition ✓');
        if (scoreSub) {
          scoreSub.textContent = parts.length
            ? parts.join(' · ')
            : 'Start logging to build your score.';
        }

        // GIFD card
        const gifdStatus = document.getElementById('today-gifd-status');
        const gifdBody   = document.getElementById('today-gifd-body');
        if (gifd) {
          const good = Object.values(gifd.good || {}).filter(Boolean).length;
          const bad  = Object.values(gifd.bad  || {}).filter(Boolean).length;
          const sc   = good - bad;
          if (gifdStatus) { gifdStatus.textContent = `Score ${sc > 0 ? '+' : ''}${sc}`; gifdStatus.className = `today-card-status ${sc > 0 ? 'done' : sc < 0 ? 'partial' : 'partial'}`; }
          if (gifdBody)   {
            const desc = gifd.desc ? `"${gifd.desc.slice(0, 80)}${gifd.desc.length > 80 ? '…' : ''}"` : '';
            gifdBody.innerHTML = [
              desc ? `<em>${desc}</em>` : '',
              good || bad ? `<strong>${good} good · ${bad} bad habit${bad !== 1 ? 's' : ''}</strong>` : ''
            ].filter(Boolean).join('<br>') || 'Entry started.';
          }
        } else {
          if (gifdStatus) { gifdStatus.textContent = 'Not logged'; gifdStatus.className = 'today-card-status empty'; }
          if (gifdBody)   gifdBody.innerHTML = 'Nothing logged yet. Write how today went.';
        }

        // Workout card
        const woStatus = document.getElementById('today-workout-status');
        const woBody   = document.getElementById('today-workout-body');
        if (wo && wo.sets && wo.sets.length) {
          const groups = {};
          wo.sets.forEach(s => { if (!groups[s.exercise]) groups[s.exercise] = []; groups[s.exercise].push(s); });
          const names = Object.keys(groups);
          if (woStatus) { woStatus.textContent = `${wo.sets.length} set${wo.sets.length !== 1 ? 's' : ''}`; woStatus.className = 'today-card-status done'; }
          if (woBody)   woBody.innerHTML = names.slice(0, 3).map(ex => {
            const best = groups[ex].reduce((b, s) => s.kg > b.kg ? s : b, groups[ex][0]);
            return `<strong>${ex}</strong> <em>${best.kg}kg × ${best.reps}</em>`;
          }).join('<br>') + (names.length > 3 ? `<br><em>+${names.length - 3} more</em>` : '');
        } else {
          if (woStatus) { woStatus.textContent = 'Not logged'; woStatus.className = 'today-card-status empty'; }
          if (woBody)   woBody.innerHTML = 'No sets logged. Open Movement to start.';
        }

        // Sleep card
        const sleepStatus  = document.getElementById('today-sleep-status');
        const sleepBody    = document.getElementById('today-sleep-body');
        const sleepQL      = document.getElementById('today-sleep-quicklog');
        if (sleep && sleep.hours) {
          const hrs = +sleep.hours.toFixed(1);
          const col = hrs >= 7 ? 'var(--green)' : hrs >= 6 ? 'var(--amber)' : 'var(--red)';
          if (sleepStatus) { sleepStatus.textContent = `${hrs}h`; sleepStatus.className = 'today-card-status done'; sleepStatus.style.color = col; }
          if (sleepBody)   sleepBody.innerHTML = `<strong style="color:${col}">${hrs}h</strong> asleep${sleep.bedtime ? ` · ${sleep.bedtime}→${sleep.waketime}` : ''}`;
          if (sleepQL)     sleepQL.style.display = 'none';
        } else {
          if (sleepStatus) { sleepStatus.textContent = 'Not logged'; sleepStatus.className = 'today-card-status empty'; sleepStatus.style.color = ''; }
          if (sleepBody)   sleepBody.innerHTML = 'Log last night below:';
          if (sleepQL)     sleepQL.style.display = '';
        }

        // Nutrition / Protein card
        const nutrStatus = document.getElementById('today-nutrition-status');
        const nutrBody   = document.getElementById('today-nutrition-body');
        const proteinQL  = document.getElementById('today-protein-ql');
        const proteinGoal = (() => { try { return JSON.parse(localStorage.getItem('leon-macro-goals')||'{}').protein || 160; } catch(_) { return 160; } })();
        if (nutr && nutr.meals && nutr.meals.length) {
          const t    = nutr.totals || {};
          const prot = Math.round(t.protein || 0);
          const pct  = Math.min(100, Math.round((prot / proteinGoal) * 100));
          const col  = pct >= 100 ? 'var(--green)' : pct >= 60 ? 'var(--amber)' : 'var(--red)';
          if (nutrStatus) { nutrStatus.textContent = `${prot}g protein`; nutrStatus.className = `today-card-status ${pct >= 100 ? 'done' : 'partial'}`; }
          if (nutrBody)   nutrBody.innerHTML = `<strong style="color:${col}">${prot}g</strong> / ${proteinGoal}g protein · ${Math.round(t.calories||0)} kcal`;
          if (proteinQL && pct >= 100) proteinQL.style.opacity = '0.4';
        } else {
          if (nutrStatus) { nutrStatus.textContent = 'Not logged'; nutrStatus.className = 'today-card-status empty'; }
          if (nutrBody)   nutrBody.innerHTML = `Hit ${proteinGoal}g protein today — quick-add below:`;
          if (proteinQL)  proteinQL.style.opacity = '1';
        }

        // Schedule strip
        const schedWrap  = document.getElementById('today-schedule-items');
        const schedEmpty = document.getElementById('today-schedule-empty');
        if (schedWrap) {
          schedWrap.innerHTML = '';
          const events = getCalendar();
          if (!events.length) {
            const emp = document.createElement('div');
            emp.className = 'today-schedule-empty';
            emp.textContent = 'No events today.';
            schedWrap.appendChild(emp);
          } else {
            const now = new Date().getHours() * 60 + new Date().getMinutes();
            events.slice(0, 6).forEach(ev => {
              const [h, m] = (ev.start || '00:00').split(':').map(Number);
              const evMin = h * 60 + m;
              const past  = evMin < now - 60;
              const row   = document.createElement('div');
              row.className = 'today-sched-item';
              const [eh, em2] = (ev.end || '00:00').split(':').map(Number);
              const dur = (() => {
                let d = (eh * 60 + em2) - evMin;
                if (d <= 0) d += 1440;
                const h2 = Math.floor(d / 60), m2 = d % 60;
                return m2 ? `${h2}h${m2}m` : `${h2}h`;
              })();
              row.innerHTML = `
                <div class="today-sched-dot ${ev.color || 'gray'}"></div>
                <span class="today-sched-time" style="${past ? 'opacity:0.4' : ''}">${ev.start}–${ev.end}</span>
                <span class="today-sched-label" style="${past ? 'opacity:0.4;text-decoration:line-through' : ''}">${ev.label}</span>
                <span class="today-sched-dur">${dur}</span>`;
              schedWrap.appendChild(row);
            });
          }
        }
      }

      // Expose so updateDailyScore() calls refresh today too
      window.refreshTodayDash = render;

      // Today sleep quick-log save button
      document.getElementById('today-sleep-save')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const bed  = document.getElementById('today-bed')?.value;
        const wake = document.getElementById('today-wake')?.value;
        if (!bed || !wake) return;
        window.saveSleepQuick?.(bed, wake);
        render();
        const btn = e.target;
        btn.textContent = '✓'; setTimeout(() => { btn.textContent = 'Save'; }, 1500);
      });

      // Lazy init when Today section becomes active
      const sec = document.getElementById('section-today');
      if (sec) {
        new MutationObserver(() => {
          if (sec.classList.contains('active')) render();
        }).observe(sec, { attributes: true, attributeFilter: ['class'] });
        if (sec.classList.contains('active')) render();
      }
    })();

    /* ══════════════════════════════
       PHASE 9a — EDITABLE MACRO GOALS
    ══════════════════════════════ */
    (function () {
      const LS_GOALS = 'leon-macro-goals';
      const DEF      = { protein: 160, carbs: 250, fat: 80 };

      function loadGoals() {
        try { return { ...DEF, ...JSON.parse(localStorage.getItem(LS_GOALS) || '{}') }; } catch(_) { return DEF; }
      }
      function saveGoals(g) { try { localStorage.setItem(LS_GOALS, JSON.stringify(g)); } catch(_) {} }

      // Replace the static text nodes in the nutrition totals with editable spans
      function makeEditable(numId, key, goals) {
        const el = document.getElementById(numId);
        if (!el) return;
        el.textContent = `0/${goals[key]}g`;
        // Make the goal part (after /) clickable to edit
        el.title = 'Click goal number to edit';
        el.style.cursor = 'default';
      }

      const goals = loadGoals();

      // Patch into the existing nutr-nums-* elements — make them show current goals
      ['protein','carbs','fat'].forEach(k => {
        const numsEl = document.getElementById(`nutr-nums-${k}`);
        if (!numsEl) return;
        // Re-render with current goal
        const cur = numsEl.textContent.split('/')[0] || '0';
        numsEl.innerHTML = `<span>${cur}</span>/<span class="goal-edit" data-key="${k}" contenteditable="true" title="Click to edit goal" style="cursor:text;outline:none">${goals[k]}</span>g`;
        const goalSpan = numsEl.querySelector('.goal-edit');
        goalSpan.addEventListener('focus', () => {
          const r = document.createRange(); r.selectNodeContents(goalSpan);
          window.getSelection().removeAllRanges(); window.getSelection().addRange(r);
        });
        goalSpan.addEventListener('blur', () => {
          const v = parseInt(goalSpan.textContent, 10);
          if (!isNaN(v) && v > 0) {
            goals[k] = v; saveGoals(goals);
            // Recalculate bar
            const fill = document.getElementById(`nutr-bar-${k}`);
            const curVal = parseFloat(numsEl.querySelector('span').textContent) || 0;
            if (fill) fill.style.width = Math.min(100, (curVal / v) * 100) + '%';
          } else {
            goalSpan.textContent = goals[k];
          }
        });
        goalSpan.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); goalSpan.blur(); }
          if (e.key === 'Escape') { goalSpan.textContent = goals[k]; goalSpan.blur(); }
        });
      });
    })();

    /* ══════════════════════════════
       PHASE 9b — TOUCH SIDEBAR FIX
    ══════════════════════════════ */
    (function () {
      // On touch-only devices, the CSS :hover never fires persistently.
      // Add a tap-to-toggle for the sidebar logo dot.
      const sidebar = document.querySelector('.sidebar');
      const logoDot = document.querySelector('.sidebar-logo-dot');
      if (!sidebar || !logoDot) return;

      // Only activate for touch devices
      if (window.matchMedia('(hover: none)').matches) {
        logoDot.style.cursor = 'pointer';
        logoDot.title = 'Tap to expand/collapse sidebar';
        let expanded = false;
        logoDot.addEventListener('click', e => {
          e.stopPropagation();
          expanded = !expanded;
          sidebar.style.width      = expanded ? '220px' : '';
          sidebar.style.transition = 'width 0.28s cubic-bezier(0.4,0,0.2,1)';
          // Show/hide text
          sidebar.querySelectorAll('.nav-item-text, .nav-section-label, .sidebar-logo-text, .streak-row-text, .streak-row-num').forEach(el => {
            el.style.opacity = expanded ? '1' : '';
          });
          sidebar.querySelectorAll('.nav-item').forEach(el => {
            el.style.justifyContent = expanded ? 'flex-start' : '';
            el.style.gap            = expanded ? '9px' : '';
            el.style.padding        = expanded ? '10px 10px' : '';
          });
        });
      }
    })();

    /* ══════════════════════════════
       PHASE 9c — DATA EXPORT
    ══════════════════════════════ */
    window.exportLeonData = function () {
      const data = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('leon-') || k.startsWith('los-') || k === 'anthropic_api_key' && false)) {
          try { data[k] = JSON.parse(localStorage.getItem(k)); } catch(_) { data[k] = localStorage.getItem(k); }
        }
      }
      data._exported = new Date().toISOString();
      data._version  = '6.0';
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `leon-os-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    };

    /* Hook updateDailyScore to also refresh Today dashboard + progress bar */
    const _origUpdateScore = window.updateDailyScore;
    window.updateDailyScore = function () {
      _origUpdateScore?.();
      window.refreshTodayDash?.();
      window.syncTodayProgress?.();
    };

    /* ══════════════════════════════
       THEME TOGGLE
    ══════════════════════════════ */
    (function () {
      const LS = 'leon-theme-v1';
      const btn = document.getElementById('theme-toggle-btn');
      let theme = localStorage.getItem(LS) || 'dark';

      function apply(t) {
        document.body.classList.toggle('light', t === 'light');
        if (btn) btn.textContent = t === 'light' ? '🌙' : '☀️';
        theme = t;
        try { localStorage.setItem(LS, t); } catch(_) {}
      }

      apply(theme);
      btn?.addEventListener('click', () => apply(theme === 'light' ? 'dark' : 'light'));
    })();

    /* ══════════════════════════════
       TODAY — DAY STRIP + PROGRESS
    ══════════════════════════════ */
    (function () {
      const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

      // Always use LOCAL dates — avoids UTC off-by-one in UTC+1/+2 timezones
      function localStr(d) {
        return d.getFullYear() + '-' +
          String(d.getMonth()+1).padStart(2,'0') + '-' +
          String(d.getDate()).padStart(2,'0');
      }

      // Check what was logged on a given YYYY-MM-DD string
      function dayStatus(ds) {
        try {
          const gifd = JSON.parse(localStorage.getItem('los-gifd-current')||'[]').find(x=>x.date===ds);
          const gifdDone = !!(gifd && (gifd.desc || Object.values(gifd.good||{}).some(Boolean)));
          const wo   = JSON.parse(localStorage.getItem('leon-workout-v3')||'{}');
          const woDone = !!((wo.sessions||[]).find(x=>x.date===ds)?.sets?.length);
          const nutr = JSON.parse(localStorage.getItem('leon-nutrition-v2')||'{}');
          const nutrDone = !!(nutr.date===ds && nutr.meals?.length);
          return { gifd:gifdDone, wo:woDone, nutr:nutrDone };
        } catch(_) { return {}; }
      }

      function buildStrip() {
        const strip = document.getElementById('today-day-strip');
        if (!strip) return;
        const today = new Date();
        const todayStr = localStr(today);
        const dates = [];
        for (let i = -3; i <= 3; i++) {
          const d = new Date(today); d.setDate(today.getDate() + i); dates.push(d);
        }
        strip.innerHTML = dates.map(d => {
          const ds = localStr(d);
          const isToday = ds === todayStr;
          const name = DAYS[d.getDay()].slice(0,3).toUpperCase();
          const num  = d.getDate();
          // Only check status for today and past days
          const st = (ds <= todayStr) ? dayStatus(ds) : {};
          const dot = (done) => `<div class="day-dot${done?' done':''}"></div>`;
          const dots = dot(st.gifd) + dot(st.wo) + dot(st.nutr);
          return `<div class="day-pill${isToday?' today selected':''}" data-date="${ds}">
            <span class="day-pill-name">${name}</span>
            <span class="day-pill-num">${num}</span>
            <div class="day-pill-dots">${dots}</div>
          </div>`;
        }).join('');
        strip.querySelectorAll('.day-pill').forEach(p => {
          p.addEventListener('click', () => {
            strip.querySelectorAll('.day-pill').forEach(x => x.classList.remove('selected'));
            p.classList.add('selected');
          });
        });
      }
      buildStrip();

      // Category pill interaction — actually filters today cards
      const CAT_MAP = { gifd:'today-card-gifd', workout:'today-card-workout', sleep:'today-card-sleep', nutrition:'today-card-nutrition' };
      document.querySelectorAll('.today-cat-pill').forEach(p => {
        p.addEventListener('click', () => {
          document.querySelectorAll('.today-cat-pill').forEach(x => x.classList.remove('active'));
          p.classList.add('active');
          const cat = p.dataset.cat;
          const cards = document.querySelectorAll('.today-card');
          const sched = document.querySelector('.today-schedule-wrap');
          if (cat === 'all') {
            cards.forEach(c => c.style.display = '');
            if (sched) sched.style.display = '';
          } else if (cat === 'schedule') {
            cards.forEach(c => c.style.display = 'none');
            if (sched) sched.style.display = '';
          } else {
            const showId = CAT_MAP[cat];
            cards.forEach(c => { c.style.display = (showId && c.id === showId) ? '' : 'none'; });
            if (sched) sched.style.display = 'none';
          }
        });
      });

      // Progress bar — exposed so score hook can call it (no more polling)
      window.syncTodayProgress = function () {
        const score = parseInt(document.getElementById('daily-score-badge')?.dataset.score || '0', 10);
        const pct = Math.min(100, score);
        const fill = document.getElementById('tdp-fill');
        const pctEl = document.getElementById('tdp-pct');
        if (fill) { fill.style.width = pct + '%'; fill.style.background = pct >= 70 ? 'var(--green)' : pct >= 35 ? 'var(--amber)' : 'var(--blue)'; }
        if (pctEl) pctEl.textContent = pct + '%';
        // Refresh dot status too
        buildStrip();
      };
      setTimeout(window.syncTodayProgress, 800);
    })(); } catch(e) { console.error('[Today Dashboard]', e); }


    /* ══════════════════════════════
       NOTES NOTEBOOK
    ══════════════════════════════ */
    try { (function () {
      const LS_NOTES = 'leon-notes-pages';
      const DEFAULT_PAGE = () => ({ id: Date.now().toString(), title: '', content: '' });

      function load() {
        try { const v = localStorage.getItem(LS_NOTES); return v ? JSON.parse(v) : [DEFAULT_PAGE()]; }
        catch(_) { return [DEFAULT_PAGE()]; }
      }

      function save(pages) {
        try { localStorage.setItem(LS_NOTES, JSON.stringify(pages)); } catch(_) {}
      }

      let pages = load();
      let idx = 0;

      const counterEl = document.getElementById('notes-counter');
      const titleEl   = document.getElementById('notes-title');
      const bodyEl    = document.getElementById('notes-body');
      const prevBtn   = document.getElementById('notes-prev');
      const nextBtn   = document.getElementById('notes-next');
      const addBtn    = document.getElementById('notes-add');
      const delBtn    = document.getElementById('notes-delete');

      if (!counterEl || !titleEl || !bodyEl) return;

      function clamp() { idx = Math.max(0, Math.min(idx, pages.length - 1)); }

      function render() {
        clamp();
        const p = pages[idx];
        titleEl.value = p.title;
        bodyEl.value  = p.content;
        counterEl.textContent = `${idx + 1} / ${pages.length}`;
        if (delBtn) delBtn.style.opacity = pages.length > 1 ? '1' : '0.3';
      }

      function flush() {
        pages[idx].title   = titleEl.value;
        pages[idx].content = bodyEl.value;
        save(pages);
      }

      titleEl.addEventListener('input', flush);
      bodyEl.addEventListener('input',  flush);

      prevBtn?.addEventListener('click', () => { flush(); idx--; render(); });
      nextBtn?.addEventListener('click', () => { flush(); idx++; render(); });

      addBtn?.addEventListener('click', () => {
        flush();
        const p = DEFAULT_PAGE();
        p.title = `Page ${pages.length + 1}`;
        pages.push(p);
        idx = pages.length - 1;
        save(pages);
        render();
        titleEl.focus();
      });

      delBtn?.addEventListener('click', () => {
        if (pages.length <= 1) return;
        pages.splice(idx, 1);
        idx = Math.max(0, idx - 1);
        save(pages);
        render();
      });

      render();
    })(); } catch(e) { console.error('[Notes]', e); }


    /* ══════════════════════════════
       TO-DO LIST
    ══════════════════════════════ */
    try { (function () {
      const LS_TODO = 'leon-todo-items';

      function load()     { try { return JSON.parse(localStorage.getItem(LS_TODO) || '[]'); } catch(_) { return []; } }
      function save(arr)  { try { localStorage.setItem(LS_TODO, JSON.stringify(arr)); } catch(_) {} }

      let items = load();

      const listEl  = document.getElementById('todo-list');
      const input   = document.getElementById('todo-input');
      const addBtn  = document.getElementById('todo-add-btn');

      if (!listEl || !input || !addBtn) return;

      function render() {
        listEl.innerHTML = '';
        const sorted = [...items.filter(i => !i.done), ...items.filter(i => i.done)];
        sorted.forEach(item => {
          const row = document.createElement('div');
          row.className = 'todo-item' + (item.done ? ' done' : '');

          const check = document.createElement('div');
          check.className = 'todo-check';
          check.textContent = item.done ? '✓' : '';
          check.title = item.done ? 'Mark undone' : 'Mark done';

          const text = document.createElement('span');
          text.className = 'todo-text';
          text.textContent = item.text;

          const del = document.createElement('button');
          del.className = 'todo-del';
          del.textContent = '×';
          del.title = 'Delete';

          check.addEventListener('click', () => {
            const i = items.find(x => x.id === item.id);
            if (i) { i.done = !i.done; save(items); render(); }
          });
          text.addEventListener('click', () => {
            const i = items.find(x => x.id === item.id);
            if (i) { i.done = !i.done; save(items); render(); }
          });
          del.addEventListener('click', () => {
            items = items.filter(x => x.id !== item.id);
            save(items);
            render();
          });

          row.append(check, text, del);
          listEl.appendChild(row);
        });
      }

      function addItem() {
        const text = input.value.trim();
        if (!text) return;
        items.push({ id: Date.now().toString(), text, done: false, created: new Date().toISOString() });
        save(items);
        input.value = '';
        render();
        input.focus();
      }

      addBtn.addEventListener('click', addItem);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') addItem(); });

      render();
    })(); } catch(e) { console.error('[To-Do]', e); }