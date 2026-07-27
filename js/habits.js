    /* ══════════════════════════════
       HABITS — Aura-style streak tracker
       4 types: activity, timer, streak, daysSince
    ══════════════════════════════ */
    try { (function () {
      const lDate = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
      function loadChartHabits(cb) {
        if (window.Chart) { cb(); return; }
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
        s.onload = cb; document.head.appendChild(s);
      }

      const LS_DEFS  = 'los-habits-defs';
      const LS_LOGS  = 'los-habits-logs';
      const LS_TIMER = 'los-habits-timer';

      function load(k, fallback) { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? fallback; } catch(_) { return fallback; } }
      function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch(_) {} }

      function loadDefs() { return load(LS_DEFS, []); }
      function saveDefs(d) { save(LS_DEFS, d); }
      function loadLogs() { return load(LS_LOGS, []); }
      function saveLogs(l) { save(LS_LOGS, l); }

      const TYPE_LABEL = { activity:'Activity', timer:'Timer', streak:'Streak', daysSince:'Days Since' };
      const TYPE_HINT = {
        activity:  "One-off activities you don't do every day — a run, a hike, a gym trip.",
        timer:     'Timed sessions — workout, practice, focus block. Set a goal or run it open-ended.',
        streak:    'Check in daily to build a streak — reading, guitar, workout.',
        daysSince: 'Auto-counts days since a start date — days smoke-free, days sober.',
      };

      let activeDetailId = null;
      let calMonth = new Date(); calMonth.setDate(1);

      /* ── log helpers ── */
      function logsFor(habitId) { return loadLogs().filter(l => l.habitId === habitId); }
      function logOn(habitId, date) { return loadLogs().find(l => l.habitId === habitId && l.date === date); }
      function upsertLog(habitId, date, value) {
        const logs = loadLogs();
        const existing = logs.find(l => l.habitId === habitId && l.date === date);
        if (existing) { existing.value = value; }
        else { logs.push({ id: Date.now().toString()+Math.random().toString(36).slice(2,6), habitId, date, value }); }
        saveLogs(logs);
      }
      function addToLog(habitId, date, delta) {
        const cur = logOn(habitId, date);
        upsertLog(habitId, date, (cur ? cur.value : 0) + delta);
      }

      /* ── streak math (activity/timer/streak types — "done" = log value > 0) ── */
      function currentStreak(habitId) {
        const logs = logsFor(habitId).filter(l => l.value > 0);
        const set = new Set(logs.map(l => l.date));
        const today = lDate(new Date());
        let cursor = new Date();
        if (!set.has(today)) cursor.setDate(cursor.getDate() - 1); // today not logged yet — start from yesterday
        let streak = 0;
        while (set.has(lDate(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
        return streak;
      }
      function bestStreak(habitId) {
        const dates = [...new Set(logsFor(habitId).filter(l => l.value > 0).map(l => l.date))].sort();
        if (!dates.length) return 0;
        let best = 1, run = 1;
        for (let i = 1; i < dates.length; i++) {
          const prev = new Date(dates[i-1]+'T00:00:00'), cur = new Date(dates[i]+'T00:00:00');
          const diffDays = Math.round((cur - prev) / 86400000);
          run = diffDays === 1 ? run + 1 : 1;
          if (run > best) best = run;
        }
        return best;
      }
      function bestMonth(habitId) {
        const dates = [...new Set(logsFor(habitId).filter(l => l.value > 0).map(l => l.date))];
        if (!dates.length) return { month: null, count: 0 };
        const buckets = {};
        dates.forEach(d => { const m = d.slice(0,7); buckets[m] = (buckets[m]||0) + 1; });
        const best = Object.entries(buckets).sort((a,b) => b[1]-a[1])[0];
        return { month: best[0], count: best[1] };
      }

      /* ── period totals ── */
      function mondayOf(d) {
        const x = new Date(d); const day = x.getDay();
        x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day)); x.setHours(0,0,0,0);
        return x;
      }
      function sumInRange(habitId, from, to) {
        return logsFor(habitId).filter(l => l.date >= from && l.date <= to).reduce((a,l) => a + (l.value||0), 0);
      }
      function periodTotals(habit) {
        const now = new Date();
        const weekStart = lDate(mondayOf(now));
        const monthStart = lDate(new Date(now.getFullYear(), now.getMonth(), 1));
        const yearStart = lDate(new Date(now.getFullYear(), 0, 1));
        const today = lDate(now);
        return {
          week:  sumInRange(habit.id, weekStart, today),
          month: sumInRange(habit.id, monthStart, today),
          year:  sumInRange(habit.id, yearStart, today),
        };
      }
      function comparison(habit) {
        const now = new Date();
        const thisWeekStart = mondayOf(now);
        const lastWeekStart = new Date(thisWeekStart); lastWeekStart.setDate(lastWeekStart.getDate() - 7);
        const lastWeekEnd = new Date(thisWeekStart); lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
        const thisWeek = sumInRange(habit.id, lDate(thisWeekStart), lDate(now));
        const lastWeek = sumInRange(habit.id, lDate(lastWeekStart), lDate(lastWeekEnd));

        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth()-1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        const thisMonth = sumInRange(habit.id, lDate(thisMonthStart), lDate(now));
        const lastMonth = sumInRange(habit.id, lDate(lastMonthStart), lDate(lastMonthEnd));

        function pct(cur, prev) {
          if (prev === 0) return cur === 0 ? 0 : 100;
          return Math.round(((cur - prev) / prev) * 100);
        }
        return {
          week:  { cur: thisWeek,  prev: lastWeek,  pct: pct(thisWeek, lastWeek) },
          month: { cur: thisMonth, prev: lastMonth, pct: pct(thisMonth, lastMonth) },
        };
      }

      /* ── icon / accent helpers ── */
      function accentVar(habit) { return habit.color === 'cyan' ? 'var(--habit-cyan)' : 'var(--habit-orange)'; }

      /* ── card subtitle per type ── */
      function habitCardSub(habit) {
        if (habit.type === 'daysSince') {
          const days = Math.floor((new Date() - new Date(habit.startDate+'T00:00:00')) / 86400000);
          return `${Math.max(0,days)} days`;
        }
        if (habit.type === 'timer') {
          const today = logOn(habit.id, lDate(new Date()));
          const mins = today ? today.value : 0;
          const goal = habit.timerGoal ? ` / ${habit.timerGoal} min` : '';
          return `${mins} min today${goal}`;
        }
        const streak = currentStreak(habit.id);
        return streak > 0 ? `🔥 ${streak} day streak` : 'No streak yet';
      }

      function habitCardAction(habit) {
        if (habit.type === 'daysSince') return null; // no quick action on card
        if (habit.type === 'timer') {
          const timer = load(LS_TIMER, null);
          const running = timer && timer.habitId === habit.id;
          return running ? '⏸ Running…' : '▶ Start';
        }
        if (habit.type === 'streak') {
          const doneToday = !!(logOn(habit.id, lDate(new Date()))||{}).value;
          return doneToday ? '✓ Checked in' : 'Check in';
        }
        // activity
        return '+1';
      }

      /* ── render habit grid ── */
      function renderGrid() {
        const grid = document.getElementById('habit-grid');
        const empty = document.getElementById('habit-empty');
        if (!grid) return;
        const defs = loadDefs();
        grid.innerHTML = '';
        empty.style.display = defs.length ? 'none' : '';
        defs.forEach(habit => {
          const card = document.createElement('div');
          card.className = 'habit-card';
          card.style.setProperty('--habit-accent', accentVar(habit));
          const action = habitCardAction(habit);
          card.innerHTML = `
            <div class="habit-card-icon">${habit.icon || '⭐'}</div>
            <div class="habit-card-body">
              <div class="habit-card-name">${habit.name}</div>
              <div class="habit-card-sub" id="habit-card-sub-${habit.id}">${habitCardSub(habit)}</div>
            </div>
            ${action ? `<button class="habit-card-action" data-id="${habit.id}">${action}</button>` : ''}
          `;
          card.addEventListener('click', e => {
            if (e.target.closest('.habit-card-action')) return;
            openDetail(habit.id);
          });
          const actionBtn = card.querySelector('.habit-card-action');
          if (actionBtn) actionBtn.addEventListener('click', e => { e.stopPropagation(); quickAction(habit.id); });
          grid.appendChild(card);
        });
      }

      function quickAction(habitId) {
        const habit = loadDefs().find(h => h.id === habitId);
        if (!habit) return;
        const today = lDate(new Date());
        if (habit.type === 'streak') {
          const cur = logOn(habitId, today);
          upsertLog(habitId, today, cur && cur.value ? 0 : 1);
        } else if (habit.type === 'activity') {
          addToLog(habitId, today, 1);
        } else if (habit.type === 'timer') {
          toggleTimer(habitId);
        }
        renderGrid();
        if (activeDetailId === habitId) renderDetail();
      }

      /* ── timer ── */
      function toggleTimer(habitId) {
        const timer = load(LS_TIMER, null);
        if (timer && timer.habitId === habitId) {
          const elapsedMin = (Date.now() - timer.startedAt) / 60000;
          addToLog(habitId, lDate(new Date()), Math.round(elapsedMin * 10) / 10);
          save(LS_TIMER, null);
        } else {
          save(LS_TIMER, { habitId, startedAt: Date.now() });
        }
      }

      /* ── habit form (add/edit) ── */
      let editingId = null;
      let formType = 'activity';

      function setFormType(t) {
        formType = t;
        document.querySelectorAll('.habit-type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === t));
        document.getElementById('habit-type-hint').textContent = TYPE_HINT[t];
        document.getElementById('habit-fields-activity').style.display = t === 'activity' ? 'flex' : 'none';
        document.getElementById('habit-fields-timer').style.display = t === 'timer' ? 'block' : 'none';
        document.getElementById('habit-fields-dayssince').style.display = t === 'daysSince' ? 'block' : 'none';
      }

      function resetForm() {
        editingId = null;
        document.getElementById('habit-name').value = '';
        document.getElementById('habit-icon').value = '';
        document.getElementById('habit-unit').value = '';
        document.getElementById('habit-target').value = '';
        document.getElementById('habit-timer-goal').value = '';
        document.getElementById('habit-start-date').value = lDate(new Date());
        document.querySelectorAll('.habit-color-btn').forEach(b => b.classList.toggle('active', b.dataset.color === 'orange'));
        setFormType('activity');
      }

      function openForm(habit) {
        resetForm();
        if (habit) {
          editingId = habit.id;
          document.getElementById('habit-name').value = habit.name;
          document.getElementById('habit-icon').value = habit.icon || '';
          document.getElementById('habit-unit').value = habit.unit || '';
          document.getElementById('habit-target').value = habit.dailyTarget || '';
          document.getElementById('habit-timer-goal').value = habit.timerGoal || '';
          document.getElementById('habit-start-date').value = habit.startDate || lDate(new Date());
          document.querySelectorAll('.habit-color-btn').forEach(b => b.classList.toggle('active', b.dataset.color === (habit.color||'orange')));
          setFormType(habit.type);
        }
        document.getElementById('habit-form').classList.add('open');
      }

      function saveHabitForm() {
        const name = document.getElementById('habit-name').value.trim();
        if (!name) return;
        const icon = document.getElementById('habit-icon').value.trim() || '⭐';
        const color = document.querySelector('.habit-color-btn.active')?.dataset.color || 'orange';
        const defs = loadDefs();
        let habit = editingId ? defs.find(h => h.id === editingId) : null;
        if (!habit) {
          habit = { id: Date.now().toString(36)+Math.random().toString(36).slice(2,6), createdAt: lDate(new Date()) };
          defs.push(habit);
        }
        habit.name = name;
        habit.icon = icon;
        habit.color = color;
        habit.type = formType;
        if (formType === 'activity') {
          habit.unit = document.getElementById('habit-unit').value.trim() || 'times';
          const t = document.getElementById('habit-target').value;
          habit.dailyTarget = t ? +t : null;
        } else if (formType === 'timer') {
          const g = document.getElementById('habit-timer-goal').value;
          habit.timerGoal = g ? +g : null;
        } else if (formType === 'daysSince') {
          habit.startDate = document.getElementById('habit-start-date').value || lDate(new Date());
        }
        saveDefs(defs);
        document.getElementById('habit-form').classList.remove('open');
        renderGrid();
      }

      function deleteHabit(habitId) {
        saveDefs(loadDefs().filter(h => h.id !== habitId));
        saveLogs(loadLogs().filter(l => l.habitId !== habitId));
        const timer = load(LS_TIMER, null);
        if (timer && timer.habitId === habitId) save(LS_TIMER, null);
        document.getElementById('habit-detail-overlay').style.display = 'none';
        activeDetailId = null;
        renderGrid();
      }

      /* ── detail view ── */
      function openDetail(habitId) {
        activeDetailId = habitId;
        calMonth = new Date(); calMonth.setDate(1);
        document.getElementById('habit-detail-overlay').style.display = 'flex';
        renderDetail();
        loadChartHabits(() => renderDetailChart());
      }

      function renderDetail() {
        const habit = loadDefs().find(h => h.id === activeDetailId);
        if (!habit) { document.getElementById('habit-detail-overlay').style.display = 'none'; return; }
        const panel = document.getElementById('habit-detail-panel');
        panel.style.setProperty('--habit-accent', accentVar(habit));

        document.getElementById('habit-detail-icon').textContent = habit.icon || '⭐';
        document.getElementById('habit-detail-name').textContent = habit.name;
        document.getElementById('habit-detail-sub').textContent = TYPE_LABEL[habit.type];

        const primary = document.getElementById('habit-detail-primary-btn');
        const inputRow = document.getElementById('habit-detail-input-row');
        const today = lDate(new Date());
        inputRow.style.display = 'none';

        if (habit.type === 'daysSince') {
          const days = Math.max(0, Math.floor((new Date() - new Date(habit.startDate+'T00:00:00')) / 86400000));
          primary.textContent = `${days} days — Reset`;
          primary.onclick = () => { habit.startDate = today; saveDefs(loadDefs().map(h => h.id===habit.id?habit:h)); renderDetail(); renderGrid(); };
        } else if (habit.type === 'timer') {
          const timer = load(LS_TIMER, null);
          const running = timer && timer.habitId === habit.id;
          if (running) {
            const elapsedMin = Math.floor((Date.now() - timer.startedAt) / 60000);
            const elapsedSec = Math.floor(((Date.now() - timer.startedAt) / 1000) % 60);
            primary.textContent = `⏸ Stop (${elapsedMin}:${String(elapsedSec).padStart(2,'0')})`;
          } else {
            primary.textContent = '▶ Start Timer';
          }
          primary.onclick = () => { toggleTimer(habit.id); renderDetail(); renderGrid(); };
        } else if (habit.type === 'streak') {
          const done = !!(logOn(habit.id, today)||{}).value;
          primary.textContent = done ? '✓ Checked in today' : 'Check in';
          primary.onclick = () => { quickAction(habit.id); renderDetail(); };
        } else { // activity
          primary.textContent = `+1 ${habit.unit||'times'}`;
          primary.onclick = () => { quickAction(habit.id); renderDetail(); };
          inputRow.style.display = 'flex';
          const amountInput = document.getElementById('habit-detail-amount');
          amountInput.value = '';
          amountInput.placeholder = `Custom (${habit.unit||'times'})`;
          document.getElementById('habit-detail-amount-save').onclick = () => {
            const v = +amountInput.value;
            if (!v) return;
            addToLog(habit.id, today, v);
            amountInput.value = '';
            renderDetail(); renderGrid();
          };
        }

        // Badges
        const best = bestStreak(habit.id);
        const bm = bestMonth(habit.id);
        const badgeRow = document.getElementById('habit-badge-row');
        const bmLabel = bm.month ? new Date(bm.month+'-01T00:00:00').toLocaleDateString('en-US',{month:'short',year:'numeric'}) : '—';
        badgeRow.innerHTML = habit.type === 'daysSince'
          ? `<div class="habit-badge">🏆 Longest run: ${Math.max(best, Math.floor((new Date()-new Date(habit.startDate+'T00:00:00'))/86400000))} days</div>`
          : `<div class="habit-badge">🏆 Best streak: ${best}</div><div class="habit-badge">📅 Best month: ${bm.count} <span style="opacity:.6">(${bmLabel})</span></div>`;

        // Period totals
        if (habit.type !== 'daysSince') {
          const tot = periodTotals(habit);
          const unit = habit.type === 'timer' ? 'min' : habit.type === 'streak' ? 'check-ins' : (habit.unit || 'times');
          const statRow = document.getElementById('habit-stat-row');
          statRow.innerHTML = ['week','month','year'].map(p => `
            <div class="habit-stat">
              <div class="habit-stat-num">${tot[p]}</div>
              <div class="habit-stat-unit">${unit}</div>
              <div class="habit-stat-label">This ${p[0].toUpperCase()+p.slice(1)}</div>
            </div>`).join('');
          document.getElementById('habit-totals-card').style.display = '';

          const cmp = comparison(habit);
          function cmpHtml(label, c) {
            const dir = c.pct > 0 ? '↑' : c.pct < 0 ? '↓' : '→';
            const cls = c.pct > 0 ? 'pos' : c.pct < 0 ? 'neg' : 'flat';
            return `<div class="habit-cmp-item">
              <div class="habit-cmp-label">${label}</div>
              <div class="habit-cmp-nums">${c.cur} <span class="habit-cmp-vs">vs ${c.prev}</span></div>
              <div class="habit-cmp-pct ${cls}">${dir} ${Math.abs(c.pct)}%</div>
            </div>`;
          }
          document.getElementById('habit-compare-row').innerHTML =
            cmpHtml('vs Last Week', cmp.week) + cmpHtml('vs Last Month', cmp.month);
          document.getElementById('habit-compare-card').style.display = '';
        } else {
          document.getElementById('habit-totals-card').style.display = 'none';
          document.getElementById('habit-compare-card').style.display = 'none';
        }

        renderCalendar(habit);
        if (window.Chart) renderDetailChart();
      }

      /* ── calendar ── */
      function renderCalendar(habit) {
        const label = document.getElementById('habit-cal-label');
        const grid = document.getElementById('habit-cal-grid');
        if (!label || !grid) return;
        label.textContent = calMonth.toLocaleDateString('en-US', { month:'long', year:'numeric' });

        const year = calMonth.getFullYear(), month = calMonth.getMonth();
        const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Monday=0
        const daysInMonth = new Date(year, month+1, 0).getDate();
        const today = lDate(new Date());
        const logs = logsFor(habit.id);
        const activeDates = new Set(logs.filter(l => l.value > 0).map(l => l.date));

        grid.innerHTML = '';
        for (let i = 0; i < firstDow; i++) grid.appendChild(document.createElement('div'));
        for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const cell = document.createElement('div');
          cell.className = 'habit-cal-day' + (activeDates.has(dateStr) ? ' filled' : '') + (dateStr === today ? ' today' : '');
          cell.textContent = day;
          grid.appendChild(cell);
        }
      }

      /* ── trend chart ── */
      let habitChart = null;
      function renderDetailChart() {
        const habit = loadDefs().find(h => h.id === activeDetailId);
        const canvas = document.getElementById('habit-trend-chart');
        if (!habit || !canvas || !window.Chart) return;
        if (habitChart) { habitChart.destroy(); habitChart = null; }

        const days = 30;
        const labels = [], data = [];
        const cursor = new Date(); cursor.setDate(cursor.getDate() - (days-1));
        for (let i = 0; i < days; i++) {
          const ds = lDate(cursor);
          const log = logOn(habit.id, ds);
          labels.push(String(cursor.getDate()));
          data.push(log ? log.value : 0);
          cursor.setDate(cursor.getDate() + 1);
        }
        const color = habit.color === 'cyan' ? '#2dd4c4' : '#ff8a3d';
        habitChart = new Chart(canvas.getContext('2d'), {
          type: 'bar',
          data: { labels, datasets: [{ data, backgroundColor: color, borderRadius: 3, maxBarThickness: 10 }] },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { display: false }, border: { color: '#1e1e1e' }, ticks: { color: '#333', font: { size: 8 }, maxTicksLimit: 10 } },
              y: { grid: { color: '#161616' }, border: { color: '#1e1e1e' }, ticks: { color: '#333', font: { size: 9 } }, beginAtZero: true },
            },
          },
        });
      }

      /* ── init ── */
      function initHabits() {
        renderGrid();

        document.getElementById('habit-add-btn')?.addEventListener('click', () => {
          const form = document.getElementById('habit-form');
          const willOpen = !form.classList.contains('open');
          if (willOpen) openForm(null); else form.classList.remove('open');
        });
        document.getElementById('habit-form-cancel')?.addEventListener('click', () => document.getElementById('habit-form').classList.remove('open'));
        document.getElementById('habit-save-btn')?.addEventListener('click', saveHabitForm);

        document.querySelectorAll('.habit-type-btn').forEach(btn => {
          btn.addEventListener('click', () => setFormType(btn.dataset.type));
        });
        document.querySelectorAll('.habit-color-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            document.querySelectorAll('.habit-color-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
          });
        });

        document.getElementById('habit-detail-close')?.addEventListener('click', () => {
          document.getElementById('habit-detail-overlay').style.display = 'none';
          activeDetailId = null;
        });
        document.getElementById('habit-detail-delete')?.addEventListener('click', () => {
          if (activeDetailId) deleteHabit(activeDetailId);
        });
        document.getElementById('habit-cal-prev')?.addEventListener('click', () => {
          calMonth.setMonth(calMonth.getMonth() - 1);
          const habit = loadDefs().find(h => h.id === activeDetailId);
          if (habit) renderCalendar(habit);
        });
        document.getElementById('habit-cal-next')?.addEventListener('click', () => {
          calMonth.setMonth(calMonth.getMonth() + 1);
          const habit = loadDefs().find(h => h.id === activeDetailId);
          if (habit) renderCalendar(habit);
        });

        // Re-render when the Habits tab is opened (list can go stale while on another tab)
        document.querySelector('.los-tab[data-los-tab="habits"]')?.addEventListener('click', () => renderGrid());

        // Keep timer displays live
        setInterval(() => {
          const timer = load(LS_TIMER, null);
          if (!timer) return;
          renderGrid();
          if (activeDetailId === timer.habitId) renderDetail();
        }, 1000);
      }

      const losSec = document.getElementById('section-life-os');
      let habitsInited = false;
      if (losSec) {
        new MutationObserver(() => { if (losSec.classList.contains('active') && !habitsInited) { habitsInited = true; initHabits(); } })
          .observe(losSec, { attributes: true, attributeFilter: ['class'] });
        if (losSec.classList.contains('active')) { habitsInited = true; initHabits(); }
      }
    })(); } catch(e) { console.error('[Habits]', e); }
