# Standup Board

A lightweight, gamified task board for tiny remote teams. Built as a replacement for the manual Miro workflow used by a UK-based remote web design agency for daily standups.

> Currently in active development. Targeting a 35-day sprint to a working prototype with a real team using it end-to-end.

---

## What it does

Four core jobs:

1. **Show what everyone is working on today**: a kanban board with one column per team member, colour-coded.
2. **Track who is winning the month**: admin marks cards green when completed, points auto-tally to a live leaderboard.
3. **Show when people are working**: every card action is logged, timestamps shown on hover, start/end of day derived from activity.
4. **Find historical tasks**: keyword search across cards with filters by person and date.

At the end of each month the board archives itself and resets clean, with a new monthly theme.

---

## Why it exists

The client's team had been running daily standups on Miro for over a year. The workflow was working, but Miro was the wrong tool for it. Manual point counting, no historical search, no automation, the board getting unmanageably cluttered by the end of each month.

The brief was to build a focused product that replaces just the standup workflow, automates the admin overhead, and adds enough gamification to make point tracking feel motivating rather than tedious.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14 (App Router) | Single deploy, server components reduce client JS |
| Language | TypeScript | Type safety across the full stack |
| Styling | Tailwind CSS + shadcn/ui | Fast iteration, consistent design system |
| Database | Supabase (PostgreSQL) | Hosted Postgres with built-in auth, realtime, RLS |
| Auth | Supabase Auth (magic link) | No password management for a small trusted team |
| Drag and drop | dnd-kit | Modern, maintained, accessible |
| Real-time | Supabase Realtime (Postgres CDC) | Live sync via WebSockets |
| Hosting | Vercel | Zero-config deploys, free tier |

---

## Architecture highlights

**Server-first rendering.** The board page is a server component that fetches all data in one round trip, then hands off interactive pieces to client components. No loading spinners on initial render.

**Activity log as source of truth.** Every card action (create, edit, complete, reopen, delete, move) writes an immutable entry to an `activity_log` table. Points, leaderboard rankings, and daily timestamps are all derived from this log rather than computed from the cards table, which means deleted or edited cards don't corrupt historical analytics.

**Row-level security from day one.** RLS policies enforce that users can only see and modify data for their own team. The schema includes `team_id` on every table even though v1 only supports a single team, so going multi-tenant later doesn't require a rewrite.

**Optimistic UI with server reconciliation.** Drag and drop updates the local state instantly, fires the API call in the background, and falls back to server state on failure.

**Progressive stale card treatment.** Open cards get a subtle visual age indicator based on days since creation. 1 day is barely visible, 3+ days adds an "overdue" label, 7+ days is unmistakable. Avoids the "everything looks urgent" problem.

---

## Data model

Six tables, all multi-tenant ready:

- `teams`: team workspace, holds current theme
- `users`: team members with role (admin/member), display name, column colour
- `cards`: tasks with status, position, owner, month partition key
- `activity_log`: append-only audit trail of every action
- `archives`: monthly snapshots as JSONB
- `themes`: twelve preset monthly colour schemes

Key design decisions are documented in `DECISIONS.md`.

---

## Project structure

```
src/
├── app/
│   ├── (auth)/login              Magic link login page
│   ├── (dashboard)/board         Main board page (server component)
│   ├── api/
│   │   ├── cards/                CRUD + complete + reopen endpoints
│   │   └── stats/leaderboard     Aggregated points + completion stats
│   └── auth/callback             Magic link callback handler
├── components/board/             Board UI components (server + client mix)
├── lib/
│   ├── supabase/                 Browser and server Supabase clients
│   └── activity.ts               Shared activity log writer
└── middleware.ts                 Auth guard on every route
```

---

## Sprint progress

Built as a 35-day solo sprint with weekly checkpoints. Tracking against `PROJECT_PLAN.md`.

- **Week 1, Foundation.** Auth, schema, RLS, static board rendering.
- **Week 2, Interactivity.** Card CRUD, drag and drop within and across columns, mark green (admin only), activity logging, real-time sync.
- **Week 3, Gamification and time.** Points calculation, leaderboard panel, hover timestamps, reopen cards, stale card treatment, search (in progress).
- **Week 4, Theming and archive.** Theme picker, monthly archive + reset, weekly stats, mobile polish.
- **Week 5, Hardening and launch.** Bug bash, performance pass, onboarding, soft launch with the client's team.

---

## What this project taught me

Going in I was comfortable with NestJS but had never shipped a full Next.js app. The App Router's server-component model forced a mental shift. Instead of "frontend calls backend over HTTP," it became "some components run on the server, some in the browser, and you choose per file based on what each piece needs."

Other things I learnt the hard way:

- **Database design matters more than feature count.** Getting `month_key` and the activity log right early meant later features like leaderboard and archive were small SQL queries rather than tangled rewrites.
- **Optimistic updates and real-time sync fight each other** if you're not careful. Switching from `useOptimistic` to `useState` for the cards array fixed live sync flickering.
- **REST conventions for actions.** PATCH for field updates, POST on a sub-resource for state transitions (`/cards/:id/complete`, `/cards/:id/reopen`) reads more clearly than overloading PATCH.
- **Foreign key cascades need thought.** The activity log foreign key to `cards.id` originally blocked card deletion until I set it to `ON DELETE SET NULL`.

---

## Running locally

```bash
git clone <this-repo>
cd standup-board
npm install
cp .env.example .env.local      # fill in Supabase keys
npm run dev
```

You'll need a Supabase project with the schema in `supabase/migrations/001_initial_schema.sql` applied, and at least one user inserted into the `users` table linked to a Supabase auth user.

---

## Status

Active development. Not feature-complete. Not deployed. Not seeking contributions, this is being built for a specific client.

The code is public so I can talk about it in interviews and so employers can see how I think about real product work.
