import { createClient } from "@/lib/supabase/server"
import { NextResponse, type NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users")
    .select("team_id")
    .eq("id", user.id)
    .single()
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 })

  const dateParam = request.nextUrl.searchParams.get("date")
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : new Date().toISOString().slice(0, 10)

  const { data: board } = await supabase
    .from("boards")
    .select("id")
    .eq("team_id", profile.team_id)
    .eq("date", date)
    .maybeSingle()

  if (!board) return NextResponse.json({ leaderboard: [] })

  const { data: greenCards } = await supabase
    .from("cards")
    .select("owner_id")
    .eq("board_id", board.id)
    .eq("status", "green")

  const points: Record<string, number> = {}
  for (const card of greenCards ?? []) {
    if (card.owner_id) points[card.owner_id] = (points[card.owner_id] ?? 0) + 1
  }

  const { data: users } = await supabase
    .from("users")
    .select("id, display_name, column_color")
    .eq("team_id", profile.team_id)

  const leaderboard = (users ?? [])
    .map((u) => ({
      user_id: u.id,
      display_name: u.display_name,
      column_color: u.column_color,
      points: points[u.id] ?? 0,
    }))
    .sort((a, b) => b.points - a.points)

  return NextResponse.json({ leaderboard })
}
