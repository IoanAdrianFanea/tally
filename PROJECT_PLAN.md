# Standup Board — Product Plan

## What it is
A daily infinite canvas workspace for small remote teams. Each day has its own board. Teams organise tasks freely in topic sections, compete on a monthly leaderboard, and navigate between days like a calendar.

## Stack
Next.js · TypeScript · Supabase · Tailwind · shadcn/ui · @hello-pangea/dnd · react-zoom-pan-pinch · Vercel

---

## Data model

```
boards
  id, team_id, date, is_archived, created_at

sections
  id, board_id, team_id, name, x, y, width, height, is_done_section, position

cards
  id, board_id, section_id, team_id, owner_id,
  content, x, y, position, status, completed_at, created_at

activity_log
  id, team_id, user_id, action_type, card_id, metadata, created_at

archives
  id, team_id, month_key, snapshot, is_manual, created_at

users
  id, team_id, display_name, column_color, role, email

teams
  id, name, banner_url, banner_title, theme_id

themes
  12 presets, unchanged
```

Key decisions:
- `status` and `completed_at` are set automatically when a card enters or leaves the Done section — backwards compatible with existing leaderboard and archive logic
- `section_id` on cards replaces `month_key` as the primary organisational unit
- `boards.date` is the source of truth for day navigation
- `sections.is_done_section` flags the Done section — only one per board

---

## Build order

### 1. Foundation
- Schema migration — create boards, sections tables, update cards
- Auto-create today's board on first load
- Day navigation in navbar — left/right arrows + date picker
- Past boards load as read-only

### 2. Infinite canvas
- Pan + zoom via react-zoom-pan-pinch
- Dot grid background
- Sections — draggable, resizable, named bordered containers
- Admin creates, names, repositions, resizes sections
- Cards are free-floating sticky notes inside sections, coloured by owner
- Drag and drop works correctly at any zoom level
- Done section — smart auto-assignment into per-person sub-columns when card is dropped
- Dropping card into Done section sets status = green, completed_at = now, awards 1 point
- Removing card from Done section reverts status = open, completed_at = null
- Minimap

### 3. Cards and points
- Create card by clicking inside a section
- Edit and delete cards
- Drag cards freely between sections
- Leaderboard counts cards in Done section per person
- Points update in real time

### 4. Board management
- Copy single card
- Multi-select cards and copy
- Paste to current board
- Duplicate yesterday's board as starting point for today
- Archive month — snapshots all boards in that month
- Browse past boards from calendar picker

### 5. Polish
- UI redesign — clean, aesthetic, Stitch-inspired
- Banner upload per board
- 12 preset monthly themes
- Performance pass
- Universal search across all boards with date range filter
- Mobile responsive (last)

---

## Out of scope for now
- Multi-team support (lowest priority, add after everything else)
- Theme customisation beyond 12 presets
- Decoration and sticker system
- Email notifications