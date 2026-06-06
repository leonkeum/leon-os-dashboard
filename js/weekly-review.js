try { (function () {
  const LS_REVIEWS = 'leon-weekly-reviews';

  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch(_) { return null; } }
  function lsSet(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

  function getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;
  }

  function getWeekDates(weekStr) {
    const [year, w] = weekStr.split('-W').map(Number);
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const startOfWeek1 = new Date(jan4);
    startOfWeek1.setUTCDate(jan4.getUTCDate() - (jan4.getUTCDay() || 7) + 1);
    const weekStart = new Date(startOfWeek1);
    weekStart.setUTCDate(startOfWeek1.getUTCDate() + (w - 1) * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setUTCDate(weekStart.getUTCDate() + i);
      return d.toISOString().slice(0, 10);
    });
  }

  function computeWeekStats(weekStr) {
    const dates = getWeekDates(weekStr);
    const fromDate = dates[0];
    const toDate   = dates[6];

    let avgSleep = 0, workoutDays = 0, avgProtein = 0, avgScore = 0;

    try {
      const sleepData = lsGet('leon-sleep-v2');
      const entries = (sleepData?.entries || []).filter(e => e.date >= fromDate && e.date <= toDate);
      if (entries.length) avgSleep = entries.reduce((a, e) => a + (e.actual || 0), 0) / entries.length;
    } catch(_) {}

    try {
      const woData = lsGet('leon-workout-v3');
      const sessions = (woData?.sessions || []).filter(s => s.date >= fromDate && s.date <= toDate && (s.sets||[]).length > 0);
      workoutDays = new Set(sessions.map(s => s.date)).size;
    } catch(_) {}

    try {
      const nutr = lsGet('leon-nutrition-v2') || {};
      const days = dates.filter(d => nutr[d] && nutr[d].totals);
      if (days.length) avgProtein = days.reduce((a, d) => a + (nutr[d].totals.protein || 0), 0) / days.length;
    } catch(_) {}

    try {
      const gifd = lsGet('los-gifd-current') || [];
      const entries = gifd.filter(e => e.date >= fromDate && e.date <= toDate);
      if (entries.length) {
        const scores = entries.map(e => Object.values(e.good || {}).filter(Boolean).length - Object.values(e.bad || {}).filter(Boolean).length);
        avgScore = scores.reduce((a, s) => a + s, 0) / scores.length;
      }
    } catch(_) {}

    return { avgSleep, workoutDays, avgProtein, avgScore };
  }

  const banner    = document.getElementById('weekly-review-banner');
  const head      = document.getElementById('wr-banner-head');
  const weekLabel = document.getElementById('wr-week-label');
  const starsEl   = document.getElementById('wr-stars');
  const saveBtn   = document.getElementById('wr-save-btn');
  const skipBtn   = document.getElementById('wr-skip-btn');
  const savedMsg  = document.getElementById('wr-saved-msg');

  if (!banner || !head) return;

  let wrRating = 0;
  let expanded = false;

  function toggleBanner(open) {
    expanded = open;
    banner.classList.toggle('collapsed', !open);
    banner.classList.toggle('expanded', open);
    if (open) fillStats();
  }

  function fillStats() {
    const currentWeek = getISOWeek(new Date());
    const stats = computeWeekStats(currentWeek);
    const el = id => document.getElementById(id);
    el('wr-avg-sleep').textContent    = stats.avgSleep    ? stats.avgSleep.toFixed(1) + 'h' : '—';
    el('wr-workout-days').textContent = stats.workoutDays ? stats.workoutDays + 'd'   : '0d';
    el('wr-avg-protein').textContent  = stats.avgProtein  ? Math.round(stats.avgProtein) + 'g' : '—';
    el('wr-avg-score').textContent    = stats.avgScore !== 0 ? (stats.avgScore >= 0 ? '+' : '') + stats.avgScore.toFixed(1) : '—';
  }

  function setStars(n) {
    wrRating = n;
    starsEl?.querySelectorAll('.wr-star').forEach(b => {
      b.classList.toggle('active', Number(b.dataset.v) <= n);
    });
  }

  starsEl?.querySelectorAll('.wr-star').forEach(b => {
    b.addEventListener('click', () => setStars(Number(b.dataset.v)));
  });

  head.addEventListener('click', () => toggleBanner(!expanded));

  skipBtn?.addEventListener('click', () => {
    sessionStorage.setItem('wr-skipped', '1');
    toggleBanner(false);
  });

  saveBtn?.addEventListener('click', () => {
    if (!wrRating) { savedMsg.textContent = 'Pick a rating first ⭐'; savedMsg.style.color = '#c94f4f'; return; }
    const currentWeek = getISOWeek(new Date());
    const reviews = lsGet(LS_REVIEWS) || [];
    const idx = reviews.findIndex(r => r.week === currentWeek);
    const entry = {
      week: currentWeek,
      rating: wrRating,
      best:   document.getElementById('wr-best')?.value.trim()   || '',
      lesson: document.getElementById('wr-lesson')?.value.trim() || '',
      focus:  document.getElementById('wr-focus')?.value.trim()  || '',
      savedAt: new Date().toISOString(),
      stats:  computeWeekStats(currentWeek),
    };
    if (idx >= 0) reviews[idx] = entry; else reviews.push(entry);
    lsSet(LS_REVIEWS, reviews);
    savedMsg.textContent = '✓ Saved';
    savedMsg.style.color = '#4daa7d';
    setTimeout(() => toggleBanner(false), 800);
  });

  // Init
  function id(s) { return document.getElementById(s); }
  const currentWeek = getISOWeek(new Date());
  const reviews     = lsGet(LS_REVIEWS) || [];
  const thisWeekReview = reviews.find(r => r.week === currentWeek);
  const weekNum = currentWeek.split('-W')[1];

  if (thisWeekReview) {
    weekLabel.textContent = `Week ${weekNum} · Reviewed ✓`;
    banner.style.display = 'block';
  } else {
    weekLabel.textContent = `Week ${weekNum} · Tap to review your week`;
    banner.style.display = 'block';
    const now  = new Date();
    const isSun = now.getDay() === 0;
    const isEvening = now.getHours() >= 18;
    if ((isSun || isEvening) && !sessionStorage.getItem('wr-skipped')) {
      setTimeout(() => toggleBanner(true), 600);
    }
  }

})(); } catch(e) { console.error('[WeeklyReview]', e); }
