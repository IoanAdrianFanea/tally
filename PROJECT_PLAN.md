# Productivity Dashboard — Project Plan

## Overview
A browser-based gamified task board for small remote teams. Replaces manual Miro workflows with automated point tracking, timestamps, and monthly archiving.

**Client:** UK web design agency (remote)
**Deadline:** June 1st 2026 (35 days)  
**Stack:** Next.js · TypeScript · Supabase · Tailwind · shadcn/ui · dnd-kit · Vercel

---

## Core Jobs the Product Does
1. Show what everyone is working on today (visual board, one column per person)
2. Track who is winning the month (auto points from green cards)
3. Show when people are working (timestamps, start/end of day detection)
4. Find historical tasks (keyword search across archived months)

---

## Scope

### In (v1)
- Magic link auth, single team workspace
- Kanban board with one column per user, colour coded
- Create / edit / delete / drag cards within and across columns
- Mark card green (admin only) = 1 point
- Auto timestamps on card creation and completion (visible on hover)
- First and last action of day logged automatically
- Stale card visual treatment for incomplete previous-day cards
- Monthly leaderboard with auto point tally
- Keyword search + filter by person and date
- Weekly stats per user (tasks per day, completion rate, avg time)
- Monthly theme picker (12 prebuilt colour schemes)
- Archive month → snapshot to DB → board resets clean
- Mobile responsive web app

### Out (v1)
- Infinite canvas / zoom (solved by monthly reset reducing board size)
- Multi-team / multi-board support
- Native mobile app
- Email notifications or third-party integrations
- Task weighting or comments
- Year-to-date search (current + last archived month only)

---

## Data Model

| Table | Purpose |
|---|---|
| `teams` | Single team workspace, holds current theme |
| `users` | Team members with role, colour, display name |
| `cards` | Tasks with status, position, owner, month_key |
| `activity_log` | Every action (create, complete, move, login) |
| `archives` | Monthly snapshots as JSONB |
| `themes` | 12 preset monthly colour schemes |

Key decisions:
- `month_key` (e.g. `2026-05`) on cards makes archiving a single SQL operation
- `activity_log` is the source of truth for all analytics and timestamps
- Schema supports multi-tenancy from day one via `team_id` on every table

---

## API Routes
Cards
GET    /api/cards                   all cards for current month
POST   /api/cards                   create card
PATCH  /api/cards/:id               update content, position, owner
DELETE /api/cards/:id               delete card
POST   /api/cards/:id/complete      mark green (admin only)
Search
GET    /api/search?q=&from=&to=&user=
Stats
GET    /api/stats/leaderboard       monthly points per user
GET    /api/stats/user/:id          individual weekly/monthly stats
GET    /api/stats/team              team-wide metrics
Admin
POST   /api/archive                 snapshot month, reset board
GET    /api/themes                  list available themes
PATCH  /api/team/theme              set active theme

---

## 35-Day Sprint

| Week | Dates | Tasks | Checkpoint |
|---|---|---|---|
| 1 | Apr 27 – May 3 | Project setup, DB schema, auth, static board | Board renders from DB |
| 2 | May 4 – May 10 | Create/edit/delete, drag and drop, mark green, real-time sync | Live sync across two windows |
| 3 | May 11 – May 17 | Points + leaderboard, timestamps, start/end of day, search | All smart features working |
| 4 | May 18 – May 24 | Theme picker, archive + reset, weekly stats, mobile responsive | Feature-complete prototype |
| 5 | May 25 – May 31 | Bug bash, performance pass, onboarding flow, soft launch | Team is live |

---

## Engineering Rules
- One branch per feature, merged via PR even when working solo
- Write the DB query before building the UI
- Ship a demo URL every Friday
- All scope changes go in `BACKLOG.md`, not the sprint
- Unit test the points calculation — everything else can break, not that

---

## Key Risks

| Risk | Mitigation |
|---|---|
| Mobile drag-and-drop is janky | Test on mobile from week 2 |
| Scope creep from client | IN/OUT list is the contract |
| Real-time sync conflicts | Last-write-wins for v1 |
| One bad week kills the timeline | Week 5 is a buffer, scope locks at week 4 |