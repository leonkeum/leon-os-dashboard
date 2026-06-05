(function initGistSync() {
  const SKIP_KEYS = new Set(['sync-pat','sync-gist-id','sync-auto','sync-last-push']);
  const GIST_FILE = 'leon-os-data.json';

  const overlay   = document.getElementById('sync-overlay');
  const syncBtn   = document.getElementById('sync-btn');
  const patInput  = document.getElementById('sync-pat');
  const gistInput = document.getElementById('sync-gist-id');
  const autoCb    = document.getElementById('sync-auto-cb');
  const pushBtn   = document.getElementById('sync-push-btn');
  const pullBtn   = document.getElementById('sync-pull-btn');
  const statusEl  = document.getElementById('sync-status');

  if (!overlay || !syncBtn) return;

  /* ── Persist config in localStorage ── */
  function getCfg() {
    return {
      pat:    localStorage.getItem('sync-pat')     || '',
      gistId: localStorage.getItem('sync-gist-id') || '',
      auto:   localStorage.getItem('sync-auto')    === '1',
    };
  }
  function saveCfg() {
    localStorage.setItem('sync-pat',    patInput.value.trim());
    localStorage.setItem('sync-gist-id',gistInput.value.trim());
    localStorage.setItem('sync-auto',   autoCb.checked ? '1' : '0');
  }

  /* ── Open modal, populate inputs ── */
  syncBtn.addEventListener('click', () => {
    const cfg = getCfg();
    patInput.value  = cfg.pat;
    gistInput.value = cfg.gistId;
    autoCb.checked  = cfg.auto;
    const last = localStorage.getItem('sync-last-push');
    setStatus(last ? 'Last push: ' + new Date(last).toLocaleString() : '', '');
    overlay.style.display = 'flex';
    patInput.focus();
  });

  /* ── Status helper ── */
  function setStatus(msg, cls) {
    statusEl.textContent = msg;
    statusEl.className   = 'sync-status' + (cls ? ' ' + cls : '');
  }
  function setBusy(busy) {
    pushBtn.disabled = pullBtn.disabled = busy;
    syncBtn.classList.toggle('syncing', busy);
  }

  /* ── Silent auto-push (debounced) ── */
  let autoPushTimer = null;
  let autoPushing   = false;
  async function doSilentPush() {
    const cfg = getCfg();
    if (!cfg.pat || !cfg.gistId) return; // not configured — skip
    if (autoPushing) return;             // push already in flight
    autoPushing = true;
    syncBtn.classList.add('syncing');
    try {
      const content = JSON.stringify(collectData(), null, 0);
      await gistRequest('PATCH', '/gists/' + cfg.gistId, { [GIST_FILE]: { content } }, cfg.pat);
      const ts = new Date().toISOString();
      _origSetItem.call(localStorage, 'sync-last-push', ts);
    } catch(_) { /* silent — user can manually push if needed */ }
    autoPushing = false;
    syncBtn.classList.remove('syncing');
  }
  function scheduleAutoPush() {
    clearTimeout(autoPushTimer);
    autoPushTimer = setTimeout(doSilentPush, 4000);
  }

  /* ── Intercept localStorage writes to trigger auto-push ── */
  const _origSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(key, value) {
    _origSetItem(key, value);
    if (!SKIP_KEYS.has(key)) scheduleAutoPush();
  };

  /* ── Collect all data to sync ── */
  function collectData() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!SKIP_KEYS.has(k)) data[k] = localStorage.getItem(k);
    }
    return data;
  }

  /* ── Gist API helpers ── */
  async function gistRequest(method, path, body, pat) {
    const resp = await fetch('https://api.github.com' + path, {
      method,
      headers: {
        'Authorization': 'token ' + pat,
        'Accept':        'application/vnd.github+json',
        'Content-Type':  'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || resp.statusText);
    }
    return resp.json();
  }

  /* ── Push ── */
  pushBtn.addEventListener('click', async () => {
    saveCfg();
    const cfg = getCfg();
    if (!cfg.pat) { setStatus('Enter your GitHub PAT first.', 'err'); return; }
    setBusy(true);
    setStatus('Pushing…', '');
    try {
      const content = JSON.stringify(collectData(), null, 0);
      const filePayload = { [GIST_FILE]: { content } };

      let gistId = cfg.gistId;
      if (!gistId) {
        // Create new gist
        const created = await gistRequest('POST', '/gists', {
          description: 'Leon OS dashboard data',
          public: false,
          files: filePayload,
        }, cfg.pat);
        gistId = created.id;
        localStorage.setItem('sync-gist-id', gistId);
        gistInput.value = gistId;
      } else {
        await gistRequest('PATCH', '/gists/' + gistId, { files: filePayload }, cfg.pat);
      }

      const ts = new Date().toISOString();
      _origSetItem.call(localStorage, 'sync-last-push', ts);
      setStatus('✓ Pushed at ' + new Date(ts).toLocaleTimeString(), 'ok');
    } catch(e) {
      setStatus('Push failed: ' + e.message, 'err');
    }
    setBusy(false);
  });

  /* ── Pull ── */
  async function doPull(silent) {
    const cfg = getCfg();
    if (!cfg.pat || !cfg.gistId) {
      if (!silent) setStatus('Enter PAT and Gist ID first.', 'err');
      return false;
    }
    if (!silent) { setBusy(true); setStatus('Pulling…', ''); }
    try {
      const gist = await gistRequest('GET', '/gists/' + cfg.gistId, null, cfg.pat);
      const file = gist.files && gist.files[GIST_FILE];
      if (!file) throw new Error('File "' + GIST_FILE + '" not found in gist.');

      // Fetch raw content (may be truncated in API response)
      let raw = file.content;
      if (file.truncated) {
        const r = await fetch(file.raw_url);
        raw = await r.text();
      }
      const data = JSON.parse(raw);

      // Restore — overwrite matching keys, leave others untouched
      // Use _origSetItem so restoring data doesn't trigger auto-push
      Object.entries(data).forEach(([k, v]) => {
        if (!SKIP_KEYS.has(k)) _origSetItem.call(localStorage, k, v);
      });

      if (!silent) {
        setStatus('✓ Pulled. Reloading…', 'ok');
        setTimeout(() => location.reload(), 900);
      }
      return true;
    } catch(e) {
      if (!silent) { setStatus('Pull failed: ' + e.message, 'err'); setBusy(false); }
      return false;
    }
  }

  pullBtn.addEventListener('click', async () => {
    saveCfg();
    setBusy(true);
    await doPull(false);
    setBusy(false);
  });

  /* ── Auto-pull on load ── */
  autoCb.addEventListener('change', saveCfg);
  const cfg0 = getCfg();
  if (cfg0.auto && cfg0.pat && cfg0.gistId) {
    doPull(true).then(ok => {
      if (ok) {
        // Show toast only — no reload. A reload after auto-pull causes an
        // infinite loop because every reload re-triggers auto-pull.
        // Fresh data is now in localStorage; it will render on next genuine open.
        const toast = document.createElement('div');
        toast.textContent = '☁ Synced from cloud';
        toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#4f7ec9;color:#fff;font-size:12px;padding:8px 16px;border-radius:20px;z-index:9999;pointer-events:none;opacity:1;transition:opacity .4s;';
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 400); }, 2000);
      }
    });
  }

  /* ── Push immediately when app goes to background (mobile close) ── */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      clearTimeout(autoPushTimer);
      doSilentPush();
    }
  });

})();
