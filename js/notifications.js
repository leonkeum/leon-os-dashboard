try { (function () {
  if (!('Notification' in window)) return;

  const LS_PERM  = 'leon-notif-perm';
  const firedKey = () => `leon-notif-fired-${new Date().toISOString().slice(0,10)}`;

  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch(_) { return null; } }

  function gifdLoggedToday() {
    const today = new Date().toISOString().slice(0,10);
    const entries = lsGet('los-gifd-current') || [];
    const e = entries.find(x => x.date === today);
    return !!(e && (e.desc || Object.values(e.good||{}).some(Boolean) || Object.values(e.bad||{}).some(Boolean)));
  }
  function nutritionLoggedToday() {
    const today = new Date().toISOString().slice(0,10);
    const data = lsGet('leon-nutrition-v2') || {};
    return !!(data[today] && (data[today].meals||[]).length > 0);
  }
  function workoutLoggedToday() {
    const today = new Date().toISOString().slice(0,10);
    const data = lsGet('leon-workout-v3') || {};
    const sess = (data.sessions||[]).find(s => s.date === today);
    return !!(sess && (sess.sets||[]).length > 0);
  }
  function sleepLoggedToday() {
    const today = new Date().toISOString().slice(0,10);
    const data = lsGet('leon-sleep-v2') || {};
    return !!(data.entries||[]).find(e => e.date === today && e.actual > 0);
  }
  function weekReviewDone() {
    const d = new Date();
    const jan4 = new Date(Date.UTC(d.getFullYear(), 0, 4));
    const startW1 = new Date(jan4); startW1.setUTCDate(jan4.getUTCDate() - (jan4.getUTCDay()||7) + 1);
    const week = Math.ceil(((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()) - startW1) / 86400000 + 1) / 7);
    const weekStr = `${d.getFullYear()}-W${String(week).padStart(2,'0')}`;
    const reviews = lsGet('leon-weekly-reviews') || [];
    return !!reviews.find(r => r.week === weekStr);
  }

  const now = () => new Date();
  const isWeekday = () => { const d = now().getDay(); return d >= 1 && d <= 5; };
  const isSunday  = () => now().getDay() === 0;

  const TRIGGERS = [
    { id:'nutrition', hour:12, check: () => !nutritionLoggedToday(), msg:'🍗 Log your meals — nutrition not tracked yet today', section:'nutrition' },
    { id:'workout',   hour:20, check: () => isWeekday() && !workoutLoggedToday(), msg:'💪 Did you train today? Log your session', section:'movement' },
    { id:'gifd',      hour:22, check: () => !gifdLoggedToday(), msg:'📔 Fill in your GIFD before bed', section:'life-os' },
    { id:'sleep',     hour:23, check: () => !sleepLoggedToday(), msg:'😴 Log your sleep goal for tonight', section:'movement' },
    { id:'weekly',    hour:18, check: () => isSunday() && !weekReviewDone(), msg:'📊 Weekly review is due — how was your week?', section:'today' },
  ];

  function fire(trigger) {
    try {
      new Notification('Leon OS', {
        body: trigger.msg,
        icon: './icon-192.png',
        tag:  trigger.id,
        data: { section: trigger.section },
      });
    } catch(_) {}
    const fired = lsGet(firedKey()) || [];
    fired.push(trigger.id);
    localStorage.setItem(firedKey(), JSON.stringify(fired));
  }

  function checkAndFire() {
    if (Notification.permission !== 'granted') return;
    const h = now().getHours();
    const fired = lsGet(firedKey()) || [];
    TRIGGERS.forEach(t => {
      if (h >= t.hour && !fired.includes(t.id) && t.check()) fire(t);
    });
  }

  // ── Permission button in sync modal ──
  function initNotifButton() {
    const btn    = document.getElementById('notif-enable-btn');
    const status = document.getElementById('notif-status-notif');
    if (!btn) return;

    function updateBtn(perm) {
      if (perm === 'granted') {
        btn.textContent = 'Notifications enabled ✓';
        btn.disabled = true;
        btn.style.opacity = '0.6';
      } else if (perm === 'denied') {
        btn.textContent = 'Blocked — enable in browser settings';
        btn.disabled = true;
        btn.style.opacity = '0.6';
      }
    }

    updateBtn(Notification.permission);
    localStorage.setItem(LS_PERM, Notification.permission);

    btn.addEventListener('click', async () => {
      const result = await Notification.requestPermission();
      localStorage.setItem(LS_PERM, result);
      updateBtn(result);
      if (result === 'granted' && status) {
        status.textContent = '✓ Notifications on — you\'ll be reminded to log daily';
        status.style.color = '#4daa7d';
      }
    });
  }

  initNotifButton();
  checkAndFire();
  setInterval(checkAndFire, 30 * 60 * 1000);

})(); } catch(e) { console.error('[Notifications]', e); }
