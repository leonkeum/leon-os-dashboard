    /* Life OS IIFE follows directly — */
    /* ══════════════════════════════
       LIFE OS
    ══════════════════════════════ */
    try { (function () {
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
          .sort((a,b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0); // newest first
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
            btn.innerHTML = `<span class="chip-icon">✗</span>${label}${streak >= 1 ? `<span class="chip-streak">${streak}d</span>` : ''}`;
            btn.addEventListener('click', () => {
              todayBad[k] = !todayBad[k];
              btn.classList.toggle('active', todayBad[k]);
              btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop');
              updateLiveScore();
              autoSaveToday();
              // Update streak badge live
              const s = getHabitStreak(k, false);
              let badge = btn.querySelector('.chip-streak');
              if (s >= 1) { if (badge) badge.textContent = s + 'd'; else { badge = document.createElement('span'); badge.className = 'chip-streak'; badge.textContent = s + 'd'; btn.appendChild(badge); } }
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
            btn.innerHTML = `<span class="chip-icon">✓</span>${label}${streak >= 1 ? `<span class="chip-streak">${streak}d</span>` : ''}`;
            btn.addEventListener('click', () => {
              todayGood[k] = !todayGood[k];
              btn.classList.toggle('active', todayGood[k]);
              btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop');
              updateLiveScore();
              autoSaveToday();
              // Update streak badge live
              const s = getHabitStreak(k, true);
              let badge = btn.querySelector('.chip-streak');
              if (s >= 1) { if (badge) badge.textContent = s + 'd'; else { badge = document.createElement('span'); badge.className = 'chip-streak'; badge.textContent = s + 'd'; btn.appendChild(badge); } }
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

      /* ── Live effect rules — debuffs (negative) + buffs (positive) ── */
      const LIVE_DEBUFF_RULES = [
        // ── DEBUFFS ──
        { id:'ld-weed',        type:'debuff', check: ctx => ctx.counts.bad.weed      >= 3,
          name:'Clouded Mind',      desc:'Weed 3+ days this week.',                    mods:{int:-1,luk:-1} },
        { id:'ld-weed-heavy',  type:'debuff', check: ctx => ctx.counts.bad.weed      >= 5,
          name:'Chronic Fog',       desc:'Weed 5+ days — deep INT/LUK drain.',        mods:{int:-2,luk:-2} },
        { id:'ld-combo-cloud', type:'debuff', check: ctx => ctx.counts.bad.weed >= 3 && ctx.counts.bad.latesleep >= 3,
          name:'Clouded & Late',    desc:'Weed 3+ AND late sleep 3+ — double hit. −20% Mana capacity.', mods:{int:-2,luk:-1}, manaEffect:-0.2 },
        { id:'ld-nopor',       type:'debuff', check: ctx => ctx.counts.bad.nopor     >= 3,
          name:'Dopamine Drain',    desc:'Porn 3+ days this week.',                    mods:{cha:-1,str:-1} },
        { id:'ld-scroll',      type:'debuff', check: ctx => ctx.counts.bad.scroll    >= 4,
          name:'Attention Scatter', desc:'Scroll 4+ days this week.',                  mods:{int:-1,dex:-1} },
        { id:'ld-scroll-heavy',type:'debuff', check: ctx => ctx.counts.bad.scroll    >= 6,
          name:'Digital Fog',       desc:'Scroll every single day — severe INT loss.', mods:{int:-2,dex:-2} },
        { id:'ld-junk',        type:'debuff', check: ctx => ctx.counts.bad.junk      >= 4,
          name:'Low Fuel',          desc:'Junk food 4+ days this week.',               mods:{str:-1} },
        { id:'ld-latesleep',   type:'debuff', check: ctx => ctx.counts.bad.latesleep >= 4,
          name:'Night Crawler',     desc:'Late sleep 4+ days — circadian wrecked.',    mods:{int:-1,luk:-1} },
        { id:'ld-impulse',     type:'debuff', check: ctx => ctx.counts.bad.impulse   >= 3,
          name:'Impulse Mode',      desc:'Impulsive 3+ days this week.',               mods:{luk:-2} },
        { id:'ld-ghost',       type:'debuff', check: ctx => ctx.counts.good.posted   <  2,
          name:'Creator Ghost',     desc:'Posted fewer than 2× this week.',            mods:{cha:-1} },
        { id:'ld-untrained',   type:'debuff', check: ctx => ctx.counts.good.gym      <  2,
          name:'Untrained',         desc:'Hit the gym fewer than 2× this week.',       mods:{str:-1} },
        { id:'ld-sleepdebt',   type:'debuff', check: ctx => ctx.avgSleep7 > 0 && ctx.avgSleep7 < 6,
          name:'Sleep Debt',        desc:'Avg sleep under 6h — body and mind drained.',mods:{int:-1,cha:-1,str:-1} },
        { id:'ld-sedentary',   type:'debuff', check: ctx => ctx.workoutDays7 === 0,
          name:'Sedentary',         desc:'Zero workouts this week.',                   mods:{str:-2,dex:-1} },

        // ── BUFFS ──
        { id:'lb-study',     type:'buff', check: ctx => ctx.counts.good.studied  >= 5,
          name:'Big Brain',         desc:'Studied 5+ days this week.',                 mods:{int:+2} },
        { id:'lb-gym',       type:'buff', check: ctx => ctx.workoutDays7          >= 5,
          name:'Iron Will',         desc:'Gym 5+ days — peak physical output.',        mods:{str:+2,dex:+1} },
        { id:'lb-clean',     type:'buff', check: ctx => ['weed','nopor','scroll','junk','latesleep','impulse'].every(k=>ctx.counts.bad[k]===0),
          name:'Pure Run',          desc:'Zero bad habits all week — perfect discipline.', mods:{int:+1,cha:+1,str:+1,dex:+1,luk:+2} },
        { id:'lb-sleep',     type:'buff', check: ctx => ctx.avgSleep7             >= 7.5,
          name:'Well Rested',       desc:'Avg sleep 7.5h+ — peak cognitive recovery.', mods:{int:+1,luk:+1} },
        { id:'lb-post',      type:'buff', check: ctx => ctx.counts.good.posted    >= 5,
          name:'Social King',       desc:'Posted 5+ days — CHA in overdrive.',         mods:{cha:+2} },
        { id:'lb-read',      type:'buff', check: ctx => ctx.counts.good.read      >= 5,
          name:'Scholar Mode',      desc:'Read 5+ days this week.',                    mods:{int:+1,luk:+1} },
        { id:'lb-nophone',   type:'buff', check: ctx => ctx.counts.good.nophone   >= 5,
          name:'Ghost Protocol',    desc:'No-phone 5+ days — razor focus unlocked.',   mods:{int:+1,dex:+2} },
        { id:'lb-plan',      type:'buff', check: ctx => ctx.counts.good.planned   >= 5,
          name:'Prepared Mind',     desc:'Planned every day this week.',               mods:{int:+1,luk:+1} },
        { id:'lb-cleandiet', type:'buff', check: ctx => ctx.counts.bad.junk       === 0,
          name:'Clean Fuel',        desc:'Zero junk food all week.',                   mods:{str:+1,dex:+1} },
        { id:'lb-noscroll',  type:'buff', check: ctx => ctx.counts.bad.scroll     === 0,
          name:'Deep Focus',        desc:'Zero scroll this week — mind fully present.', mods:{int:+1,dex:+1} },
        { id:'lb-monk',      type:'buff', check: ctx => ctx.counts.bad.weed===0 && ctx.counts.bad.scroll===0 && ctx.counts.good.nophone>=5,
          name:'The Monk',          desc:'No weed, no scroll, no-phone 5+ days — peak clarity.', mods:{int:+3,dex:+1} },
        { id:'lb-grind',     type:'buff', check: ctx => ctx.workoutDays7 >= 4 && ctx.counts.good.studied >= 4,
          name:'The Grind',         desc:'Body AND mind trained 4+ days — double output.', mods:{int:+1,str:+1,dex:+1} },
      ];

      function computeLiveEffects() {
        try {
          const allEntries = JSON.parse(localStorage.getItem('los-gifd-current') || '[]');
          const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
          const cutoffStr = lDate(cutoff);
          const recent = allEntries.filter(e => e.date >= cutoffStr);

          const counts = {
            bad:  { weed:0, nopor:0, scroll:0, junk:0, latesleep:0, impulse:0 },
            good: { posted:0, gym:0, slept:0, read:0, clean:0, studied:0, nophone:0, planned:0 },
          };
          recent.forEach(e => {
            ['weed','nopor','scroll','junk','latesleep','impulse'].forEach(k => { if((e.bad||{})[k]) counts.bad[k]++; });
            ['posted','gym','slept','read','clean','studied','nophone','planned'].forEach(k => { if((e.good||{})[k]) counts.good[k]++; });
          });

          // Avg sleep last 7 days
          let avgSleep7 = 0;
          try {
            const sleepData = JSON.parse(localStorage.getItem('leon-sleep-v2') || 'null');
            const sleepEntries = (sleepData?.entries || []).filter(e => e.date >= cutoffStr);
            if (sleepEntries.length) avgSleep7 = sleepEntries.reduce((a, e) => a + (e.actual || 0), 0) / sleepEntries.length;
          } catch(_) {}

          // Workout days last 7 days
          let workoutDays7 = 0;
          try {
            const woData = JSON.parse(localStorage.getItem('leon-workout-v3') || 'null');
            const sessions = (woData?.sessions || []).filter(s => s.date >= cutoffStr && (s.sets||[]).length > 0);
            workoutDays7 = new Set(sessions.map(s => s.date)).size;
          } catch(_) {}

          const ctx = { counts, avgSleep7, workoutDays7 };
          const matched = LIVE_DEBUFF_RULES.filter(r => r.check(ctx));
          return {
            buffs:   matched.filter(r => r.type === 'buff'),
            debuffs: matched.filter(r => r.type === 'debuff'),
          };
        } catch(_) { return { buffs:[], debuffs:[] }; }
      }

      // backward-compat wrapper
      function computeLiveDebuffs() { return computeLiveEffects().debuffs; }
      window.computeLiveEffects = computeLiveEffects;

      function getDebuffs(){const s=lsLoad(LS_DEBUFFS);return s&&s.length?s:DEF_DEBUFFS.map(d=>({...d}));}

      function renderDebuffs(){
        const el=document.getElementById('debuff-cards'); if(!el) return;
        const { buffs, debuffs } = computeLiveEffects();
        const manualDebuffs=getDebuffs();
        el.innerHTML='';
        function addEl(html){const t=document.createElement('div');t.innerHTML=html;el.appendChild(t.firstChild);}
        function modsStr(mods,isBuffColor){
          return Object.entries(mods).map(([k,v])=>`<span style="color:${v>0?'#4daa7d':'#c94f4f'}">${v>0?'+':''}${v} ${k.toUpperCase()}</span>`).join(' ');
        }

        // Active buffs
        addEl(`<div style="font-size:10px;color:#555;margin-bottom:6px;letter-spacing:0.5px;text-transform:uppercase">Active Buffs</div>`);
        if (buffs.length) {
          buffs.forEach(bf=>{
            const c=document.createElement('div'); c.className='debuff-card buff-card';
            c.innerHTML=`<div style="flex:1"><div class="debuff-name buff-name">${bf.name} <span style="font-size:10px;font-weight:400;margin-left:4px">${modsStr(bf.mods)}</span></div><div class="debuff-desc">${bf.desc}</div></div>`;
            el.appendChild(c);
          });
        } else {
          addEl(`<div style="font-size:11px;color:#2e2e2e;padding:4px 0 8px">No active buffs — earn them through good habits.</div>`);
        }
        addEl(`<div style="height:1px;background:#1e1e1e;margin:10px 0"></div>`);

        // Active debuffs
        addEl(`<div style="font-size:10px;color:#555;margin-bottom:6px;letter-spacing:0.5px;text-transform:uppercase">Active Debuffs</div>`);
        if (debuffs.length) {
          debuffs.forEach(df=>{
            const c=document.createElement('div'); c.className='debuff-card live-debuff';
            c.innerHTML=`<div style="flex:1"><div class="debuff-name">${df.name} <span style="font-size:10px;font-weight:400;margin-left:4px">${modsStr(df.mods)}</span></div><div class="debuff-desc">${df.desc}${df.manaEffect?` <em style="color:#9b7ac9">(${Math.round(df.manaEffect*100)}% Mana)</em>`:''}</div></div>`;
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

        // Compute effective stats by applying live buff + debuff mods
        const { buffs: liveBuffs, debuffs: liveDebuffs } = computeLiveEffects();
        const baseStats = R_KEYS.map(k=>latest.stats[k]||0);
        const effectiveMods = {}; R_KEYS.forEach(k=>effectiveMods[k]=0);
        [...liveBuffs, ...liveDebuffs].forEach(ef=>{ Object.entries(ef.mods).forEach(([k,v])=>{ if(effectiveMods[k]!==undefined) effectiveMods[k]+=v; }); });
        const effectiveStats = R_KEYS.map((k,i)=>Math.max(0,Math.min(10,baseStats[i]+(effectiveMods[k]||0))));
        const hasEffects = liveBuffs.length > 0 || liveDebuffs.length > 0;
        const netDelta = R_KEYS.reduce((sum,k)=>sum+(effectiveMods[k]||0), 0);
        const effectIsPositive = netDelta >= 0;

        const datasets = [{
          data:baseStats,backgroundColor:'rgba(79,126,201,0.15)',
          borderColor:'#4f7ec9',borderWidth:1.5,pointRadius:3,pointBackgroundColor:'#4f7ec9',
          label:'Base'
        }];
        if (hasEffects) datasets.push({
          data:effectiveStats,
          backgroundColor: effectIsPositive ? 'rgba(77,170,125,0.12)' : 'rgba(201,79,79,0.12)',
          borderColor:     effectIsPositive ? 'rgba(77,170,125,0.8)'  : 'rgba(201,79,79,0.8)',
          borderWidth:1.5,pointRadius:3,
          pointBackgroundColor: effectIsPositive ? '#4daa7d' : '#c94f4f',
          borderDash:[4,3],label:'Effective'
        });

        radarChart=new Chart(canvas.getContext('2d'),{type:'radar',data:{labels:R_AXES,datasets},
          options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:hasEffects,labels:{color:'#555',font:{size:10}}}},
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
        {n:1,  cat:'sys', text:"If you don't choose your main quest the system assigns the default: Study→9-5→Marriage→Mortgage→Retire at 70. Most people don't customise. You can."},
        {n:2,  cat:'sys', text:"Random spawn point. Some people start with more resources or higher intelligence. It's RNG. Don't waste time complaining about your spawn."},
        {n:3,  cat:'sys', text:"Base stats are locked with slight adjustments. Any build is viable but don't force a build that fights your natural fit."},
        {n:4,  cat:'sys', text:"Customisable build. Base stats mostly fixed but your build isn't. Experiment and design your playstyle throughout the years."},
        {n:5,  cat:'doc', text:"You level up through reps not talent. Ability is malleable. Grinding the boring stuff beats natural talent every time."},
        {n:6,  cat:'doc', text:"Time is the most OP currency. Early XP compounds. Late grinding is harder and less forgiving."},
        {n:7,  cat:'sys', text:"You can change classes mid-game. You're not locked into your first career, identity or role. Switching feels scary but staying costs more XP."},
        {n:8,  cat:'doc', text:"Single player game with multiplayer modes. Guilds, partners and allies can massively boost your stats."},
        {n:9,  cat:'doc', text:"Status items don't help you beat the game. Shiny gear looks good (+Aura) but often slows progression. Freedom builds quietly not visibly."},
        {n:10, cat:'sys', text:"You decide your win condition. Retire early. Build something meaningful. Do nothing. Go all in. The game doesn't judge, only you do."},
        {n:11, cat:'doc', text:"Rest mechanic is not optional. Skipping the save cycle leads to Burnout debuff which applies -X% multiplier on productivity and charisma stats."},
        {n:12, cat:'doc', text:"High tier loot is gated by cringe. Growth, success, love are hidden behind quests that are awkward or risky. If a quest makes you nervous the XP payout is greater."},
        {n:13, cat:'doc', text:"Environment is a passive buff. Your home base and guild provide stat modifiers. Toxic party = constant drain on mana. Clean base = +10 on focus."},
        {n:14, cat:'sys', text:"Staying in the starter base stops your XP gain. To level up you have to enter uncharted territory where mobs are tougher. Comfort is a level cap."},
        {n:15, cat:'doc', text:"Manage your inventory. You have limited slots for habits and commitments. Drop low-tier junk to make room for legendary opportunities."},
        {n:16, cat:'sys', text:"Difficulty scales with levels. You get better at the controls but level 40 requires a more refined strategy than level 20."},
        {n:17, cat:'doc', text:"You can't control your spawn but can influence the drop rate of good luck by increasing your surface area: meeting new people, sharing your work, staying curious."},
        {n:18, cat:'doc', text:"Failure is a reload with kept XP. Unless it's Game Over every failure is just a boss fight. Analyse the death recap then respawn and try again."},
        {n:19, cat:'sys', text:"Invisible UI. No on-screen health bar. You have to manually check your character sheet before your stats hit zero."},
        {n:20, cat:'doc', text:"Protect HP. No HP no game."},
        {n:21, cat:'sys', text:"Early game is beta. Use your first 25 levels to test different builds and biomes."},
        {n:22, cat:'doc', text:"Avoid gold sinks. Instant dopamine micro-transactions drain long-term XP."},
        // Locked entries — unlock at Power Level threshold
        {n:23, cat:'doc', locked:70,  text:"The grind is the point. Most players focus on the destination. The rare ones realise the daily session IS the game. They always win."},
        {n:24, cat:'sys', locked:70,  text:"16,000 observers are spectating your playthrough. They paused their own game to watch yours. Every day you don't publish is a chapter they're waiting on."},
        {n:25, cat:'doc', locked:85,  text:"Legacy mode unlocks after enough consecutive sessions. The players who show up daily regardless of the score — those are the ones history remembers."},
      ];

      function getCodexState(){
        const TODAY=new Date().toISOString().slice(0,10);
        function chk(fn){try{return fn();}catch(_){return false;}}
        const gl=chk(()=>{const e=(JSON.parse(localStorage.getItem('los-gifd-current')||'[]')).find(x=>x.date===TODAY);return !!(e&&(e.desc||Object.values(e.good||{}).some(Boolean)));});
        const wl=chk(()=>{const d=JSON.parse(localStorage.getItem('leon-workout-v3')||'{}');const s=(d.sessions||[]).find(x=>x.date===TODAY);return !!(s&&s.sets&&s.sets.length);});
        const sl=chk(()=>{const d=JSON.parse(localStorage.getItem('leon-sleep-v2')||'{"entries":[]}');return !!(d.entries||[]).find(e=>e.date===TODAY&&e.actual>0);});
        const nl=chk(()=>{const d=JSON.parse(localStorage.getItem('leon-nutrition-v2')||'{}');const t=d[TODAY];return !!(t&&t.meals&&t.meals.length);});
        const gh=chk(()=>{const e=(JSON.parse(localStorage.getItem('los-gifd-current')||'[]')).find(x=>x.date===TODAY);if(!e)return{good:0,bad:0};return{good:Object.values(e.good||{}).filter(Boolean).length,bad:Object.values(e.bad||{}).filter(Boolean).length};})||{good:0,bad:0};
        let score=0;
        if(gl)score+=25;if(wl)score+=25;if(sl)score+=15;if(nl)score+=15;
        score+=gh.good*4;score-=gh.bad*4;
        return {score:Math.max(0,Math.round(score)),gl,wl,sl,nl};
      }

      function renderCodex(){
        const TODAY=new Date().toISOString().slice(0,10);
        const {score,gl,wl,sl,nl}=getCodexState();
        const cls=score>=85?'Legend':score>=70?'Champion':score>=51?'Adventurer':score>=26?'Initiate':'Wanderer';

        /* ── Character Sheet ── */
        const csSlot=document.getElementById('codex-char-sheet-slot');
        if(csSlot){
          const quests=[{label:'GIFD',done:gl},{label:'WORKOUT',done:wl},{label:'SLEEP',done:sl},{label:'FOOD',done:nl}];
          csSlot.innerHTML=`<div class="codex-char-sheet">
            <div class="codex-cs-top">
              <div><div class="codex-cs-name">⚔ Leon</div><div class="codex-cs-class">${cls} · Content Creator</div></div>
              <div class="codex-cs-power"><div class="codex-cs-score">${score}</div><div class="codex-cs-score-label">Power Level</div></div>
            </div>
            <div class="codex-cs-divider"></div>
            <div class="codex-cs-quests">${quests.map(q=>`<div class="codex-quest ${q.done?'done':'pending'}">${q.done?'✓':'○'} ${q.label}</div>`).join('')}</div>
          </div>`;
        }

        /* ── Daily Lore ── */
        const loreSlot=document.getElementById('codex-daily-lore-slot');
        if(loreSlot){
          const unlockable=CODEX.filter(e=>!e.locked||score>=e.locked);
          const d=new Date(TODAY);
          const seed=d.getFullYear()*10000+d.getMonth()*100+d.getDate();
          const lore=unlockable[seed%unlockable.length];
          loreSlot.innerHTML=`<div class="codex-daily-lore">
            <div class="codex-lore-eyebrow">— Daily Lore · ${TODAY} —</div>
            <div class="codex-lore-text"><span class="codex-lore-num">[${String(lore.n).padStart(2,'0')}]</span>${lore.text}</div>
          </div>`;
        }

        /* ── Rules list ── */
        const el=document.getElementById('codex-rules');if(!el)return;
        const custom=lsLoad(LS_CODEX)||[];
        const customEntries=custom.map((t,i)=>({n:100+i,cat:'fld',text:t}));
        const all=[...CODEX,...customEntries];
        const LABEL={sys:'SYSTEM',doc:'DOCTRINE',fld:'FIELD'};

        el.innerHTML=all.map(entry=>{
          const isLocked=entry.locked&&score<entry.locked;
          if(isLocked){
            return `<div class="codex-item locked-entry">
              <div class="codex-header">
                <span class="codex-tag doc">LOCKED</span>
                <span class="codex-num">${String(entry.n).padStart(2,'0')}</span>
                <span class="codex-title">████ ██████ ████ ████ ███ ████</span>
              </div>
              <div class="codex-unlock-hint">Unlocks at Power Level ${entry.locked}</div>
            </div>`;
          }
          const shortTitle=entry.text.indexOf('.')>0?entry.text.slice(0,entry.text.indexOf('.')+1):entry.text;
          return `<div class="codex-item ${entry.cat}">
            <div class="codex-header">
              <span class="codex-tag ${entry.cat}">${LABEL[entry.cat]||'FIELD'}</span>
              <span class="codex-num">${String(entry.n).padStart(2,'0')}</span>
              <span class="codex-title">${shortTitle}</span>
              <span class="codex-arrow">▶</span>
            </div>
            <div class="codex-body">${entry.text}</div>
          </div>`;
        }).join('');

        el.querySelectorAll('.codex-item:not(.locked-entry) .codex-header').forEach(h=>
          h.addEventListener('click',()=>h.closest('.codex-item').classList.toggle('open'))
        );
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

    })(); } catch(e) { console.error('[Life OS]', e); } /* end Life OS IIFE */