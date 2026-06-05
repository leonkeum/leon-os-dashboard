
    /* ══════════════════════════════
       MOVEMENT — WORKOUT + SLEEP
    ══════════════════════════════ */
    try { (function () {
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
    })(); } catch(e) { console.error('[Movement]', e); }