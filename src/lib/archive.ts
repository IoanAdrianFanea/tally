import { logActivity } from "@/lib/activity"

type SupabaseClient = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>

/**
 * Archives all boards in `monthKey` (YYYY-MM) for the given team.
 * Idempotent — upserts archive entry and archive_days rows.
 * Soft-fails on columns that don't exist yet (pre-migration), but will use
 * new separate fields once migration has been run.
 */
export async function runMonthlyArchive(
  supabase: SupabaseClient,
  teamId: string,
  userId: string,
  monthKey: string
): Promise<{ archive_id: string; boards_archived: number }> {
  const [year, month] = monthKey.split("-").map(Number)

  // ── Fetch reference data ───────────────────────────────────────────────────
  const [{ data: team }, { data: teamUsers }] = await Promise.all([
    supabase.from("teams").select("id, name").eq("id", teamId).single(),
    supabase.from("users").select("id, display_name, column_color, role").eq("team_id", teamId),
  ])

  const firstDay = `${monthKey}-01`
  const lastDay = new Date(year, month, 0).toISOString().slice(0, 10)

  const { data: boards } = await supabase
    .from("boards")
    .select("id, date")
    .eq("team_id", teamId)
    .gte("date", firstDay)
    .lte("date", lastDay)
    .order("date", { ascending: true })

  if (!boards || boards.length === 0) {
    throw new Error(`No boards found for ${monthKey}`)
  }

  const boardIds = boards.map((b) => b.id)

  // ── Fetch all sections and cards ──────────────────────────────────────────
  const [{ data: allSections }, { data: allCards }] = await Promise.all([
    supabase.from("sections")
      .select("id, board_id, name, x, y, width, height, is_done_section, position")
      .in("board_id", boardIds),
    supabase.from("cards")
      .select("id, board_id, section_id, owner_id, content, x, y, status, completed_at")
      .in("board_id", boardIds),
  ])

  const sectionsByBoard: Record<string, NonNullable<typeof allSections>> = {}
  for (const s of allSections ?? []) {
    if (!sectionsByBoard[s.board_id]) sectionsByBoard[s.board_id] = []
    sectionsByBoard[s.board_id]!.push(s)
  }
  const cardsByBoard: Record<string, NonNullable<typeof allCards>> = {}
  for (const c of allCards ?? []) {
    if (!cardsByBoard[c.board_id]) cardsByBoard[c.board_id] = []
    cardsByBoard[c.board_id]!.push(c)
  }

  // ── Compute total points by user ───────────────────────────────────────────
  const totalPointsByUser: Record<string, number> = {}
  for (const card of allCards ?? []) {
    if (card.status === "green" && card.owner_id) {
      totalPointsByUser[card.owner_id] = (totalPointsByUser[card.owner_id] ?? 0) + 1
    }
  }

  // ── Users summary ──────────────────────────────────────────────────────────
  const usersSummary = (teamUsers ?? []).map((u) => ({
    id: u.id,
    display_name: u.display_name,
    column_color: u.column_color,
    role: u.role,
    total_points: totalPointsByUser[u.id] ?? 0,
  }))

  const archivedAt = new Date().toISOString()

  // ── Upsert archives entry — try new schema first, fall back to old blob ───
  let archiveEntry: { id: string } | null = null

  const newSchemaPayload = {
    team_id: teamId,
    month_key: monthKey,
    archived_at: archivedAt,
    is_open: false,
    users: usersSummary,
    total_points_by_user: totalPointsByUser,
    total_days_with_boards: boards.length,
  }

  const { data: newResult, error: newErr } = await supabase
    .from("archives")
    .upsert(newSchemaPayload, { onConflict: "team_id,month_key" })
    .select("id")
    .maybeSingle()

  if (!newErr) {
    archiveEntry = newResult
  } else {
    // Pre-migration fallback: use old `snapshot` blob column
    const legacySnapshot = {
      month: monthKey,
      archived_at: archivedAt,
      team: team ? { id: team.id, name: team.name } : null,
      users: usersSummary,
      total_points_by_user: totalPointsByUser,
      total_days_with_boards: boards.length,
      days: boards.map((board) => {
        const cards = (cardsByBoard[board.id] ?? []).map((c) => ({
          id: c.id, content: c.content, owner_id: c.owner_id,
          status: c.status, x: c.x, y: c.y,
          section_id: c.section_id, completed_at: c.completed_at,
        }))
        const pointsByUser: Record<string, number> = {}
        for (const c of cards) {
          if (c.status === "green" && c.owner_id)
            pointsByUser[c.owner_id] = (pointsByUser[c.owner_id] ?? 0) + 1
        }
        return {
          date: board.date, board_id: board.id, board_existed: true,
          sections: (sectionsByBoard[board.id] ?? []).map((s) => ({
            id: s.id, name: s.name, x: s.x, y: s.y,
            width: s.width, height: s.height,
            is_done_section: s.is_done_section, position: s.position,
          })),
          cards,
          points_by_user: pointsByUser,
        }
      }),
    }

    const { data: legacyResult, error: legacyErr } = await supabase
      .from("archives")
      .upsert(
        { team_id: teamId, month_key: monthKey, snapshot: legacySnapshot },
        { onConflict: "team_id,month_key" }
      )
      .select("id")
      .maybeSingle()

    if (legacyErr || !legacyResult) {
      throw new Error(legacyErr?.message ?? "Failed to create archive entry")
    }
    archiveEntry = legacyResult
  }

  if (!archiveEntry) throw new Error("Failed to retrieve archive entry after upsert")

  // ── Upsert archive_days rows ───────────────────────────────────────────────
  const archiveDayRows = boards.map((board) => {
    const sections = (sectionsByBoard[board.id] ?? []).map((s) => ({
      id: s.id, name: s.name, x: s.x, y: s.y,
      width: s.width, height: s.height,
      is_done_section: s.is_done_section, position: s.position,
    }))
    const cards = (cardsByBoard[board.id] ?? []).map((c) => ({
      id: c.id, content: c.content, owner_id: c.owner_id,
      status: c.status, x: c.x, y: c.y,
      section_id: c.section_id, completed_at: c.completed_at,
    }))
    const pointsByUser: Record<string, number> = {}
    for (const c of cards) {
      if (c.status === "green" && c.owner_id)
        pointsByUser[c.owner_id] = (pointsByUser[c.owner_id] ?? 0) + 1
    }
    return {
      archive_id: archiveEntry!.id,
      date: board.date,
      board_id: board.id,
      board_existed: true,
      is_open: false,
      day_snapshot: { sections, cards, points_by_user: pointsByUser },
    }
  })

  // Best-effort: archive_days table may not exist yet
  await supabase
    .from("archive_days")
    .upsert(archiveDayRows, { onConflict: "archive_id,date" })

  // ── Mark all boards as archived ────────────────────────────────────────────
  await supabase
    .from("boards")
    .update({ is_archived: true, unarchived_until: null })
    .in("id", boardIds)

  // ── Update teams.last_archived_at ─────────────────────────────────────────
  await supabase
    .from("teams")
    .update({ last_archived_at: archivedAt })
    .eq("id", teamId)

  // ── Log activity ──────────────────────────────────────────────────────────
  await logActivity(supabase, {
    team_id: teamId,
    user_id: userId,
    action_type: "month_archived",
    card_id: null,
    metadata: {
      month_key: monthKey,
      archive_id: archiveEntry.id,
      boards_archived: boardIds.length,
      total_points: Object.values(totalPointsByUser).reduce((a, b) => a + b, 0),
      triggered_by: "auto",
    },
  })

  return { archive_id: archiveEntry.id, boards_archived: boardIds.length }
}
