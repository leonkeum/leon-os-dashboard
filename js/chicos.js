function initChicosSection() {
const stored = JSON.parse(localStorage.getItem('twochicos_weekly') || '[]');
const latest = stored[stored.length-1] || {};
let selectedPosts = latest.posts || 0;
function saveWeek() {
const entry = {
timestamp: Date.now(),
date: new Date().toISOString().split('T')[0],
account: document.getElementById('chicos-account')?.value.trim() || '',
posts: selectedPosts,
lastPostDate: document.getElementById('chicos-last-post')?.value || ''
};
/* Overwrite today's entry if one already exists, otherwise append */
const todayIdx = stored.findIndex(e => e.date === entry.date);
if (todayIdx !== -1) stored[todayIdx] = entry;
else stored.push(entry);
localStorage.setItem('twochicos_weekly', JSON.stringify(stored));
renderChicosMetrics();
updateCountdownBadge();
}
function updateCountdownBadge() {
  const badge = document.getElementById('chicos-update-badge');
  if (!badge) return;
  const data = JSON.parse(localStorage.getItem('twochicos_weekly') || '[]');
  if (!data.length) {
    badge.textContent = 'no data yet';
    badge.className = 'chicos-update-badge badge-due';
    return;
  }
  const lastTs = data[data.length - 1].timestamp || 0;
  const msLeft = (lastTs + 7 * 86400000) - Date.now();
  const daysLeft = Math.ceil(msLeft / 86400000);
  if (daysLeft > 2) {
    badge.textContent = 'update in ' + daysLeft + 'd';
    badge.className = 'chicos-update-badge badge-ok';
  } else if (daysLeft > 0) {
    badge.textContent = 'due in ' + daysLeft + 'd';
    badge.className = 'chicos-update-badge badge-soon';
  } else if (daysLeft === 0) {
    badge.textContent = 'due today';
    badge.className = 'chicos-update-badge badge-due';
  } else {
    badge.textContent = Math.abs(daysLeft) + 'd overdue';
    badge.className = 'chicos-update-badge badge-overdue';
  }
}
function renderChicosMetrics() {
const data = JSON.parse(localStorage.getItem('twochicos_weekly') || '[]');
const latest = data[data.length-1] || {};
const lastPostDate = latest.lastPostDate ? new Date(latest.lastPostDate) : null;
const daysSince = lastPostDate ? Math.floor((Date.now() - lastPostDate) / 86400000) : null;
const last3 = data.slice(-3);
const avgPosts = last3.length ? last3.reduce((s,e) => s+(e.posts||0), 0) / last3.length : 0;
const consistency = avgPosts ? Math.round(((latest.posts||0) / avgPosts) * 100) : 0;
const monthPosts = data.filter(e => e.date && e.date.startsWith(new Date().toISOString().slice(0,7))).reduce((s,e) => s+(e.posts||0), 0);

const daysEl = document.getElementById('chicos-days-since');
if (daysEl) {
  daysEl.textContent = daysSince !== null ? daysSince : '—';
  daysEl.className = 'days-counter ' + (daysSince >= 14 ? 'days-red pulse' : daysSince >= 7 ? 'days-orange' : '');
}

const consEl = document.getElementById('chicos-consistency');
if (consEl) {
  consEl.textContent = consistency + '%';
  consEl.style.color = consistency >= 75 ? '#22c55e' : consistency >= 50 ? '#f59e0b' : '#ef4444';
}

const monthEl = document.getElementById('chicos-month-posts');
if (monthEl) {
  monthEl.textContent = monthPosts + '/12-16';
  monthEl.style.color = monthPosts >= 16 ? '#22c55e' : monthPosts >= 12 ? '#4ade80' : monthPosts >= 8 ? '#f59e0b' : monthPosts >= 4 ? '#f97316' : '';
}

const alertsEl = document.getElementById('chicos-alerts');
if (alertsEl) {
  if (!data.length) { alertsEl.innerHTML = ''; return; }
  let html = '';
  if (daysSince !== null && daysSince > 14) html += '<div class="chicos-alert chicos-alert-red">🔴 ' + daysSince + ' days without posting — your audience is waiting</div>';
  if (latest.posts === 0 && new Date().getDay() >= 4) html += '<div class="chicos-alert chicos-alert-amber">⚠️ No post this week yet — window closing</div>';
  alertsEl.innerHTML = html;
}
}
document.getElementById('chicos-save-btn')?.addEventListener('click', saveWeek);
/* ── Weekly form collapse toggle ── */
(function() {
  const toggleBtn = document.getElementById('chicos-form-toggle');
  const formBody  = document.getElementById('chicos-form-body');
  if (!toggleBtn || !formBody) return;
  toggleBtn.addEventListener('click', () => {
    const open = formBody.classList.toggle('open');
    toggleBtn.classList.toggle('open', open);
  });
})();
document.querySelectorAll('.chicos-post-btn').forEach(btn => {
btn.addEventListener('click', () => {
selectedPosts = parseInt(btn.dataset.val);
document.querySelectorAll('.chicos-post-btn').forEach(b => b.classList.remove('active'));
btn.classList.add('active');
});
});
/* ── Chicos Kanban ── */
(function () {
  const COLS = ['idea', 'filming', 'editing', 'published'];
  const LS_KEY = 'chicos_kanban';

  /* Migrate old string-array format → {id, title} objects */
  function migrate(raw) {
    const out = {};
    COLS.forEach(col => {
      const arr = raw[col] || [];
      out[col] = arr.map((item, i) =>
        typeof item === 'string'
          ? { id: Date.now().toString() + '_' + col + '_' + i, title: item }
          : item
      );
    });
    return out;
  }

  const _raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null') || {
    idea:      ['Backrooms Ep.4 — La Sala Roja', 'Anime short'],
    filming:   ['Cinematic commercial — next brand'],
    editing:   [],
    published: ['Backrooms Ep.1 — La Oficina']
  };
  const kanbanData = migrate(_raw);

  let _dragId = null, _dragFromCol = null;

  function saveKanban() {
    localStorage.setItem(LS_KEY, JSON.stringify(kanbanData));
  }

  /* ── Touch drag-and-drop for Kanban (mobile) ── */
  function addTouchDrag(el, card, col) {
    el.addEventListener('touchstart', function(e) {
      if (e.touches.length !== 1) return;
      const touch0 = e.touches[0];
      const startX = touch0.clientX, startY = touch0.clientY;
      let ghost = null, active = false, cancelled = false;

      const holdTimer = setTimeout(() => {
        if (cancelled) return;
        active = true;
        _dragId = card.id;
        _dragFromCol = col;
        el.style.opacity = '0.35';
        const rect = el.getBoundingClientRect();
        const ox = touch0.clientX - rect.left;
        const oy = touch0.clientY - rect.top;
        ghost = el.cloneNode(true);
        ghost._ox = ox;
        ghost._oy = oy;
        ghost.style.cssText = 'position:fixed;top:' + rect.top + 'px;left:' + rect.left + 'px;width:' + rect.width + 'px;opacity:0.92;pointer-events:none;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,0.6);transform:rotate(2deg);margin:0;border-radius:8px;';
        document.body.appendChild(ghost);
      }, 230);

      function onMove(ev) {
        const t = ev.touches[0];
        if (!active) {
          if (Math.hypot(t.clientX - startX, t.clientY - startY) > 8) {
            cancelled = true;
            clearTimeout(holdTimer);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onEnd);
          }
          return;
        }
        ev.preventDefault();
        ghost.style.top  = (t.clientY - ghost._oy) + 'px';
        ghost.style.left = (t.clientX - ghost._ox) + 'px';
        ghost.style.display = 'none';
        const over = document.elementFromPoint(t.clientX, t.clientY);
        ghost.style.display = '';
        const overColEl = over ? over.closest('.chicos-kanban-col') : null;
        document.querySelectorAll('.chicos-drag-over').forEach(c => c.classList.remove('chicos-drag-over'));
        if (overColEl && overColEl.dataset.kanbanCol && overColEl.dataset.kanbanCol !== col) {
          overColEl.classList.add('chicos-drag-over');
        }
      }

      function onEnd(ev) {
        clearTimeout(holdTimer);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
        if (ghost) { ghost.remove(); ghost = null; }
        el.style.opacity = '';
        if (!active) return;
        active = false;

        const t = ev.changedTouches[0];
        const over = document.elementFromPoint(t.clientX, t.clientY);
        const overColEl = over ? over.closest('.chicos-kanban-col') : null;
        const targetCol = overColEl ? overColEl.dataset.kanbanCol : null;
        document.querySelectorAll('.chicos-drag-over').forEach(c => c.classList.remove('chicos-drag-over'));

        if (targetCol && targetCol !== col) {
          const cardObj = (kanbanData[col] || []).find(c => c.id === card.id);
          if (cardObj) {
            kanbanData[col] = kanbanData[col].filter(c => c.id !== card.id);
            if (!kanbanData[targetCol]) kanbanData[targetCol] = [];
            kanbanData[targetCol].push(cardObj);
            saveKanban();
            renderKanban();
          }
        }
        _dragId = _dragFromCol = null;
      }

      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onEnd, { passive: true });
    }, { passive: true });
  }

  /* Only render the cards list — column chrome (drop zone, + button) is set up once */
  function renderCards(col) {
    const container = document.getElementById('kanban-' + col);
    if (!container) return;
    container.innerHTML = '';

    (kanbanData[col] || []).forEach(card => {
      const el = document.createElement('div');
      el.className = 'chicos-card';
      el.draggable = true;
      el.dataset.id  = card.id;
      el.dataset.col = col;
      el.innerHTML =
        '<button class="chicos-card-del" title="Delete">✕</button>' +
        '<div class="chicos-card-title">' + card.title + '</div>';

      /* Delete */
      el.querySelector('.chicos-card-del').addEventListener('click', e => {
        e.stopPropagation();
        kanbanData[col] = kanbanData[col].filter(c => c.id !== card.id);
        saveKanban();
        renderCards(col);
      });

      /* Desktop drag */
      el.addEventListener('dragstart', e => {
        _dragId = card.id;
        _dragFromCol = col;
        setTimeout(() => el.classList.add('chicos-card-dragging'), 0);
        e.dataTransfer.effectAllowed = 'move';
      });
      el.addEventListener('dragend', () => {
        el.classList.remove('chicos-card-dragging');
        document.querySelectorAll('.chicos-drag-over')
          .forEach(c => c.classList.remove('chicos-drag-over'));
        _dragId = _dragFromCol = null;
      });

      /* Mobile touch drag */
      addTouchDrag(el, card, col);

      container.appendChild(el);
    });
  }

  function renderKanban() { COLS.forEach(renderCards); saveKanban(); }

  /* Wire drop zone + add button once per column (keyed on colEl dataset) */
  function setupColumns() {
    COLS.forEach(col => {
      const container = document.getElementById('kanban-' + col);
      if (!container) return;
      const colEl = container.closest('.chicos-kanban-col');
      if (!colEl || colEl.dataset.kanbanReady) return;
      colEl.dataset.kanbanReady = '1';
      colEl.dataset.kanbanCol = col;  // used by touch drag to identify target

      /* ── Drop zone on the full column div so empty columns work ── */
      colEl.addEventListener('dragover', e => {
        e.preventDefault();
        if (_dragFromCol !== col) colEl.classList.add('chicos-drag-over');
      });
      colEl.addEventListener('dragleave', e => {
        if (!colEl.contains(e.relatedTarget))
          colEl.classList.remove('chicos-drag-over');
      });
      colEl.addEventListener('drop', e => {
        e.preventDefault();
        colEl.classList.remove('chicos-drag-over');
        if (!_dragId || !_dragFromCol || _dragFromCol === col) return;
        const card = (kanbanData[_dragFromCol] || []).find(c => c.id === _dragId);
        if (!card) return;
        kanbanData[_dragFromCol] = kanbanData[_dragFromCol].filter(c => c.id !== _dragId);
        kanbanData[col].push(card);
        _dragId = _dragFromCol = null;
        saveKanban();
        renderKanban();
      });

      /* ── + button + inline form (Idea column only) ── */
      if (col !== 'idea') return;
      const addBtn = document.createElement('button');
      addBtn.className = 'chicos-add-btn';
      addBtn.textContent = '+';

      const addForm = document.createElement('div');
      addForm.className = 'chicos-add-form';
      addForm.innerHTML =
        '<input class="chicos-add-input" type="text" placeholder="Add a card…" />' +
        '<div class="chicos-add-actions">' +
          '<button class="chicos-add-save">Add</button>' +
          '<button class="chicos-add-cancel">✕</button>' +
        '</div>';

      const input  = addForm.querySelector('.chicos-add-input');
      const saveBtn  = addForm.querySelector('.chicos-add-save');
      const cancelBtn = addForm.querySelector('.chicos-add-cancel');

      function openForm() {
        addForm.classList.add('open');
        addBtn.classList.add('active');
        input.focus();
      }
      function closeForm() {
        addForm.classList.remove('open');
        addBtn.classList.remove('active');
        input.value = '';
      }
      function addCard() {
        const title = input.value.trim();
        if (!title) return;
        kanbanData[col].unshift({ id: Date.now().toString() + '_' + col, title });
        saveKanban();
        renderCards(col);
        closeForm();
      }

      addBtn.addEventListener('click', () => addForm.classList.contains('open') ? closeForm() : openForm());
      saveBtn.addEventListener('click', addCard);
      cancelBtn.addEventListener('click', closeForm);
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') addCard();
        if (e.key === 'Escape') closeForm();
      });

      colEl.appendChild(addBtn);
      colEl.appendChild(addForm);
    });
  }

  window._renderChicosKanban = function () {
    setupColumns();
    renderKanban();
  };
})();
/* call once on init */
if (window._renderChicosKanban) window._renderChicosKanban();
renderChicosMetrics();
updateCountdownBadge();
if (latest.account)      document.getElementById('chicos-account').value    = latest.account;
if (latest.lastPostDate) document.getElementById('chicos-last-post').value  = latest.lastPostDate;
document.querySelectorAll('.chicos-post-btn').forEach(btn => {
if (parseInt(btn.dataset.val) === selectedPosts) btn.classList.add('active');
});
}
document.addEventListener('DOMContentLoaded', () => { if (document.getElementById('chicos-save-btn')) initChicosSection(); });

/* ══════════════════════════════════════════════════════════════
   GIST SYNC — push/pull all Leon OS data to a private GitHub Gist
   Config keys (never synced themselves):
     sync-pat       — GitHub Personal Access Token
     sync-gist-id   — Gist ID (set after first push)
     sync-auto      — '1' if auto-pull on load is enabled
     sync-last-push — ISO timestamp of last push
   ══════════════════════════════════════════════════════════════ */