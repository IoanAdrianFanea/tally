import { createClient } from "@/lib/supabase/server"
import { logActivity } from "@/lib/activity"
import { NextResponse, type NextRequest } from "next/server"

// POST /api/admin/boards/[boardId]/unarchive
// Opens an archived board for 24 hours of editing.
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

  // Verify the board belongs to this team
  const { data: board } = await supabase
    .from("boards")
    .select("id, date, team_id")
    .eq("id", boardId)
    .eq("team_id", profile.team_id)
    .single()

  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 })

  const unarchivedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const monthKey = board.date.slice(0, 7)

  // Update board
  const { error } = await supabase
    .from("boards")
    .update({ is_archived: false, unarchived_until: unarchivedUntil })
    .eq("id", boardId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Mark the archive and the specific day as open
  const { data: archiveRecord } = await supabase
    .from("archives")
    .select("id")
    .eq("team_id", profile.team_id)
    .eq("month_key", monthKey)
    .maybeSingle()

  if (archiveRecord) {
    await Promise.all([
      supabase.from("archives").update({ is_open: true }).eq("id", archiveRecord.id),
      supabase.from("archive_days").update({ is_open: true }).eq("archive_id", archiveRecord.id).eq("date", board.date),
    ])
  }

  await logActivity(supabase, {
    team_id: profile.team_id,
    user_id: user.id,
    action_type: "day_unarchived",
    card_id: null,
    metadata: {
      board_id: boardId,
      date: board.date,
      unarchived_until: unarchivedUntil,
    },
  })

  return NextResponse.json({ success: true, unarchived_until: unarchivedUntil })
}
