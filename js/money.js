

    /* ══════════════════════════════
       MONEY SECTION
    ══════════════════════════════ */
    try { (function () {
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
    })(); } catch(e) { console.error('[Money]', e); }