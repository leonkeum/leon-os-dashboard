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
    }

    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => switchSection(item.dataset.section));
    });

    document.querySelectorAll('.mob-nav-item').forEach(item => {
      item.addEventListener('click', () => switchSection(item.dataset.section));
    });
