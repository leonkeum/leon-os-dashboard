try { (function () {

  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch(_) { return null; } }

  function last14Dates() {
    const dates = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  }

  function getLast14DaysSleep() {
    const dates = last14Dates();
    const data = lsGet('leon-sleep-v2');
    const map = {};
    (data?.entries || []).forEach(e => { map[e.date] = e; });
    return dates.map(d => ({ date: d, actual: map[d]?.actual || null, quality: map[d]?.quality ?? null }));
  }

  function getLast4WeeksWorkouts() {
    const data = lsGet('leon-workout-v3');
    const sessions = (data?.sessions || []).filter(s => (s.sets||[]).length > 0);
    const weeks = [];
    for (let i = 3; i >= 0; i--) {
      const start = new Date(); start.setDate(start.getDate() - start.getDay() - i * 7);
      const end   = new Date(start); end.setDate(start.getDate() + 6);
      const startStr = start.toISOString().slice(0, 10);
      const endStr   = end.toISOString().slice(0, 10);
      const count = new Set(sessions.filter(s => s.date >= startStr && s.date <= endStr).map(s => s.date)).size;
      const label = `W${startStr.slice(5, 7)}/${startStr.slice(8, 10)}`;
      weeks.push({ label, count });
    }
    return weeks;
  }

  function getLast14DaysProtein() {
    const dates = last14Dates();
    const data = lsGet('leon-nutrition-v2') || {};
    return dates.map(d => ({ date: d, protein: data[d]?.totals?.protein || null }));
  }

  function getLast14DaysGIFDScore() {
    const dates = last14Dates();
    const entries = lsGet('los-gifd-current') || [];
    const map = {};
    entries.forEach(e => {
      const good = Object.values(e.good || {}).filter(Boolean).length;
      const bad  = Object.values(e.bad  || {}).filter(Boolean).length;
      map[e.date] = good - bad;
    });
    return dates.map(d => ({ date: d, score: map[d] !== undefined ? map[d] : null }));
  }

  function getLast14DaysHappiness() {
    const dates = last14Dates();
    const entries = lsGet('los-gifd-current') || [];
    const map = {};
    entries.forEach(e => { if (e.happiness !== undefined) map[e.date] = e.happiness; });
    return dates.map(d => ({ date: d, happiness: map[d] !== undefined ? map[d] : null }));
  }

  function getManaAvgByHour() {
    const hourSums   = new Array(24).fill(0);
    const hourCounts = new Array(24).fill(0);
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('los-mana-')) continue;
      try {
        const readings = JSON.parse(localStorage.getItem(key) || '[]');
        readings.forEach(r => {
          if (r.hour >= 0 && r.hour < 24 && r.energy != null) {
            hourSums[r.hour]   += r.energy;
            hourCounts[r.hour] += 1;
          }
        });
      } catch(_) {}
    }
    return hourSums.map((s, i) => hourCounts[i] ? Math.round(s / hourCounts[i] * 10) / 10 : null);
  }

  // ── Chart rendering ──
  let insightsInited = false;
  const chartInstances = {};

  function loadChart(cb) {
    if (window.Chart) { cb(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
    s.onload = cb;
    document.head.appendChild(s);
  }

  const DARK_SCALES = {
    x: { grid:{color:'#1a1a1a'}, border:{color:'#1e1e1e'}, ticks:{color:'#444',font:{size:9}} },
    y: { grid:{color:'#1a1a1a'}, border:{color:'#1e1e1e'}, ticks:{color:'#444',font:{size:9}} },
  };

  function makeChart(id, type, data, options) {
    if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
    const canvas = document.getElementById(id); if (!canvas) return;
    chartInstances[id] = new Chart(canvas.getContext('2d'), {
      type,
      data,
      options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, ...options },
    });
  }

  function shortDate(d) { return d.slice(5).replace('-', '/'); }

  function renderBuffsDebuffs() {
    const effects = window.computeLiveEffects?.() || { buffs:[], debuffs:[] };
    const buffList   = document.getElementById('ins-buff-list');
    const debuffList = document.getElementById('ins-debuff-list');
    if (!buffList || !debuffList) return;

    function modsStr(mods) {
      return Object.entries(mods).map(([k,v]) =>
        `<span style="color:${v>0?'#4daa7d':'#c94f4f'}">${v>0?'+':''}${v} ${k.toUpperCase()}</span>`
      ).join(' ');
    }

    buffList.innerHTML = effects.buffs.length ? effects.buffs.map(b =>
      `<div class="buff-card">
        <div class="buff-name">${b.name} <span style="font-size:10px;font-weight:400;margin-left:4px">${modsStr(b.mods)}</span></div>
        <div class="buff-desc">${b.desc}</div>
      </div>`
    ).join('') : `<div class="ins-empty">No active buffs — earn them through habits.</div>`;

    debuffList.innerHTML = effects.debuffs.length ? effects.debuffs.map(d =>
      `<div class="debuff-card live-debuff" style="margin-bottom:8px">
        <div style="flex:1">
          <div class="debuff-name">${d.name} <span style="font-size:10px;font-weight:400;margin-left:4px">${modsStr(d.mods)}</span></div>
          <div class="debuff-desc">${d.desc}${d.manaEffect?` <em style="color:#9b7ac9">(${Math.round(d.manaEffect*100)}% Mana)</em>`:''}</div>
        </div>
      </div>`
    ).join('') : `<div class="ins-empty">✅ No debuffs — clean week.</div>`;
  }

  function initInsights() {
    if (insightsInited) return;
    insightsInited = true;
    loadChart(() => {
      renderBuffsDebuffs();

      // Sleep chart
      const sleepData = getLast14DaysSleep();
      makeChart('ins-sleep-chart', 'line', {
        labels: sleepData.map(d => shortDate(d.date)),
        datasets: [
          { label:'Sleep h', data: sleepData.map(d => d.actual), borderColor:'#4f7ec9', backgroundColor:'rgba(79,126,201,0.1)', fill:true, tension:0.3, spanGaps:true, pointRadius:3, pointBackgroundColor:'#4f7ec9' },
          { label:'Quality', data: sleepData.map(d => d.quality !== null ? d.quality * 2 : null), borderColor:'#9b7ac9', backgroundColor:'rgba(155,122,201,0.08)', fill:false, tension:0.3, spanGaps:true, pointRadius:3, pointBackgroundColor:'#9b7ac9', yAxisID:'y2' },
        ],
      }, {
        plugins:{ legend:{ display:true, labels:{ color:'#555', font:{ size:9 } } } },
        scales: {
          ...DARK_SCALES,
          y:  { ...DARK_SCALES.y, min:0, max:12, title:{ display:true, text:'hours', color:'#444', font:{size:8} } },
          y2: { ...DARK_SCALES.y, min:0, max:10, position:'right', grid:{ drawOnChartArea:false }, title:{ display:true, text:'quality×2', color:'#444', font:{size:8} } },
        },
      });

      // Workout chart
      const woData = getLast4WeeksWorkouts();
      makeChart('ins-workout-chart', 'bar', {
        labels: woData.map(w => w.label),
        datasets: [{ data: woData.map(w => w.count), backgroundColor:'rgba(77,170,125,0.5)', borderColor:'#4daa7d', borderWidth:1, borderRadius:4 }],
      }, { scales: { ...DARK_SCALES, y: { ...DARK_SCALES.y, min:0, max:7, ticks:{ stepSize:1, color:'#444', font:{size:9} } } } });

      // Protein chart
      const protData = getLast14DaysProtein();
      makeChart('ins-protein-chart', 'bar', {
        labels: protData.map(d => shortDate(d.date)),
        datasets: [{ data: protData.map(d => d.protein), backgroundColor:'rgba(201,160,50,0.5)', borderColor:'#c9a032', borderWidth:1, borderRadius:3 }],
      }, { scales: { ...DARK_SCALES, y: { ...DARK_SCALES.y, min:0 } } });

      // Day score chart
      const scoreData = getLast14DaysGIFDScore();
      const scoreColors = scoreData.map(d => d.score === null ? 'transparent' : d.score >= 0 ? 'rgba(77,170,125,0.6)' : 'rgba(201,79,79,0.6)');
      makeChart('ins-score-chart', 'bar', {
        labels: scoreData.map(d => shortDate(d.date)),
        datasets: [{ data: scoreData.map(d => d.score), backgroundColor: scoreColors, borderRadius:3 }],
      }, { scales: { ...DARK_SCALES, y: { ...DARK_SCALES.y } } });

      // Mana by hour chart
      const manaData = getManaAvgByHour();
      const manaLabels = Array.from({length:24}, (_,i) => i + 'h');
      makeChart('ins-mana-chart', 'bar', {
        labels: manaLabels,
        datasets: [{ data: manaData, backgroundColor:'rgba(155,122,201,0.5)', borderColor:'#9b7ac9', borderWidth:1, borderRadius:2 }],
      }, { scales: { ...DARK_SCALES, y: { ...DARK_SCALES.y, min:0, max:10 } } });

      // Happiness chart
      const happyData = getLast14DaysHappiness();
      const happyEmoji = ['😞','🙁','😐','🙂','🔥'];
      makeChart('ins-happy-chart', 'line', {
        labels: happyData.map(d => shortDate(d.date)),
        datasets: [{ data: happyData.map(d => d.happiness), borderColor:'#c9a032', backgroundColor:'rgba(201,160,50,0.1)', fill:true, tension:0.3, spanGaps:true, pointRadius:4, pointBackgroundColor: happyData.map(d => d.happiness === null ? 'transparent' : d.happiness >= 3 ? '#4daa7d' : d.happiness >= 2 ? '#c9a032' : '#c94f4f') }],
      }, { scales: { ...DARK_SCALES, y: { ...DARK_SCALES.y, min:0, max:4, ticks:{ stepSize:1, color:'#444', font:{size:9}, callback: v => happyEmoji[v] || v } } } });
    });
  }

  // Activate on section switch
  const section = document.getElementById('section-insights');
  if (section) {
    new MutationObserver(() => {
      if (section.classList.contains('active')) initInsights();
    }).observe(section, { attributes:true, attributeFilter:['class'] });
  }

})(); } catch(e) { console.error('[Insights]', e); }
