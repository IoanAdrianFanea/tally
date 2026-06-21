import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// GET /api/admin/archive-status
// Returns when the team last archived and how many days until the 1st of next month.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users")
    .select("team_id")
    .eq("id", user.id)
    .single()

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 })

  // Get the most recent archive for this team
  const { data: lastArchive } = await supabase
    .from("archives")
    .select("month_key, archived_at")
    .eq("team_id", profile.team_id)
    .order("month_key", { ascending: false })
    .limit(1)
    .maybeSingle()

  // Days until the 1st of next month (when auto-archive fires)
  const today = new Date()
  const firstOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)
  const daysUntilNextArchive = Math.ceil(
    (firstOfNextMonth.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  )

  return NextResponse.json({
    last_archived_at: lastArchive?.archived_at ?? null,
    last_archived_month: lastArchive?.month_key ?? null,
    days_until_next_archive: daysUntilNextArchive,
  })
}
