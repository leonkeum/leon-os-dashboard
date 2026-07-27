# Leon OS — Project Reference

## What This Is
A personal life dashboard PWA. Vanilla JS, no framework, no build step. Open `dashboard.html` in browser to run. Installable as a PWA via `manifest.json`.

## Daily Essentials (always visible in sidebar)
- **Today** (`#section-today`) — home screen with score, cards, notes, todo
- **GIFD** (`#section-life-os`) — daily journal + habit scoring; also hosts the **Habits** tab (`js/habits.js`), an Aura-style streak tracker
- **Time OS** (`#section-time-os`) — weekly calendar grid
- **Money** (`#section-money`) — accounts, transactions, goals

Everything else (Movement, Nutrition, School, @2.chicos, Projects, Goals, Insights) is accessible via the "⋯ More sections" toggle.

## Tech Stack
- HTML/CSS/JS — no framework, no build pipeline
- Data: `localStorage` only (all keys prefixed `leon-*` or `los-*`)
- Cloud sync: GitHub Gist API (`js/gist-sync.js`) — auto-pushes 1 second after any data write
- Charts: Chart.js loaded from CDN on demand
- PWA: `manifest.json` + `sw.js` service worker (cache key: `leon-os-v13`)
- Deploy: push to `master` on GitHub → auto-published to GitHub Pages (`leonkeum.github.io/leon-os-dashboard`). No CI/build step — files are served as-is.
- **Cache-busting**: `dashboard.css` and every `js/*.js` are referenced from `dashboard.html` with a `?v=N` query string (currently `13`), mirrored in `sw.js`'s `STATIC` array and `CACHE_NAME`. GitHub Pages sends `Cache-Control: max-age=600` on every file, so without a version bump a browser can keep serving a stale cached CSS/JS file for up to 10 minutes after a deploy even though the HTML re-fetches (this actually happened — new HTML rendered with old, unstyled CSS). **On any change to `dashboard.css` or a `js/*.js` file, bump `?v=N` everywhere in `dashboard.html` + `sw.js`'s `STATIC` list + `CACHE_NAME` together**, or the update won't reliably reach already-loaded phones/PWAs.

## localStorage Key Schema
| Prefix | Module | Notes |
|--------|--------|-------|
| `los-gifd-current` | life-os.js | Array of `{date, desc, good, bad, happiness}` |
| `los-habits-defs` | habits.js | Array of `{id, name, icon, color, type, unit?, dailyTarget?, timerGoal?, startDate?, createdAt}` — `type` is one of `activity`/`timer`/`streak`/`daysSince` |
| `los-habits-logs` | habits.js | Array of `{id, habitId, date, value}` — one entry per habit per date, upserted |
| `los-habits-timer` | habits.js | `{habitId, startedAt}` or `null` — the currently-running Timer-type session |
| `leon-workout-v3` | movement.js | `{sessions:[{date, sets:[{exercise,kg,reps}]}]}` |
| `leon-sleep-v2` | movement.js | `{entries:[{date,actual,quality,bedtime,waketime}]}` |
| `leon-nutrition-v2` | nutrition.js | `{YYYY-MM-DD:{meals:[],totals:{protein,calories}}}` |
| `leon-calendar-v2` | time-os.js | Array of `{date,day,label,start,end,color}` |
| `leon-money-v1` | money.js | `{accounts,transactions,goals}` |
| `leon-notes-pages` | today-dashboard.js | Array of `{id,title,content}` |
| `leon-todo-items` | today-dashboard.js | Array of `{id,text,done,created}` |
| `leon-sidebar-expanded` | shared-init.js | `'1'` or `'0'` |
| `sync-pat` | gist-sync.js | GitHub PAT (skipped from sync) |
| `sync-gist-id` | gist-sync.js | Gist ID (skipped from sync) |

## Module Responsibilities
| File | Owns |
|------|------|
| `js/shared-init.js` | Service worker, clock, section switching, sidebar toggle, mobile tray |
| `js/today-dashboard.js` | Today section render, notes, todo, day strip, data export |
| `js/life-os.js` | GIFD journal, Codex rules |
| `js/habits.js` | Habits tab: Activity/Timer/Streak/Days-Since tracker, best streak/month, calendar, trend chart |
| `js/time-os.js` | Calendar grid, event add/edit |
| `js/money.js` | Accounts, transactions, cash flow, money goals |
| `js/movement.js` | Workout log, calisthenics skills, Sleep OS |
| `js/nutrition.js` | Protein tracking, meal log, AI estimation |
| `js/gamification.js` | Daily score, streaks, buffs/debuffs |
| `js/gist-sync.js` | GitHub Gist push/pull, auto-sync on localStorage writes |
| `js/insights.js` | Analytics charts (14-day trends) |
| `js/chicos.js` | Social Media section: account label, post tracking, content kanban |
| `js/skills-school.js` | School assignments |
| `js/weekly-review.js` | Weekly review banner |
| `js/notifications.js` | Push notification setup |

## Global Functions (cross-module calls)
- `window.updateDailyScore()` — gamification.js, called after any section switch
- `window.refreshTodayDash()` — today-dashboard.js, re-renders Today cards
- `window.syncTodayProgress()` — today-dashboard.js, updates day strip dots
- `window.quickAddProtein(g, label, event)` — nutrition.js, called from Today card buttons
- `window.saveSleepQuick(bedtime, waketime)` — movement.js, called from Today sleep card
- `window.exportLeonData()` — today-dashboard.js, downloads backup JSON

## Removed Features
- **Mana tab** (was `#los-mana`) — removed for simplicity; data keys `los-mana-*` still in localStorage if previously used
- **Map tab** (was `#los-map`) — removed; fog-of-war canvas and tile system removed from UI
- **Skills XP tab** (was `#los-skills`) — removed; data key `los-skills-*` still in localStorage
- **Radar Stats tab** (was `#los-radar`) — removed; data key `los-radar-*` still in localStorage
- **Side Projects section** (was `#section-side-projects`) — removed; data key `leon-side-projects-*` still in localStorage
- **Life Goals section** (was `#section-life-goals`) — removed; data key `leon-life-goals-*` still in localStorage
- **@2.chicos** renamed to **Social Media** (`#section-chicos`); simplified to account + last post + posts this week + kanban; follower/DM/Higgsfield/growth chart removed
