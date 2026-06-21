import { createClient } from "@/lib/supabase/server"
import { runMonthlyArchive } from "@/lib/archive"
import { NextResponse, type NextRequest } from "next/server"

// Called by Vercel Cron on the 1st of each month at 00:05 UTC.
// Also accepts a manual POST from admins with the X-Cron-Secret header.
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret")
  const expectedSecret = process.env.CRON_SECRET

  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await createClient()

  // Get all teams that have boards in the previous month
  const today = new Date()
  const prevMonthKey = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    .toISOString().slice(0, 7)
  const firstDay = `${prevMonthKey}-01`
  const [prevYear, prevMonth] = prevMonthKey.split("-").map(Number)
  const lastDay = new Date(prevYear, prevMonth, 0).toISOString().slice(0, 10)

  // Find teams with boards in the previous month that haven't been archived yet
  const { data: unarchivedBoards } = await supabase
    .from("boards")
    .select("team_id")
    .gte("date", firstDay)
    .lte("date", lastDay)

  if (!unarchivedBoards || unarchivedBoards.length === 0) {
    return NextResponse.json({ message: "No boards to archive", month_key: prevMonthKey })
  }

  const teamIds = [...new Set(unarchivedBoards.map((b) => b.team_id).filter(Boolean))]

  // Check which teams already have an archive for this month
  const { data: existingArchives } = await supabase
    .from("archives")
    .select("team_id")
    .in("team_id", teamIds)
    .eq("month_key", prevMonthKey)

  const alreadyArchivedTeams = new Set((existingArchives ?? []).map((a) => a.team_id))
  const teamsToArchive = teamIds.filter((id) => !alreadyArchivedTeams.has(id))

  if (teamsToArchive.length === 0) {
    return NextResponse.json({ message: "All teams already archived", month_key: prevMonthKey })
  }

  // Get a system user id for logging (first admin per team, or use the board owner)
  const results: Array<{ team_id: string; status: string; error?: string }> = []

  for (const teamId of teamsToArchive) {
    const { data: adminUser } = await supabase
      .from("users")
      .select("id")
      .eq("team_id", teamId)
      .eq("role", "admin")
      .limit(1)
      .maybeSingle()

    const userId = adminUser?.id
    if (!userId) {
      results.push({ team_id: teamId, status: "skipped", error: "No admin user found" })
      continue
    }

    try {
      await runMonthlyArchive(supabase, teamId, userId, prevMonthKey)
      results.push({ team_id: teamId, status: "archived" })
    } catch (err) {
      results.push({
        team_id: teamId,
        status: "failed",
        error: err instanceof Error ? err.message : "Unknown error",
      })
    }
  }

  return NextResponse.json({ month_key: prevMonthKey, results })
}
