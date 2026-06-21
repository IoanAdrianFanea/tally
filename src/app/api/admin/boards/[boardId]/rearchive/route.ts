import { createClient } from "@/lib/supabase/server"
import { logActivity } from "@/lib/activity"
import { NextResponse, type NextRequest } from "next/server"

// POST /api/admin/boards/[boardId]/rearchive
// Closes an unarchived board, updates the archive_days snapshot with any changes,
// and marks archives.status = 'modified'.
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ boardId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users")
    .select("team_id, role")
    .eq("id", user.id)
    .single()

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 })
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { boardId } = await context.params

  // Fetch the board with current state (select * to survive pre-migration schema)
  const { data: board } = await supabase
    .from("boards")
    .select("*")
    .eq("id", boardId)
    .eq("team_id", profile.team_id)
    .maybeSingle()

  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 })

  // Fetch current sections and cards for the snapshot update
  const { data: sections } = await supabase
    .from("sections")
    .select("id, name, x, y, width, height, is_done_section, position")
    .eq("board_id", boardId)

  const { data: cards } = await supabase
    .from("cards")
    .select("id, content, owner_id, status, x, y, section_id, completed_at")
    .eq("board_id", boardId)

  const pointsByUser: Record<string, number> = {}
  for (const card of cards ?? []) {
    if (card.status === "green" && card.owner_id) {
      pointsByUser[card.owner_id] = (pointsByUser[card.owner_id] ?? 0) + 1
    }
  }

  const updatedDaySnapshot = {
    sections: sections ?? [],
    cards: cards ?? [],
    points_by_user: pointsByUser,
    rearchived_at: new Date().toISOString(),
  }

  // Find the matching archive_days entry
  const monthKey = board.date.slice(0, 7)

  const { data: archiveRecord } = await supabase
    .from("archives")
    .select("id")
    .eq("team_id", profile.team_id)
    .eq("month_key", monthKey)
    .single()

  if (archiveRecord) {
    // Mark this day as closed in archive_days
    await supabase
      .from("archive_days")
      .update({ day_snapshot: updatedDaySnapshot, is_open: false })
      .eq("archive_id", archiveRecord.id)
      .eq("date", board.date)

    // Check if any other days are still open; if not, clear archive.is_open
    const { count: stillOpenCount } = await supabase
      .from("archive_days")
      .select("id", { count: "exact", head: true })
      .eq("archive_id", archiveRecord.id)
      .eq("is_open", true)

    if ((stillOpenCount ?? 0) === 0) {
      await supabase
        .from("archives")
        .update({ is_open: false })
        .eq("id", archiveRecord.id)
    }
  }

  // Re-archive the board
  const { error } = await supabase
    .from("boards")
    .update({ is_archived: true, unarchived_until: null })
    .eq("id", boardId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logActivity(supabase, {
    team_id: profile.team_id,
    user_id: user.id,
    action_type: "day_rearchived",
    card_id: null,
    metadata: {
      board_id: boardId,
      date: board.date,
      cards_count: cards?.length ?? 0,
      completed_cards: (cards ?? []).filter((c) => c.status === "green").length,
      points_by_user: pointsByUser,
      archive_id: archiveRecord?.id ?? null,
      snapshot_updated: !!archiveRecord,
    },
  })

  return NextResponse.json({ success: true })
}
