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
      if (sectionKey === 'time-os') window.scrollTimeOsToNow?.();
    }

    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => switchSection(item.dataset.section));
    });

    document.querySelectorAll('.mob-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        switchSection(item.dataset.section);
        // Close more tray when a section is selected
        const tray = document.getElementById('mob-more-tray');
        if (tray) tray.style.display = 'none';
        const moreBtn = document.getElementById('mob-more-btn');
        if (moreBtn) moreBtn.style.color = '';
      });
    });

    // Sidebar extras toggle
    (function () {
      const extras = document.getElementById('sidebar-extras');
      const btn    = document.getElementById('sidebar-more-btn');
      const icon   = document.getElementById('sidebar-more-icon');
      if (!extras || !btn) return;
      let expanded = localStorage.getItem('leon-sidebar-expanded') === '1';
      function applyState() {
        extras.style.display = expanded ? '' : 'none';
        if (icon) icon.textContent = expanded ? '↑' : '⋯';
      }
      applyState();
      btn.addEventListener('click', () => {
        expanded = !expanded;
        localStorage.setItem('leon-sidebar-expanded', expanded ? '1' : '0');
        applyState();
      });
    })();

    // Mobile more tray toggle
    (function () {
      const moreBtn = document.getElementById('mob-more-btn');
      const tray    = document.getElementById('mob-more-tray');
      if (!moreBtn || !tray) return;
      moreBtn.addEventListener('click', () => {
        const open = tray.style.display === 'flex';
        tray.style.display = open ? 'none' : 'flex';
        moreBtn.style.color = open ? '' : '#4f7ec9';
      });
      // Close tray when tapping outside
      document.addEventListener('click', e => {
        if (!tray.contains(e.target) && e.target !== moreBtn && !moreBtn.contains(e.target)) {
          tray.style.display = 'none';
          moreBtn.style.color = '';
        }
      });
    })();
