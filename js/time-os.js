    try { (function () {
      const CAL_KEY = 'leon-calendar-v2';
      const DAYS    = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

      /* Default calendar blocks
         day  = recurring every week on that weekday
         date = specific YYYY-MM-DD (overrides recurring for that day)
         No recurring blocks are seeded by default — Euroaula (school) is done,
         and both @2.chicos and Gaby's shifts vary week to week, so fixed
         defaults just go stale. Add real events with the + button instead. */
      const DEFAULT_BLOCKS = [];

      function loadCal() {
        try { const v = localStorage.getItem(CAL_KEY); return v ? JSON.parse(v) : JSON.parse(JSON.stringify(DEFAULT_BLOCKS)); }
        catch(_) { return JSON.parse(JSON.stringify(DEFAULT_BLOCKS)); }
      }
      function saveCal(b) { try { localStorage.setItem(CAL_KEY, JSON.stringify(b)); } catch(_) {} }

      let calBlocks = loadCal();

      // One-time cleanup: strip the old hardcoded Euroaula/@2.chicos/Gaby
      // seed blocks out of anyone's already-saved calendar. Schedules for
      // school/chicos/Gaby always varied, so these stale fixed blocks were
      // just clutter — real, current events should be added manually.
      {
        const before = calBlocks.length;
        calBlocks = calBlocks.filter(b => !/^(sch-|ch-|gb-|gaby-upload-)/.test(b.id));
        if (calBlocks.length !== before) saveCal(calBlocks);
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
            ? Math.max(0, Math.min(816 - dragState.h0, ghostFixedTop - colRect.top))
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
        if (top < 0 || top > 816) { line.style.display = 'none'; return; }
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

      // Average hours slept over the last 7 logged nights (Movement → Sleep OS)
      function avgSleepThisWeek() {
        try {
          const data = JSON.parse(localStorage.getItem('leon-sleep-v2') || '{"entries":[]}');
          const last7 = (data.entries || []).slice(-7).filter(e => e.actual > 0);
          if (!last7.length) return null;
          return last7.reduce((sum, e) => sum + e.actual, 0) / last7.length;
        } catch(_) { return null; }
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
        setHours('.stat-card.green .sc-hours', fmt(totals.green));

        const avgSleep = avgSleepThisWeek();
        setHours('.stat-card.sleep .sc-hours', avgSleep === null ? '—' : fmt(avgSleep));
        const sleepSub = q('.stat-card.sleep .sc-sub');
        if (sleepSub) sleepSub.textContent = avgSleep === null ? 'Log a night in Sleep OS' : (avgSleep >= 7 ? 'Solid — last 7 nights' : 'Below 7h — last 7 nights');
        const sleepFill = q('.stat-card.sleep .sc-fill');
        if (sleepFill) sleepFill.style.width = Math.min(100, Math.round((avgSleep || 0) / 9 * 100)) + '%';

        // Free time: 7 days × 18 waking hours minus committed (calendar blocks only)
        const committed = totals.red + totals.blue + totals.green;
        setHours('.stat-card.muted .sc-hours', Math.round(Math.max(0, 7 * 18 - committed)) + 'h');

        // Update sub labels
        const redSub = q('.stat-card.red .sc-sub');
        if (redSub) redSub.textContent = totals.red > 0 ? 'This week' : 'No shifts this week';
        const greenSub = q('.stat-card.green .sc-sub');
        if (greenSub) greenSub.textContent = totals.green > 0 ? 'This week' : 'No shifts this week';
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
        [6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,0,1,2,3,4,5].forEach(h =>
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
      }

      // The whole page scrolls now (the grid is a full 24h tall, not its own
      // scroll container) — bring "now" into view within that page scroll.
      function scrollToNow() {
        const line = document.getElementById('time-now-line');
        if (line) line.scrollIntoView({ block: 'center' });
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
      window.scrollTimeOsToNow = () => setTimeout(scrollToNow, 60);
      window.scrollTimeOsToNow();
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
    })(); } catch(e) { console.error('[Time OS]', e); }