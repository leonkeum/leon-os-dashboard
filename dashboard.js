if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});

// --- NEXT BLOCK ---


    // Greeting + live clock
    function updateTopbarClock() {
      const n = new Date();
      const h = String(n.getHours()).padStart(2,'0');
      const m = String(n.getMinutes()).padStart(2,'0');
      const s = String(n.getSeconds()).padStart(2,'0');
      const el = document.getElementById('topbar-clock');
      if (el) el.textContent = `${h}:${m}:${s}`;
    }
    updateTopbarClock();
    setInterval(updateTopbarClock, 1000);

    const now = new Date();
    const hour = now.getHours();
    const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    document.getElementById('greeting').textContent = `${greet}, Leon`;
    document.getElementById('topbar-date').textContent = now.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric'
    });

    // Section switching
    function switchSection(sectionKey) {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.mob-nav-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      document.querySelectorAll(`.nav-item[data-section="${sectionKey}"]`).forEach(i => i.classList.add('active'));
      document.querySelectorAll(`.mob-nav-item[data-section="${sectionKey}"]`).forEach(i => i.classList.add('active'));
      const target = document.getElementById(`section-${sectionKey}`);
      if (target) target.classList.add('active');
      window.updateDailyScore?.();
      // Show FAB only on Time OS on mobile
      const fab = document.getElementById('mob-cal-fab');
      if (fab) fab.style.display = (sectionKey === 'time-os' && window.innerWidth <= 768) ? 'flex' : 'none';
    }

    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => switchSection(item.dataset.section));
    });

    document.querySelectorAll('.mob-nav-item').forEach(item => {
      item.addEventListener('click', () => switchSection(item.dataset.section));
    });

    /* ══════════════════════════════
       GAMIFICATION — DAILY SCORE + STREAKS + RINGS
    ══════════════════════════════ */
    (function () {
      const TODAY      = new Date().toISOString().slice(0, 10);
      const LS_STREAKS = 'leon-streaks-v1';
      const CIRC       = 50.27; // 2π × r(8)

      /* ── What's logged today? ── */
      function gifdLogged() {
        try {
          const entries = JSON.parse(localStorage.getItem('los-gifd-current') || '[]');
          const e = entries.find(x => x.date === TODAY);
          return !!(e && (e.desc || Object.values(e.good||{}).some(Boolean) || Object.values(e.bad||{}).some(Boolean)));
        } catch(_) { return false; }
      }

      function workoutLogged() {
        try {
          const d = JSON.parse(localStorage.getItem('leon-workout-v3') || '{}');
          const s = (d.sessions || []).find(x => x.date === TODAY);
          return !!(s && s.sets && s.sets.length > 0);
        } catch(_) { return false; }
      }

      function sleepLogged() {
        try {
          const d = JSON.parse(localStorage.getItem('leon-sleep-v1') || '{}');
          return d.date === TODAY && d.hours > 0;
        } catch(_) { return false; }
      }

      function nutritionLogged() {
        try {
          const d = JSON.parse(localStorage.getItem('leon-nutrition-v2') || '{}');
          return d.date === TODAY && d.meals && d.meals.length > 0;
        } catch(_) { return false; }
      }

      function gifdHabits() {
        try {
          const entries = JSON.parse(localStorage.getItem('los-gifd-current') || '[]');
          const e = entries.find(x => x.date === TODAY);
          if (!e) return { good: 0, bad: 0 };
          return {
            good: Object.values(e.good || {}).filter(Boolean).length,
            bad:  Object.values(e.bad  || {}).filter(Boolean).length
          };
        } catch(_) { return { good: 0, bad: 0 }; }
      }

      /* ── Score calculation ── */
      function calcScore() {
        const { good, bad } = gifdHabits();
        let s = 0;
        if (gifdLogged())      s += 25;
        if (workoutLogged())   s += 25;
        if (sleepLogged())     s += 15;
        if (nutritionLogged()) s += 15;
        s += good * 4;
        s -= bad  * 4;
        return Math.max(0, Math.round(s));
      }

      /* ── Completion rings ── */
      function setRing(id, filled, color) {
        const arc  = document.getElementById(`ring-arc-${id}`);
        const wrap = document.getElementById(`ring-${id}`);
        if (arc) {
          arc.style.strokeDashoffset = filled ? 0 : CIRC;
          arc.style.stroke = color;
        }
        if (wrap) wrap.classList.toggle('done', filled);
      }

      /* ── Score badge ── */
      function renderScoreBadge(score) {
        const badge = document.getElementById('daily-score-badge');
        if (!badge) return;
        const prev     = parseInt(badge.dataset.score || '-1', 10);
        const colorCls = score >= 70 ? 'green' : score >= 35 ? 'amber' : 'red';
        badge.style.display = '';
        badge.className     = `topbar-badge ${colorCls}`;
        badge.textContent   = `DAY ${score}`;
        badge.dataset.score = score;
        if (score !== prev) {
          badge.classList.remove('pop');
          void badge.offsetWidth;
          badge.classList.add('pop');
        }
      }

      /* ── Streaks ── */
      function loadStreaks() {
        try { return JSON.parse(localStorage.getItem(LS_STREAKS) || '{}'); } catch(_) { return {}; }
      }
      function saveStreaks(s) { try { localStorage.setItem(LS_STREAKS, JSON.stringify(s)); } catch(_) {} }

      function updateStreak(key, loggedToday) {
        const streaks = loadStreaks();
        const s = streaks[key] || { count: 0, lastDate: '' };
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

        if (loggedToday && s.lastDate !== TODAY) {
          s.count    = (s.lastDate === yesterday) ? s.count + 1 : 1;
          s.lastDate = TODAY;
          streaks[key] = s;
          saveStreaks(streaks);
        } else if (!loggedToday && s.lastDate < yesterday && s.lastDate !== '') {
          // Streak broken — reset to 0
          s.count = 0;
          streaks[key] = s;
          saveStreaks(streaks);
        }

        return s.count;
      }

      function renderStreakNum(id, count) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = count > 0 ? `${count}d` : '—';
        el.classList.toggle('hot', count >= 3);
      }

      /* ── Main refresh (called everywhere) ── */
      window.updateDailyScore = function () {
        const score  = calcScore();
        const gl     = gifdLogged();
        const wl     = workoutLogged();
        const nl     = nutritionLogged();

        renderScoreBadge(score);
        setRing('gifd',      gl, '#4f7ec9');
        setRing('workout',   wl, '#c94f4f');
        setRing('nutrition', nl, '#4daa7d');

        renderStreakNum('streak-gifd-num',      updateStreak('gifd',      gl));
        renderStreakNum('streak-workout-num',   updateStreak('workout',   wl));
        renderStreakNum('streak-nutrition-num', updateStreak('nutrition', nl));
      };

      /* Init + poll every 30s */
      window.updateDailyScore();
      setInterval(window.updateDailyScore, 30000);

      /* ── GIFD Reminder Banner ── */
      (function checkGIFDReminder() {
        const DISMISS_KEY = 'gifd-reminder-dismissed';
        if (sessionStorage.getItem(DISMISS_KEY)) return; // already dismissed this session

        function fmtDate(d) {
          return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
        }

        const now          = new Date();
        const hour         = now.getHours();
        const todayStr     = fmtDate(now);
        const yest         = new Date(now); yest.setDate(yest.getDate() - 1);
        const yesterdayStr = fmtDate(yest);

        function gifdLoggedFor(dateStr) {
          try {
            const entries = JSON.parse(localStorage.getItem('los-gifd-current') || '[]');
            const e = entries.find(x => x.date === dateStr);
            return !!(e && (e.desc || Object.values(e.good||{}).some(Boolean) || Object.values(e.bad||{}).some(Boolean)));
          } catch(_) { return false; }
        }

        function getGIFDStreak() {
          try { return (JSON.parse(localStorage.getItem('leon-streaks-v1') || '{}').gifd || {}).count || 0; }
          catch(_) { return 0; }
        }

        let msg = null;
        const streak = getGIFDStreak();

        if (hour >= 22 && !gifdLoggedFor(todayStr)) {
          // After 10pm, today not logged
          msg = streak > 0
            ? `🔥 ${streak}-day streak at risk — you haven't logged today's GIFD yet.`
            : `📋 Almost midnight — log tonight's GIFD before the day's gone.`;
        } else if (hour < 12 && !gifdLoggedFor(yesterdayStr)) {
          // Morning, yesterday not logged
          msg = `📋 Yesterday's GIFD is unlogged — go back and fill it in.`;
        }

        if (!msg) return;

        const banner   = document.getElementById('gifd-reminder-banner');
        const textEl   = document.getElementById('gifd-reminder-text');
        const goBtn    = document.getElementById('gifd-reminder-go');
        const dismissBtn = document.getElementById('gifd-reminder-dismiss');
        if (!banner || !textEl) return;

        textEl.textContent = msg;
        banner.style.display = 'flex';

        goBtn?.addEventListener('click', () => {
          banner.style.display = 'none';
          sessionStorage.setItem(DISMISS_KEY, '1');
          document.querySelector('[data-section=life-os]')?.click();
        });
        dismissBtn?.addEventListener('click', () => {
          banner.style.display = 'none';
          sessionStorage.setItem(DISMISS_KEY, '1');
        });
      })();

    })();

    /* ══════════════════════════════
       TIME OS — DYNAMIC CALENDAR + GABY UPLOAD
    ══════════════════════════════ */
    (function () {
      const CAL_KEY = 'leon-calendar-v2';
      const DAYS    = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

      /* Default calendar blocks
         day  = recurring every week on that weekday
         date = specific YYYY-MM-DD (overrides recurring for that day) */
      const DEFAULT_BLOCKS = [
        // ── Euroaula (recurring, updated schedule) ──
        { id:'sch-mon', day:'Mon', label:'Euroaula',         start:'15:30', end:'20:00', color:'blue',  style:'solid' },
        { id:'sch-tue', day:'Tue', label:'Euroaula',         start:'16:00', end:'19:00', color:'blue',  style:'solid' },
        { id:'sch-wed', day:'Wed', label:'Digitalización',   start:'15:30', end:'16:00', color:'blue',  style:'dashed', note:'optional · 1h' },
        { id:'sch-thu', day:'Thu', label:'Euroaula',         start:'15:30', end:'19:00', color:'blue',  style:'solid' },
        { id:'sch-fri', day:'Fri', label:'Skip unless exam', start:'06:00', end:'00:00', color:'gray',  style:'dashed' },
        // ── @2.chicos (recurring, mornings) ──
        { id:'ch-mon', day:'Mon', label:'@2.chicos', start:'09:00', end:'14:30', color:'green', style:'solid' },
        { id:'ch-tue', day:'Tue', label:'@2.chicos', start:'09:00', end:'15:00', color:'green', style:'solid' },
        { id:'ch-wed', day:'Wed', label:'@2.chicos', start:'09:00', end:'14:30', color:'green', style:'solid' },
        { id:'ch-thu', day:'Thu', label:'@2.chicos', start:'09:00', end:'14:30', color:'green', style:'solid' },
        { id:'ch-sat', day:'Sat', label:'@2.chicos', start:'09:00', end:'16:00', color:'green', style:'solid' },
        // ── Gaby shifts — week May 18-24 ──
        { id:'gb-0522', date:'2026-05-22', label:"Gaby · sala",  start:'10:00', end:'16:00', color:'red', style:'solid' },
        { id:'gb-0523', date:'2026-05-23', label:"Gaby's shift", start:'18:00', end:'00:00', color:'red', style:'solid' },
        { id:'gb-0524', date:'2026-05-24', label:"Gaby's shift", start:'18:00', end:'00:00', color:'red', style:'solid' },
        // ── Gaby shifts — week May 25-31 ──
        { id:'gb-0529', date:'2026-05-29', label:"Gaby · sala",  start:'10:00', end:'16:00', color:'red', style:'solid' },
        { id:'gb-0530', date:'2026-05-30', label:"Gaby · sala",  start:'18:30', end:'23:30', color:'red', style:'solid' },
      ];

      function loadCal() {
        try { const v = localStorage.getItem(CAL_KEY); return v ? JSON.parse(v) : JSON.parse(JSON.stringify(DEFAULT_BLOCKS)); }
        catch(_) { return JSON.parse(JSON.stringify(DEFAULT_BLOCKS)); }
      }
      function saveCal(b) { try { localStorage.setItem(CAL_KEY, JSON.stringify(b)); } catch(_) {} }

      let calBlocks = loadCal();

      // Migration: ensure gb-0524 exists
      if (!calBlocks.find(b => b.id === 'gb-0524')) {
        calBlocks.push({ id:'gb-0524', date:'2026-05-24', label:"Gaby's shift", start:'18:00', end:'00:00', color:'red', style:'solid' });
        saveCal(calBlocks);
      }

      function localDateStr(d) {
        return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      }

      function getWeekDates() {
        const t = new Date(); const d = t.getDay();
        // Sunday (0) → go back 6 days to THIS week's Monday. Other days → back to Monday.
        const mon = new Date(t); mon.setDate(t.getDate() + (d === 0 ? -6 : 1 - d)); mon.setHours(0,0,0,0);
        return Array.from({length:7}, (_,i) => { const x = new Date(mon); x.setDate(mon.getDate()+i); return localDateStr(x); });
      }

      // top in px from 06:00 baseline (34px/hr)
      function tpx(t) {
        const [h,m] = t.split(':').map(Number);
        const hr = h < 6 ? h + 24 : h; // 00–05 treated as post-midnight (24–29)
        return (hr - 6) * 34 + (m / 60) * 34;
      }

      const PAL = {
        red:    { bg:'rgba(201,79,79,0.15)',   bl:'rgba(201,79,79,0.7)',   tx:'#c94f4f' },
        blue:   { bg:'rgba(79,126,201,0.15)',  bl:'rgba(79,126,201,0.7)',  tx:'#4f7ec9' },
        green:  { bg:'rgba(77,170,125,0.12)',  bl:'rgba(77,170,125,0.65)', tx:'#4daa7d' },
        gray:   { bg:'rgba(255,255,255,0.02)', bl:'#2a2a2a',               tx:'#666' },
        purple: { bg:'rgba(150,110,201,0.12)', bl:'rgba(150,110,201,0.6)', tx:'#9b7ac9' },
      };

      /* ── Drag state ── */
      let dragState = null;

      // Parse compact time string "1130" / "930" / "9" / "11:30" → "11:30" | null
      function parseCompactTime(s) {
        const digits = (s || '').replace(/\D/g, '');
        if (!digits) return null;
        let h, m;
        if (digits.length <= 2) {
          h = parseInt(digits, 10); m = 0;
        } else {
          m = parseInt(digits.slice(-2), 10);
          h = parseInt(digits.slice(0, -2), 10);
        }
        if (isNaN(h) || isNaN(m) || h > 23 || m > 59) return null;
        return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
      }

      // Convert pixel offset from grid top (06:00 baseline) to HH:MM snapped to 15 min
      function pxToTime(px) {
        const totalMin = Math.round((px * 60 / 34) / 15) * 15;
        const absHour  = 6 + Math.floor(totalMin / 60);
        const min      = totalMin % 60;
        const h        = absHour >= 24 ? absHour - 24 : absHour;
        return String(h).padStart(2,'0') + ':' + String(min).padStart(2,'0');
      }

      function calDragMove(clientX, clientY) {
        if (!dragState) return;
        const dy = clientY - dragState.mouseY0;
        if (dragState.type === 'move') {
          const dx = clientX - dragState.mouseX0;
          dragState.ghost.style.top  = (dragState.top0  + dy) + 'px';
          dragState.ghost.style.left = (dragState.left0 + dx) + 'px';
        } else {
          const el = dragState.el;
          if (dragState.type === 'bot') {
            el.style.height = Math.max(17, dragState.h0 + dy) + 'px';
          } else if (dragState.type === 'top') {
            const nh = dragState.h0 - dy;
            const nt = dragState.top0 + dy;
            if (nh >= 17 && nt >= 0) { el.style.top = nt + 'px'; el.style.height = nh + 'px'; }
          }
        }
      }

      document.addEventListener('mousemove', function(e) { calDragMove(e.clientX, e.clientY); });
      document.addEventListener('touchmove', function(e) {
        if (!dragState) return;
        e.preventDefault();
        calDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: false });

      function calDragEnd(clientX, clientY) {
        if (!dragState) return;
        const el    = dragState.el;
        const ghost = dragState.ghost;

        if (dragState.type === 'move') {
          // Read ghost position before removing it
          const ghostFixedTop = ghost ? parseFloat(ghost.style.top)  || 0 : 0;

          // Tear down ghost and restore original
          if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
          if (el) { el.classList.remove('is-dragging'); el.style.opacity = ''; }

          // Which column did the pointer land on?
          const weekDates = getWeekDates();
          let targetColIdx = dragState.colIdx;
          for (let i = 0; i < 7; i++) {
            const colEl = document.getElementById('dc-' + i);
            if (colEl) {
              const r = colEl.getBoundingClientRect();
              if (clientX >= r.left && clientX <= r.right) { targetColIdx = i; break; }
            }
          }
          const targetColEl = document.getElementById('dc-' + targetColIdx);
          const colRect = targetColEl ? targetColEl.getBoundingClientRect() : null;
          // Convert ghost's viewport-Y to column-relative px
          const newRelTop = colRect
            ? Math.max(0, Math.min(714 - dragState.h0, ghostFixedTop - colRect.top))
            : 0;

          const block = calBlocks.find(b => b.id === dragState.id);
          if (block) {
            block.start = pxToTime(newRelTop);
            block.end   = pxToTime(newRelTop + dragState.h0);
            const targetDate = weekDates[targetColIdx];
            const targetDay  = DAYS[targetColIdx];
            if (block.date) {
              block.date = targetDate;                    // date-specific: move to new date
            } else if (targetColIdx !== dragState.colIdx) {
              block.date = targetDate; delete block.day; // recurring pinned to specific date
            } else {
              block.day = targetDay;                      // recurring, same column
            }
            saveCal(calBlocks);
          }
        } else {
          // Resize — stays in same column, no ghost
          if (el) {
            el.classList.remove('is-dragging');
            const newTop = parseFloat(el.style.top) || 0;
            const newH   = parseFloat(el.style.height) || 34;
            const block  = calBlocks.find(b => b.id === dragState.id);
            if (block) {
              block.start = pxToTime(newTop);
              block.end   = pxToTime(newTop + newH);
              saveCal(calBlocks);
            }
          }
        }

        dragState = null;
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        renderCalendar();
      }

      document.addEventListener('mouseup',  function(e) { calDragEnd(e.clientX, e.clientY); });
      document.addEventListener('touchend',  function(e) {
        if (!dragState) return;
        const t = e.changedTouches[0];
        calDragEnd(t.clientX, t.clientY);
      });
      document.addEventListener('touchcancel', function() {
        if (!dragState) return;
        const ghost = dragState.ghost;
        if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
        if (dragState.el) { dragState.el.classList.remove('is-dragging'); dragState.el.style.opacity = ''; }
        dragState = null;
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        renderCalendar();
      });

      // The calendar's "day" boundary is 06:00, not midnight.
      // 00:00–05:59 of date D still belongs to D-1's column.
      function calendarTodayStr() {
        const n = new Date();
        if (n.getHours() < 6) {
          const prev = new Date(n);
          prev.setDate(n.getDate() - 1);
          return localDateStr(prev);
        }
        return localDateStr(n);
      }

      function positionNowLine() {
        const line = document.getElementById('time-now-line');
        if (!line) return;
        const n  = new Date();
        const h  = n.getHours();
        const hr = h < 6 ? h + 24 : h; // 00–05 = post-midnight (24–29)
        const top = (hr - 6) * 34 + (n.getMinutes() / 60) * 34;
        if (top < 0 || top > 714) { line.style.display = 'none'; return; }
        line.style.display = 'block';
        line.style.top = top + 'px';
      }

      // Hours between two HH:MM times (handles midnight crossing)
      function blockHours(bl) {
        const [sh, sm] = bl.start.split(':').map(Number);
        const [eh, em] = bl.end.split(':').map(Number);
        const startMin = sh * 60 + sm;
        let endMin = eh * 60 + em;
        if (eh < 6) endMin += 24 * 60; // post-midnight end
        return Math.max(0, (endMin - startMin) / 60);
      }

      // Human-readable duration string e.g. "6h" or "1h30m"
      function durationStr(start, end) {
        const h = blockHours({ start, end });
        const hrs = Math.floor(h);
        const mins = Math.round((h - hrs) * 60);
        return mins > 0 ? `${hrs}h${mins}m` : `${hrs}h`;
      }

      // Recompute and update the "This week" stat cards from calBlocks
      function updateStatCards() {
        const wDates = getWeekDates();
        const totals = { red: 0, blue: 0, green: 0 };

        calBlocks.forEach(bl => {
          const inWeek = bl.date ? wDates.includes(bl.date) : true; // recurring = every week
          if (!inWeek || totals[bl.color] === undefined) return;
          totals[bl.color] += blockHours(bl);
        });

        const fmt = h => {
          const hrs = Math.floor(h); const mins = Math.round((h - hrs) * 60);
          return mins > 0 ? `${hrs}h${mins}m` : `${hrs}h`;
        };

        const q = (sel) => document.querySelector(`#section-time-os ${sel}`);
        const setHours = (sel, val) => { const el = q(sel); if (el) el.textContent = val; };

        setHours('.stat-card.red   .sc-hours', fmt(totals.red));
        setHours('.stat-card.blue  .sc-hours', fmt(totals.blue));
        setHours('.stat-card.green .sc-hours', fmt(totals.green));

        // Free time: 7 days × 18 waking hours minus committed
        const committed = totals.red + totals.blue + totals.green;
        setHours('.stat-card.muted .sc-hours', Math.round(Math.max(0, 7 * 18 - committed)) + 'h');

        // Update sub labels
        const redSub = q('.stat-card.red .sc-sub');
        if (redSub) redSub.textContent = totals.red > 0 ? 'This week' : 'No shifts this week';
      }

      function renderCalendar() {
        const weekDates = getWeekDates();
        const todayStr  = calendarTodayStr(); // 06:00-boundary day, not midnight

        /* ── Header ── */
        const hdr = document.getElementById('cal-header');
        if (hdr) {
          hdr.innerHTML = '<div class="wh-spacer" style="border-right:1px solid #1a1a1a;height:100%"></div>' +
            DAYS.map((d,i) => {
              const dt = weekDates[i];
              const num = new Date(dt+'T00:00:00').getDate();
              const isToday = dt === todayStr;
              return `<div class="wh-day${isToday?' today':''}">
                ${d}<span class="wh-date">${num}</span>
              </div>`;
            }).join('');
        }

        /* ── Body ── */
        const body = document.getElementById('cal-body');
        if (!body) return;

        // Time labels column
        let html = '<div class="time-labels">';
        [6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,0,1,2,3].forEach(h =>
          html += `<div class="tl-hour">${String(h).padStart(2,'0')}</div>`
        );
        html += '</div>';

        // Day columns
        DAYS.forEach((dayName, i) => {
          const dateStr  = weekDates[i];
          const dayBlocks = calBlocks
            .filter(b => (!b.date && b.day === dayName) || b.date === dateStr)
            .sort((a,b) => a.start < b.start ? -1 : 1);

          html += `<div class="day-col" id="dc-${i}"><div class="hour-lines"></div>`;

          dayBlocks.forEach(bl => {
            const c   = PAL[bl.color] || PAL.gray;
            const top = tpx(bl.start);
            const ht  = Math.max(tpx(bl.end) - top, 17);
            const bdr = `2px ${bl.style==='dashed'?'dashed':'solid'} ${c.bl}`;
            const showTime = ht > 32;
            html += `<div class="tb cal-block" style="top:${top}px;height:${ht}px;background:${c.bg};border-left:${bdr}" data-id="${bl.id}">
              <div class="cb-resize-top" data-id="${bl.id}"></div>
              <span class="tb-label" style="color:${c.tx}">${bl.label}</span>
              ${showTime ? `<span class="tb-time">${bl.start}–${bl.end} (${durationStr(bl.start, bl.end)})</span>` : ''}
              ${bl.note  ? `<span class="tb-note">${bl.note}</span>` : ''}
              <button class="cal-del-btn" data-id="${bl.id}">×</button>
              <div class="cb-resize-bot" data-id="${bl.id}"></div>
            </div>`;
          });

          html += '</div>';
        });

        body.innerHTML = html;

        // Inject time-now-line into TODAY's day-col only
        const todayColIdx = weekDates.indexOf(todayStr);
        if (todayColIdx >= 0) {
          const nl = document.createElement('div');
          nl.className = 'time-now-line';
          nl.id = 'time-now-line';
          const todayColEl = document.getElementById('dc-' + todayColIdx);
          if (todayColEl) todayColEl.appendChild(nl);
        }
        positionNowLine();
        updateStatCards();

        // Delete handlers
        body.querySelectorAll('.cal-del-btn').forEach(btn => {
          btn.addEventListener('click', e => {
            e.stopPropagation();
            calBlocks = calBlocks.filter(b => b.id !== btn.dataset.id);
            saveCal(calBlocks);
            renderCalendar();
          });
        });

        // Drag handlers
        body.querySelectorAll('.cal-block').forEach(el => {
          const id = el.dataset.id;

          // Helper: start resize drag (top or bot)
          function startResize(type, clientY) {
            dragState = { type, id, el, mouseY0:clientY, top0:parseFloat(el.style.top)||0, h0:parseFloat(el.style.height)||34 };
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'ns-resize';
          }

          // Resize top edge
          const resizeTop = el.querySelector('.cb-resize-top');
          if (resizeTop) {
            resizeTop.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); startResize('top', e.clientY); });
            resizeTop.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); startResize('top', e.touches[0].clientY); }, { passive:false });
          }

          // Resize bottom edge
          const resizeBot = el.querySelector('.cb-resize-bot');
          if (resizeBot) {
            resizeBot.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); startResize('bot', e.clientY); });
            resizeBot.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); startResize('bot', e.touches[0].clientY); }, { passive:false });
          }

          // Helper: start move drag
          function startMove(clientX, clientY) {
            const colEl  = el.closest('.day-col');
            const colIdx = colEl ? parseInt(colEl.id.replace('dc-', '')) : 0;
            const rect   = el.getBoundingClientRect();
            const ghost = el.cloneNode(true);
            ghost.style.position     = 'fixed';
            ghost.style.left         = rect.left + 'px';
            ghost.style.top          = rect.top  + 'px';
            ghost.style.width        = rect.width + 'px';
            ghost.style.margin       = '0';
            ghost.style.zIndex       = '9999';
            ghost.style.pointerEvents = 'none';
            ghost.classList.add('is-dragging-free');
            document.body.appendChild(ghost);
            el.classList.add('is-dragging');
            el.style.opacity = '0.35';
            dragState = {
              type:'move', id, el, ghost,
              mouseY0: clientY, mouseX0: clientX,
              top0: rect.top, left0: rect.left,
              h0: rect.height, colIdx
            };
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'grabbing';
          }

          // Move (block body — not resize handles or delete button)
          el.addEventListener('mousedown', e => {
            if (e.target.classList.contains('cb-resize-top') ||
                e.target.classList.contains('cb-resize-bot') ||
                e.target.classList.contains('cal-del-btn')) return;
            e.preventDefault();
            startMove(e.clientX, e.clientY);
          });
          el.addEventListener('touchstart', e => {
            if (e.target.classList.contains('cb-resize-top') ||
                e.target.classList.contains('cb-resize-bot') ||
                e.target.classList.contains('cal-del-btn')) return;
            // On mobile: short tap = select; long-press = drag
            if (window.innerWidth <= 768) {
              // Use a 250ms hold timer to distinguish tap vs drag
              let holdTimer = setTimeout(() => {
                holdTimer = null;
                e.preventDefault();
                startMove(e.touches[0].clientX, e.touches[0].clientY);
              }, 250);
              el.addEventListener('touchend', function onTapEnd(te) {
                el.removeEventListener('touchend', onTapEnd);
                if (holdTimer) {
                  clearTimeout(holdTimer);
                  // It was a tap — toggle selection
                  const already = el.classList.contains('mob-selected');
                  body.querySelectorAll('.cal-block.mob-selected').forEach(b => b.classList.remove('mob-selected'));
                  if (!already) el.classList.add('mob-selected');
                  te.preventDefault();
                }
              }, { once: true, passive: false });
            } else {
              e.preventDefault();
              startMove(e.touches[0].clientX, e.touches[0].clientY);
            }
          }, { passive:false });
        });

        // Mobile: re-apply active day view after every render
        if (typeof updateMobCalView === 'function' && window.innerWidth <= 768) updateMobCalView();

        /* ── Add-block row — + buttons only, open shared modal ── */
        const addRow = document.getElementById('add-block-row');
        if (!addRow) return;

        let rowHtml = '<div class="add-block-spacer"></div>';
        DAYS.forEach((dayName, i) => {
          const dateStr = weekDates[i];
          rowHtml += `<div class="add-block-col">
            <button class="add-block-trigger" data-col="${i}" data-date="${dateStr}" data-day="${dayName}">+</button>
          </div>`;
        });
        addRow.innerHTML = rowHtml;

        addRow.querySelectorAll('.add-block-trigger').forEach(btn => {
          btn.addEventListener('click', () => openCalModal(btn.dataset.date, btn.dataset.day));
        });
      }

      /* ── Shared calendar add-event modal ── */
      (function () {
        const modal    = document.getElementById('cal-add-modal');
        const lblInp   = document.getElementById('cal-modal-lbl');
        const startInp = document.getElementById('cal-modal-start');
        const endInp   = document.getElementById('cal-modal-end');
        const dayLbl   = document.getElementById('cal-modal-day-label');
        const saveBtn  = document.getElementById('cal-modal-save');
        const cancelBtn= document.getElementById('cal-modal-cancel');
        const closeBtn = document.getElementById('cal-modal-close');
        if (!modal) return;

        let _date = '', _day = '';
        const COLOR_DEFAULTS = { red:"Gaby's shift", blue:'Euroaula', green:'@2.chicos', purple:'Random', gray:'Free time' };

        function getSelectedColor() {
          const sel = modal.querySelector('.cal-modal-color.selected');
          return sel ? sel.dataset.color : 'red';
        }

        function closeModal() {
          modal.classList.remove('open');
          lblInp.value = ''; startInp.value = ''; endInp.value = '';
          modal.querySelectorAll('.cal-modal-color').forEach((b,i) => b.classList.toggle('selected', i===0));
        }

        window.openCalModal = function(date, day) {
          _date = date; _day = day;
          // Label in day header
          const d = new Date(date + 'T00:00:00');
          const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
          dayLbl.textContent = dayNames[d.getDay()] + ' ' + d.getDate() + ' ' + d.toLocaleString('default', {month:'long'});
          modal.classList.add('open');
          setTimeout(() => lblInp.focus(), 50);
        };

        // Color swatch clicks
        modal.querySelectorAll('.cal-modal-color').forEach(btn => {
          btn.addEventListener('click', () => {
            modal.querySelectorAll('.cal-modal-color').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            // Auto-fill label if blank or still a default
            if (!lblInp.value || Object.values(COLOR_DEFAULTS).includes(lblInp.value)) {
              lblInp.value = COLOR_DEFAULTS[btn.dataset.color] || '';
            }
          });
        });

        // Compact-time auto-format on blur
        [startInp, endInp].forEach(inp => {
          inp.addEventListener('blur', () => {
            const parsed = parseCompactTime(inp.value);
            if (parsed) inp.value = parsed;
          });
        });

        // Enter key on title → focus start
        lblInp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); startInp.focus(); } });
        startInp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); endInp.focus(); } });
        endInp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveBtn.click(); } });

        saveBtn.addEventListener('click', () => {
          const label = lblInp.value.trim();
          const start = parseCompactTime(startInp.value);
          const end   = parseCompactTime(endInp.value);
          const color = getSelectedColor();
          if (!label || !start || !end) {
            if (!label) lblInp.focus();
            else if (!start) startInp.focus();
            else endInp.focus();
            return;
          }
          calBlocks.push({ id:'custom-'+Date.now(), date:_date, label, start, end, color, style:'solid' });
          saveCal(calBlocks);
          closeModal();
          renderCalendar();
        });

        cancelBtn.addEventListener('click', closeModal);
        closeBtn.addEventListener('click', closeModal);
        // Click backdrop to close
        modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
        // Esc key to close
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('open')) closeModal(); });
      })();

      /* ══ Mobile single-day calendar view ══ */
      let mobCalDayIdx = 0; // which of the 7 week columns is visible on mobile

      function updateMobCalView() {
        const weekDates = getWeekDates();
        // Show only the active day column
        document.querySelectorAll('#cal-body .day-col').forEach((col, i) => {
          col.classList.toggle('mob-active', i === mobCalDayIdx);
        });
        // Show only the active header cell
        document.querySelectorAll('#cal-header .wh-day').forEach((el, i) => {
          el.classList.toggle('mob-active', i === mobCalDayIdx);
        });
        // Update the day label above the grid
        const label = document.getElementById('mob-cal-day-label');
        if (label) {
          const dt = new Date(weekDates[mobCalDayIdx] + 'T00:00:00');
          const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
          label.textContent = dayNames[dt.getDay()] + ' ' + dt.getDate();
        }
        // Deselect any selected blocks when switching day
        document.querySelectorAll('.cal-block.mob-selected').forEach(b => b.classList.remove('mob-selected'));
        // Scroll the day's column to ~current time
        const activeCol = document.querySelector('#cal-body .day-col.mob-active');
        if (activeCol) {
          const body = document.getElementById('cal-body');
          if (body) {
            const nowH = new Date().getHours();
            const scrollTo = Math.max(0, (nowH - 7) * 34 - 60);
            body.scrollTop = scrollTo;
          }
        }
      }

      function initMobCal() {
        if (window.innerWidth > 768) return;
        const weekDates = getWeekDates();
        const todayStr  = calendarTodayStr();
        const idx = weekDates.indexOf(todayStr);
        mobCalDayIdx = idx >= 0 ? idx : 0;
        updateMobCalView();
      }

      // Prev / Next day buttons
      document.getElementById('mob-cal-prev')?.addEventListener('click', () => {
        mobCalDayIdx = (mobCalDayIdx + 6) % 7;
        updateMobCalView();
      });
      document.getElementById('mob-cal-next')?.addEventListener('click', () => {
        mobCalDayIdx = (mobCalDayIdx + 1) % 7;
        updateMobCalView();
      });

      // Swipe left/right on the calendar grid to change day
      let _swipeStartX = null, _swipeStartY = null;
      const _calWrap = document.getElementById('week-grid-wrap');
      if (_calWrap) {
        _calWrap.addEventListener('touchstart', e => {
          if (dragState) return;
          _swipeStartX = e.touches[0].clientX;
          _swipeStartY = e.touches[0].clientY;
        }, { passive: true });
        _calWrap.addEventListener('touchend', e => {
          if (_swipeStartX === null || dragState) return;
          const dx = e.changedTouches[0].clientX - _swipeStartX;
          const dy = e.changedTouches[0].clientY - _swipeStartY;
          _swipeStartX = null; _swipeStartY = null;
          if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2) return; // not a horizontal swipe
          if (window.innerWidth > 768) return;
          mobCalDayIdx = dx < 0 ? (mobCalDayIdx + 1) % 7 : (mobCalDayIdx + 6) % 7;
          updateMobCalView();
        });
      }

      // FAB → open add-event modal for the visible day
      document.getElementById('mob-cal-fab')?.addEventListener('click', () => {
        const weekDates = getWeekDates();
        window.openCalModal(weekDates[mobCalDayIdx], DAYS[mobCalDayIdx]);
      });

      // Tap outside any block → deselect
      document.getElementById('cal-body')?.addEventListener('click', e => {
        if (window.innerWidth > 768) return;
        if (!e.target.closest('.cal-block')) {
          document.querySelectorAll('.cal-block.mob-selected').forEach(b => b.classList.remove('mob-selected'));
        }
      });

      renderCalendar();
      initMobCal();
      setInterval(positionNowLine, 60000); // update time line every minute

      /* ── Gaby schedule upload ── */
      const gabBtn  = document.getElementById('gaby-upload-btn');
      const gabFile = document.getElementById('gaby-file-input');
      const akWrap  = document.getElementById('gaby-apikey-wrap');
      const akInput = document.getElementById('gaby-apikey-input');
      const akSave  = document.getElementById('gaby-apikey-save');
      const spinner = document.getElementById('gaby-spinner');
      const result  = document.getElementById('gaby-result');

      if (gabBtn) gabBtn.addEventListener('click', () => {
        if (localStorage.getItem('anthropic_api_key')) { gabFile.click(); }
        else { akWrap.classList.add('show'); akInput.focus(); }
      });

      if (akSave) akSave.addEventListener('click', () => {
        const k = akInput.value.trim();
        if (!k) return;
        localStorage.setItem('anthropic_api_key', k);
        akWrap.classList.remove('show');
        akInput.value = '';
        gabFile.click();
      });

      if (gabFile) gabFile.addEventListener('change', async () => {
        const file = gabFile.files[0];
        if (!file) return;
        const apiKey = localStorage.getItem('anthropic_api_key');
        if (!apiKey) return;

        spinner.classList.add('show');
        result.className = 'gaby-result';

        try {
          const { b64, mime } = await new Promise(res => {
            const r = new FileReader();
            r.onload = () => res({ b64: r.result.split(',')[1], mime: file.type || 'image/jpeg' });
            r.readAsDataURL(file);
          });

          const resp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
            body: JSON.stringify({
              model: 'claude-opus-4-5',
              max_tokens: 1024,
              system: "You are reading a restaurant staff schedule spreadsheet image. Find the row labeled 'leon' (lowercase). For each day column (Lunes, Martes, Miércoles, Jueves, Viernes, Sábado, Domingo), read the date number shown under the day name and the shift time if not OFF. Return ONLY a valid JSON array, no explanation, no markdown: [{\"date\":\"YYYY-MM-DD\",\"start\":\"HH:MM\",\"end\":\"HH:MM\",\"location\":\"sala/bar/etc\"}]. Use the current year. Omit days that are OFF or empty.",
              messages: [{ role:'user', content: [
                { type:'image', source: { type:'base64', media_type: mime, data: b64 } },
                { type:'text', text:"Extract leon's schedule from this image." }
              ]}]
            }),
          });

          if (!resp.ok) throw new Error(await resp.text());
          const data = await resp.json();
          const raw  = data.content[0].text.trim();

          let shifts;
          try { const m = raw.match(/\[[\s\S]*\]/); shifts = JSON.parse(m ? m[0] : raw); }
          catch(_) {
            spinner.classList.remove('show');
            result.className = 'gaby-result err show';
            result.innerHTML = `Parse error. Raw response:<br><pre>${raw}</pre>`;
            return;
          }

          let added = 0;
          shifts.forEach(s => {
            if (!s.date || !s.start || !s.end) return;
            const id = 'gaby-upload-' + s.date;
            calBlocks = calBlocks.filter(b => b.id !== id);
            calBlocks.push({ id, date: s.date, label: 'Gaby' + (s.location ? ` · ${s.location}` : ''), start: s.start, end: s.end, color: 'red', style: 'solid' });
            added++;
          });

          saveCal(calBlocks);
          renderCalendar();
          spinner.classList.remove('show');
          result.className = 'gaby-result ok show';
          result.textContent = `✓ ${added} shift${added!==1?'s':''} added to calendar`;

        } catch(err) {
          spinner.classList.remove('show');
          result.className = 'gaby-result err show';
          result.textContent = 'Error: ' + (err.message || String(err));
        }
        gabFile.value = '';
      });
    })();

    /* ══════════════════════════════
       MOVEMENT — calisthenics skills (dynamic + persisted)
    ══════════════════════════════ */
    (function () {
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
    })();

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
    (function () {
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
    })();

    /* ══════════════════════════════
       @2.CHICOS  (handled by initChicosSection at bottom of file)
    ══════════════════════════════ */
    /* legacy IIFE removed — all chicos logic lives in initChicosSection() */
    if (false) (function () {
      const LS_STATS   = 'leon-chicos-stats';
      const LS_FOLLOW  = 'leon-chicos-followers';
      const LS_KANBAN  = 'leon-chicos-kanban';

      const DEF_STATS = {
        followers: 15988, engagement: 17.3, views30d: 1712,
        interactions: 296, newFollowers: 136, netChange: -136
      };

      const DEF_FOLLOWERS = [
        { date: '2026-03-23', count: 7200 },
        { date: '2026-03-30', count: 7450 },
        { date: '2026-04-06', count: 7680 },
        { date: '2026-04-13', count: 7890 },
        { date: '2026-04-20', count: 8050 },
        { date: '2026-04-27', count: 8180 },
        { date: '2026-05-04', count: 8310 },
        { date: '2026-05-11', count: 8420 },
        { date: '2026-05-18', count: 15988 },
      ];

      const DEF_KANBAN = {
        idea: [
          { id: 'k1', title: 'Backrooms Ep.4 — La Sala Roja',     note: 'Sonido ambiente + efecto estático' },
          { id: 'k2', title: 'Spot cinematic — Joyería oscura',    note: 'Planos detalle, luz de vela' },
        ],
        filming: [
          { id: 'k3', title: 'Comercial cinematic — Perfumería',   note: 'Rodar al atardecer, luz dorada' },
          { id: 'k4', title: 'Backrooms Ep.3 — El Pasillo',        note: 'Locación confirmada, fin de semana' },
        ],
        editing: [
          { id: 'k5', title: 'Spot — Estudio de Arquitectura',     note: 'Color grading en proceso' },
          { id: 'k6', title: 'Backrooms Ep.2 — La Piscina',        note: 'VFX y foley pendientes' },
        ],
        published: [
          { id: 'k7', title: 'Intro cinematic — Marca de ropa',    note: '2.4K views · 4.1% engagement' },
          { id: 'k8', title: 'Backrooms Ep.1 — La Oficina',        note: '12K views · viral en TikTok' },
        ],
      };

      function ls(key, def) {
        try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : JSON.parse(JSON.stringify(def)); }
        catch (_) { return JSON.parse(JSON.stringify(def)); }
      }
      function lsSave(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (_) {} }

      let chicosStats     = ls(LS_STATS,  DEF_STATS);
      let chicosFollowers = ls(LS_FOLLOW, DEF_FOLLOWERS);
      let chicosKanban    = ls(LS_KANBAN, DEF_KANBAN);

      /* ── Stat cards ── */
      const STAT_DEFS = [
        { key: 'followers',    label: 'Followers',       unit: '' },
        { key: 'engagement',   label: 'Engagement',      unit: '%' },
        { key: 'views30d',     label: 'Views (30d)',      unit: '' },
        { key: 'interactions', label: 'Interactions',    unit: '' },
        { key: 'newFollowers', label: 'New this month',  unit: '' },
        { key: 'netChange',    label: 'Net change',       unit: '' },
      ];

      function fmtStat(val, key) {
        if (key === 'engagement')   return (+val).toFixed(1);
        if (key === 'followers')    return val >= 1000 ? (val/1000).toFixed(1)+'k' : String(val);
        if (key === 'netChange')    return (val > 0 ? '+' : '') + val;
        if (key === 'views30d' || key === 'interactions' || key === 'newFollowers')
          return val >= 1000 ? (val/1000).toFixed(1)+'k' : String(val);
        return String(val);
      }

      function applyStatColors() {
        const nc = document.getElementById('cv-netChange');
        if (nc) nc.style.color = chicosStats.netChange < 0 ? '#c94f4f' : '#4daa7d';
        const nf = document.getElementById('cv-newFollowers');
        if (nf) nf.style.color = '#4daa7d';
      }

      function initStatCards() {
        const grid = document.getElementById('chicos-stats-grid');
        if (!grid) return;
        grid.innerHTML = '';
        STAT_DEFS.forEach(def => {
          const card = document.createElement('div');
          card.className = 'chicos-stat';
          card.innerHTML = `
            <div class="cs-label">${def.label}</div>
            <div class="cs-value" id="cv-${def.key}" contenteditable="true" spellcheck="false">${fmtStat(chicosStats[def.key], def.key)}</div>
            ${def.unit ? `<div class="cs-unit">${def.unit}</div>` : ''}`;
          grid.appendChild(card);

          const el = card.querySelector('.cs-value');
          el.addEventListener('focus', () => {
            el.textContent = String(chicosStats[def.key]);
            const r = document.createRange(); r.selectNodeContents(el);
            const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
          });
          el.addEventListener('blur', () => {
            const raw = el.textContent.replace(/[^0-9.\-]/g, '');
            const n = parseFloat(raw);
            if (!isNaN(n)) { chicosStats[def.key] = n; lsSave(LS_STATS, chicosStats); }
            el.textContent = fmtStat(chicosStats[def.key], def.key);
            applyStatColors();
          });
          el.addEventListener('keydown', e => {
            if (e.key === 'Enter')  { e.preventDefault(); el.blur(); }
            if (e.key === 'Escape') { el.textContent = fmtStat(chicosStats[def.key], def.key); el.blur(); }
          });
        });
      }

      /* ── Chart ── */
      let followersChart = null;

      function buildChart() {
        if (!window.Chart) return;
        const canvas = document.getElementById('followers-chart');
        if (!canvas) return;
        if (followersChart) { followersChart.destroy(); followersChart = null; }

        const ctx   = canvas.getContext('2d');
        const grad  = ctx.createLinearGradient(0, 0, 0, 180);
        grad.addColorStop(0, 'rgba(77,170,125,0.22)');
        grad.addColorStop(1, 'rgba(77,170,125,0)');

        const sorted = [...chicosFollowers].sort((a, b) => a.date < b.date ? -1 : 1);
        const labels = sorted.map(p =>
          new Date(p.date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
        );
        const data = sorted.map(p => p.count);

        followersChart = new Chart(ctx, {
          type: 'line',
          data: {
            labels,
            datasets: [{
              data,
              borderColor: '#4daa7d',
              backgroundColor: grad,
              borderWidth: 1.5,
              pointRadius: 3,
              pointHoverRadius: 5,
              pointBackgroundColor: '#4daa7d',
              pointBorderColor: 'transparent',
              tension: 0.4,
              fill: true,
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 300 },
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: '#111',
                borderColor: '#2a2a2a',
                borderWidth: 1,
                titleColor: '#555',
                bodyColor: '#ddd',
                padding: 8,
                callbacks: { label: c => c.raw.toLocaleString() + ' followers' }
              }
            },
            scales: {
              x: {
                grid:   { color: '#161616' },
                border: { color: '#1e1e1e' },
                ticks:  { color: '#2a2a2a', font: { family: 'Inter', size: 9 }, maxRotation: 0 }
              },
              y: {
                grid:   { color: '#161616' },
                border: { color: '#1e1e1e' },
                ticks:  { color: '#2a2a2a', font: { family: 'Inter', size: 9 } }
              }
            }
          }
        });
      }

      function loadChartJS(cb) {
        if (window.Chart) { cb(); return; }
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
        s.onload = cb;
        document.head.appendChild(s);
      }

      function initSnapshotForm() {
        const btn  = document.getElementById('add-snap-btn');
        const form = document.getElementById('snapshot-form');
        if (!btn || !form) return;

        btn.addEventListener('click', () => {
          const open = form.classList.toggle('open');
          btn.textContent = open ? '✕ Cancel' : '+ Add snapshot';
          if (open) document.getElementById('snap-date').value = new Date().toISOString().slice(0, 10);
        });

        document.getElementById('snap-submit').addEventListener('click', () => {
          const date  = document.getElementById('snap-date').value;
          const count = parseInt(document.getElementById('snap-count').value, 10);
          if (!date || isNaN(count)) return;
          chicosFollowers.push({ date, count });
          lsSave(LS_FOLLOW, chicosFollowers);
          buildChart();
          document.getElementById('snap-date').value  = '';
          document.getElementById('snap-count').value = '';
          form.classList.remove('open');
          btn.textContent = '+ Add snapshot';
        });
      }

      /* ── Kanban ── */
      const COLS = ['idea', 'filming', 'editing', 'published'];
      let dragId = null, dragFrom = null;

      function renderKanban() {
        COLS.forEach(col => {
          const cards     = chicosKanban[col];
          const container = document.getElementById(`kc-${col}`);
          const countEl   = document.getElementById(`cnt-${col}`);
          if (!container) return;
          if (countEl) countEl.textContent = cards.length;

          container.innerHTML = '';
          cards.forEach(card => {
            const el = document.createElement('div');
            el.className = 'kanban-card';
            el.draggable = true;
            el.dataset.id  = card.id;
            el.dataset.col = col;
            el.innerHTML = `
              <div class="kc-title">${card.title}</div>
              ${card.note ? `<div class="kc-note">${card.note}</div>` : ''}
              <button class="kc-del">×</button>`;
            container.appendChild(el);

            el.querySelector('.kc-del').addEventListener('click', () => {
              chicosKanban[col] = chicosKanban[col].filter(c => c.id !== card.id);
              lsSave(LS_KANBAN, chicosKanban);
              renderKanban();
            });

            el.addEventListener('dragstart', e => {
              dragId = card.id; dragFrom = col;
              el.classList.add('dragging');
              e.dataTransfer.effectAllowed = 'move';
            });
            el.addEventListener('dragend', () => el.classList.remove('dragging'));
          });

          container.addEventListener('dragover',  e => { e.preventDefault(); container.classList.add('drag-over'); });
          container.addEventListener('dragleave', () => container.classList.remove('drag-over'));
          container.addEventListener('drop', e => {
            e.preventDefault();
            container.classList.remove('drag-over');
            if (!dragId || dragFrom === col) return;
            const card = chicosKanban[dragFrom].find(c => c.id === dragId);
            if (!card) return;
            chicosKanban[dragFrom] = chicosKanban[dragFrom].filter(c => c.id !== dragId);
            chicosKanban[col].push(card);
            lsSave(LS_KANBAN, chicosKanban);
            dragId = dragFrom = null;
            renderKanban();
          });
        });
      }

      function initAddButtons() {
        COLS.forEach(col => {
          const btn  = document.getElementById(`kc-add-${col}`);
          const form = document.getElementById(`kc-form-${col}`);
          if (!btn || !form) return;

          btn.addEventListener('click', () => {
            const open = form.classList.toggle('open');
            btn.textContent = open ? '✕' : '+';
            if (open) form.querySelector('.kc-input').focus();
          });

          const doAdd = () => {
            const title = form.querySelector('.kc-input').value.trim();
            const note  = form.querySelector('.kc-note-input').value.trim();
            if (!title) return;
            chicosKanban[col].unshift({ id: Date.now().toString(), title, note });
            lsSave(LS_KANBAN, chicosKanban);
            renderKanban();
            form.querySelector('.kc-input').value      = '';
            form.querySelector('.kc-note-input').value = '';
            form.classList.remove('open');
            btn.textContent = '+';
          };

          form.querySelector('.kc-save-btn').addEventListener('click', doAdd);
          form.querySelector('.kc-input').addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });
        });
      }

      /* ── Init (lazy — only when section first becomes active) ── */
      let inited = false;
      function initChicos() {
        if (inited) return;
        inited = true;
        initStatCards();
        applyStatColors();
        initSnapshotForm();
        renderKanban();
        initAddButtons();
        loadChartJS(buildChart);
      }

      const sec = document.getElementById('section-chicos');
      if (sec) {
        new MutationObserver(() => {
          if (sec.classList.contains('active')) initChicos();
        }).observe(sec, { attributes: true, attributeFilter: ['class'] });
        if (sec.classList.contains('active')) initChicos();
      }
    }); /* end dead IIFE — never called */

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

    /* Life OS IIFE follows directly — */
    /* ══════════════════════════════
       LIFE OS
    ══════════════════════════════ */
    (function () {
      /* shared utils */
      const lDate = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
      function loadChartLOS(cb) {
        if (window.Chart) { cb(); return; }
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
        s.onload = cb; document.head.appendChild(s);
      }

      /* ── Tab switching ── */
      function initTabs() {
        document.querySelectorAll('.los-tab').forEach(tab => {
          tab.addEventListener('click', () => {
            document.querySelectorAll('.los-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.los-pane').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            const pane = document.getElementById(`los-${tab.dataset.losTab}`);
            if (pane) pane.classList.add('active');
            if (tab.dataset.losTab === 'radar') { initRadarChart(); renderDebuffs(); }
            if (tab.dataset.losTab === 'mana')  initManaChart();
            if (tab.dataset.losTab === 'gifd')  renderGIFDCharts();
          });
        });
      }

      /* ════ GIFD ════ */
      const LS_GIFD = 'los-gifd-current';
      let gifdEntries = [];
      function loadGIFD()  { try { gifdEntries = JSON.parse(localStorage.getItem(LS_GIFD)||'[]'); } catch(_){ gifdEntries=[]; } }
      function saveGIFD()  { try { localStorage.setItem(LS_GIFD, JSON.stringify(gifdEntries)); } catch(_){} }

      const BAD_CHIPS  = [['weed','Weed'],['nopor','Nopor'],['scroll','Doom scroll'],['junk','Junk food'],['latesleep','Late sleep'],['impulse','Impulse spend']];
      const GOOD_CHIPS = [['posted','Posted @2.chicos'],['gym','Gym'],['slept','Slept on sched'],['read','Read 10pages+'],['clean','Room clean'],['studied','Studied something'],['nophone','No phone morning'],['planned','Planned tomorrow']];

      /* ── Today's entry state ── */
      let gifdActiveDate = lDate(new Date()); // can be changed to log a past day
      let todayBad  = {};
      let todayGood = {};
      let todayFeel = 0;

      function calcScore(e) {
        return Object.values(e.good||{}).filter(Boolean).length - Object.values(e.bad||{}).filter(Boolean).length;
      }

      /* ── Habit streak: how many consecutive past days has this chip been active? ── */
      function getHabitStreak(key, isGood) {
        const todayStr = lDate(new Date());
        // Build the yesterday string
        const yest = new Date(); yest.setDate(yest.getDate() - 1);
        const yestStr = lDate(yest);
        const sorted = [...gifdEntries]
          .filter(e => e.date < todayStr)    // past only (not today)
          .sort((a,b) => b.date < a.date ? -1 : 1); // newest first
        let streak = 0;
        // Walk backward from yesterday — missing day breaks streak
        let expectDate = yestStr;
        for (const e of sorted) {
          if (e.date !== expectDate) break; // gap or missed day — streak broken
          const active = isGood ? !!(e.good||{})[key] : !!(e.bad||{})[key];
          if (!active) break; // habit not done that day — streak broken
          streak++;
          // Next expected day is one day earlier
          const prev = new Date(e.date + 'T00:00:00');
          prev.setDate(prev.getDate() - 1);
          expectDate = lDate(prev);
        }
        // Count today too if it's already ticked
        const todayActive = isGood ? !!todayGood[key] : !!todayBad[key];
        if (todayActive) streak++;
        return streak;
      }

      /* ── Best/worst day of week from past entries ── */
      function getBestWorstDay() {
        const todayStr = lDate(new Date());
        const past = gifdEntries.filter(e => e.date < todayStr);
        if (past.length < 7) return null;
        const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const buckets = Array.from({length:7}, ()=>[]); // index 0=Sun
        past.forEach(e => {
          const d = new Date(e.date + 'T00:00:00');
          buckets[d.getDay()].push(calcScore(e));
        });
        const avgs = buckets.map(arr => arr.length < 2 ? null : arr.reduce((a,b)=>a+b,0)/arr.length);
        const valid = avgs.map((v,i)=>v===null?null:{day:i,avg:v}).filter(Boolean);
        if (valid.length < 2) return null;
        const best  = valid.reduce((a,b)=>b.avg>a.avg?b:a);
        const worst = valid.reduce((a,b)=>b.avg<a.avg?b:a);
        if (best.day === worst.day) return null;
        return { best: DAY_NAMES[best.day], worst: DAY_NAMES[worst.day],
                 bestAvg: best.avg.toFixed(1), worstAvg: worst.avg.toFixed(1) };
      }

      function renderDayInsight() {
        const el = document.getElementById('gifd-dayinsight'); if (!el) return;
        const res = getBestWorstDay();
        if (!res) { el.style.display = 'none'; return; }
        el.style.display = '';
        el.innerHTML = `You score best on <strong>${res.best}s</strong> (avg ${res.bestAvg > 0 ? '+' : ''}${res.bestAvg}) · Worst on <strong>${res.worst}s</strong> (avg ${res.worstAvg > 0 ? '+' : ''}${res.worstAvg})`;
      }

      function calcLiveScore() {
        return Object.values(todayGood).filter(Boolean).length - Object.values(todayBad).filter(Boolean).length;
      }

      function updateLiveScore() {
        const sc  = calcLiveScore();
        const el  = document.getElementById('gifd-live-score');
        if (!el) return;
        const prev = el.textContent;
        el.textContent = sc > 0 ? '+' + sc : String(sc);
        el.className   = 'gifd-live-score' + (sc > 0 ? ' pos' : sc < 0 ? ' neg' : '');
        if (el.textContent !== prev) {
          el.classList.remove('pop');
          void el.offsetWidth;
          el.classList.add('pop');
        }
      }

      function renderTodayCard() {
        const realToday = lDate(new Date());
        const dateEl    = document.getElementById('gifd-today-date');
        const subtitleEl = document.getElementById('gifd-today-subtitle');
        const nextBtn   = document.getElementById('gifd-date-next');
        if (dateEl) {
          const d = new Date(gifdActiveDate + 'T00:00:00');
          dateEl.textContent = d.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });
        }
        if (subtitleEl) {
          subtitleEl.textContent = gifdActiveDate === realToday ? 'What happened today?' : 'Logging for a past day';
        }
        if (nextBtn) nextBtn.disabled = (gifdActiveDate >= realToday);

        // Restore saved state for the active date
        const todayStr = gifdActiveDate;
        const todayEntry = gifdEntries.find(e => e.date === todayStr);
        if (todayEntry) {
          todayBad  = { ...todayEntry.bad };
          todayGood = { ...todayEntry.good };
          todayFeel = todayEntry.happiness || 0;
          const ta  = document.getElementById('gifd-journal-text');
          if (ta) ta.value = todayEntry.desc || '';
        } else {
          BAD_CHIPS.forEach(([k])  => todayBad[k]  = false);
          GOOD_CHIPS.forEach(([k]) => todayGood[k] = false);
        }

        // Render bad habits
        const badList = document.getElementById('gifd-bad-list');
        if (badList) {
          badList.innerHTML = '';
          BAD_CHIPS.forEach(([k, label]) => {
            const streak = getHabitStreak(k, false);
            const btn = document.createElement('button');
            btn.className = 'gifd-habit-chip bad' + (todayBad[k] ? ' active' : '');
            btn.dataset.k = k;
            btn.innerHTML = `<span class="chip-icon">✗</span>${label}${streak >= 2 ? `<span class="chip-streak">${streak}d</span>` : ''}`;
            btn.addEventListener('click', () => {
              todayBad[k] = !todayBad[k];
              btn.classList.toggle('active', todayBad[k]);
              btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop');
              updateLiveScore();
              autoSaveToday();
              // Update streak badge live
              const s = getHabitStreak(k, false);
              let badge = btn.querySelector('.chip-streak');
              if (s >= 2) { if (badge) badge.textContent = s + 'd'; else { badge = document.createElement('span'); badge.className = 'chip-streak'; badge.textContent = s + 'd'; btn.appendChild(badge); } }
              else if (badge) badge.remove();
            });
            badList.appendChild(btn);
          });
        }

        // Render good habits
        const goodList = document.getElementById('gifd-good-list');
        if (goodList) {
          goodList.innerHTML = '';
          GOOD_CHIPS.forEach(([k, label]) => {
            const streak = getHabitStreak(k, true);
            const btn = document.createElement('button');
            btn.className = 'gifd-habit-chip good' + (todayGood[k] ? ' active' : '');
            btn.dataset.k = k;
            btn.innerHTML = `<span class="chip-icon">✓</span>${label}${streak >= 2 ? `<span class="chip-streak">${streak}d</span>` : ''}`;
            btn.addEventListener('click', () => {
              todayGood[k] = !todayGood[k];
              btn.classList.toggle('active', todayGood[k]);
              btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop');
              updateLiveScore();
              autoSaveToday();
              // Update streak badge live
              const s = getHabitStreak(k, true);
              let badge = btn.querySelector('.chip-streak');
              if (s >= 2) { if (badge) badge.textContent = s + 'd'; else { badge = document.createElement('span'); badge.className = 'chip-streak'; badge.textContent = s + 'd'; btn.appendChild(badge); } }
              else if (badge) badge.remove();
            });
            goodList.appendChild(btn);
          });
        }

        // Feel buttons
        document.querySelectorAll('.gifd-feel-btn').forEach(btn => {
          btn.classList.toggle('active', +btn.dataset.v === todayFeel);
          btn.addEventListener('click', () => {
            todayFeel = +btn.dataset.v;
            document.querySelectorAll('.gifd-feel-btn').forEach(b => b.classList.toggle('active', +b.dataset.v === todayFeel));
            autoSaveToday();
          });
        });

        updateLiveScore();
      }

      function autoSaveToday() {
        const todayStr = gifdActiveDate;
        const ta  = document.getElementById('gifd-journal-text');
        const desc = ta ? ta.value : '';
        let entry = gifdEntries.find(e => e.date === todayStr);
        if (!entry) {
          entry = { id: Date.now().toString(), date: todayStr, desc: '', bad: {}, good: {}, happiness: 0 };
          gifdEntries.unshift(entry);
        }
        entry.bad       = { ...todayBad };
        entry.good      = { ...todayGood };
        entry.happiness = todayFeel;
        entry.desc      = desc;
        saveGIFD();
        window.updateDailyScore?.();
      }

      function renderGIFDEntries() {
        const el = document.getElementById('gifd-entries'); if (!el) return;
        el.innerHTML = '';
        const todayStr = lDate(new Date());
        const past = gifdEntries.filter(e => e.date !== todayStr).sort((a,b) => b.date < a.date ? -1 : 1);
        if (!past.length) {
          el.innerHTML = '<div style="font-size:12px;color:#2e2e2e;padding:12px 0;text-align:center">No past entries yet.</div>';
          return;
        }
        past.forEach(entry => {
          const sc  = calcScore(entry);
          const div = document.createElement('div'); div.className = 'gifd-entry';
          const activeB = BAD_CHIPS.filter(([k]) => entry.bad[k]);
          const activeG = GOOD_CHIPS.filter(([k]) => entry.good[k]);
          const chipsHtml = [
            ...activeB.map(([,l]) => `<span class="gifd-past-chip bad">${l}</span>`),
            ...activeG.map(([,l]) => `<span class="gifd-past-chip good">${l}</span>`)
          ].join('');
          div.innerHTML = `
            <div class="gifd-entry-header">
              <span class="gifd-date">${entry.date}</span>
              <input class="gifd-desc" value="${(entry.desc||'').replace(/"/g,'&quot;')}" placeholder="What happened…" data-id="${entry.id}">
              <button class="gifd-del" data-id="${entry.id}">×</button>
            </div>
            ${chipsHtml ? `<div class="gifd-past-chips">${chipsHtml}</div>` : ''}
            <div class="gifd-score-row">
              <span class="gifd-score ${sc>0?'pos':sc<0?'neg':'zero'}">${sc>0?'+'+sc:sc}</span>
              <div class="gifd-happy-btns">
                ${[['sad','😞',1],['mild','😐',2],['happy','😊',3],['happy','🔥',4]].map(([c,l,v])=>
                  `<button class="gifd-happy-btn ${c}${entry.happiness===v?' active':''}" data-id="${entry.id}" data-v="${v}">${l}</button>`).join('')}
              </div>
            </div>`;
          el.appendChild(div);
        });
        el.querySelectorAll('.gifd-desc').forEach(i => i.addEventListener('blur', () => {
          const e = gifdEntries.find(x=>x.id===i.dataset.id); if(e){e.desc=i.value;saveGIFD();}
        }));
        el.querySelectorAll('.gifd-del').forEach(b => b.addEventListener('click', () => {
          gifdEntries=gifdEntries.filter(e=>e.id!==b.dataset.id); saveGIFD(); renderGIFDEntries(); renderGIFDCharts();
        }));
        el.querySelectorAll('.gifd-happy-btn').forEach(b => b.addEventListener('click', () => {
          const e=gifdEntries.find(x=>x.id===b.dataset.id); if(e){e.happiness=+b.dataset.v;saveGIFD();renderGIFDEntries();renderGIFDCharts();}
        }));
      }

      let gScoreChart=null, gHappyChart=null;
      function renderGIFDCharts() {
        if (!window.Chart) return;
        const sorted=[...gifdEntries].sort((a,b)=>a.date<b.date?-1:1);
        const days=sorted.map(e=>e.date.slice(8));
        const scores=sorted.map(calcScore);
        const happy=sorted.map(e=>e.happiness||null);
        const sc=document.getElementById('gifd-score-chart');
        if(sc){if(gScoreChart){gScoreChart.destroy();gScoreChart=null;}
          gScoreChart=new Chart(sc.getContext('2d'),{type:'line',data:{labels:days,datasets:[
            {data:scores,borderColor:'#4f7ec9',borderWidth:1.5,pointRadius:3,pointBackgroundColor:'#4f7ec9',tension:0.3,fill:{target:0,above:'rgba(77,170,125,0.15)',below:'rgba(201,79,79,0.15)'}},
            {data:days.map(()=>0),borderColor:'rgba(255,255,255,0.08)',borderDash:[4,4],borderWidth:1,pointRadius:0}
          ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
            scales:{x:{grid:{color:'#161616'},border:{color:'#1e1e1e'},ticks:{color:'#333',font:{size:9}}},
                    y:{grid:{color:'#161616'},border:{color:'#1e1e1e'},ticks:{color:'#333',font:{size:9}}}}}}); }
        const hc=document.getElementById('gifd-happy-chart');
        if(hc){if(gHappyChart){gHappyChart.destroy();gHappyChart=null;}
          gHappyChart=new Chart(hc.getContext('2d'),{type:'line',data:{labels:days,datasets:[
            {data:happy,borderColor:'#9b7ac9',backgroundColor:'rgba(150,110,201,0.12)',borderWidth:1.5,pointRadius:3,pointBackgroundColor:'#9b7ac9',stepped:'before',fill:true,spanGaps:false}
          ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
            scales:{x:{grid:{color:'#161616'},border:{color:'#1e1e1e'},ticks:{color:'#333',font:{size:9}}},
                    y:{grid:{color:'#161616'},border:{color:'#1e1e1e'},min:0,max:5,ticks:{color:'#333',font:{size:9},callback:v=>['','Terrible','Rough','Okay','Good','🔥'][v]||''}}}}});}
      }

      function populateGIFDArchive() {
        const sel=document.getElementById('gifd-archive-select'); if(!sel) return;
        const keys=[]; for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('los-gifd-archive-'))keys.push(k);}
        sel.innerHTML='<option value="">Past months…</option>';
        keys.sort().reverse().forEach(k=>{ sel.innerHTML+=`<option value="${k}">${k.replace('los-gifd-archive-','')}</option>`; });
        sel.onchange=()=>{if(!sel.value)return;sel.value='';};
      }

      function initGIFD() {
        loadGIFD();
        gifdActiveDate = lDate(new Date()); // reset to today on init
        renderTodayCard();

        // Date navigation — prev/next day
        document.getElementById('gifd-date-prev')?.addEventListener('click', () => {
          const d = new Date(gifdActiveDate + 'T00:00:00');
          d.setDate(d.getDate() - 1);
          gifdActiveDate = lDate(d);
          todayBad = {}; todayGood = {}; todayFeel = 0;
          const ta = document.getElementById('gifd-journal-text');
          if (ta) ta.value = '';
          renderTodayCard();
        });
        document.getElementById('gifd-date-next')?.addEventListener('click', () => {
          const realToday = lDate(new Date());
          if (gifdActiveDate >= realToday) return;
          const d = new Date(gifdActiveDate + 'T00:00:00');
          d.setDate(d.getDate() + 1);
          gifdActiveDate = lDate(d);
          todayBad = {}; todayGood = {}; todayFeel = 0;
          const ta = document.getElementById('gifd-journal-text');
          if (ta) ta.value = '';
          renderTodayCard();
        });

        // Journal auto-save on type
        const ta = document.getElementById('gifd-journal-text');
        if (ta) {
          ta.addEventListener('input', () => autoSaveToday());
          ta.addEventListener('keydown', e => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); saveBtn?.click(); } });
        }

        // Save button
        const saveBtn = document.getElementById('gifd-save-btn');
        if (saveBtn) {
          saveBtn.addEventListener('click', () => {
            autoSaveToday();
            saveBtn.textContent = '✓ Saved!';
            saveBtn.classList.add('saved');
            setTimeout(() => {
              saveBtn.textContent = 'Save entry ↵';
              saveBtn.classList.remove('saved');
            }, 2000);
            renderGIFDEntries();
            loadChartLOS(() => renderGIFDCharts());
            window.updateDailyScore?.();
          });
        }

        // Show/hide archive
        const showPast  = document.getElementById('gifd-show-past');
        const entriesEl = document.getElementById('gifd-entries');
        const chartsEl  = document.getElementById('gifd-charts-wrap');
        let archiveOpen = false; // explicit flag — avoids empty-string falsy bug
        if (showPast) {
          showPast.addEventListener('click', () => {
            archiveOpen = !archiveOpen;
            if (entriesEl) entriesEl.style.display = archiveOpen ? '' : 'none';
            if (chartsEl)  chartsEl.style.display  = archiveOpen ? '' : 'none';
            showPast.textContent = archiveOpen ? 'Hide archive' : 'Show archive';
            if (archiveOpen) { renderGIFDEntries(); loadChartLOS(() => renderGIFDCharts()); renderDayInsight(); }
          });
        }

        // Archive month
        document.getElementById('gifd-close-month')?.addEventListener('click', () => {
          if (!gifdEntries.length) return;
          const key = `los-gifd-archive-${new Date().toISOString().slice(0,7)}`;
          try { localStorage.setItem(key, JSON.stringify(gifdEntries)); } catch(_) {}
          gifdEntries = []; saveGIFD();
          todayBad = {}; todayGood = {}; todayFeel = 0;
          BAD_CHIPS.forEach(([k])  => todayBad[k]  = false);
          GOOD_CHIPS.forEach(([k]) => todayGood[k] = false);
          renderTodayCard(); renderGIFDEntries();
          if (window.Chart) renderGIFDCharts();
          populateGIFDArchive();
        });

        populateGIFDArchive();
        renderGIFDEntries();
        renderDayInsight();
      }
      /* ════ SKILLS ════ */
      const LS_SKILLS_XP='los-skills-xp', LS_SKILLS_HX='los-skills-history';
      const SKILL_DEFS=[{key:'SOC',label:'SOC',sub:'Social',color:'#4f7ec9'},{key:'STR',label:'STR',sub:'Strength',color:'#c94f4f'},{key:'WOK',label:'WOK',sub:'Work',color:'#c9a032'},{key:'INT',label:'INT',sub:'Intelligence',color:'#9b7ac9'}];
      function lsLoad(k){try{return JSON.parse(localStorage.getItem(k)||'null');}catch(_){return null;}}
      function lsSave2(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(_){}}

      function renderSkillsXP(){
        const xp=lsLoad(LS_SKILLS_XP)||{};
        const grid=document.getElementById('skills-xp-bars'); if(!grid) return; grid.innerHTML='';
        SKILL_DEFS.forEach(def=>{
          const pts=xp[def.key]||0,lv=Math.floor(pts/100)+1,pct=Math.min(100,pts%100);
          const c=document.createElement('div'); c.className='los-xp-card';
          c.innerHTML=`<div class="los-xp-header"><span class="los-xp-label">${def.label} <span style="font-size:9px;color:#333">Lv${lv}</span></span><span class="los-xp-val">${pts} XP</span></div>
            <div style="font-size:9px;color:#2e2e2e;margin-bottom:6px">${def.sub}</div>
            <div class="los-xp-track"><div class="los-xp-fill" style="width:${pct}%;background:${def.color}"></div></div>`;
          grid.appendChild(c);
        });
      }

      function renderSkillsHistory(){
        const hx=lsLoad(LS_SKILLS_HX)||[];
        const el=document.getElementById('skills-history'); if(!el) return;
        el.innerHTML=!hx.length?'<div style="font-size:12px;color:#2e2e2e;padding:8px 0">No sessions yet.</div>':'';
        [...hx].reverse().slice(0,20).forEach(s=>{
          el.innerHTML+=`<div class="sk-session-item"><span class="sk-si-date">${s.date}</span><span class="sk-si-skill">${s.skill}</span><span class="sk-si-deta">D${s.d} I${s.i} C${s.c}</span><span class="sk-si-xp">+${s.d+s.i+s.c}XP</span></div>`;
        });
      }

      function initSkills(){
        renderSkillsXP(); renderSkillsHistory();
        const dateEl=document.getElementById('sk-date'); if(dateEl) dateEl.value=lDate(new Date());
        document.getElementById('skills-log-btn')?.addEventListener('click',()=>document.getElementById('skills-form')?.classList.toggle('open'));
        ['sk-d','sk-i','sk-c'].forEach((id,ci)=>{
          const sl=document.getElementById(id); if(!sl) return;
          const colors=['#4daa7d','#4f7ec9','#c9a032'];
          const upd=()=>{
            document.getElementById(`${id}-val`).textContent=sl.value;
            const pct=(+sl.value/5)*100;
            sl.style.background=`linear-gradient(to right,${colors[ci]} 0%,${colors[ci]} ${pct}%,#1e1e1e ${pct}%)`;
            document.getElementById('sk-total').textContent=[+document.getElementById('sk-d').value,+document.getElementById('sk-i').value,+document.getElementById('sk-c').value].reduce((a,b)=>a+b,0);
          };
          sl.addEventListener('input',upd);
        });
        document.getElementById('sk-save')?.addEventListener('click',()=>{
          const date=document.getElementById('sk-date').value, skill=document.getElementById('sk-skill').value;
          const d=+document.getElementById('sk-d').value, i=+document.getElementById('sk-i').value, c=+document.getElementById('sk-c').value;
          if(!date) return;
          const xp=lsLoad(LS_SKILLS_XP)||{}; xp[skill]=(xp[skill]||0)+d+i+c; lsSave2(LS_SKILLS_XP,xp);
          const hx=lsLoad(LS_SKILLS_HX)||[]; hx.push({date,skill,d,i,c}); lsSave2(LS_SKILLS_HX,hx);
          renderSkillsXP(); renderSkillsHistory();
          ['sk-d','sk-i','sk-c'].forEach(id=>{document.getElementById(id).value=0;document.getElementById(`${id}-val`).textContent=0;});
          document.getElementById('sk-total').textContent=0;
          document.getElementById('skills-form').classList.remove('open');
        });
      }

      /* ════ RADAR ════ */
      const LS_RADAR='los-radar-snapshots', LS_DEBUFFS='los-radar-debuffs';
      const R_AXES=['INT/WIS','CHA','STR','DEX','LUK'], R_KEYS=['int','cha','str','dex','luk'];
      const R_DEF={int:7,cha:6,str:7,dex:4,luk:3};
      let radarChart=null;

      function loadSnaps(){const v=lsLoad(LS_RADAR)||[];return v.length?v:[{date:lDate(new Date()),stats:{...R_DEF}}];}
      function saveSnaps(s){lsSave2(LS_RADAR,s);}

      const DEF_DEBUFFS=[
        {id:'d1',name:'Clouded Mind',desc:'Waking late + weed = massive mana leak. Start day at 20% Mana.',resolved:false},
        {id:'d2',name:'Creator Quest Ghost',desc:'Abandoned creator quest creates Incomplete Quest debuff, lowers resolve.',resolved:false},
        {id:'d3',name:'Dark Cloud',desc:'High stats but zero current Main Quest. Feeling over-leveled with nothing to aim at.',resolved:false},
      ];

      /* ── Live debuff rules — scan last 7 days of GIFD ── */
      const LIVE_DEBUFF_RULES = [
        { id:'ld-weed',   check: (counts) => counts.bad.weed   >= 3, name:'Clouded Mind',      desc:'Weed 3+ days this week.',          mods:{int:-1,luk:-1} },
        { id:'ld-porn',   check: (counts) => counts.bad.porn   >= 3, name:'Dopamine Drain',    desc:'Porn 3+ days this week.',          mods:{cha:-1,str:-1} },
        { id:'ld-scroll', check: (counts) => counts.bad.scroll >= 4, name:'Attention Scatter', desc:'Scroll +1h on 4+ days this week.', mods:{int:-1,dex:-1} },
        { id:'ld-junk',   check: (counts) => counts.bad.junk   >= 4, name:'Low Fuel',          desc:'Junk food 4+ days this week.',     mods:{str:-1} },
        { id:'ld-smoke',  check: (counts) => counts.bad.smoked >= 2, name:'Lung Debuff',       desc:'Smoked 2+ days this week.',        mods:{str:-1,dex:-1} },
        { id:'ld-post',   check: (counts) => counts.good.posted < 2, name:'Creator Ghost',     desc:'Posted fewer than 2× this week.',  mods:{cha:-1} },
        { id:'ld-train',  check: (counts) => counts.good.trained < 2,name:'Untrained',         desc:'Trained fewer than 2× this week.', mods:{str:-1} },
        { id:'ld-med',    check: (counts) => counts.good.meditate === 0, name:'Uncalibrated',  desc:'No meditation this week.',         mods:{int:-1} },
      ];

      function computeLiveDebuffs() {
        try {
          const allEntries = JSON.parse(localStorage.getItem('los-gifd-current') || '[]');
          const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
          const cutoffStr = lDate(cutoff);
          const recent = allEntries.filter(e => e.date >= cutoffStr);
          const counts = { bad:{weed:0,porn:0,scroll:0,junk:0,smoked:0}, good:{posted:0,trained:0,meditate:0} };
          recent.forEach(e => {
            ['weed','porn','scroll','junk','smoked'].forEach(k=>{ if((e.bad||{})[k]) counts.bad[k]++; });
            ['posted','trained','meditate'].forEach(k=>{ if((e.good||{})[k]) counts.good[k]++; });
          });
          return LIVE_DEBUFF_RULES.filter(r => r.check(counts));
        } catch(_) { return []; }
      }

      function getDebuffs(){const s=lsLoad(LS_DEBUFFS);return s&&s.length?s:DEF_DEBUFFS.map(d=>({...d}));}

      function renderDebuffs(){
        const el=document.getElementById('debuff-cards'); if(!el) return;
        const liveDebuffs = computeLiveDebuffs();
        const manualDebuffs=getDebuffs();
        el.innerHTML='';
        function addEl(html){const t=document.createElement('div');t.innerHTML=html;el.appendChild(t.firstChild);}

        // Live debuffs section
        addEl(`<div style="font-size:10px;color:#555;margin-bottom:6px;letter-spacing:0.5px;text-transform:uppercase">Auto — this week's GIFD</div>`);
        if (liveDebuffs.length) {
          liveDebuffs.forEach(df=>{
            const modsStr = Object.entries(df.mods).map(([k,v])=>`${v>0?'+':''}${v} ${k.toUpperCase()}`).join(', ');
            const c=document.createElement('div'); c.className='debuff-card live-debuff';
            c.innerHTML=`<div style="flex:1"><div class="debuff-name">${df.name} <span style="font-size:10px;font-weight:400;color:#c94f4f;margin-left:4px">${modsStr}</span></div><div class="debuff-desc">${df.desc}</div></div>`;
            el.appendChild(c);
          });
        } else {
          addEl(`<div style="font-size:11px;color:#2e2e2e;padding:4px 0 8px">✅ No auto-debuffs this week — clean run.</div>`);
        }
        addEl(`<div style="height:1px;background:#1e1e1e;margin:10px 0"></div>`);

        // Manual debuffs section
        addEl(`<div style="font-size:10px;color:#555;margin-bottom:6px;letter-spacing:0.5px;text-transform:uppercase">Manual</div>`);
        manualDebuffs.forEach(df=>{
          const c=document.createElement('div'); c.className=`debuff-card${df.resolved?' resolved':''}`;
          c.innerHTML=`<div style="flex:1"><div class="debuff-name">${df.name}</div><div class="debuff-desc">${df.desc}</div></div>
            <button class="debuff-resolve-btn" data-id="${df.id}"${df.resolved?' style="color:#333;border-color:#222"':''}>${df.resolved?'Resolved':'Remove Debuff'}</button>`;
          el.appendChild(c);
        });
        el.querySelectorAll('.debuff-resolve-btn').forEach(b=>b.addEventListener('click',()=>{
          const d2=getDebuffs(),d=d2.find(x=>x.id===b.dataset.id);
          if(d){d.resolved=!d.resolved;lsSave2(LS_DEBUFFS,d2);renderDebuffs();}
        }));
      }

      function initRadarChart(){
        if(!window.Chart){loadChartLOS(initRadarChart);return;}
        const snaps=loadSnaps(),latest=snaps[snaps.length-1];
        const canvas=document.getElementById('radar-chart'); if(!canvas) return;
        if(radarChart){radarChart.destroy();radarChart=null;}

        // Compute effective stats by applying live debuff mods
        const liveDebuffs = computeLiveDebuffs();
        const baseStats = R_KEYS.map(k=>latest.stats[k]||0);
        const effectiveMods = {}; R_KEYS.forEach(k=>effectiveMods[k]=0);
        liveDebuffs.forEach(df=>{ Object.entries(df.mods).forEach(([k,v])=>{ if(effectiveMods[k]!==undefined) effectiveMods[k]+=v; }); });
        const effectiveStats = R_KEYS.map((k,i)=>Math.max(0,Math.min(10,baseStats[i]+(effectiveMods[k]||0))));
        const hasDebuffs = liveDebuffs.length > 0;

        const datasets = [{
          data:baseStats,backgroundColor:'rgba(79,126,201,0.15)',
          borderColor:'#4f7ec9',borderWidth:1.5,pointRadius:3,pointBackgroundColor:'#4f7ec9',
          label:'Base'
        }];
        if (hasDebuffs) datasets.push({
          data:effectiveStats,backgroundColor:'rgba(201,79,79,0.12)',
          borderColor:'rgba(201,79,79,0.8)',borderWidth:1.5,pointRadius:3,pointBackgroundColor:'#c94f4f',
          borderDash:[4,3],label:'Effective'
        });

        radarChart=new Chart(canvas.getContext('2d'),{type:'radar',data:{labels:R_AXES,datasets},
          options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:hasDebuffs,labels:{color:'#555',font:{size:10}}}},
            scales:{r:{min:0,max:10,ticks:{display:false},grid:{color:'#1e1e1e'},angleLines:{color:'#1e1e1e'},
                      pointLabels:{color:'#666',font:{family:'Inter',size:11}}}}}});
        const st=document.getElementById('radar-date-stamp');if(st)st.textContent='Last updated: '+latest.date;
        const hel=document.getElementById('radar-history');if(hel){
          hel.innerHTML=loadSnaps().slice(-3).reverse().map(s=>
            `<div class="radar-snap-item"><span class="rsi-date">${s.date}</span><span class="rsi-stats">${R_AXES.map((a,i)=>`${a}:${s.stats[R_KEYS[i]]}`).join(' · ')}</span></div>`).join('');
        }
      }

      function initRadar(){
        const fc=document.getElementById('radar-form-card');
        document.getElementById('radar-update-btn')?.addEventListener('click',()=>{
          const open=fc.style.display==='none'||!fc.style.display; fc.style.display=open?'block':'none';
          if(open){
            const cur=loadSnaps().slice(-1)[0]?.stats||R_DEF;
            document.getElementById('radar-sliders').innerHTML=R_KEYS.map((k,i)=>`
              <div class="los-slider-row" style="margin-bottom:10px">
                <label class="form-label">${R_AXES[i]} &nbsp;<span id="rsl-${k}" style="color:#4f7ec9">${cur[k]||0}</span></label>
                <input type="range" min="0" max="10" value="${cur[k]||0}" class="goal-progress" id="rs-${k}"
                  style="background:linear-gradient(to right,#4f7ec9 0%,#4f7ec9 ${(cur[k]||0)*10}%,#1e1e1e ${(cur[k]||0)*10}%)">
              </div>`).join('');
            R_KEYS.forEach(k=>{const sl=document.getElementById(`rs-${k}`);if(!sl)return;
              sl.addEventListener('input',()=>{document.getElementById(`rsl-${k}`).textContent=sl.value;const p=+sl.value*10;sl.style.background=`linear-gradient(to right,#4f7ec9 0%,#4f7ec9 ${p}%,#1e1e1e ${p}%)`;});});
          }
        });
        document.getElementById('radar-save')?.addEventListener('click',()=>{
          const stats={};R_KEYS.forEach(k=>{stats[k]=+(document.getElementById(`rs-${k}`)?.value||0);});
          const snaps=loadSnaps();snaps.push({date:lDate(new Date()),stats});saveSnaps(snaps);
          fc.style.display='none';initRadarChart();
        });
        renderDebuffs();
      }

      /* ════ MANA ════ */
      const LS_STREAKS='los-streaks';
      let manaChart=null;
      function getManaKey(){return 'los-mana-'+lDate(new Date());}
      function loadManaToday(){return lsLoad(getManaKey())||[];}
      function saveManaToday(l){lsSave2(getManaKey(),l);}

      function initManaChart(){
        if(!window.Chart){loadChartLOS(initManaChart);return;}
        const canvas=document.getElementById('mana-chart');if(!canvas)return;
        const pts=Array(25).fill(null);
        loadManaToday().forEach(p=>{pts[p.hour]=p.energy;});
        if(manaChart){manaChart.destroy();manaChart=null;}
        manaChart=new Chart(canvas.getContext('2d'),{type:'line',data:{
          labels:Array.from({length:25},(_,i)=>i+':00'),
          datasets:[{data:pts,borderColor:'#9b7ac9',backgroundColor:'rgba(150,110,201,0.15)',
            borderWidth:1.5,pointRadius:4,pointBackgroundColor:'#9b7ac9',tension:0.4,fill:true,spanGaps:false}]
        },options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
          scales:{x:{grid:{color:'#161616'},border:{color:'#1e1e1e'},ticks:{color:'#333',font:{size:9},maxRotation:0,maxTicksLimit:12}},
                  y:{grid:{color:'#161616'},border:{color:'#1e1e1e'},ticks:{color:'#333',font:{size:9}},min:0,max:10}}}});
      }

      function renderManaLog(){
        const el=document.getElementById('mana-log-list');if(!el)return;
        const log=loadManaToday();
        el.innerHTML=!log.length?'<div style="font-size:12px;color:#2e2e2e;padding:8px 0">Nothing logged today.</div>':'';
        log.sort((a,b)=>a.hour-b.hour).forEach(p=>{
          el.innerHTML+=`<div class="mana-log-item"><span class="mli-hour">${String(p.hour).padStart(2,'0')}:00</span><div class="mli-bar"><div class="mli-fill" style="width:${p.energy*10}%"></div></div><span class="mli-val">${p.energy}/10</span></div>`;
        });
      }

      /* ── Mana pattern insights: scan all los-mana-* keys ── */
      function getManaInsights() {
        const hourBuckets = Array.from({length:24}, ()=>[]); // index = hour
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k || !k.startsWith('los-mana-')) continue;
          try {
            const entries = JSON.parse(localStorage.getItem(k) || '[]');
            entries.forEach(p => { if (p.hour >= 0 && p.hour < 24 && p.energy >= 0 && p.energy <= 10) hourBuckets[p.hour].push(p.energy); });
          } catch(_) {}
        }
        const avgs = hourBuckets.map((arr,h) => arr.length >= 2 ? {hour:h,avg:arr.reduce((a,b)=>a+b,0)/arr.length,n:arr.length} : null).filter(Boolean);
        if (avgs.length < 3) return null;
        const peak = avgs.reduce((a,b)=>b.avg>a.avg?b:a);
        const low  = avgs.reduce((a,b)=>b.avg<a.avg?b:a);
        return { peak, low };
      }

      function renderManaInsights() {
        const card = document.getElementById('mana-insights-card');
        const el   = document.getElementById('mana-insights');
        if (!card || !el) return;
        const ins = getManaInsights();
        if (!ins) { card.style.display='none'; return; }
        card.style.display = '';
        el.innerHTML = `
          <div class="mana-insight-row">
            <span class="mir-icon">⚡</span>
            <div>
              <div class="mir-label">Peak energy</div>
              <div class="mir-val"><span class="mir-time">${String(ins.peak.hour).padStart(2,'0')}:00</span> — avg ${ins.peak.avg.toFixed(1)}/10 <span style="font-size:10px;color:#333">(${ins.peak.n} readings)</span></div>
            </div>
          </div>
          <div class="mana-insight-row">
            <span class="mir-icon">😴</span>
            <div>
              <div class="mir-label">Low energy</div>
              <div class="mir-val"><span class="mir-time">${String(ins.low.hour).padStart(2,'0')}:00</span> — avg ${ins.low.avg.toFixed(1)}/10 <span style="font-size:10px;color:#333">(${ins.low.n} readings)</span></div>
            </div>
          </div>`;
      }

      function renderStreaks(){
        const str=lsLoad(LS_STREAKS)||{};
        const t=new Date(),d=t.getDay();
        const mon=new Date(t);mon.setDate(t.getDate()+(d===0?1:1-d));mon.setHours(0,0,0,0);
        const wDates=Array.from({length:7},(_,i)=>{const x=new Date(mon);x.setDate(mon.getDate()+i);return lDate(x);});
        const todayStr=lDate(new Date());
        ['cleanse','post'].forEach(type=>{
          const el=document.getElementById(`${type}-circles`);if(!el)return; el.innerHTML='';
          let consec=0;
          wDates.forEach(date=>{
            const state=str[`${type}-${date}`]||'empty';
            const btn=document.createElement('button');btn.className=`los-circle${state==='filled'?' filled':state==='broken'?' broken':''}`;
            const abbr=new Date(date+'T00:00:00').toLocaleDateString('en',{weekday:'short'}).slice(0,2);
            btn.textContent=state==='broken'?'✕':state==='filled'?'✓':abbr;btn.title=date;
            btn.addEventListener('click',()=>{
              const cur=str[`${type}-${date}`]||'empty';
              str[`${type}-${date}`]=cur==='empty'?'filled':cur==='filled'?'broken':'empty';
              lsSave2(LS_STREAKS,str);renderStreaks();
            });
            el.appendChild(btn);
          });
          const ti=wDates.indexOf(todayStr);
          for(let i=ti;i>=0;i--){if((str[`${type}-${wDates[i]}`]||'empty')==='filled')consec++;else break;}
          const c=document.getElementById(`${type}-count`);if(c)c.textContent=consec;
        });
      }

      function initMana(){
        renderStreaks(); renderManaLog(); renderManaInsights(); loadChartLOS(initManaChart);
        document.getElementById('mana-log-btn')?.addEventListener('click',()=>document.getElementById('mana-form')?.classList.toggle('open'));
        document.getElementById('mana-save')?.addEventListener('click',()=>{
          const h=+(document.getElementById('mana-hour')?.value);
          const e=+(document.getElementById('mana-energy')?.value);
          if(isNaN(h)||isNaN(e)||h<0||h>23||e<0||e>10)return;
          const log=loadManaToday();const xi=log.findIndex(p=>p.hour===h);
          if(xi!==-1)log[xi].energy=e;else log.push({hour:h,energy:e});
          saveManaToday(log);
          document.getElementById('mana-hour').value='';document.getElementById('mana-energy').value='';
          document.getElementById('mana-form').classList.remove('open');
          renderManaLog();initManaChart();renderManaInsights();
        });
      }

      /* ════ CODEX ════ */
      const LS_CODEX='los-codex-custom';
      const CODEX=[
        [1,"If you don't choose your main quest the system assigns the default: Study→9-5→Marriage→Mortgage→Retire at 70. Most people don't customise. You can."],
        [2,"Random spawn point. Some people start with more resources or higher intelligence. It's RNG. Don't waste time complaining about your spawn."],
        [3,"Base stats are locked with slight adjustments. Any build is viable but don't force a build that fights your natural fit."],
        [4,"Customisable build. Base stats mostly fixed but your build isn't. Experiment and design your playstyle throughout the years."],
        [5,"You level up through reps not talent. Ability is malleable. Grinding the boring stuff beats natural talent every time."],
        [6,"Time is the most OP currency. Early XP compounds. Late grinding is harder and less forgiving."],
        [7,"You can change classes mid-game. You're not locked into your first career, identity or role. Switching feels scary but staying costs more XP."],
        [8,"Single player game with multiplayer modes. Guilds, partners and allies can massively boost your stats."],
        [9,"Status items don't help you beat the game. Shiny gear looks good (+Aura) but often slows progression. Freedom builds quietly not visibly."],
        [10,"You decide your win condition. Retire early. Build something meaningful. Do nothing. Go all in. The game doesn't judge, only you do."],
        [11,"Rest mechanic is not optional. Skipping the save cycle leads to Burnout debuff which applies -X% multiplier on productivity and charisma stats."],
        [12,"High tier loot is gated by cringe. Growth, success, love are hidden behind quests that are awkward or risky. If a quest makes you nervous the XP payout is greater."],
        [13,"Environment is a passive buff. Your home base and guild provide stat modifiers. Toxic party = constant drain on mana. Clean base = +10 on focus."],
        [14,"Staying in the starter base stops your XP gain. To level up you have to enter uncharted territory where mobs are tougher. Comfort is a level cap."],
        [15,"Manage your inventory. You have limited slots for habits and commitments. Drop low-tier junk to make room for legendary opportunities."],
        [16,"Difficulty scales with levels. You get better at the controls but level 40 requires a more refined strategy than level 20."],
        [17,"You can't control your spawn but can influence the drop rate of good luck by increasing your surface area: meeting new people, sharing your work, staying curious."],
        [18,"Failure is a reload with kept XP. Unless it's Game Over every failure is just a boss fight. Analyse the death recap then respawn and try again."],
        [19,"Invisible UI. No on-screen health bar. You have to manually check your character sheet before your stats hit zero."],
        [20,"Protect HP. No HP no game."],
        [21,"Early game is beta. Use your first 25 levels to test different builds and biomes."],
        [22,"Avoid gold sinks. Instant dopamine micro-transactions drain long-term XP."],
      ];

      function renderCodex(){
        const el=document.getElementById('codex-rules');if(!el)return;
        const custom=lsLoad(LS_CODEX)||[];
        const all=[...CODEX,...custom.map((t,i)=>[23+i,t])];
        el.innerHTML=all.map(([n,text])=>`<div class="codex-item${n>=23?' codex-custom':''}">
          <div class="codex-header"><span class="codex-num">${String(n).padStart(2,'0')}</span>
            <span class="codex-title">${text.split('.')[0]}.</span><span class="codex-arrow">▶</span></div>
          <div class="codex-body">${text}</div></div>`).join('');
        el.querySelectorAll('.codex-header').forEach(h=>h.addEventListener('click',()=>h.closest('.codex-item').classList.toggle('open')));
      }

      function initCodex(){
        renderCodex();
        document.getElementById('codex-add-btn')?.addEventListener('click',()=>document.getElementById('codex-form')?.classList.toggle('open'));
        document.getElementById('codex-save')?.addEventListener('click',()=>{
          const t=document.getElementById('codex-input')?.value.trim();if(!t)return;
          const c=lsLoad(LS_CODEX)||[];c.push(t);lsSave2(LS_CODEX,c);renderCodex();
          document.getElementById('codex-input').value='';document.getElementById('codex-form').classList.remove('open');
        });
      }

      /* ════ MAP (Fog of War) ════ */
      const LS_MAP='fog_explored_tiles';
      function initMap(){
        const canvas=document.getElementById('fog-map-canvas');
        if(!canvas)return;
        const ctx=canvas.getContext('2d');
        const CW=900,CH=700,R=120;
        const hr=new Date().getHours(),isNight=(hr<6||hr>=20);

        /* ── Image preload ── */
        const IMGS={};
        let loadedCount=0,allLoaded=false;
        const SRC={
          chars:  'assets/rpg_characters_1x.png',
          church: 'assets/Church_sitges.png.png',
          grass:  'assets/freepack_grass.png',
          beach:  'assets/freepack_beach.png',
          water:  'assets/freepack_water.png',
          rocks:  'assets/freepack_rocks.png',
          trees:  'assets/freepack_trees.png',
          bcn:    'assets/pixel_rpg_2.png',
          vil:    'assets/pixel_rpg_4.png',
          fogImg: 'assets/pixel_rpg_6.png',
        };
        const totalImgs=Object.keys(SRC).length;
        Object.entries(SRC).forEach(([k,src])=>{
          const img=new Image();
          img.onload=()=>{IMGS[k]=img;if(++loadedCount>=totalImgs)allLoaded=true;};
          img.onerror=()=>{IMGS[k]=null;if(++loadedCount>=totalImgs)allLoaded=true;};
          img.src=src;
        });

        /* ── Tiles ── */
        const TILES=[
          {id:'sitges',   label:'SITGES',    sub:"Plaza España · Gaby's",  x:450,y:350,unlocked:true,  bgKey:null},
          {id:'platja',   label:'PLATJA',    sub:'Sitges Beach',            x:450,y:558,unlocked:true,  bgKey:null},
          {id:'bcn',      label:'BARCELONA', sub:'Razzmatazz · Euroaula',   x:630,y:245,unlocked:false, bgKey:'bcn'},
          {id:'vilanova', label:'VILANOVA',  sub:'Tren · Luena',            x:270,y:455,unlocked:false, bgKey:'vil'},
          {id:'fog_nw',   label:'',          sub:'',                        x:270,y:245,unlocked:false, bgKey:'fogImg'},
          {id:'fog_n',    label:'',          sub:'',                        x:450,y:142,unlocked:false, bgKey:'fogImg'},
          {id:'fog_se',   label:'',          sub:'',                        x:630,y:455,unlocked:false, bgKey:'fogImg'},
        ];

        /* ── localStorage helpers ── */
        function loadExp(){try{return JSON.parse(localStorage.getItem(LS_MAP)||'[]');}catch(_){return[];}}
        function saveExp(a){try{localStorage.setItem(LS_MAP,JSON.stringify(a));}catch(_){}}

        /* ── Apply saved explored state ── */
        loadExp().forEach(e=>{
          const t=TILES.find(t2=>t2.id===e.tile);
          if(t){t.unlocked=true;if(t.id.startsWith('fog_')&&e.name)t.label=e.name.toUpperCase().slice(0,12);}
        });

        /* ── Hex path ── */
        function hexPath(cx,cy){
          ctx.beginPath();
          for(let i=0;i<6;i++){const a=Math.PI/3*i;i===0?ctx.moveTo(cx+R*Math.cos(a),cy+R*Math.sin(a)):ctx.lineTo(cx+R*Math.cos(a),cy+R*Math.sin(a));}
          ctx.closePath();
        }

        /* ── Tile image fill helper ── */
        function tileImg(img,cx,cy,fallback){
          if(!img){ctx.fillStyle=fallback;ctx.fillRect(cx-R,cy-R,2*R,2*R);return;}
          const tw=img.naturalWidth||64,th=img.naturalHeight||64;
          if(tw<=0||th<=0){ctx.fillStyle=fallback;ctx.fillRect(cx-R,cy-R,2*R,2*R);return;}
          for(let ty=cy-R;ty<cy+R;ty+=th)for(let tx=cx-R;tx<cx+R;tx+=tw)ctx.drawImage(img,tx,ty,tw,th);
        }

        /* ── Fog particles ── */
        const fogPts={};
        function initFogPts(){
          TILES.forEach(t=>{
            if(t.unlocked||fogPts[t.id])return;
            fogPts[t.id]=Array.from({length:15},()=>({
              x:t.x+(Math.random()-0.5)*R*1.1,y:t.y+(Math.random()-0.5)*R*0.65,
              vx:(Math.random()-0.5)*0.3,vy:(Math.random()-0.5)*0.2,
              r:5+Math.random()*4,a:0.06+Math.random()*0.08,
              ph:Math.random()*Math.PI*2,per:4000+Math.random()*2000,
            }));
          });
        }
        initFogPts();

        /* ── Character definitions ── */
        const CHARS=[
          {col:0,tile:'sitges',  name:'Leon'},  {col:1,tile:'sitges',  name:'Maxi'},
          {col:2,tile:'sitges',  name:'Chris'}, {col:3,tile:'sitges',  name:'Chemi'},
          {col:4,tile:'sitges',  name:'Alex'},  {col:0,tile:'platja',  name:'Leon'},
          {col:4,tile:'platja',  name:'Alex'},  {col:6,tile:'bcn',     name:'Adri'},
          {col:7,tile:'bcn',     name:'Noi'},   {col:5,tile:'vilanova',name:'Luena'},
        ];
        CHARS.forEach(c=>{
          const t=TILES.find(t2=>t2.id===c.tile);
          c.x=t.x+(Math.random()-0.5)*60; c.y=t.y+(Math.random()-0.5)*35;
          c.tx=t.x+(Math.random()-0.5)*70; c.ty=t.y+(Math.random()-0.5)*40;
          c.nxt=Date.now()+Math.random()*3000; c.fr=0; c.lf=0;
        });

        /* ── Wave + stars ── */
        let waveOff=0;
        const STARS=Array.from({length:8},()=>({
          x:Math.random()*CW,y:Math.random()*(CH*0.35),r:1,a:0.4+Math.random()*0.4,
        }));

        /* ════ DRAW FUNCTIONS ════ */

        /* ── Helpers ── */
        function drawCobble(cx,cy){
          ctx.fillStyle='#0f0c08'; ctx.fillRect(cx-R,cy-R,2*R,2*R);
          for(let ry=cy-R;ry<cy+R;ry+=10){
            const odd=Math.floor((ry-(cy-R))/10)%2;
            for(let rx=cx-R+odd*7;rx<cx+R;rx+=14){
              ctx.fillStyle='#191410'; ctx.fillRect(rx+1,ry+1,12,8);
              ctx.fillStyle='#1e1912'; ctx.fillRect(rx+1,ry+1,12,3);
            }
          }
          ctx.fillStyle='#0a0806';
          for(let ry=cy-R;ry<cy+R;ry+=10) ctx.fillRect(cx-R,ry,2*R,1);
        }

        function drawBldg(bx,by,bw,bh,floors,cols){
          ctx.fillStyle='#26211c'; ctx.fillRect(bx,by,bw,bh);
          ctx.fillStyle='#1a1612'; ctx.fillRect(bx,by,bw,3);
          ctx.fillStyle='#302a24'; ctx.fillRect(bx,by+bh-5,bw,5);
          const cw=Math.floor((bw-6)/cols), ch=Math.floor((bh-10)/floors);
          for(let f=0;f<floors;f++) for(let c=0;c<cols;c++){
            const wx=bx+3+c*cw+2, wy=by+5+f*ch+2;
            const ww=Math.max(4,cw-5), wh=Math.max(4,ch-4);
            const lit=((bx*7+by*11+c*5+f*17+1)&0xff)>50;
            if(lit){
              ctx.fillStyle='#ffc030'; ctx.fillRect(wx,wy,ww,wh);
              const g=ctx.createRadialGradient(wx+ww/2,wy+wh/2,0,wx+ww/2,wy+wh/2,15);
              g.addColorStop(0,'rgba(255,185,45,0.5)'); g.addColorStop(1,'rgba(255,185,45,0)');
              ctx.fillStyle=g; ctx.beginPath(); ctx.arc(wx+ww/2,wy+wh/2,15,0,Math.PI*2); ctx.fill();
            }else{
              ctx.fillStyle='#0c0a06'; ctx.fillRect(wx,wy,ww,wh);
            }
          }
        }

        function drawLamp(lx,ly){
          ctx.fillStyle='#504535'; ctx.fillRect(lx-1,ly,2,16); ctx.fillRect(lx-3,ly,7,2);
          ctx.fillStyle='#ffd060'; ctx.fillRect(lx-3,ly-7,6,6);
          ctx.fillStyle='#3a2e1e'; ctx.fillRect(lx-4,ly-9,8,3);
          const g=ctx.createRadialGradient(lx,ly-4,0,lx,ly-4,28);
          g.addColorStop(0,'rgba(255,190,50,0.6)'); g.addColorStop(0.45,'rgba(255,160,30,0.2)'); g.addColorStop(1,'rgba(255,140,20,0)');
          ctx.fillStyle=g; ctx.beginPath(); ctx.arc(lx,ly-4,28,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='#fff5c0'; ctx.beginPath(); ctx.arc(lx,ly-4,3,0,Math.PI*2); ctx.fill();
        }

        function drawBeacon(bx,by){
          const ag=ctx.createRadialGradient(bx,by,0,bx,by,52);
          ag.addColorStop(0,'rgba(255,165,25,0.75)'); ag.addColorStop(0.45,'rgba(255,120,15,0.28)'); ag.addColorStop(1,'rgba(255,80,10,0)');
          ctx.fillStyle=ag; ctx.beginPath(); ctx.arc(bx,by,52,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='#1e1a0e'; ctx.beginPath(); ctx.arc(bx,by+12,15,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='#2e2812'; ctx.beginPath(); ctx.arc(bx,by+12,10,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='#cc7018'; ctx.fillRect(bx-5,by-28,10,40);
          ctx.fillStyle='#ee9030'; ctx.fillRect(bx-3,by-25,6,34);
          ctx.fillStyle='#ffb040'; ctx.fillRect(bx-2,by-22,4,28);
          const tg=ctx.createRadialGradient(bx,by-30,0,bx,by-30,18);
          tg.addColorStop(0,'rgba(255,240,120,1)'); tg.addColorStop(0.3,'rgba(255,180,40,0.9)'); tg.addColorStop(1,'rgba(255,100,20,0)');
          ctx.fillStyle=tg; ctx.beginPath(); ctx.arc(bx,by-30,18,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='#fffce0'; ctx.beginPath(); ctx.arc(bx,by-30,5,0,Math.PI*2); ctx.fill();
        }

        /* ── Sitges ── */
        function drawSitges(cx,cy){
          ctx.save(); hexPath(cx,cy); ctx.clip();
          drawCobble(cx,cy);
          // Warm ambient from beacon
          const amb=ctx.createRadialGradient(cx-22,cy+32,0,cx-22,cy+32,95);
          amb.addColorStop(0,'rgba(255,145,20,0.3)'); amb.addColorStop(1,'rgba(255,145,20,0)');
          ctx.fillStyle=amb; ctx.beginPath(); ctx.arc(cx-22,cy+32,95,0,Math.PI*2); ctx.fill();
          // Church (hero element)
          if(IMGS.church&&IMGS.church.naturalWidth>0){
            ctx.drawImage(IMGS.church,cx-48,cy-R+4,96,92);
          }else{
            drawBldg(cx-30,cy-R+8,60,55,2,2);
            ctx.fillStyle='#26211c'; ctx.fillRect(cx-9,cy-R,18,14);
            ctx.fillStyle='#6a5a4a'; ctx.fillRect(cx-1,cy-R-6,2,10); ctx.fillRect(cx-5,cy-R-1,10,2);
          }
          // Left flanking building
          drawBldg(cx-R+8,cy-28,34,58,3,2);
          // Right flanking building
          drawBldg(cx+R-42,cy-32,32,50,2,2);
          // Lamp left
          drawLamp(cx-65,cy+8);
          // Beacon (central plaza)
          drawBeacon(cx-22,cy+28);
          // Plaza stone ring
          ctx.fillStyle='#1a1710'; ctx.beginPath(); ctx.arc(cx-22,cy+50,24,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='#222016'; ctx.beginPath(); ctx.arc(cx-22,cy+50,18,0,Math.PI*2); ctx.fill();
          // Palm trees from asset (small, around plaza)
          [[cx-22,cy+18],[cx-22,cy+82],[cx-50,cy+50],[cx+6,cy+50]].forEach(([tx,ty])=>{
            if(IMGS.trees&&IMGS.trees.naturalWidth>0) ctx.drawImage(IMGS.trees,0,0,16,16,tx-8,ty-10,14,14);
            else{ ctx.fillStyle='#3d2e10';ctx.fillRect(tx-2,ty-14,3,14); ctx.fillStyle='#1e3d0a';ctx.fillRect(tx-7,ty-18,14,8); }
          });
          // Lamp right (near Gaby's)
          drawLamp(cx+55,cy+18);
          // Gaby's restaurant
          const gx=cx+32,gy=cy+22;
          ctx.fillStyle='#26211c'; ctx.fillRect(gx,gy-6,48,56);
          ctx.fillStyle='#201c16'; ctx.fillRect(gx,gy-6,48,3);
          ctx.fillStyle='#e8960a'; ctx.fillRect(gx-2,gy-16,52,10);
          for(let sx=gx;sx<gx+52;sx+=8){ ctx.fillStyle='rgba(255,255,255,0.18)'; ctx.fillRect(sx,gy-16,4,10); }
          [[gx+5,gy+2],[gx+22,gy+2],[gx+38,gy+2],[gx+5,gy+20],[gx+22,gy+20],[gx+38,gy+20]].forEach(([wx,wy])=>{
            ctx.fillStyle='#ffbf28'; ctx.fillRect(wx,wy,8,7);
            const wg=ctx.createRadialGradient(wx+4,wy+3,0,wx+4,wy+3,13);
            wg.addColorStop(0,'rgba(255,190,40,0.5)'); wg.addColorStop(1,'rgba(255,190,40,0)');
            ctx.fillStyle=wg; ctx.beginPath(); ctx.arc(wx+4,wy+3,13,0,Math.PI*2); ctx.fill();
          });
          ctx.save(); ctx.font="4px 'Press Start 2P',monospace"; ctx.fillStyle='#fff8e0'; ctx.textAlign='left'; ctx.fillText("GABY'S",gx+3,gy-4); ctx.restore();
          // Ground warm tint near Gaby's door
          const dg=ctx.createRadialGradient(gx+24,gy+50,0,gx+24,gy+50,30);
          dg.addColorStop(0,'rgba(255,170,40,0.25)'); dg.addColorStop(1,'rgba(255,170,40,0)');
          ctx.fillStyle=dg; ctx.beginPath(); ctx.arc(gx+24,gy+50,30,0,Math.PI*2); ctx.fill();
          ctx.restore();
          hexPath(cx,cy); ctx.strokeStyle='#c8860a'; ctx.lineWidth=3; ctx.stroke();
          ctx.save(); ctx.textAlign='center';
          ctx.font="7px 'Press Start 2P',monospace"; ctx.fillStyle='#fff'; ctx.fillText('SITGES',cx,cy+R-10);
          ctx.font="5px 'Press Start 2P',monospace"; ctx.fillStyle='#c8a060'; ctx.fillText("Plaza España · Gaby's",cx,cy+R+4);
          ctx.restore();
        }

        /* ── Platja ── */
        function drawPlatja(cx,cy){
          const split=cy-R+Math.round(2*R*0.35);
          ctx.save(); hexPath(cx,cy); ctx.clip();
          // Building zone (top 35%)
          ctx.fillStyle='#0e0c08'; ctx.fillRect(cx-R,cy-R,2*R,split-(cy-R));
          // Cobble strip at base of buildings
          for(let rx=cx-R;rx<cx+R;rx+=14){ ctx.fillStyle='#1a1610'; ctx.fillRect(rx+1,split-7,12,6); }
          // 3 buildings with lit windows
          drawBldg(cx-52,split-44,36,44,2,2);
          drawBldg(cx-9, split-38,36,38,2,2);
          drawBldg(cx+34,split-32,36,32,2,2);
          // Tito's neon on middle building
          const tg=ctx.createRadialGradient(cx-9+18,split-20,0,cx-9+18,split-20,22);
          tg.addColorStop(0,'rgba(160,90,200,0.55)'); tg.addColorStop(1,'rgba(160,90,200,0)');
          ctx.fillStyle=tg; ctx.beginPath(); ctx.arc(cx-9+18,split-20,22,0,Math.PI*2); ctx.fill();
          ctx.save(); ctx.font="5px 'Press Start 2P',monospace"; ctx.fillStyle='#ff69b4';
          ctx.shadowColor='#ff69b4'; ctx.shadowBlur=6; ctx.textAlign='center'; ctx.fillText("TITO'S",cx-9+18,split-14); ctx.restore();
          // Beach (bottom 65%) — sandy dark
          if(IMGS.beach&&IMGS.beach.naturalWidth>0){
            const bw=IMGS.beach.naturalWidth,bh=IMGS.beach.naturalHeight;
            for(let ty=split;ty<cy+R;ty+=bh) for(let tx=cx-R;tx<cx+R;tx+=bw) ctx.drawImage(IMGS.beach,tx,ty,bw,bh);
          }else{ ctx.fillStyle='#3a2e1a'; ctx.fillRect(cx-R,split,2*R,cy+R-split); }
          // Warm sand tint
          ctx.fillStyle='rgba(180,130,60,0.22)'; ctx.fillRect(cx-R,split,2*R,35);
          // Rock border
          if(IMGS.rocks&&IMGS.rocks.naturalWidth>0){
            for(let rx=cx-R;rx<cx+R;rx+=11) ctx.drawImage(IMGS.rocks,0,0,10,10,rx,split+32,10,9);
          }else{ ctx.fillStyle='#5a5040'; for(let rx=cx-R;rx<cx+R;rx+=14) ctx.fillRect(rx,split+32,10,8); }
          // Water (animated)
          if(IMGS.water&&IMGS.water.naturalWidth>0){
            const ww=IMGS.water.naturalWidth,wh=IMGS.water.naturalHeight;
            ctx.globalAlpha=0.7;
            const sx=Math.floor(waveOff%ww);
            for(let ty=split+42;ty<cy+R;ty+=wh){
              if(sx>0) ctx.drawImage(IMGS.water,sx,0,ww-sx,wh,cx-R,ty,ww-sx,wh);
              for(let tx=cx-R+(ww-sx);tx<cx+R;tx+=ww) ctx.drawImage(IMGS.water,0,0,ww,wh,tx,ty,ww,wh);
            }
            ctx.globalAlpha=1;
          }else{
            ctx.fillStyle='#0e2840'; ctx.fillRect(cx-R,split+42,2*R,cy+R-split-42);
          }
          // Moonlight shimmer
          const mx2=cx+((waveOff*0.3|0)%30)-15;
          ctx.fillStyle='rgba(180,210,255,0.18)'; ctx.fillRect(mx2,split+44,60,4);
          ctx.fillStyle='rgba(180,210,255,0.08)'; ctx.fillRect(cx-40,split+55,80,3);
          ctx.restore();
          hexPath(cx,cy); ctx.strokeStyle='#c8860a'; ctx.lineWidth=3; ctx.stroke();
          ctx.save(); ctx.textAlign='center';
          ctx.font="7px 'Press Start 2P',monospace"; ctx.fillStyle='#fff'; ctx.fillText('PLATJA',cx,cy+R-10);
          ctx.font="5px 'Press Start 2P',monospace"; ctx.fillStyle='#8aaccc'; ctx.fillText('Sitges Beach',cx,cy+R+4);
          ctx.restore();
        }

        /* ── Barcelona ── */
        function drawBcn(cx,cy,unlocked){
          ctx.save(); hexPath(cx,cy); ctx.clip();
          if(IMGS.bcn&&IMGS.bcn.naturalWidth>0){
            ctx.globalAlpha=unlocked?0.3:0.12; ctx.drawImage(IMGS.bcn,cx-R,cy-R,2*R,2*R); ctx.globalAlpha=1;
          }else{ ctx.fillStyle='#050810'; ctx.fillRect(cx-R,cy-R,2*R,2*R); }
          ctx.fillStyle=unlocked?'rgba(6,8,22,0.6)':'rgba(4,6,18,0.88)'; ctx.fillRect(cx-R,cy-R,2*R,2*R);
          if(unlocked){
            ctx.strokeStyle='#12122a'; ctx.lineWidth=1;
            for(let gx2=cx-R;gx2<=cx+R;gx2+=18){ctx.beginPath();ctx.moveTo(gx2,cy-R);ctx.lineTo(gx2,cy+R);ctx.stroke();}
            for(let gy2=cy-R;gy2<=cy+R;gy2+=18){ctx.beginPath();ctx.moveTo(cx-R,gy2);ctx.lineTo(cx+R,gy2);ctx.stroke();}
            // Buildings left side with windows
            drawBldg(cx-R+4,cy-48,30,70,4,2);
            drawBldg(cx-R+38,cy-38,24,55,3,1);
            // Sagrada spires (right-center) — organic shape
            ctx.fillStyle='#32304e';
            for(let sy=0;sy<58;sy+=4){ const w=Math.max(4,8-((sy/11)|0)+(sy%8>4?1:0)); ctx.fillRect(cx+24-w/2,cy-sy-4,w,4); }
            for(let sy=0;sy<74;sy+=4){ const w=Math.max(4,10-((sy/11)|0)+(sy%8>4?2:0)); ctx.fillRect(cx+44-w/2,cy-sy-4,w,4); }
            ctx.fillStyle='#f0c020';
            ctx.fillRect(cx+23,cy-62,2,10); ctx.fillRect(cx+20,cy-56,8,2);
            ctx.fillRect(cx+43,cy-78,2,10); ctx.fillRect(cx+40,cy-72,8,2);
            const rg=ctx.createRadialGradient(cx+34,cy-40,0,cx+34,cy-40,20);
            rg.addColorStop(0,'rgba(180,90,255,0.4)'); rg.addColorStop(1,'rgba(180,90,255,0)');
            ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(cx+34,cy-40,20,0,Math.PI*2); ctx.fill();
            // RAZZ club
            ctx.fillStyle='#0d0d10'; ctx.fillRect(cx-78,cy-40,38,32);
            ctx.fillStyle='#111118'; ctx.fillRect(cx-80,cy-46,42,8);
            ctx.save(); ctx.fillStyle='#ff1744'; ctx.shadowColor='#ff1744'; ctx.shadowBlur=10;
            ctx.font="5px 'Press Start 2P',monospace"; ctx.textAlign='left'; ctx.fillText('RAZZ',cx-76,cy-25); ctx.restore();
            ctx.fillStyle='#111'; ctx.fillRect(cx-70,cy-8,5,16); // bouncer
            ctx.fillStyle='rgba(200,30,60,0.4)';
            const rclub=ctx.createRadialGradient(cx-59,cy-46,0,cx-59,cy-46,20);
            rclub.addColorStop(0,'rgba(255,40,80,0.35)'); rclub.addColorStop(1,'rgba(255,40,80,0)');
            ctx.fillStyle=rclub; ctx.beginPath(); ctx.arc(cx-59,cy-46,20,0,Math.PI*2); ctx.fill();
            // Metro M
            ctx.fillStyle='#c0392b'; ctx.beginPath(); ctx.arc(cx+62,cy+48,9,0,Math.PI*2); ctx.fill();
            ctx.save(); ctx.fillStyle='#fff'; ctx.font='bold 9px sans-serif'; ctx.textAlign='center'; ctx.fillText('M',cx+62,cy+52); ctx.restore();
          }else{ drawFogPts('bcn'); }
          ctx.restore();
          hexPath(cx,cy); ctx.strokeStyle=unlocked?'#2a2a4a':'#0e0e24'; ctx.lineWidth=unlocked?2:1.5; ctx.stroke();
          if(unlocked){
            ctx.save(); ctx.textAlign='center';
            ctx.font="7px 'Press Start 2P',monospace"; ctx.fillStyle='#d0d0ff'; ctx.fillText('BARCELONA',cx,cy+R-10);
            ctx.font="5px 'Press Start 2P',monospace"; ctx.fillStyle='#7070a0'; ctx.fillText('Razzmatazz · Euroaula',cx,cy+R+4);
            ctx.restore();
          }
        }

        /* ── Vilanova ── */
        function drawVilanova(cx,cy,unlocked){
          ctx.save(); hexPath(cx,cy); ctx.clip();
          if(unlocked){
            drawCobble(cx,cy);
            ctx.fillStyle='rgba(200,170,100,0.1)'; ctx.fillRect(cx-R,cy-R,2*R,2*R);
            // Sky strip top
            ctx.fillStyle='#0a0e1a'; ctx.fillRect(cx-R,cy-R,2*R,36);
            // Station building (center) with lit windows
            ctx.fillStyle='#c0392b'; ctx.fillRect(cx-22,cy-24,44,8);
            ctx.fillStyle='#26211c'; ctx.fillRect(cx-22,cy-16,44,30);
            [[cx-16,cy-10],[cx-4,cy-10],[cx+8,cy-10],[cx-10,cy+8],[cx+4,cy+8]].forEach(([wx,wy])=>{
              ctx.fillStyle='#ffc030'; ctx.fillRect(wx,wy,7,7);
              const wg=ctx.createRadialGradient(wx+3,wy+3,0,wx+3,wy+3,12);
              wg.addColorStop(0,'rgba(255,185,45,0.45)'); wg.addColorStop(1,'rgba(255,185,45,0)');
              ctx.fillStyle=wg; ctx.beginPath(); ctx.arc(wx+3,wy+3,12,0,Math.PI*2); ctx.fill();
            });
            ctx.fillStyle='#888'; ctx.fillRect(cx-R,cy+16,2*R,6); // platform
            // Train tracks
            ctx.strokeStyle='#6a6a6a'; ctx.lineWidth=3;
            ctx.beginPath(); ctx.moveTo(cx-R,cy+24); ctx.lineTo(cx+R,cy+24); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx-R,cy+32); ctx.lineTo(cx+R,cy+32); ctx.stroke();
            ctx.strokeStyle='#5D4037'; ctx.lineWidth=3;
            for(let sx=cx-R+8;sx<cx+R;sx+=12){ctx.beginPath();ctx.moveTo(sx,cy+15);ctx.lineTo(sx,cy+40);ctx.stroke();}
            // Lamp on platform
            drawLamp(cx-50,cy+14);
            drawLamp(cx+50,cy+14);
            ctx.save(); ctx.font="4px 'Press Start 2P',monospace"; ctx.fillStyle='#c0a060'; ctx.textAlign='center'; ctx.fillText('VILANOVA I LA GELTRÚ',cx,cy-4); ctx.restore();
          }else{
            if(IMGS.vil&&IMGS.vil.naturalWidth>0){ctx.globalAlpha=0.12;ctx.drawImage(IMGS.vil,cx-R,cy-R,2*R,2*R);ctx.globalAlpha=1;}
            ctx.fillStyle='rgba(4,6,18,0.88)'; ctx.fillRect(cx-R,cy-R,2*R,2*R);
            drawFogPts('vilanova');
          }
          ctx.restore();
          hexPath(cx,cy); ctx.strokeStyle=unlocked?'#c8860a':'#0e0e24'; ctx.lineWidth=unlocked?3:1.5; ctx.stroke();
          if(unlocked){
            ctx.save(); ctx.textAlign='center';
            ctx.font="7px 'Press Start 2P',monospace"; ctx.fillStyle='#fff'; ctx.fillText('VILANOVA',cx,cy+R-10);
            ctx.font="5px 'Press Start 2P',monospace"; ctx.fillStyle='#c8a060'; ctx.fillText('Tren · Luena',cx,cy+R+4);
            ctx.restore();
          }
        }

        /* ── Fogged tile (always locked) ── */
        function drawFogged(cx,cy,id){
          ctx.save(); hexPath(cx,cy); ctx.clip();
          ctx.fillStyle='#040610'; ctx.fillRect(cx-R,cy-R,2*R,2*R);
          const t=TILES.find(t2=>t2.id===id);
          const bg=t&&t.bgKey?IMGS[t.bgKey]:null;
          if(bg&&bg.naturalWidth>0){ ctx.globalAlpha=0.09; ctx.drawImage(bg,cx-R,cy-R,2*R,2*R); ctx.globalAlpha=1; }
          ctx.fillStyle='rgba(4,6,18,0.82)'; ctx.fillRect(cx-R,cy-R,2*R,2*R);
          drawFogPts(id);
          // Mystery sparkle dots
          ctx.fillStyle='rgba(140,160,255,0.3)';
          [[cx-20,cy-30],[cx+35,cy+10],[cx-40,cy+45],[cx+15,cy-55]].forEach(([sx,sy])=>{
            const ph=(Date.now()/1800+sx*0.01)%1;
            const a=0.15+0.25*Math.abs(Math.sin(ph*Math.PI));
            ctx.fillStyle=`rgba(140,160,255,${a.toFixed(2)})`;
            ctx.beginPath(); ctx.arc(sx,sy,1.5,0,Math.PI*2); ctx.fill();
          });
          ctx.restore();
          hexPath(cx,cy); ctx.strokeStyle='#0c0e26'; ctx.lineWidth=1.5; ctx.stroke();
        }

        /* ── Fog particles ── */
        function drawFogPts(id){
          const pts=fogPts[id]; if(!pts)return;
          const now=Date.now();
          pts.forEach(p=>{
            const alpha=p.a*(0.4+0.6*Math.abs(Math.sin((now%(p.per||5000))/(p.per||5000)*Math.PI+p.ph)));
            ctx.fillStyle=`rgba(25,35,110,${Math.max(0,alpha).toFixed(3)})`;
            ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
          });
        }

        function drawChar(c){
          const tile=TILES.find(t=>t.id===c.tile);
          if(!tile||!tile.unlocked||!IMGS.chars||!IMGS.chars.naturalWidth)return;
          const now=Date.now();
          if(now-c.lf>180){c.fr=(c.fr+1)%4;c.lf=now;}
          ctx.drawImage(IMGS.chars,c.col*64+c.fr*16,96,16,24,Math.round(c.x)-20,Math.round(c.y)-30,40,60);
        }

        /* ── Tooltip ── */
        const tip=document.getElementById('map-tooltip');
        canvas.addEventListener('mousemove',e=>{
          const rc=canvas.getBoundingClientRect();
          const mx=(e.clientX-rc.left)*(CW/rc.width),my=(e.clientY-rc.top)*(CH/rc.height);
          let found=null;
          CHARS.forEach(c=>{
            const tile=TILES.find(t=>t.id===c.tile);
            if(!tile||!tile.unlocked)return;
            const dx=mx-c.x,dy=my-(c.y-10);
            if(Math.sqrt(dx*dx+dy*dy)<20)found=c.name;
          });
          if(tip){
            if(found){tip.style.display='block';tip.textContent=found;tip.style.left=(e.clientX+14)+'px';tip.style.top=(e.clientY-24)+'px';}
            else tip.style.display='none';
          }
        });
        canvas.addEventListener('mouseleave',()=>{if(tip)tip.style.display='none';});

        /* ── RAF loop ── */
        function mapLoop(){
          if(!document.getElementById('los-map')?.classList.contains('active')){requestAnimationFrame(mapLoop);return;}
          ctx.clearRect(0,0,CW,CH);
          ctx.fillStyle=isNight?'#02020a':'#0a0a0a'; ctx.fillRect(0,0,CW,CH);
          if(!allLoaded){
            ctx.save(); ctx.font="8px 'Press Start 2P',monospace"; ctx.fillStyle='#444';
            ctx.textAlign='center'; ctx.fillText('LOADING MAP...',CW/2,CH/2); ctx.restore();
            requestAnimationFrame(mapLoop); return;
          }
          if(isNight) STARS.forEach(s=>{
            ctx.fillStyle='rgba(255,255,255,'+s.a+')';
            ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill();
          });
          waveOff=(waveOff+0.4)%512;
          const now=Date.now();
          CHARS.forEach(c=>{
            const tile=TILES.find(t=>t.id===c.tile);
            if(!tile||!tile.unlocked)return;
            if(now>=c.nxt){
              c.tx=tile.x+(Math.random()-0.5)*80; c.ty=tile.y+(Math.random()-0.5)*45;
              c.nxt=now+3000+Math.random()*2000;
            }
            const dx=c.tx-c.x,dy=c.ty-c.y,dist=Math.sqrt(dx*dx+dy*dy);
            if(dist>0.5){c.x+=dx/dist*0.4; c.y+=dy/dist*0.4;}
          });
          TILES.forEach(t=>{
            if(t.unlocked)return;
            const pts=fogPts[t.id]; if(!pts)return;
            pts.forEach(p=>{
              p.x+=p.vx; p.y+=p.vy;
              if(Math.abs(p.x-t.x)>R*0.82)p.vx*=-1;
              if(Math.abs(p.y-t.y)>R*0.65)p.vy*=-1;
              if(t._fading)p.a=Math.max(0,p.a-0.005);
            });
          });
          const [sitges,platja,bcn,vil,fnw,fn,fse]=TILES;
          drawSitges(sitges.x,sitges.y);
          drawPlatja(platja.x,platja.y);
          drawBcn(bcn.x,bcn.y,bcn.unlocked);
          drawVilanova(vil.x,vil.y,vil.unlocked);
          drawFogged(fnw.x,fnw.y,'fog_nw');
          drawFogged(fn.x,fn.y,'fog_n');
          drawFogged(fse.x,fse.y,'fog_se');
          CHARS.forEach(c=>{
            const tile=TILES.find(t=>t.id===c.tile);
            if(!tile||!tile.unlocked)return;
            ctx.save(); hexPath(tile.x,tile.y); ctx.clip();
            drawChar(c);
            ctx.restore();
          });
          if(isNight){ctx.fillStyle='rgba(0,0,20,0.3)'; ctx.fillRect(0,0,CW,CH);}
          requestAnimationFrame(mapLoop);
        }
        requestAnimationFrame(mapLoop);

        /* ── Stale check ── */
        function checkStale(){
          const exp=loadExp(); if(!exp.length)return;
          const last=exp.reduce((a,b)=>a.date>b.date?a:b);
          const days=(Date.now()-new Date(last.date).getTime())/86400000;
          const bn=document.getElementById('map-stale-banner');
          if(bn)bn.style.display=days>=7?'block':'none';
        }
        checkStale();

        function populateDrop(){
          const sel=document.getElementById('map-tile-sel'); if(!sel)return;
          sel.innerHTML='';
          const fogged=TILES.filter(t=>!t.unlocked);
          if(!fogged.length){sel.innerHTML='<option>All tiles explored!</option>';return;}
          fogged.forEach(t=>{
            const o=document.createElement('option'); o.value=t.id;
            o.textContent=t.id.startsWith('fog_')?'Unknown ('+t.id.replace('fog_','').toUpperCase()+')':t.label||t.id;
            sel.appendChild(o);
          });
        }
        populateDrop();

        function renderLog(){
          const el=document.getElementById('map-log-list');
          const cnt=document.getElementById('map-total-count');
          const exp=loadExp();
          if(cnt)cnt.textContent=exp.length+(exp.length===1?' tile':' tiles');
          if(!el)return;
          if(!exp.length){el.innerHTML='<div style="font-size:12px;color:#2e2e2e;padding:8px 0">No tiles explored yet. Hit ⚔ EXPLORE to begin.</div>';return;}
          el.innerHTML=[...exp].reverse().map(e=>`<div class="map-log-item"><span class="map-log-date">${e.date}</span><span class="map-log-tile">${e.name||e.tile}</span><span class="map-log-notes">${e.notes||'—'}</span></div>`).join('');
        }
        renderLog();

        const eBtn=document.getElementById('map-explore-btn');
        const eForm=document.getElementById('map-explore-form');
        eBtn?.addEventListener('click',()=>{eForm?.classList.toggle('open');populateDrop();});
        document.getElementById('map-explore-cancel')?.addEventListener('click',()=>eForm?.classList.remove('open'));

        document.getElementById('map-explore-submit')?.addEventListener('click',()=>{
          const name=(document.getElementById('map-loc-name')?.value||'').trim();
          const tileId=document.getElementById('map-tile-sel')?.value;
          const notes=(document.getElementById('map-notes')?.value||'').trim();
          if(!name||!tileId)return;
          const tile=TILES.find(t=>t.id===tileId); if(!tile||tile.unlocked)return;
          eForm?.classList.remove('open');
          tile._fading=true;
          setTimeout(()=>{
            tile.unlocked=true; tile._fading=false;
            if(tile.id.startsWith('fog_')&&name)tile.label=name.toUpperCase().slice(0,12);
            delete fogPts[tile.id];
            populateDrop();
          },1200);
          const exp=loadExp();
          exp.push({date:new Date().toISOString().slice(0,10),tile:tileId,name,notes});
          saveExp(exp); checkStale();
          ['map-loc-name','map-notes'].forEach(id=>{const el2=document.getElementById(id);if(el2)el2.value='';});
          const ov=document.getElementById('map-dice-overlay');
          const dn=document.getElementById('map-dice-num');
          const dr=document.getElementById('map-dice-result');
          if(ov&&dn&&dr){
            ov.classList.add('active'); dn.classList.add('spinning');
            let spins=0;
            const iv=setInterval(()=>{
              dn.textContent=Math.floor(Math.random()*6)+1;
              if(++spins>=8){
                clearInterval(iv);
                const roll=Math.floor(Math.random()*6)+1;
                dn.textContent=roll; dn.classList.remove('spinning');
                if(roll===6){dr.innerHTML='<div class="map-dice-gold">LEGENDARY LOOT 🎲</div>';}
                else{
                  dr.textContent='+15 SOC XP!';
                  const xpd=lsLoad(LS_SKILLS_XP)||{};
                  xpd['SOC']=(xpd['SOC']||0)+15; lsSave2(LS_SKILLS_XP,xpd);
                  renderSkillsXP();
                }
                setTimeout(()=>{ov.classList.remove('active');dn.textContent='?';dr.textContent='';renderLog();},2200);
              }
            },100);
          }
        });
      } /* end initMap */


      /* ── Init ── */
      function initLOS(){
        initTabs(); initGIFD(); initSkills(); initRadar(); initMana(); initCodex(); initMap();
        loadChartLOS(()=>{renderGIFDCharts();});
      }

      const losSec=document.getElementById('section-life-os');
      let losInited=false;
      if(losSec){
        new MutationObserver(()=>{if(losSec.classList.contains('active')&&!losInited){losInited=true;initLOS();}})
          .observe(losSec,{attributes:true,attributeFilter:['class']});
        if(losSec.classList.contains('active')){losInited=true;initLOS();}
      }

    })(); /* end Life OS IIFE */

    /* ══════════════════════════════
       LIFE GOALS
    ══════════════════════════════ */
    (function () {
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
    })();

    /* ══════════════════════════════
       MOVEMENT — WORKOUT + SLEEP
    ══════════════════════════════ */
    (function () {
      const LS_WO    = 'leon-workout-v3';
      const LS_SLEEP = 'leon-sleep-v1';
      const TODAY    = new Date().toISOString().slice(0, 10);

      /* ── Workout ── */
      function lsWo()    { try { return JSON.parse(localStorage.getItem(LS_WO) || '{}'); } catch(_) { return {}; } }
      function saveWo(d) { try { localStorage.setItem(LS_WO, JSON.stringify(d)); } catch(_) {} }

      function getWoData() {
        const d = lsWo();
        if (!d.prs)      d.prs      = {};
        if (!d.sessions) d.sessions = [];
        return d;
      }

      function todaySets(d) {
        let s = d.sessions.find(s => s.date === TODAY);
        if (!s) { s = { date: TODAY, sets: [] }; d.sessions.push(s); }
        return s;
      }

      function isPR(d, exercise, kg, reps) {
        const prev = d.prs[exercise];
        if (!prev) return true;
        if (kg > prev.kg) return true;
        return kg === prev.kg && reps > prev.reps;
      }

      function updatePR(d, exercise, kg, reps) {
        const prev = d.prs[exercise];
        if (!prev || kg > prev.kg || (kg === prev.kg && reps > prev.reps)) {
          d.prs[exercise] = { kg, reps };
        }
      }

      function refreshExerciseList(d) {
        const dl = document.getElementById('exercise-history');
        if (!dl) return;
        dl.innerHTML = '';
        const names = [...new Set(d.sessions.flatMap(s => s.sets.map(x => x.exercise)))];
        names.forEach(n => { const opt = document.createElement('option'); opt.value = n; dl.appendChild(opt); });
      }

      function showLastBest(d, exercise) {
        const el = document.getElementById('wo-lastbest');
        if (!el) return;
        const prev = d.prs[exercise];
        if (!exercise || !prev) { el.style.display = 'none'; return; }
        el.style.display = '';
        el.innerHTML = `Last best: <span class="pr-highlight">${prev.kg}kg × ${prev.reps}</span> for <strong style="color:#bbb">${exercise}</strong>`;
      }

      function renderWorkoutToday(d) {
        const wrap  = document.getElementById('workout-session-wrap');
        const empty = document.getElementById('workout-session-empty');
        if (!wrap) return;
        const today = d.sessions.find(s => s.date === TODAY);
        if (!today || !today.sets.length) {
          wrap.innerHTML = '';
          if (empty) { empty.style.display = ''; wrap.appendChild(empty); }
          return;
        }
        if (empty) empty.style.display = 'none';
        wrap.innerHTML = '';

        // Group by exercise
        const groups = {};
        today.sets.forEach((set, idx) => {
          if (!groups[set.exercise]) groups[set.exercise] = [];
          groups[set.exercise].push({ ...set, idx });
        });

        Object.entries(groups).forEach(([ex, sets]) => {
          const bestSet = sets.reduce((b, s) => s.kg > b.kg ? s : b, sets[0]);
          const pr = d.prs[ex];
          const isExPR = pr && bestSet.kg >= pr.kg && bestSet.reps >= pr.reps;

          const grp = document.createElement('div');
          grp.className = 'workout-exercise-group';
          grp.innerHTML = `
            <div class="workout-ex-header">
              <span class="workout-ex-name">${ex}</span>
              <span class="workout-ex-pr${isExPR ? ' show' : ''}">🏆 PR</span>
            </div>
            ${sets.map((s, i) => `
              <div class="workout-set-row">
                <span class="workout-set-num">Set ${i + 1}</span>
                <span class="workout-set-data">${s.kg} kg × ${s.reps} reps</span>
                <button class="workout-set-del" data-idx="${s.idx}" title="Remove">×</button>
              </div>`).join('')}`;
          wrap.appendChild(grp);
        });

        wrap.querySelectorAll('.workout-set-del').forEach(btn => {
          btn.addEventListener('click', () => {
            const d2 = getWoData();
            const t  = todaySets(d2);
            t.sets.splice(+btn.dataset.idx, 1);
            saveWo(d2);
            renderWorkoutToday(d2);
            renderWorkoutHistory(d2);
          });
        });
      }

      function renderWorkoutHistory(d) {
        const wrap = document.getElementById('workout-history-wrap');
        const list = document.getElementById('workout-history-list');
        if (!wrap || !list) return;
        const past = d.sessions.filter(s => s.date !== TODAY && s.sets.length).slice(-7).reverse();
        if (!past.length) { wrap.style.display = 'none'; return; }
        wrap.style.display = '';
        list.innerHTML = '';
        past.forEach(s => {
          const groups = {};
          s.sets.forEach(set => { if (!groups[set.exercise]) groups[set.exercise] = []; groups[set.exercise].push(set); });
          const summary = Object.entries(groups).map(([ex, sets]) => {
            const best = sets.reduce((b, x) => x.kg > b.kg ? x : b, sets[0]);
            return `${ex}: ${sets.length} sets · best ${best.kg}kg×${best.reps}`;
          }).join(' &nbsp;·&nbsp; ');
          const el = document.createElement('div');
          el.className = 'workout-history-session';
          el.innerHTML = `<div class="workout-history-date">${s.date}</div><div class="workout-history-detail">${summary}</div>`;
          list.appendChild(el);
        });
      }

      const exInput   = document.getElementById('wo-exercise');
      const kgInput   = document.getElementById('wo-weight');
      const repsInput = document.getElementById('wo-reps');
      const prMsg     = document.getElementById('workout-pr-msg');

      exInput?.addEventListener('input', () => showLastBest(getWoData(), exInput.value.trim()));

      function doLogSet() {
        const ex   = exInput?.value?.trim();
        const kg   = parseFloat(kgInput?.value);
        const reps = parseInt(repsInput?.value, 10);
        if (!ex || isNaN(kg) || isNaN(reps) || reps < 1) return;

        const d     = getWoData();
        const newPR = isPR(d, ex, kg, reps);
        todaySets(d).sets.push({ exercise: ex, kg, reps });
        updatePR(d, ex, kg, reps);
        saveWo(d);

        renderWorkoutToday(d);
        renderWorkoutHistory(d);
        refreshExerciseList(d);
        showLastBest(d, ex);

        if (newPR && prMsg) {
          prMsg.style.display = '';
          setTimeout(() => { if (prMsg) prMsg.style.display = 'none'; }, 3000);
          // PR glow on the exercise group
          setTimeout(() => {
            document.querySelectorAll('.workout-exercise-group').forEach(g => {
              if (g.querySelector('.workout-ex-name')?.textContent === ex) {
                g.classList.remove('pr-flash');
                void g.offsetWidth;
                g.classList.add('pr-flash');
              }
            });
          }, 80);
        }

        window.updateDailyScore?.();

        if (kgInput)   kgInput.value   = '';
        if (repsInput) repsInput.value = '';
        if (exInput)   exInput.focus();
      }

      document.getElementById('wo-log-btn')?.addEventListener('click', doLogSet);
      repsInput?.addEventListener('keydown', e => { if (e.key === 'Enter') doLogSet(); });

      document.getElementById('workout-history-toggle')?.addEventListener('click', function() {
        const list = document.getElementById('workout-history-list');
        if (!list) return;
        const open = list.style.display === 'none' || !list.style.display;
        list.style.display = open ? '' : 'none';
        this.textContent = open ? 'Hide' : 'Show';
      });

      /* ── Sleep OS ── */
      const LS_SLEEP2 = 'leon-sleep-v2';

      function lsSleep2() { try { return JSON.parse(localStorage.getItem(LS_SLEEP2) || '{"entries":[]}'); } catch(_) { return {entries:[]}; } }
      function saveSleep2(d) { try { localStorage.setItem(LS_SLEEP2, JSON.stringify(d)); } catch(_) {} }

      // Also keep v1 compatibility (gamification reads v1)
      function writeSleepV1(hours, quality) {
        try { localStorage.setItem(LS_SLEEP, JSON.stringify({ date: TODAY, hours, quality })); } catch(_) {}
      }

      function timeDiffHours(bed, wake) {
        if (!bed || !wake) return 0;
        const [bh, bm] = bed.split(':').map(Number);
        const [wh, wm] = wake.split(':').map(Number);
        let diff = (wh * 60 + wm) - (bh * 60 + bm);
        if (diff <= 0) diff += 1440; // crosses midnight
        return +(diff / 60).toFixed(2);
      }

      function fmtHours(h) {
        if (!h || h <= 0) return '—';
        const hrs = Math.floor(h), mins = Math.round((h - hrs) * 60);
        return mins ? `${hrs}h ${mins}m` : `${hrs}h`;
      }

      function calcSleepDebt(entries) {
        const GOAL = 8;
        const last7 = entries.slice(-7);
        const debt = last7.reduce((acc, e) => acc + Math.max(0, GOAL - (e.actual || 0)), 0);
        return +debt.toFixed(1);
      }

      function updateSleepSummary() {
        const bed      = document.getElementById('sleep-bedtime')?.value;
        const wake     = document.getElementById('sleep-waketime')?.value;
        const fallin   = parseInt(document.getElementById('sleep-fallin-display')?.textContent) || 15;
        const inBed    = timeDiffHours(bed, wake);
        const actual   = Math.max(0, inBed - fallin / 60);
        const data     = lsSleep2();
        const debt     = calcSleepDebt(data.entries);

        const inBedEl  = document.getElementById('sleep-sum-inbed');
        const actEl    = document.getElementById('sleep-sum-actual');
        const debtEl   = document.getElementById('sleep-sum-debt');
        if (inBedEl) inBedEl.textContent  = fmtHours(inBed);
        if (actEl)   { actEl.textContent  = fmtHours(actual); actEl.style.color = actual >= 7 ? 'var(--green)' : actual >= 6 ? 'var(--amber)' : 'var(--red)'; }
        if (debtEl)  { debtEl.textContent = debt > 0 ? `-${debt}h` : '0h'; debtEl.style.color = debt > 5 ? 'var(--red)' : debt > 2 ? 'var(--amber)' : 'var(--green)'; }
        return { inBed, actual, fallin };
      }

      // Fall-asleep minutes +/-
      let fallInMins = 15;
      document.getElementById('sleep-fallin-minus')?.addEventListener('click', () => {
        fallInMins = Math.max(0, fallInMins - 5);
        const el = document.getElementById('sleep-fallin-display');
        if (el) el.textContent = fallInMins + ' min';
        updateSleepSummary();
      });
      document.getElementById('sleep-fallin-plus')?.addEventListener('click', () => {
        fallInMins = Math.min(120, fallInMins + 5);
        const el = document.getElementById('sleep-fallin-display');
        if (el) el.textContent = fallInMins + ' min';
        updateSleepSummary();
      });

      document.getElementById('sleep-bedtime')?.addEventListener('change', updateSleepSummary);
      document.getElementById('sleep-waketime')?.addEventListener('change', updateSleepSummary);

      // Quality pills
      let sleepQuality = 0;
      const pillsWrap = document.getElementById('sleep-quality-pills');
      if (pillsWrap) {
        [['😞',1],['🙁',2],['😐',3],['🙂',4],['😊',5]]
          .forEach(([emoji, q]) => {
            const btn = document.createElement('button');
            btn.className = 'sleep-quality-pill';
            btn.dataset.q = q;
            btn.textContent = emoji;
            btn.title = ['','Terrible','Bad','Ok','Good','Great'][q];
            btn.addEventListener('click', () => {
              sleepQuality = q;
              document.querySelectorAll('.sleep-quality-pill').forEach(p => p.classList.toggle('sel', +p.dataset.q === q));
            });
            pillsWrap.appendChild(btn);
          });
      }

      // Save
      document.getElementById('sleep-save-btn')?.addEventListener('click', () => {
        const bed   = document.getElementById('sleep-bedtime')?.value;
        const wake  = document.getElementById('sleep-waketime')?.value;
        if (!bed || !wake) return;
        const { inBed, actual } = updateSleepSummary();
        const data = lsSleep2();
        // Remove existing entry for today if present
        data.entries = data.entries.filter(e => e.date !== TODAY);
        data.entries.push({ date: TODAY, bedtime: bed, waketime: wake, fallInMins, quality: sleepQuality, inBed: +inBed.toFixed(2), actual: +actual.toFixed(2) });
        // Keep max 90 days
        if (data.entries.length > 90) data.entries = data.entries.slice(-90);
        saveSleep2(data);
        writeSleepV1(actual, sleepQuality); // keep v1 for gamification
        renderSleepChart();
        window.updateDailyScore?.();
        const btn = document.getElementById('sleep-save-btn');
        if (btn) { btn.textContent = '✓ Saved!'; setTimeout(() => { btn.textContent = 'Save night'; }, 2000); }
      });

      // 7-day chart — single bar (actual sleep) with quality on hover
      const QUAL_LABEL = ['—', 'Terrible 😞', 'Bad 🙁', 'Ok 😐', 'Good 🙂', 'Great 😊'];
      let sleepChart = null;
      function renderSleepChart() {
        if (!window.Chart) return;
        const data  = lsSleep2();
        const last7 = [];
        for (let i = 6; i >= 0; i--) {
          const d     = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
          const entry = data.entries.find(e => e.date === d);
          const actual  = entry?.actual  || 0;
          const quality = entry?.quality || 0;
          const label   = d.slice(5); // MM-DD
          last7.push({ label, actual, quality, hasData: !!entry });
        }
        const canvas = document.getElementById('sleep-week-chart');
        if (!canvas) return;
        if (sleepChart) { sleepChart.destroy(); sleepChart = null; }

        sleepChart = new Chart(canvas.getContext('2d'), {
          type: 'bar',
          data: {
            labels: last7.map(d => d.label),
            datasets: [{
              label: 'Sleep',
              data:  last7.map(d => d.actual),
              backgroundColor: last7.map(d => {
                if (!d.hasData) return 'rgba(40,40,40,0.4)';
                return d.actual >= 7 ? 'rgba(77,170,125,0.65)' :
                       d.actual >= 6 ? 'rgba(201,160,50,0.6)'  :
                                       'rgba(201,79,79,0.55)';
              }),
              borderRadius: 5,
              borderSkipped: false,
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: '#111',
                borderColor: '#2a2a2a',
                borderWidth: 1,
                titleColor: '#888',
                bodyColor: '#ddd',
                padding: 10,
                callbacks: {
                  title: ctx => last7[ctx[0].dataIndex].label,
                  label: ctx => {
                    const d   = last7[ctx.dataIndex];
                    if (!d.hasData) return ' No data logged';
                    const hrs = Math.floor(d.actual);
                    const min = Math.round((d.actual - hrs) * 60);
                    const timeStr = min ? `${hrs}h ${min}m` : `${hrs}h`;
                    const qual = QUAL_LABEL[d.quality] || '—';
                    return [` ${timeStr} slept`, ` Quality: ${qual}`];
                  }
                }
              }
            },
            scales: {
              x: { grid: { color: '#161616' }, border: { color: '#1e1e1e' }, ticks: { color: '#444', font: { size: 9 } } },
              y: {
                grid: { color: '#161616' }, border: { color: '#1e1e1e' },
                ticks: { color: '#444', font: { size: 9 }, callback: v => v + 'h' },
                suggestedMax: 9,
                /* 8h goal line via custom annotation-free approach */
              }
            }
          }
        });
      }

      // AI analysis
      document.getElementById('sleep-ai-btn')?.addEventListener('click', async () => {
        const apiKey = localStorage.getItem('anthropic_api_key');
        const resultEl   = document.getElementById('sleep-ai-result');
        const thinkingEl = document.getElementById('sleep-thinking');
        const btn        = document.getElementById('sleep-ai-btn');
        if (!apiKey) { if (resultEl) { resultEl.style.display=''; resultEl.textContent='Add your Anthropic API key in Nutrition to enable AI analysis.'; } return; }

        const data = lsSleep2();
        const last7 = data.entries.slice(-7);
        if (!last7.length) { if (resultEl) { resultEl.style.display=''; resultEl.textContent='Log at least one night first.'; } return; }

        const summary = last7.map(e => `${e.date}: ${e.actual}h sleep (${e.inBed}h in bed, quality ${e.quality}/5)`).join('\n');
        if (btn) btn.disabled = true;
        if (thinkingEl) thinkingEl.classList.add('show');
        if (resultEl) resultEl.style.display = 'none';

        try {
          const resp = await fetch('https://api.anthropic.com/v1/messages', {
            method:'POST',
            headers:{'x-api-key':apiKey,'anthropic-version':'2023-06-01','content-type':'application/json','anthropic-dangerous-direct-browser-access':'true'},
            body: JSON.stringify({
              model:'claude-haiku-4-5-20251001', max_tokens:256,
              system:'You are a concise sleep coach. Analyse the sleep data and give 2-3 short, actionable insights. Be direct and specific. Max 3 sentences.',
              messages:[{role:'user',content:`My sleep last 7 days:\n${summary}\nGive brief insights.`}]
            })
          });
          if (!resp.ok) throw new Error(resp.status);
          const d = await resp.json();
          if (resultEl) { resultEl.textContent = d.content[0].text.trim(); resultEl.style.display=''; }
        } catch(err) {
          if (resultEl) { resultEl.textContent = 'Analysis failed. Try again.'; resultEl.style.display=''; }
        } finally {
          if (btn) btn.disabled = false;
          if (thinkingEl) thinkingEl.classList.remove('show');
        }
      });

      // Restore today's entry if exists
      (function initSleepOS() {
        const data    = lsSleep2();
        const tonight = data.entries.find(e => e.date === TODAY);
        if (tonight) {
          const bed = document.getElementById('sleep-bedtime');
          const wk  = document.getElementById('sleep-waketime');
          if (bed) bed.value = tonight.bedtime || '23:00';
          if (wk)  wk.value  = tonight.waketime || '07:30';
          fallInMins = tonight.fallInMins || 15;
          const fd = document.getElementById('sleep-fallin-display');
          if (fd) fd.textContent = fallInMins + ' min';
          sleepQuality = tonight.quality || 0;
          document.querySelectorAll('.sleep-quality-pill').forEach(p => p.classList.toggle('sel', +p.dataset.q === sleepQuality));
        }
        updateSleepSummary();
      })();

      // Export for Today dashboard quick-log
      window.saveSleepQuick = function(bedtime, waketime) {
        const inBed  = timeDiffHours(bedtime, waketime);
        const actual = Math.max(0, inBed - 15/60);
        const data   = lsSleep2();
        data.entries = data.entries.filter(e => e.date !== TODAY);
        data.entries.push({ date: TODAY, bedtime, waketime, fallInMins: 15, quality: 0, inBed: +inBed.toFixed(2), actual: +actual.toFixed(2) });
        if (data.entries.length > 90) data.entries = data.entries.slice(-90);
        saveSleep2(data);
        writeSleepV1(actual, 0);
        // Sync the Sleep OS inputs
        const b = document.getElementById('sleep-bedtime'); if (b) b.value = bedtime;
        const w = document.getElementById('sleep-waketime'); if (w) w.value = waketime;
        updateSleepSummary();
        window.updateDailyScore?.();
      };

      // Load chart lazily when section opens (Chart.js already loaded by Life OS)
      function tryRenderSleepChart() { if (window.Chart) renderSleepChart(); else setTimeout(tryRenderSleepChart, 500); }
      tryRenderSleepChart();

      /* ── Init (lazy) ── */
      const sec = document.getElementById('section-movement');
      /* workout logger removed — no init needed; sleep chart renders via tryRenderSleepChart */
    })();

    /* ══════════════════════════════
       NUTRITION
    ══════════════════════════════ */
    (function () {
      const LS_KEY      = 'leon-nutrition-v2';
      const LS_HISTORY  = 'leon-nutr-history-v1';  // { [date]: { protein, calories } }
      const LS_PRESETS  = 'leon-nutr-presets-v1';  // [{ emoji, name, p }]
      const LS_WATER    = 'leon-nutr-water-v1';     // { date, glasses }
      let nutrActiveDate = lDate(new Date());
      const WATER_GOAL  = 8;

      function renderNutrDateNav() {
        const el = document.getElementById('nutr-date-display');
        const nextBtn = document.getElementById('nutr-date-next');
        const realToday = lDate(new Date());
        if (el) {
          const d = new Date(nutrActiveDate + 'T00:00:00');
          el.textContent = nutrActiveDate === realToday
            ? 'Today'
            : d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
        }
        if (nextBtn) nextBtn.disabled = (nutrActiveDate >= realToday);
      }

      const DEFAULT_PRESETS = [
        { emoji:'🍗', name:'Chicken', p:30 },
        { emoji:'🥚', name:'2 Eggs',  p:12 },
        { emoji:'💪', name:'Whey',    p:25 },
        { emoji:'🐟', name:'Tuna',    p:25 },
        { emoji:'🫙', name:'Yogurt',  p:15 },
        { emoji:'🥩', name:'Steak',   p:50 },
      ];

      // Load protein goal (editable)
      const LS_NUTR_GOALS = 'leon-macro-goals';
      function getProteinGoal() { try { return JSON.parse(localStorage.getItem(LS_NUTR_GOALS)||'{}').protein || 160; } catch(_) { return 160; } }
      const GOALS  = { protein: 160, carbs: 250, fat: 80 };

      const emptyDay = (date) => ({ date: date || nutrActiveDate, meals: [], totals: { protein:0, carbs:0, fat:0, calories:0 } });

      function nutrStore() {
        // Storage format: { [date]: { date, meals[], totals } }
        // Migrate old single-object format on first read
        try {
          const raw = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
          if (raw.date && Array.isArray(raw.meals)) {
            // Old format — migrate to dict
            const migrated = { [raw.date]: raw };
            localStorage.setItem(LS_KEY, JSON.stringify(migrated));
            return migrated;
          }
          return raw;
        } catch(_) { return {}; }
      }

      function lsLoad() {
        const store = nutrStore();
        return store[nutrActiveDate] || emptyDay();
      }

      function lsSave(d) {
        try {
          const store = nutrStore();
          store[nutrActiveDate] = d;
          // Prune to last 90 days
          const keys = Object.keys(store).sort();
          if (keys.length > 90) keys.slice(0, keys.length - 90).forEach(k => delete store[k]);
          localStorage.setItem(LS_KEY, JSON.stringify(store));
        } catch(_) {}
        // Persist totals into history
        try {
          const h = JSON.parse(localStorage.getItem(LS_HISTORY) || '{}');
          h[nutrActiveDate] = { protein: d.totals.protein || 0, calories: d.totals.calories || 0 };
          const kept = {}; Object.keys(h).sort().slice(-60).forEach(k => kept[k] = h[k]);
          localStorage.setItem(LS_HISTORY, JSON.stringify(kept));
        } catch(_) {}
      }

      /* ── Presets ── */
      function loadPresets() {
        try { return JSON.parse(localStorage.getItem(LS_PRESETS) || 'null') || DEFAULT_PRESETS.map(p => ({...p})); }
        catch(_) { return DEFAULT_PRESETS.map(p => ({...p})); }
      }
      function savePresets(arr) { try { localStorage.setItem(LS_PRESETS, JSON.stringify(arr)); } catch(_) {} }

      function renderPresets() {
        const wrap = document.getElementById('protein-presets-dynamic');
        if (!wrap) return;
        const presets = loadPresets();
        wrap.innerHTML = presets.map((p, i) =>
          `<button class="protein-preset-btn" data-idx="${i}">
            <span class="pname">${p.emoji} ${p.name}</span>
            <span class="pgrams">+${p.p}g</span>
          </button>`
        ).join('');
        wrap.querySelectorAll('.protein-preset-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const ps  = loadPresets();
            const idx = parseInt(btn.dataset.idx, 10);
            const pr  = ps[idx];
            if (!pr) return;
            addMeal({ description: `${pr.emoji} ${pr.name}`, protein: pr.p, carbs: 0, fat: 0, calories: Math.round(pr.p * 4) });
            btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop');
          });
        });
      }

      function renderPresetEditor() {
        const rowsEl = document.getElementById('nutr-preset-rows');
        if (!rowsEl) return;
        const presets = loadPresets();
        rowsEl.innerHTML = presets.map((p, i) =>
          `<div class="nutr-preset-row" data-idx="${i}">
            <input class="nutr-pr-emoji" value="${p.emoji}" placeholder="🍗" maxlength="4" data-field="emoji">
            <input class="nutr-pr-name"  value="${p.name}"  placeholder="Name" data-field="name">
            <input class="nutr-pr-grams" value="${p.p}"     placeholder="g"    data-field="p" type="number" min="1">
            <button class="nutr-pr-del" data-idx="${i}" title="Delete">×</button>
          </div>`
        ).join('');
        rowsEl.querySelectorAll('.nutr-pr-del').forEach(btn => {
          btn.addEventListener('click', () => {
            const ps = loadPresets();
            ps.splice(parseInt(btn.dataset.idx, 10), 1);
            savePresets(ps);
            renderPresetEditor();
            renderPresets();
          });
        });
      }

      // Edit toggle
      const editBtn  = document.getElementById('nutr-presets-edit-btn');
      const editor   = document.getElementById('nutr-preset-editor');
      const addPBtn  = document.getElementById('nutr-preset-add-btn');
      const doneBtn  = document.getElementById('nutr-preset-done-btn');

      editBtn?.addEventListener('click', () => {
        renderPresetEditor();
        editor?.classList.add('open');
        editBtn.style.display = 'none';
      });

      doneBtn?.addEventListener('click', () => {
        // Read all inputs and save
        const rows = document.querySelectorAll('#nutr-preset-rows .nutr-preset-row');
        const updated = [];
        rows.forEach(row => {
          const emoji = row.querySelector('[data-field="emoji"]')?.value.trim() || '●';
          const name  = row.querySelector('[data-field="name"]')?.value.trim()  || 'Food';
          const p     = parseInt(row.querySelector('[data-field="p"]')?.value, 10) || 0;
          if (name && p > 0) updated.push({ emoji, name, p });
        });
        savePresets(updated);
        renderPresets();
        editor?.classList.remove('open');
        if (editBtn) editBtn.style.display = '';
      });

      addPBtn?.addEventListener('click', () => {
        const ps = loadPresets();
        ps.push({ emoji: '🍽', name: 'New food', p: 20 });
        savePresets(ps);
        renderPresetEditor();
      });

      /* ── Water tracker ── */
      function loadWater()  { try { const v = JSON.parse(localStorage.getItem(LS_WATER)||'{}'); return v[nutrActiveDate] || 0; } catch(_) { return 0; } }
      function saveWater(n) { try { const v = JSON.parse(localStorage.getItem(LS_WATER)||'{}'); v[nutrActiveDate] = n; localStorage.setItem(LS_WATER, JSON.stringify(v)); } catch(_) {} }

      function renderWater() {
        const n     = loadWater();
        const dotsEl = document.getElementById('nutr-water-dots');
        const countEl = document.getElementById('nutr-water-count');
        if (dotsEl) {
          dotsEl.innerHTML = Array.from({ length: WATER_GOAL }, (_, i) =>
            `<div class="nutr-water-dot${i < n ? ' filled' : ''}"></div>`
          ).join('');
        }
        if (countEl) countEl.textContent = `${n} / ${WATER_GOAL}`;
      }

      document.getElementById('nutr-water-plus')?.addEventListener('click', () => {
        const n = Math.min(WATER_GOAL, loadWater() + 1);
        saveWater(n); renderWater();
      });
      document.getElementById('nutr-water-minus')?.addEventListener('click', () => {
        const n = Math.max(0, loadWater() - 1);
        saveWater(n); renderWater();
      });

      /* ── 7-day protein history bars ── */
      function renderWeekBars() {
        const el   = document.getElementById('nutr-week-bars');
        if (!el) return;
        const goal = getProteinGoal();
        const h    = JSON.parse(localStorage.getItem(LS_HISTORY) || '{}');
        const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        // Build last 7 days including today
        const days = Array.from({ length: 7 }, (_, offset) => {
          const d  = new Date(); d.setDate(d.getDate() - (6 - offset));
          const ds = d.toISOString().slice(0, 10);
          return { label: DAY_LABELS[d.getDay()], protein: (h[ds]||{}).protein || 0, isToday: offset === 6 };
        });
        const maxP = Math.max(goal, ...days.map(d => d.protein), 1);
        el.innerHTML = days.map(d => {
          const barPct  = Math.round(d.protein / maxP * 100);
          const goalPct = Math.round(goal / maxP * 100);
          const color   = d.protein >= goal ? 'var(--green)' : d.protein > 0 ? '#c9a032' : '#1e1e1e';
          return `<div class="nutr-wb-col${d.isToday ? ' today' : ''}">
            <div class="nutr-wb-bar-wrap">
              <div class="nutr-wb-goal-line" style="bottom:${goalPct}%"></div>
              <div class="nutr-wb-fill" style="height:${barPct}%;background:${color}" title="${Math.round(d.protein)}g protein"></div>
            </div>
            <div class="nutr-wb-label">${d.label}</div>
          </div>`;
        }).join('');
      }

      function recalcTotals(d) {
        d.totals = { protein:0, carbs:0, fat:0, calories:0 };
        d.meals.forEach(m => {
          d.totals.protein  += m.protein  || 0;
          d.totals.carbs    += m.carbs    || 0;
          d.totals.fat      += m.fat      || 0;
          d.totals.calories += m.calories || 0;
        });
      }

      // ── Protein ring ──
      const CIRC_P = 515.22; // 2π × 82

      function getProteinStreak() {
        try {
          const s = JSON.parse(localStorage.getItem('leon-streaks-v1') || '{}');
          return (s.nutrition || {}).count || 0;
        } catch(_) { return 0; }
      }

      function renderProteinRing(protein) {
        const goal = getProteinGoal();
        const pct  = Math.min(1, protein / goal);
        const arc  = document.getElementById('protein-arc');
        const num  = document.getElementById('protein-ring-num');
        const goalSpan = document.getElementById('protein-goal-display');
        const kcalEl   = document.getElementById('protein-kcal-total');
        const streakEl = document.getElementById('protein-streak');

        if (arc) {
          arc.style.strokeDashoffset = CIRC_P - pct * CIRC_P;
          arc.style.stroke = pct >= 1 ? '#fff' : 'var(--green)';
        }
        if (num) { num.textContent = Math.round(protein); num.classList.toggle('done', pct >= 1); }
        if (goalSpan) goalSpan.textContent = goal;
        if (streakEl) streakEl.textContent = getProteinStreak();
      }

      function renderTotals(t) {
        const calEl = document.getElementById('nutr-calories');
        if (calEl) calEl.textContent = Math.round(t.calories) || 0;
        // Update hidden compat bars
        ['protein','carbs','fat'].forEach(k => {
          const fill = document.getElementById(`nutr-bar-${k}`);
          const nums = document.getElementById(`nutr-nums-${k}`);
          if (fill) fill.style.width = Math.min(100, ((t[k]||0)/GOALS[k])*100) + '%';
          if (nums) nums.textContent = `${Math.round(t[k]||0)}/${GOALS[k]}g`;
        });
        // Protein ring
        renderProteinRing(t.protein || 0);
        // Kcal in protein right panel
        const kcalEl = document.getElementById('protein-kcal-total');
        if (kcalEl) kcalEl.textContent = Math.round(t.calories || 0);
      }

      function renderMeals(d) {
        const wrap  = document.getElementById('nutr-meals');
        const empty = document.getElementById('nutr-empty');
        if (!wrap) return;
        wrap.innerHTML = '';
        if (!d.meals.length) {
          if (empty) empty.style.display = '';
          return;
        }
        if (empty) empty.style.display = 'none';

        [...d.meals].reverse().forEach((m, ri) => {
          const realIdx = d.meals.length - 1 - ri;
          const div = document.createElement('div');
          div.className = 'nutrition-meal-card';
          const t = new Date(m.ts || Date.now());
          const time = t.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' });
          div.innerHTML = `
            <div style="flex:1;min-width:0">
              <div class="nutrition-meal-desc">${m.description}</div>
              <div class="nutrition-meal-macros">
                <span class="nutrition-macro-chip protein">P ${Math.round(m.protein||0)}g</span>
                <span class="nutrition-macro-chip carbs">C ${Math.round(m.carbs||0)}g</span>
                <span class="nutrition-macro-chip fat">F ${Math.round(m.fat||0)}g</span>
                <span class="nutrition-macro-chip cals">${Math.round(m.calories||0)} kcal</span>
              </div>
            </div>
            <span class="nutrition-meal-time">${time}</span>
            <button class="nutrition-meal-del" data-i="${realIdx}" title="Remove meal">×</button>`;
          wrap.appendChild(div);
        });

        wrap.querySelectorAll('.nutrition-meal-del').forEach(btn => {
          btn.addEventListener('click', () => {
            const d2 = lsLoad();
            d2.meals.splice(+btn.dataset.i, 1);
            recalcTotals(d2);
            lsSave(d2);
            renderTotals(d2.totals);
            renderMeals(d2);
            renderWeekBars();
          });
        });
      }

      function addMeal(meal) {
        const d = lsLoad();
        d.meals.push({ ...meal, ts: Date.now() });
        recalcTotals(d);
        lsSave(d);
        renderTotals(d.totals);
        renderMeals(d);
        renderWeekBars();
        window.updateDailyScore?.();
      }

      // ── Protein presets (dynamic — rendered by renderPresets()) ──

      // Editable protein goal
      const pgInput = document.getElementById('protein-goal-input');
      if (pgInput) {
        try { pgInput.value = JSON.parse(localStorage.getItem(LS_NUTR_GOALS)||'{}').protein || 160; } catch(_) {}
        pgInput.addEventListener('change', () => {
          const v = parseInt(pgInput.value, 10);
          if (!isNaN(v) && v >= 50) {
            try {
              const g = JSON.parse(localStorage.getItem(LS_NUTR_GOALS)||'{}');
              g.protein = v; localStorage.setItem(LS_NUTR_GOALS, JSON.stringify(g));
            } catch(_) {}
            const d = lsLoad(); renderTotals(d.totals);
          }
        });
      }

      // Quick-add from Today dashboard
      window.quickAddProtein = function(grams, label, event) {
        if (event) { event.stopPropagation(); event.preventDefault(); }
        addMeal({ description: label || `+${grams}g protein`, protein: grams, carbs: 0, fat: 0, calories: grams * 4 });
        window.refreshTodayDash?.();
      };

      /* ── AI estimation ── */
      const textarea  = document.getElementById('nutr-ai-input');
      const aiBtn     = document.getElementById('nutr-ai-btn');
      const manualBtn = document.getElementById('nutr-manual-btn');
      const thinking  = document.getElementById('nutr-thinking');
      const akWrap    = document.getElementById('nutr-apikey-wrap');
      const akInput   = document.getElementById('nutr-apikey-input');
      const akSave    = document.getElementById('nutr-apikey-save');
      const manForm   = document.getElementById('nutr-manual-form');

      aiBtn?.addEventListener('click', async () => {
        const text = textarea?.value?.trim();
        if (!text) return;

        const apiKey = localStorage.getItem('anthropic_api_key');
        if (!apiKey) { akWrap?.classList.add('show'); akInput?.focus(); return; }

        if (aiBtn) aiBtn.disabled = true;
        if (thinking) thinking.classList.add('show');

        try {
          const resp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
              'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 256,
              system: 'You are a nutrition expert. Estimate macros for the described meal. Return ONLY valid JSON with no explanation, no markdown fences: {"description":"short meal label","protein":0,"carbs":0,"fat":0,"calories":0}. All numbers are grams/kcal rounded to nearest integer.',
              messages: [{ role: 'user', content: `Estimate macros for: ${text}` }]
            })
          });

          if (!resp.ok) throw new Error('API error ' + resp.status);
          const data  = await resp.json();
          const raw   = data.content[0].text.trim();
          const match = raw.match(/\{[\s\S]*\}/);
          const meal  = JSON.parse(match ? match[0] : raw);

          addMeal({
            description: meal.description || text,
            protein:  meal.protein  || 0,
            carbs:    meal.carbs    || 0,
            fat:      meal.fat      || 0,
            calories: meal.calories || Math.round((meal.protein||0)*4 + (meal.carbs||0)*4 + (meal.fat||0)*9)
          });

          if (textarea) textarea.value = '';

        } catch(err) {
          if (aiBtn) {
            const orig = aiBtn.textContent;
            aiBtn.textContent = 'Error — try again';
            setTimeout(() => { if (aiBtn) aiBtn.textContent = orig; }, 2500);
          }
        } finally {
          if (aiBtn) { aiBtn.disabled = false; }
          if (thinking) thinking.classList.remove('show');
        }
      });

      /* API key save */
      akSave?.addEventListener('click', () => {
        const k = akInput?.value?.trim();
        if (!k) return;
        localStorage.setItem('anthropic_api_key', k);
        akWrap?.classList.remove('show');
        if (akInput) akInput.value = '';
        aiBtn?.click();
      });

      /* Manual entry toggle */
      manualBtn?.addEventListener('click', () => {
        const open = manForm?.classList.toggle('open');
        if (manualBtn) manualBtn.textContent = open ? '✕ Cancel' : '+ Enter manually';
      });

      document.getElementById('nutr-manual-submit')?.addEventListener('click', () => {
        const desc = document.getElementById('nutr-manual-desc')?.value?.trim() || 'Manual entry';
        const p    = parseFloat(document.getElementById('nutr-manual-protein')?.value) || 0;
        const c    = parseFloat(document.getElementById('nutr-manual-carbs')?.value)   || 0;
        const f    = parseFloat(document.getElementById('nutr-manual-fat')?.value)     || 0;
        const cal  = parseFloat(document.getElementById('nutr-manual-cals')?.value)    || Math.round(p*4 + c*4 + f*9);
        if (!p && !c && !f && !cal) return;

        addMeal({ description: desc, protein: p, carbs: c, fat: f, calories: cal });
        ['nutr-manual-desc','nutr-manual-protein','nutr-manual-carbs','nutr-manual-fat','nutr-manual-cals']
          .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        manForm?.classList.remove('open');
        if (manualBtn) manualBtn.textContent = '+ Enter manually';
      });

      /* Clear today */
      document.getElementById('nutr-reset')?.addEventListener('click', () => {
        const d = emptyDay(); lsSave(d);
        renderTotals(d.totals); renderMeals(d); renderWeekBars();
      });

      /* Enter key in textarea triggers AI */
      textarea?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); aiBtn?.click(); }
      });

      /* ── Date navigation ── */
      function switchNutrDate(newDate) {
        nutrActiveDate = newDate;
        renderNutrDateNav();
        const d = lsLoad();
        renderTotals(d.totals);
        renderMeals(d);
        renderWater();
      }
      document.getElementById('nutr-date-prev')?.addEventListener('click', () => {
        const d = new Date(nutrActiveDate + 'T00:00:00');
        d.setDate(d.getDate() - 1);
        switchNutrDate(lDate(d));
      });
      document.getElementById('nutr-date-next')?.addEventListener('click', () => {
        const realToday = lDate(new Date());
        if (nutrActiveDate >= realToday) return;
        const d = new Date(nutrActiveDate + 'T00:00:00');
        d.setDate(d.getDate() + 1);
        switchNutrDate(lDate(d));
      });

      /* Init */
      renderNutrDateNav();
      const d = lsLoad();
      renderTotals(d.totals);
      renderMeals(d);
      renderPresets();
      renderWater();
      renderWeekBars();
    })();

    /* ══════════════════════════════
       TODAY DASHBOARD
    ══════════════════════════════ */
    (function () {
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
          return d.date === TODAY ? d : null;
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
    })();


    /* ══════════════════════════════
       MONEY SECTION
    ══════════════════════════════ */
    (function () {
      const LS_TX    = 'leon-money-tx-v1';
      const LS_GOALS = 'leon-money-goals-v1';
      const LS_ACCT  = 'leon-money-acct-v1';

      function fmtEur(n) {
        const abs = Math.abs(n);
        const s = abs.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
        return (n < 0 ? '-€' : '€') + s;
      }
      function fmtDate(iso) { const d = new Date(iso); return `${d.getDate()}/${d.getMonth()+1}`; }

      function loadTx()    { try { return JSON.parse(localStorage.getItem(LS_TX)   || '[]'); } catch(_) { return []; } }
      function saveTx(d)   { try { localStorage.setItem(LS_TX,    JSON.stringify(d)); } catch(_) {} }
      function loadGoals() { try { return JSON.parse(localStorage.getItem(LS_GOALS) || '[]'); } catch(_) { return []; } }
      function saveGoals(d){ try { localStorage.setItem(LS_GOALS, JSON.stringify(d)); } catch(_) {} }
      function loadAcct()  { try { return JSON.parse(localStorage.getItem(LS_ACCT)  || '{"checking":0,"savings":0}'); } catch(_) { return {checking:0,savings:0}; } }
      function saveAcct(d) { try { localStorage.setItem(LS_ACCT,  JSON.stringify(d)); } catch(_) {} }

      // View-month state (for Cash Flow nav) — starts at current month
      const _now = new Date();
      let viewYear  = _now.getFullYear();
      let viewMonth = _now.getMonth(); // 0-based

      document.getElementById('money-month-prev')?.addEventListener('click', () => {
        viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; }
        render();
      });
      document.getElementById('money-month-next')?.addEventListener('click', () => {
        viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; }
        render();
      });

      // Add-form toggle
      let txType = 'inc';
      document.getElementById('money-add-btn')?.addEventListener('click', () => {
        const f = document.getElementById('money-add-form');
        if (f) f.classList.toggle('open');
        // Set today's date default
        const di = document.getElementById('money-tx-date');
        if (di && !di.value) di.value = new Date().toISOString().slice(0,10);
      });
      document.getElementById('money-goal-add-btn')?.addEventListener('click', () => {
        const f = document.getElementById('money-goal-form');
        if (f) f.classList.toggle('open');
      });

      // Type toggle — only toggle the 'sel' class; keep 'inc'/'exp' on their buttons permanently
      document.getElementById('money-type-inc')?.addEventListener('click', () => {
        txType = 'inc';
        document.getElementById('money-type-inc')?.classList.add('sel');
        document.getElementById('money-type-exp')?.classList.remove('sel');
      });
      document.getElementById('money-type-exp')?.addEventListener('click', () => {
        txType = 'exp';
        document.getElementById('money-type-exp')?.classList.add('sel');
        document.getElementById('money-type-inc')?.classList.remove('sel');
      });

      // Save transaction
      document.getElementById('money-tx-save')?.addEventListener('click', () => {
        const desc   = document.getElementById('money-tx-desc')?.value.trim();
        const amount = Math.abs(parseFloat(document.getElementById('money-tx-amount')?.value || '0')); // always positive
        const cat    = document.getElementById('money-tx-cat')?.value.trim() || 'Other';
        const todayLocal = localDs(new Date());
        const date   = document.getElementById('money-tx-date')?.value || todayLocal;
        if (!desc || !amount || isNaN(amount)) return;
        const tx = { id:Date.now(), type:txType, desc, amount, cat, date };
        const data = loadTx(); data.unshift(tx); saveTx(data);
        document.getElementById('money-tx-desc').value = '';
        document.getElementById('money-tx-amount').value = '';
        document.getElementById('money-tx-cat').value = '';
        document.getElementById('money-add-form')?.classList.remove('open');
        render();
      });

      // Save goal
      document.getElementById('money-goal-save')?.addEventListener('click', () => {
        const name    = document.getElementById('money-goal-name')?.value.trim();
        const target  = parseFloat(document.getElementById('money-goal-target')?.value || '0');
        const current = parseFloat(document.getElementById('money-goal-current')?.value || '0');
        if (!name || !target) return;
        const goals = loadGoals();
        goals.push({ id:Date.now(), name, target, current });
        saveGoals(goals);
        document.getElementById('money-goal-name').value = '';
        document.getElementById('money-goal-target').value = '';
        document.getElementById('money-goal-current').value = '';
        document.getElementById('money-goal-form')?.classList.remove('open');
        render();
      });

      // Local date string helper — fixes UTC off-by-one in UTC+ timezones
      function localDs(d) {
        return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      }

      function drawChart(txList) {
        const svg = document.getElementById('money-chart-svg');
        if (!svg) return;

        // Build last 30 days cumulative balance
        const today = new Date();
        const points = [], dateLabels = [];
        let running = 0;
        const sorted = [...txList].sort((a,b) => a.date < b.date ? -1 : 1);
        const windowStart = new Date(today); windowStart.setDate(today.getDate() - 29);
        const wsStr = localDs(windowStart);
        sorted.filter(t => t.date < wsStr).forEach(t => { running += t.type==='inc' ? t.amount : -t.amount; });
        for (let i = 29; i >= 0; i--) {
          const d = new Date(today); d.setDate(today.getDate() - i);
          const ds = localDs(d);
          sorted.filter(t => t.date === ds).forEach(t => { running += t.type==='inc' ? t.amount : -t.amount; });
          points.push(running);
          dateLabels.push(d.toLocaleDateString('en-GB', { day:'numeric', month:'short' }));
        }
        if (points.every(p => p === 0)) { svg.innerHTML = ''; return; }

        const min = Math.min(...points), max = Math.max(...points);
        const range = max - min || 1;
        const W = 400, H = 90, pad = 10;
        const xs = points.map((_,i) => pad + (i/(points.length-1))*(W-2*pad));
        const ys = points.map(p => H - pad - ((p-min)/range)*(H-2*pad));
        const pathD = xs.map((x,i) => `${i===0?'M':'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
        const fillD = pathD + ` L${xs[xs.length-1]},${H} L${xs[0]},${H} Z`;
        const isPos = points[points.length-1] >= 0;
        const col = isPos ? '#4daa7d' : '#c94f4f';
        const isLight = document.body.classList.contains('light');

        svg.innerHTML = `
          <defs><linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${col}" stop-opacity="${isLight?'0.25':'0.3'}"/>
            <stop offset="100%" stop-color="${col}" stop-opacity="0"/>
          </linearGradient></defs>
          <path d="${fillD}" fill="url(#chartGrad)"/>
          <path d="${pathD}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
          <line id="mch-rule" x1="0" y1="0" x2="0" y2="${H}" stroke="${col}" stroke-width="1" stroke-dasharray="3,2" opacity="0" pointer-events="none"/>
          <circle id="mch-dot" cx="0" cy="0" r="4" fill="${col}" stroke="${isLight?'#fff':'#0d0d0d'}" stroke-width="2" opacity="0" pointer-events="none"/>
          <rect x="0" y="0" width="${W}" height="${H}" fill="none" pointer-events="all" id="mch-hit"/>`;

        // Wire up hover interaction
        const hitEl  = svg.querySelector('#mch-hit');
        const ruleEl = svg.querySelector('#mch-rule');
        const dotEl  = svg.querySelector('#mch-dot');
        const tip    = document.getElementById('money-chart-tooltip');
        const tipDate = document.getElementById('mct-date');
        const tipBal  = document.getElementById('mct-bal');

        if (!hitEl || !tip) return;

        hitEl.addEventListener('mousemove', e => {
          const svgRect = svg.getBoundingClientRect();
          const px = (e.clientX - svgRect.left) / svgRect.width * W; // map to viewBox coords
          // Find nearest data point
          let closest = 0, minDist = Infinity;
          xs.forEach((x, i) => { const d = Math.abs(x - px); if (d < minDist) { minDist = d; closest = i; } });

          const x = xs[closest], y = ys[closest];
          ruleEl.setAttribute('x1', x); ruleEl.setAttribute('x2', x); ruleEl.setAttribute('opacity', '0.6');
          dotEl.setAttribute('cx', x); dotEl.setAttribute('cy', y); dotEl.setAttribute('opacity', '1');

          // Position HTML tooltip — keep it inside the wrap
          const wrapRect = svg.parentElement.getBoundingClientRect();
          const clientX  = svgRect.left + (x / W) * svgRect.width; // real pixel X for this point
          const relX = clientX - wrapRect.left;
          const tipW = 110; // approx tooltip width
          const tipLeft = Math.min(relX - tipW / 2, wrapRect.width - tipW - 4);
          tip.style.left = Math.max(0, tipLeft) + 'px';

          tipDate.textContent = dateLabels[closest];
          tipBal.textContent  = fmtEur(points[closest]);
          tipBal.style.color  = points[closest] >= 0 ? '#4daa7d' : '#c94f4f';
          tip.classList.add('visible');
        });

        hitEl.addEventListener('mouseleave', () => {
          ruleEl.setAttribute('opacity', '0');
          dotEl.setAttribute('opacity', '0');
          tip.classList.remove('visible');
        });
      }

      function render() {
        const txList = loadTx();
        const goals  = loadGoals();
        const acct   = loadAcct();

        // All-time total balance (never changes with month nav)
        let totalBalance = 0;
        txList.forEach(t => { totalBalance += t.type === 'inc' ? t.amount : -t.amount; });

        // Current month net (for hero delta — always shows real now)
        const nowReal  = new Date();
        const curMonthStr = `${nowReal.getFullYear()}-${String(nowReal.getMonth()+1).padStart(2,'0')}`;
        let curIncome = 0, curExpense = 0;
        txList.forEach(t => {
          if (!t.date.startsWith(curMonthStr)) return;
          if (t.type === 'inc') curIncome += t.amount; else curExpense += t.amount;
        });
        const curNet = curIncome - curExpense;

        // Balance hero
        const balEl = document.getElementById('money-balance');
        if (balEl) balEl.textContent = fmtEur(totalBalance);
        const deltaEl = document.getElementById('money-delta');
        if (deltaEl) {
          deltaEl.textContent = `${curNet >= 0 ? '+' : ''}${fmtEur(curNet)} this month`;
          deltaEl.className = 'money-hero-delta' + (curNet < 0 ? ' neg' : '');
        }
        const checkEl = document.getElementById('money-checking');
        if (checkEl) checkEl.textContent = fmtEur(acct.checking || totalBalance);
        const savEl = document.getElementById('money-savings');
        if (savEl) savEl.textContent = fmtEur(acct.savings || 0);
        const netEl = document.getElementById('money-net');
        if (netEl) { netEl.textContent = (curNet >= 0 ? '+' : '') + fmtEur(curNet); netEl.style.color = curNet >= 0 ? 'var(--green)' : 'var(--red)'; }

        // ── Cash flow for viewYear/viewMonth ──
        const viewMonthStr = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}`;
        let incomeTotal = 0, expenseTotal = 0;
        txList.forEach(t => {
          if (!t.date.startsWith(viewMonthStr)) return;
          if (t.type === 'inc') incomeTotal += t.amount; else expenseTotal += t.amount;
        });
        const net = incomeTotal - expenseTotal;

        // Month label
        const mlbl = document.getElementById('money-month-label');
        if (mlbl) mlbl.textContent = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', { month:'long', year:'numeric' });

        // Disable next button if already at current month
        const nextBtn = document.getElementById('money-month-next');
        if (nextBtn) nextBtn.disabled = (viewYear === nowReal.getFullYear() && viewMonth === nowReal.getMonth());

        // Cash flow
        const incEl = document.getElementById('money-income-total');
        if (incEl) incEl.textContent = '+' + fmtEur(incomeTotal);
        const expEl = document.getElementById('money-expense-total');
        if (expEl) expEl.textContent = '-' + fmtEur(expenseTotal);
        const flowEl = document.getElementById('money-flow-net');
        if (flowEl) { flowEl.textContent = (net >= 0?'+':'') + fmtEur(net); flowEl.className = 'money-flow-amount tot'; }

        // ── Category breakdown (expenses only for viewMonth) ──
        const catTotals = {};
        txList.forEach(t => {
          if (t.type !== 'exp' || !t.date.startsWith(viewMonthStr)) return;
          catTotals[t.cat] = (catTotals[t.cat] || 0) + t.amount;
        });
        const catCard = document.getElementById('money-cat-card');
        const catList = document.getElementById('money-cat-list');
        if (catList) {
          const cats = Object.entries(catTotals).sort((a,b) => b[1]-a[1]);
          if (cats.length) {
            catCard && (catCard.style.display = '');
            const topAmt = cats[0][1];
            catList.innerHTML = cats.map(([name, amt]) =>
              `<div class="money-cat-row">
                <div class="money-cat-name">${name}</div>
                <div class="money-cat-track"><div class="money-cat-fill" style="width:${Math.round(amt/topAmt*100)}%"></div></div>
                <div class="money-cat-amt">${fmtEur(amt)}</div>
               </div>`
            ).join('');
          } else {
            catCard && (catCard.style.display = 'none');
          }
        }

        // Transaction list
        const txListEl = document.getElementById('money-tx-list');
        const txEmpty  = document.getElementById('money-tx-empty');
        if (txListEl) {
          txListEl.innerHTML = '';
          if (!txList.length) {
            if (txEmpty) { txEmpty.style.display=''; txListEl.appendChild(txEmpty); }
          } else {
            if (txEmpty) txEmpty.style.display = 'none';
            txList.slice(0,50).forEach(t => {
              const row = document.createElement('div');
              row.className = 'money-tx-item';
              const icon = t.type==='inc' ? '↑' : '↓';
              row.innerHTML = `
                <div class="money-tx-icon ${t.type}">${icon}</div>
                <div class="money-tx-desc">${t.desc}<br><span class="money-tx-cat">${t.cat}</span></div>
                <div class="money-tx-date">${fmtDate(t.date)}</div>
                <div class="money-tx-amount ${t.type}">${t.type==='inc'?'+':'-'}${fmtEur(t.amount)}</div>
                <span class="money-tx-del" data-id="${t.id}" title="Delete">×</span>`;
              row.querySelector('.money-tx-del')?.addEventListener('click', ev => {
                const id = parseInt(ev.target.dataset.id);
                saveTx(loadTx().filter(x => x.id !== id));
                render();
              });
              txListEl.appendChild(row);
            });
          }
        }

        // Goals
        const goalsEl = document.getElementById('money-goals-list');
        const goalsEmpty = document.getElementById('money-goals-empty');
        if (goalsEl) {
          goalsEl.innerHTML = '';
          if (!goals.length) {
            if (goalsEmpty) { goalsEmpty.style.display=''; goalsEl.appendChild(goalsEmpty); }
          } else {
            if (goalsEmpty) goalsEmpty.style.display='none';
            goals.forEach(g => {
              const pct = Math.min(100, Math.round((g.current / g.target) * 100));
              const item = document.createElement('div');
              item.className = 'money-goal-item';
              item.innerHTML = `
                <div class="money-goal-header">
                  <span class="money-goal-name">${g.name}</span>
                  <span class="money-goal-vals">${fmtEur(g.current)} / ${fmtEur(g.target)} · ${pct}%</span>
                </div>
                <div class="money-goal-track"><div class="money-goal-fill" style="width:${pct}%;background:${pct>=100?'var(--green)':pct>=60?'var(--amber)':'var(--blue)'}"></div></div>`;
              goalsEl.appendChild(item);
            });
          }
        }

        drawChart(txList);
      }

      // Init on section open
      const sec = document.getElementById('section-money');
      if (sec) {
        new MutationObserver(() => { if (sec.classList.contains('active')) render(); }).observe(sec, { attributes:true, attributeFilter:['class'] });
        if (sec.classList.contains('active')) render();
      }
    })();

    /* ══════════════════════════════
       SIDE PROJECTS — TIMER + REPORTS
    ══════════════════════════════ */
    (function () {
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
    })();

  
function initChicosSection() {
const stored = JSON.parse(localStorage.getItem('twochicos_weekly') || '[]');
const latest = stored[stored.length-1] || {};
let selectedPosts = latest.posts || 0;
function saveWeek() {
const entry = {
timestamp: Date.now(),
date: new Date().toISOString().split('T')[0],
followers: parseInt(document.getElementById('chicos-followers')?.value) || 0,
posts: selectedPosts,
bestViews: parseInt(document.getElementById('chicos-best-views')?.value) || 0,
dmsSent: parseInt(document.getElementById('chicos-dms-sent')?.value) || 0,
dmsReplied: parseInt(document.getElementById('chicos-dms-replied')?.value) || 0,
higgsfieldExpiry: document.getElementById('chicos-higgsfield-expiry')?.value || '',
lastPostDate: document.getElementById('chicos-last-post')?.value || ''
};
/* Overwrite today's entry if one already exists, otherwise append */
const todayIdx = stored.findIndex(e => e.date === entry.date);
if (todayIdx !== -1) stored[todayIdx] = entry;
else stored.push(entry);
localStorage.setItem('twochicos_weekly', JSON.stringify(stored));
renderChicosMetrics();
updateCountdownBadge();
}
function updateCountdownBadge() {
  const badge = document.getElementById('chicos-update-badge');
  if (!badge) return;
  const data = JSON.parse(localStorage.getItem('twochicos_weekly') || '[]');
  if (!data.length) {
    badge.textContent = 'no data yet';
    badge.className = 'chicos-update-badge badge-due';
    return;
  }
  const lastTs = data[data.length - 1].timestamp || 0;
  const msLeft = (lastTs + 7 * 86400000) - Date.now();
  const daysLeft = Math.ceil(msLeft / 86400000);
  if (daysLeft > 2) {
    badge.textContent = 'update in ' + daysLeft + 'd';
    badge.className = 'chicos-update-badge badge-ok';
  } else if (daysLeft > 0) {
    badge.textContent = 'due in ' + daysLeft + 'd';
    badge.className = 'chicos-update-badge badge-soon';
  } else if (daysLeft === 0) {
    badge.textContent = 'due today';
    badge.className = 'chicos-update-badge badge-due';
  } else {
    badge.textContent = Math.abs(daysLeft) + 'd overdue';
    badge.className = 'chicos-update-badge badge-overdue';
  }
}
function renderChicosMetrics() {
const data = JSON.parse(localStorage.getItem('twochicos_weekly') || '[]');
const latest = data[data.length-1] || {};
const prev = data[data.length-2] || {};
const lastPostDate = latest.lastPostDate ? new Date(latest.lastPostDate) : null;
const daysSince = lastPostDate ? Math.floor((Date.now() - lastPostDate) / 86400000) : null;
const followerChange = latest.followers && prev.followers ? latest.followers - prev.followers : null;
const last3 = data.slice(-3);
const avgPosts = last3.length ? last3.reduce((s,e) => s+e.posts, 0) / last3.length : 0;
const consistency = avgPosts ? Math.round((latest.posts / avgPosts) * 100) : 0;
const dmConversion = latest.dmsSent ? Math.round((latest.dmsReplied / latest.dmsSent) * 100) : 0;
const higgsfieldDays = latest.higgsfieldExpiry ? Math.ceil((new Date(latest.higgsfieldExpiry) - Date.now()) / 86400000) : null;
const monthPosts = data.filter(e => e.date && e.date.startsWith(new Date().toISOString().slice(0,7))).reduce((s,e) => s+e.posts, 0);

const daysEl = document.getElementById('chicos-days-since');
if (daysEl && daysSince !== null) {
  daysEl.textContent = daysSince;
  daysEl.className = 'days-counter ' + (daysSince >= 14 ? 'days-red pulse' : daysSince >= 7 ? 'days-orange' : '');
}

const fcEl = document.getElementById('chicos-follower-change');
if (fcEl && followerChange !== null) {
  fcEl.textContent = (followerChange >= 0 ? '▲ +' : '▼ ') + followerChange;
  fcEl.style.color = followerChange >= 0 ? '#22c55e' : '#ef4444';
}

const consEl = document.getElementById('chicos-consistency');
if (consEl) {
  consEl.textContent = consistency + '%';
  consEl.style.color = consistency >= 75 ? '#22c55e' : consistency >= 50 ? '#f59e0b' : '#ef4444';
}

const dmEl = document.getElementById('chicos-dm-rate');
if (dmEl) dmEl.textContent = dmConversion + '%';

const hEl = document.getElementById('chicos-higgsfield-days');
if (hEl && higgsfieldDays !== null) {
  hEl.textContent = higgsfieldDays <= 0 ? '🚨 USE NOW' : higgsfieldDays + ' days';
  hEl.className = 'chicos-metric-value ' + (higgsfieldDays <= 0 ? 'days-red pulse' : higgsfieldDays <= 1 ? 'days-red' : higgsfieldDays <= 3 ? 'days-orange' : '');
}

const monthEl = document.getElementById('chicos-month-posts');
if (monthEl) {
  const monthTarget = 12;
  monthEl.textContent = monthPosts + '/12-16';
  monthEl.style.color = monthPosts >= 16 ? '#22c55e' : monthPosts >= 12 ? '#4ade80' : monthPosts >= 8 ? '#f59e0b' : monthPosts >= 4 ? '#f97316' : '';
}

const alertsEl = document.getElementById('chicos-alerts');
if (alertsEl) {
  let html = '';
  if (!data.length) { alertsEl.innerHTML = ''; return; } /* no data yet — suppress all alerts */
  if (daysSince !== null && daysSince > 14) html += '<div class="chicos-alert chicos-alert-red">🔴 ' + daysSince + ' DAYS WITHOUT POSTING — @2.chicos is bleeding followers</div>';
  if (data.length > 0 && latest.posts === 0 && new Date().getDay() >= 4) html += '<div class="chicos-alert chicos-alert-amber">⚠️ No post this week yet — window closing</div>';
  if (followerChange !== null && followerChange < 0) html += '<div class="chicos-alert chicos-alert-amber">📉 Lost ' + Math.abs(followerChange) + ' followers this week — post something this weekend</div>';
  if (latest.dmsSent > 0 && latest.dmsReplied === 0) html += '<div class="chicos-alert chicos-alert-blue">💬 Sent DMs but no replies — follow up or try new brands</div>';
  if (higgsfieldDays !== null && higgsfieldDays <= 3) html += '<div class="chicos-alert chicos-alert-red">🎬 Higgsfield expires in ' + higgsfieldDays + ' days — generate content NOW</div>';
  alertsEl.innerHTML = html;
}

if (window.chicosChart) {
  window.chicosChart.data.labels = data.map(e => e.date);
  window.chicosChart.data.datasets[0].data = data.map(e => e.followers);
  window.chicosChart.data.datasets[1].data = data.map(() => 20000);
  window.chicosChart.update();
} else if (window.Chart) {
  buildChicosChart();
}
}
document.getElementById('chicos-save-btn')?.addEventListener('click', saveWeek);
/* ── Weekly form collapse toggle ── */
(function() {
  const toggleBtn = document.getElementById('chicos-form-toggle');
  const formBody  = document.getElementById('chicos-form-body');
  if (!toggleBtn || !formBody) return;
  toggleBtn.addEventListener('click', () => {
    const open = formBody.classList.toggle('open');
    toggleBtn.classList.toggle('open', open);
  });
})();
document.querySelectorAll('.chicos-post-btn').forEach(btn => {
btn.addEventListener('click', () => {
selectedPosts = parseInt(btn.dataset.val);
document.querySelectorAll('.chicos-post-btn').forEach(b => b.classList.remove('active'));
btn.classList.add('active');
});
});
/* ── Growth chart (lazy-load Chart.js if not already present) ── */
function buildChicosChart() {
  if (!window.Chart) return;
  const chartEl = document.getElementById('chicos-growth-chart');
  if (!chartEl) return;
  if (window.chicosChart) { window.chicosChart.destroy(); window.chicosChart = null; }
  const data = JSON.parse(localStorage.getItem('twochicos_weekly') || '[]');
  const ctx = chartEl.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 180);
  grad.addColorStop(0, 'rgba(59,130,246,0.18)');
  grad.addColorStop(1, 'rgba(59,130,246,0)');
  window.chicosChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(e => e.date),
      datasets: [{
        label: 'Followers',
        data: data.map(e => e.followers),
        borderColor: '#3b82f6',
        backgroundColor: grad,
        borderWidth: 1.5,
        tension: 0.4,
        fill: true,
        pointRadius: 3,
        pointBackgroundColor: '#3b82f6',
        pointBorderColor: 'transparent'
      }, {
        label: '20k goal',
        data: data.map(() => 20000),
        borderColor: '#f59e0b',
        borderDash: [5, 5],
        borderWidth: 1,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#111',
          borderColor: '#2a2a2a',
          borderWidth: 1,
          titleColor: '#555',
          bodyColor: '#ddd',
          padding: 8
        }
      },
      scales: {
        y: { grid: { color: '#1a1a1a' }, ticks: { color: '#555' }, border: { color: '#1e1e1e' } },
        x: { grid: { color: '#1a1a1a' }, ticks: { color: '#555' }, border: { color: '#1e1e1e' } }
      }
    }
  });
}
(function loadChicosChartJS() {
  if (window.Chart) { buildChicosChart(); return; }
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
  s.onload = buildChicosChart;
  document.head.appendChild(s);
})();
/* ── Chicos Kanban ── */
(function () {
  const COLS = ['idea', 'filming', 'editing', 'published'];
  const LS_KEY = 'chicos_kanban';

  /* Migrate old string-array format → {id, title} objects */
  function migrate(raw) {
    const out = {};
    COLS.forEach(col => {
      const arr = raw[col] || [];
      out[col] = arr.map((item, i) =>
        typeof item === 'string'
          ? { id: Date.now().toString() + '_' + col + '_' + i, title: item }
          : item
      );
    });
    return out;
  }

  const _raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null') || {
    idea:      ['Backrooms Ep.4 — La Sala Roja', 'Anime short'],
    filming:   ['Cinematic commercial — next brand'],
    editing:   [],
    published: ['Backrooms Ep.1 — La Oficina']
  };
  const kanbanData = migrate(_raw);

  let _dragId = null, _dragFromCol = null;

  function saveKanban() {
    localStorage.setItem(LS_KEY, JSON.stringify(kanbanData));
  }

  /* ── Touch drag-and-drop for Kanban (mobile) ── */
  function addTouchDrag(el, card, col) {
    el.addEventListener('touchstart', function(e) {
      if (e.touches.length !== 1) return;
      const touch0 = e.touches[0];
      const startX = touch0.clientX, startY = touch0.clientY;
      let ghost = null, active = false, cancelled = false;

      const holdTimer = setTimeout(() => {
        if (cancelled) return;
        active = true;
        _dragId = card.id;
        _dragFromCol = col;
        el.style.opacity = '0.35';
        const rect = el.getBoundingClientRect();
        const ox = touch0.clientX - rect.left;
        const oy = touch0.clientY - rect.top;
        ghost = el.cloneNode(true);
        ghost._ox = ox;
        ghost._oy = oy;
        ghost.style.cssText = 'position:fixed;top:' + rect.top + 'px;left:' + rect.left + 'px;width:' + rect.width + 'px;opacity:0.92;pointer-events:none;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,0.6);transform:rotate(2deg);margin:0;border-radius:8px;';
        document.body.appendChild(ghost);
      }, 230);

      function onMove(ev) {
        const t = ev.touches[0];
        if (!active) {
          if (Math.hypot(t.clientX - startX, t.clientY - startY) > 8) {
            cancelled = true;
            clearTimeout(holdTimer);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onEnd);
          }
          return;
        }
        ev.preventDefault();
        ghost.style.top  = (t.clientY - ghost._oy) + 'px';
        ghost.style.left = (t.clientX - ghost._ox) + 'px';
        ghost.style.display = 'none';
        const over = document.elementFromPoint(t.clientX, t.clientY);
        ghost.style.display = '';
        const overColEl = over ? over.closest('.chicos-kanban-col') : null;
        document.querySelectorAll('.chicos-drag-over').forEach(c => c.classList.remove('chicos-drag-over'));
        if (overColEl && overColEl.dataset.kanbanCol && overColEl.dataset.kanbanCol !== col) {
          overColEl.classList.add('chicos-drag-over');
        }
      }

      function onEnd(ev) {
        clearTimeout(holdTimer);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
        if (ghost) { ghost.remove(); ghost = null; }
        el.style.opacity = '';
        if (!active) return;
        active = false;

        const t = ev.changedTouches[0];
        const over = document.elementFromPoint(t.clientX, t.clientY);
        const overColEl = over ? over.closest('.chicos-kanban-col') : null;
        const targetCol = overColEl ? overColEl.dataset.kanbanCol : null;
        document.querySelectorAll('.chicos-drag-over').forEach(c => c.classList.remove('chicos-drag-over'));

        if (targetCol && targetCol !== col) {
          const cardObj = (kanbanData[col] || []).find(c => c.id === card.id);
          if (cardObj) {
            kanbanData[col] = kanbanData[col].filter(c => c.id !== card.id);
            if (!kanbanData[targetCol]) kanbanData[targetCol] = [];
            kanbanData[targetCol].push(cardObj);
            saveKanban();
            renderKanban();
          }
        }
        _dragId = _dragFromCol = null;
      }

      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onEnd, { passive: true });
    }, { passive: true });
  }

  /* Only render the cards list — column chrome (drop zone, + button) is set up once */
  function renderCards(col) {
    const container = document.getElementById('kanban-' + col);
    if (!container) return;
    container.innerHTML = '';

    (kanbanData[col] || []).forEach(card => {
      const el = document.createElement('div');
      el.className = 'chicos-card';
      el.draggable = true;
      el.dataset.id  = card.id;
      el.dataset.col = col;
      el.innerHTML =
        '<button class="chicos-card-del" title="Delete">✕</button>' +
        '<div class="chicos-card-title">' + card.title + '</div>';

      /* Delete */
      el.querySelector('.chicos-card-del').addEventListener('click', e => {
        e.stopPropagation();
        kanbanData[col] = kanbanData[col].filter(c => c.id !== card.id);
        saveKanban();
        renderCards(col);
      });

      /* Desktop drag */
      el.addEventListener('dragstart', e => {
        _dragId = card.id;
        _dragFromCol = col;
        setTimeout(() => el.classList.add('chicos-card-dragging'), 0);
        e.dataTransfer.effectAllowed = 'move';
      });
      el.addEventListener('dragend', () => {
        el.classList.remove('chicos-card-dragging');
        document.querySelectorAll('.chicos-drag-over')
          .forEach(c => c.classList.remove('chicos-drag-over'));
        _dragId = _dragFromCol = null;
      });

      /* Mobile touch drag */
      addTouchDrag(el, card, col);

      container.appendChild(el);
    });
  }

  function renderKanban() { COLS.forEach(renderCards); saveKanban(); }

  /* Wire drop zone + add button once per column (keyed on colEl dataset) */
  function setupColumns() {
    COLS.forEach(col => {
      const container = document.getElementById('kanban-' + col);
      if (!container) return;
      const colEl = container.closest('.chicos-kanban-col');
      if (!colEl || colEl.dataset.kanbanReady) return;
      colEl.dataset.kanbanReady = '1';
      colEl.dataset.kanbanCol = col;  // used by touch drag to identify target

      /* ── Drop zone on the full column div so empty columns work ── */
      colEl.addEventListener('dragover', e => {
        e.preventDefault();
        if (_dragFromCol !== col) colEl.classList.add('chicos-drag-over');
      });
      colEl.addEventListener('dragleave', e => {
        if (!colEl.contains(e.relatedTarget))
          colEl.classList.remove('chicos-drag-over');
      });
      colEl.addEventListener('drop', e => {
        e.preventDefault();
        colEl.classList.remove('chicos-drag-over');
        if (!_dragId || !_dragFromCol || _dragFromCol === col) return;
        const card = (kanbanData[_dragFromCol] || []).find(c => c.id === _dragId);
        if (!card) return;
        kanbanData[_dragFromCol] = kanbanData[_dragFromCol].filter(c => c.id !== _dragId);
        kanbanData[col].push(card);
        _dragId = _dragFromCol = null;
        saveKanban();
        renderKanban();
      });

      /* ── + button + inline form (Idea column only) ── */
      if (col !== 'idea') return;
      const addBtn = document.createElement('button');
      addBtn.className = 'chicos-add-btn';
      addBtn.textContent = '+';

      const addForm = document.createElement('div');
      addForm.className = 'chicos-add-form';
      addForm.innerHTML =
        '<input class="chicos-add-input" type="text" placeholder="Add a card…" />' +
        '<div class="chicos-add-actions">' +
          '<button class="chicos-add-save">Add</button>' +
          '<button class="chicos-add-cancel">✕</button>' +
        '</div>';

      const input  = addForm.querySelector('.chicos-add-input');
      const saveBtn  = addForm.querySelector('.chicos-add-save');
      const cancelBtn = addForm.querySelector('.chicos-add-cancel');

      function openForm() {
        addForm.classList.add('open');
        addBtn.classList.add('active');
        input.focus();
      }
      function closeForm() {
        addForm.classList.remove('open');
        addBtn.classList.remove('active');
        input.value = '';
      }
      function addCard() {
        const title = input.value.trim();
        if (!title) return;
        kanbanData[col].unshift({ id: Date.now().toString() + '_' + col, title });
        saveKanban();
        renderCards(col);
        closeForm();
      }

      addBtn.addEventListener('click', () => addForm.classList.contains('open') ? closeForm() : openForm());
      saveBtn.addEventListener('click', addCard);
      cancelBtn.addEventListener('click', closeForm);
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') addCard();
        if (e.key === 'Escape') closeForm();
      });

      colEl.appendChild(addBtn);
      colEl.appendChild(addForm);
    });
  }

  window._renderChicosKanban = function () {
    setupColumns();
    renderKanban();
  };
})();
/* call once on init */
if (window._renderChicosKanban) window._renderChicosKanban();
renderChicosMetrics();
updateCountdownBadge();
if (latest.followers)       document.getElementById('chicos-followers').value         = latest.followers;
if (latest.bestViews)       document.getElementById('chicos-best-views').value        = latest.bestViews;
if (latest.dmsSent)         document.getElementById('chicos-dms-sent').value          = latest.dmsSent;
if (latest.dmsReplied)      document.getElementById('chicos-dms-replied').value       = latest.dmsReplied;
if (latest.higgsfieldExpiry) document.getElementById('chicos-higgsfield-expiry').value = latest.higgsfieldExpiry;
if (latest.lastPostDate)    document.getElementById('chicos-last-post').value         = latest.lastPostDate;
document.querySelectorAll('.chicos-post-btn').forEach(btn => {
if (parseInt(btn.dataset.val) === selectedPosts) btn.classList.add('active');
});
}
document.addEventListener('DOMContentLoaded', () => { if (document.getElementById('chicos-followers')) initChicosSection(); });

/* ══════════════════════════════════════════════════════════════
   GIST SYNC — push/pull all Leon OS data to a private GitHub Gist
   Config keys (never synced themselves):
     sync-pat       — GitHub Personal Access Token
     sync-gist-id   — Gist ID (set after first push)
     sync-auto      — '1' if auto-pull on load is enabled
     sync-last-push — ISO timestamp of last push
   ══════════════════════════════════════════════════════════════ */
(function initGistSync() {
  const SKIP_KEYS = new Set(['sync-pat','sync-gist-id','sync-auto','sync-last-push']);
  const GIST_FILE = 'leon-os-data.json';

  const overlay   = document.getElementById('sync-overlay');
  const syncBtn   = document.getElementById('sync-btn');
  const patInput  = document.getElementById('sync-pat');
  const gistInput = document.getElementById('sync-gist-id');
  const autoCb    = document.getElementById('sync-auto-cb');
  const pushBtn   = document.getElementById('sync-push-btn');
  const pullBtn   = document.getElementById('sync-pull-btn');
  const statusEl  = document.getElementById('sync-status');

  if (!overlay || !syncBtn) return;

  /* ── Persist config in localStorage ── */
  function getCfg() {
    return {
      pat:    localStorage.getItem('sync-pat')     || '',
      gistId: localStorage.getItem('sync-gist-id') || '',
      auto:   localStorage.getItem('sync-auto')    === '1',
    };
  }
  function saveCfg() {
    localStorage.setItem('sync-pat',    patInput.value.trim());
    localStorage.setItem('sync-gist-id',gistInput.value.trim());
    localStorage.setItem('sync-auto',   autoCb.checked ? '1' : '0');
  }

  /* ── Open modal, populate inputs ── */
  syncBtn.addEventListener('click', () => {
    const cfg = getCfg();
    patInput.value  = cfg.pat;
    gistInput.value = cfg.gistId;
    autoCb.checked  = cfg.auto;
    const last = localStorage.getItem('sync-last-push');
    setStatus(last ? 'Last push: ' + new Date(last).toLocaleString() : '', '');
    overlay.style.display = 'flex';
    patInput.focus();
  });

  /* ── Status helper ── */
  function setStatus(msg, cls) {
    statusEl.textContent = msg;
    statusEl.className   = 'sync-status' + (cls ? ' ' + cls : '');
  }
  function setBusy(busy) {
    pushBtn.disabled = pullBtn.disabled = busy;
    syncBtn.classList.toggle('syncing', busy);
  }

  /* ── Silent auto-push (debounced) ── */
  let autoPushTimer = null;
  let autoPushing   = false;
  async function doSilentPush() {
    const cfg = getCfg();
    if (!cfg.pat || !cfg.gistId) return; // not configured — skip
    if (autoPushing) return;             // push already in flight
    autoPushing = true;
    syncBtn.classList.add('syncing');
    try {
      const content = JSON.stringify(collectData(), null, 0);
      await gistRequest('PATCH', '/gists/' + cfg.gistId, { [GIST_FILE]: { content } }, cfg.pat);
      const ts = new Date().toISOString();
      _origSetItem.call(localStorage, 'sync-last-push', ts);
    } catch(_) { /* silent — user can manually push if needed */ }
    autoPushing = false;
    syncBtn.classList.remove('syncing');
  }
  function scheduleAutoPush() {
    clearTimeout(autoPushTimer);
    autoPushTimer = setTimeout(doSilentPush, 4000);
  }

  /* ── Intercept localStorage writes to trigger auto-push ── */
  const _origSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(key, value) {
    _origSetItem(key, value);
    if (!SKIP_KEYS.has(key)) scheduleAutoPush();
  };

  /* ── Collect all data to sync ── */
  function collectData() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!SKIP_KEYS.has(k)) data[k] = localStorage.getItem(k);
    }
    return data;
  }

  /* ── Gist API helpers ── */
  async function gistRequest(method, path, body, pat) {
    const resp = await fetch('https://api.github.com' + path, {
      method,
      headers: {
        'Authorization': 'token ' + pat,
        'Accept':        'application/vnd.github+json',
        'Content-Type':  'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || resp.statusText);
    }
    return resp.json();
  }

  /* ── Push ── */
  pushBtn.addEventListener('click', async () => {
    saveCfg();
    const cfg = getCfg();
    if (!cfg.pat) { setStatus('Enter your GitHub PAT first.', 'err'); return; }
    setBusy(true);
    setStatus('Pushing…', '');
    try {
      const content = JSON.stringify(collectData(), null, 0);
      const filePayload = { [GIST_FILE]: { content } };

      let gistId = cfg.gistId;
      if (!gistId) {
        // Create new gist
        const created = await gistRequest('POST', '/gists', {
          description: 'Leon OS dashboard data',
          public: false,
          files: filePayload,
        }, cfg.pat);
        gistId = created.id;
        localStorage.setItem('sync-gist-id', gistId);
        gistInput.value = gistId;
      } else {
        await gistRequest('PATCH', '/gists/' + gistId, { files: filePayload }, cfg.pat);
      }

      const ts = new Date().toISOString();
      _origSetItem.call(localStorage, 'sync-last-push', ts);
      setStatus('✓ Pushed at ' + new Date(ts).toLocaleTimeString(), 'ok');
    } catch(e) {
      setStatus('Push failed: ' + e.message, 'err');
    }
    setBusy(false);
  });

  /* ── Pull ── */
  async function doPull(silent) {
    const cfg = getCfg();
    if (!cfg.pat || !cfg.gistId) {
      if (!silent) setStatus('Enter PAT and Gist ID first.', 'err');
      return false;
    }
    if (!silent) { setBusy(true); setStatus('Pulling…', ''); }
    try {
      const gist = await gistRequest('GET', '/gists/' + cfg.gistId, null, cfg.pat);
      const file = gist.files && gist.files[GIST_FILE];
      if (!file) throw new Error('File "' + GIST_FILE + '" not found in gist.');

      // Fetch raw content (may be truncated in API response)
      let raw = file.content;
      if (file.truncated) {
        const r = await fetch(file.raw_url);
        raw = await r.text();
      }
      const data = JSON.parse(raw);

      // Restore — overwrite matching keys, leave others untouched
      // Use _origSetItem so restoring data doesn't trigger auto-push
      Object.entries(data).forEach(([k, v]) => {
        if (!SKIP_KEYS.has(k)) _origSetItem.call(localStorage, k, v);
      });

      if (!silent) {
        setStatus('✓ Pulled. Reloading…', 'ok');
        setTimeout(() => location.reload(), 900);
      }
      return true;
    } catch(e) {
      if (!silent) { setStatus('Pull failed: ' + e.message, 'err'); setBusy(false); }
      return false;
    }
  }

  pullBtn.addEventListener('click', async () => {
    saveCfg();
    setBusy(true);
    await doPull(false);
    setBusy(false);
  });

  /* ── Auto-pull on load ── */
  autoCb.addEventListener('change', saveCfg);
  const cfg0 = getCfg();
  if (cfg0.auto && cfg0.pat && cfg0.gistId) {
    doPull(true).then(ok => {
      if (ok) {
        // Show toast only — no reload. A reload after auto-pull causes an
        // infinite loop because every reload re-triggers auto-pull.
        // Fresh data is now in localStorage; it will render on next genuine open.
        const toast = document.createElement('div');
        toast.textContent = '☁ Synced from cloud';
        toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#4f7ec9;color:#fff;font-size:12px;padding:8px 16px;border-radius:20px;z-index:9999;pointer-events:none;opacity:1;transition:opacity .4s;';
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 400); }, 2000);
      }
    });
  }
})();
