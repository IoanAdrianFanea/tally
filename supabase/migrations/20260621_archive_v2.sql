-- ============================================================
-- Archive v2 — run once in Supabase SQL editor
-- ============================================================

-- ── 1. Evolve archives table ──────────────────────────────────────────────────
-- Add separate data columns (replacing the old monolithic snapshot blob)
ALTER TABLE archives
  ADD COLUMN IF NOT EXISTS archived_at           timestamptz  DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS is_open               boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS users                 jsonb,
  ADD COLUMN IF NOT EXISTS total_points_by_user  jsonb,
  ADD COLUMN IF NOT EXISTS total_days_with_boards integer     DEFAULT 0;

-- Migrate any existing snapshot data into the new columns (only if old columns exist)
DO $$
DECLARE
  has_month_snapshot boolean;
  has_snapshot       boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'archives' AND column_name = 'month_snapshot') INTO has_month_snapshot;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'archives' AND column_name = 'snapshot')       INTO has_snapshot;

  IF has_month_snapshot THEN
    EXECUTE $sql$
      UPDATE archives SET
        archived_at            = COALESCE((month_snapshot->>'archived_at')::timestamptz, created_at),
        users                  = month_snapshot->'users',
        total_points_by_user   = month_snapshot->'total_points_by_user',
        total_days_with_boards = COALESCE((month_snapshot->>'total_days_with_boards')::integer, 0)
      WHERE archived_at IS NULL OR users IS NULL
    $sql$;
  ELSIF has_snapshot THEN
    EXECUTE $sql$
      UPDATE archives SET
        archived_at          = COALESCE((snapshot->>'archived_at')::timestamptz, created_at),
        users                = snapshot->'users',
        total_points_by_user = snapshot->'points_by_user'
      WHERE archived_at IS NULL OR users IS NULL
    $sql$;
  END IF;
END $$;

-- Drop old blob columns and obsolete flags (safe even if they don't exist)
ALTER TABLE archives DROP COLUMN IF EXISTS snapshot;
ALTER TABLE archives DROP COLUMN IF EXISTS month_snapshot;
ALTER TABLE archives DROP COLUMN IF EXISTS is_manual;
ALTER TABLE archives DROP COLUMN IF EXISTS status;

-- Ensure unique constraint on (team_id, month_key)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'archives_team_id_month_key_key'
      AND conrelid = 'archives'::regclass
  ) THEN
    ALTER TABLE archives ADD CONSTRAINT archives_team_id_month_key_key UNIQUE (team_id, month_key);
  END IF;
END $$;

-- ── 2. Create archive_days table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS archive_days (
  id              uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  archive_id      uuid        NOT NULL REFERENCES archives(id) ON DELETE CASCADE,
  date            date        NOT NULL,
  board_id        uuid        REFERENCES boards(id) ON DELETE SET NULL,
  board_existed   boolean     NOT NULL DEFAULT false,
  is_open         boolean     NOT NULL DEFAULT false,
  day_snapshot    jsonb,
  UNIQUE (archive_id, date)
);

CREATE INDEX IF NOT EXISTS archive_days_archive_id_idx ON archive_days(archive_id);
CREATE INDEX IF NOT EXISTS archive_days_board_id_idx   ON archive_days(board_id);

-- ── 3. Extend boards ──────────────────────────────────────────────────────────
ALTER TABLE boards
  ADD COLUMN IF NOT EXISTS is_archived      boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unarchived_until  timestamptz;

-- ── 4. Extend teams ───────────────────────────────────────────────────────────
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS last_archived_at timestamptz;

-- ── 5. RLS on archive_days ────────────────────────────────────────────────────
ALTER TABLE archive_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team members can read archive_days" ON archive_days;
DROP POLICY IF EXISTS "Service role full access to archive_days" ON archive_days;

CREATE POLICY "Team members can read archive_days"
  ON archive_days FOR SELECT
  USING (
    archive_id IN (
      SELECT id FROM archives
      WHERE team_id = (SELECT team_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Service role full access to archive_days"
  ON archive_days FOR ALL
  USING (true)
  WITH CHECK (true);
