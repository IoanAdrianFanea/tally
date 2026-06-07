

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  const { data: profile } = await supabase
    .from("users")
    .select("team_id")
    .eq("id", user.id)
    .single()

  if (!profile) {
    return new NextResponse(JSON.stringify({ error: "Profile not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10)

  const { data: boards } = await supabase
    .from("boards")
    .select("id")
    .eq("team_id", profile.team_id)
    .gte("date", monthStart)

  const boardIds = boards?.map(b => b.id) || []

  if (boardIds.length === 0) {
    return new NextResponse(JSON.stringify({ leaderboard: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }

  const { data: greenCards } = await supabase
    .from("cards")
    .select("owner_id")
    .eq("team_id", profile.team_id)
    .eq("status", "green")
    .in("board_id", boardIds)

  const points: Record<string, number> = {}

  for (const card of greenCards || []) {
    if (card.owner_id) {
      points[card.owner_id] = (points[card.owner_id] || 0) + 1
    }
  }

  const { data: users } = await supabase
    .from("users")
    .select("id, display_name, column_color")
    .eq("team_id", profile.team_id)

  const { data: allCards } = await supabase
    .from("cards")
    .select("owner_id")
    .eq("team_id", profile.team_id)
    .in("board_id", boardIds)

  const totalCards: Record<string, number> = {}
  for (const card of allCards || []) {
    if (card.owner_id) {
      totalCards[card.owner_id] = (totalCards[card.owner_id] || 0) + 1
    }
  }

  const leaderboard = (users || [])
    .map(user => ({
      user_id: user.id,
      display_name: user.display_name,
      column_color: user.column_color,
      points: points[user.id] || 0,
      total_cards: totalCards[user.id] || 0,
    }))
    .sort((a, b) => b.points - a.points)

  return new NextResponse(JSON.stringify({ leaderboard }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}