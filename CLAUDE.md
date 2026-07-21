# Leon OS — Project Reference

## What This Is
A personal life dashboard PWA. Vanilla JS, no framework, no build step. Open `dashboard.html` in browser to run. Installable as a PWA via `manifest.json`.

## Daily Essentials (always visible in sidebar)
- **Today** (`#section-today`) — home screen with score, cards, notes, todo
- **GIFD** (`#section-life-os`) — daily journal + habit scoring
- **Time OS** (`#section-time-os`) — weekly calendar grid
- **Money** (`#section-money`) — accounts, transactions, goals

Everything else (Movement, Nutrition, School, @2.chicos, Projects, Goals, Insights) is accessible via the "⋯ More sections" toggle.

## Tech Stack
- HTML/CSS/JS — no framework, no build pipeline
- Data: `localStorage` only (all keys prefixed `leon-*` or `los-*`)
- Cloud sync: GitHub Gist API (`js/gist-sync.js`) — auto-pushes 1 second after any data write
- Charts: Chart.js loaded from CDN on demand
- PWA: `manifest.json` + `sw.js` service worker (cache key: `leon-os-v10`)

## localStorage Key Schema
| Prefix | Module | Notes |
|--------|--------|-------|
| `los-gifd-current` | life-os.js | Array of `{date, desc, good, bad, happiness}` |
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
