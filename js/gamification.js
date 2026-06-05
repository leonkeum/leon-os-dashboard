    /* ══════════════════════════════
       GAMIFICATION — DAILY SCORE + STREAKS + RINGS
    ══════════════════════════════ */
    try { (function () {
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
          const d2 = JSON.parse(localStorage.getItem('leon-sleep-v2') || '{"entries":[]}');
          const entry = d2.entries.find(e => e.date === TODAY);
          if (entry && entry.actual > 0) return true;
        } catch(_) {}
        try {
          const d = JSON.parse(localStorage.getItem('leon-sleep-v1') || '{}');
          return d.date === TODAY && d.hours > 0;
        } catch(_) { return false; }
        return false;
      }

      function nutritionLogged() {
        try {
          const d = JSON.parse(localStorage.getItem('leon-nutrition-v2') || '{}');
          const todayData = d[TODAY];
          return !!(todayData && todayData.meals && todayData.meals.length > 0);
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

        const wStreak = updateStreak('workout', wl);
        renderStreakNum('streak-gifd-num',      updateStreak('gifd',      gl));
        renderStreakNum('streak-workout-num',   wStreak);
        renderStreakNum('streak-nutrition-num', updateStreak('nutrition', nl));
        const mvEl = document.getElementById('movement-streak-display');
        if (mvEl) mvEl.textContent = wStreak > 0 ? wStreak : '0';
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

    })(); } catch(e) { console.error('[Gamification]', e); }