    try { (function () {
      const LS_KEY      = 'leon-nutrition-v2';
      const LS_HISTORY  = 'leon-nutr-history-v1';  // { [date]: { protein, calories } }
      const LS_PRESETS  = 'leon-nutr-presets-v1';  // [{ emoji, name, p }]
      const LS_WATER    = 'leon-nutr-water-v1';     // { date, glasses }
      // lDate is scoped inside the Life OS IIFE — define locally here
      const fmtDate = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
      let nutrActiveDate = fmtDate(new Date());
      const WATER_GOAL  = 8;

      function renderNutrDateNav() {
        const el = document.getElementById('nutr-date-display');
        const nextBtn = document.getElementById('nutr-date-next');
        const realToday = fmtDate(new Date());
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
        switchNutrDate(fmtDate(d));
      });
      document.getElementById('nutr-date-next')?.addEventListener('click', () => {
        const realToday = fmtDate(new Date());
        if (nutrActiveDate >= realToday) return;
        const d = new Date(nutrActiveDate + 'T00:00:00');
        d.setDate(d.getDate() + 1);
        switchNutrDate(fmtDate(d));
      });

      /* Init */
      renderNutrDateNav();
      const d = lsLoad();
      renderTotals(d.totals);
      renderMeals(d);
      renderPresets();
      renderWater();
      renderWeekBars();
    })(); } catch(e) { console.error('[Nutrition]', e); }