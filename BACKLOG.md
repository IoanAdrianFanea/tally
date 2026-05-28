## Team Performance Analytics (v3 idea)
- Cross-team comparison when teams rotate
- Admin reports showing productivity trends
- Weak relationship detection (who's not collaborating)
- Requires: 3+ months of activity data, archive system, stats API

## Date picker (v2 idea)
- Have a custom day picker for filtering which shows tasks created/completed dates only

## Theme picker (v2 idea)
- Custom column banners per user
- Monthly sticker/emoji themes
- Custom banner images
- Weekly theme of the week with description

## Simplify menu (v2 idea)
- remove menu so that elements can be accessed via hover buttons that are fixed on canvas

## Archived data queriable (v1-v2 idea)
- add a way to retrieve archived data cleanly

## Team changing (v3 idea)
- allow team changing and having multiple teams.

## Scheduled monthly job (Supabase Edge Function + pg_cron)

Runs automatically on the 1st of each month:

- Check if a manual archive exists for the previous month (`is_manual = true`)
  - If yes: skip auto-archive and auto-reset, respect the admin's decision
  - If no: run auto-archive (snapshot) then delete previous month's cards
- Send confirmation notification to admin after job completes

### Auto-reset opt-out
- Add `auto_reset boolean not null default true` to the `teams` table.  
  - If `auto_reset = false` for a team, the scheduled job skips that team entirely.
- Admin manages archiving and resets manually.

### Related DB changes needed
- `archives.is_manual boolean not null default false` — already added
- `teams.auto_reset boolean not null default true` — add when building this feature

### Team invite flow
- admin invites by email, user gets magic link, automatically added to correct team and users table
- admin can also manage users and modify teams