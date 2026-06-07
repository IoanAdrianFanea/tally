import { createClient } from "@/lib/supabase/server"
import { NextResponse, type NextRequest } from "next/server"

export async function GET(
  _request: NextRequest,
  context: { params: { date: string } }
) {
  const { date } = context.params
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

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("team_id")
    .eq("id", user.id)
    .single()

  if (profileError || !profile) {
    return new NextResponse(JSON.stringify({ error: "Profile not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("*")
    .eq("team_id", profile.team_id)
    .eq("date", date)
    .single()

  if (boardError || !board) {
    return new NextResponse(
      JSON.stringify({ board: null, sections: [], cards: [] }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    )
  }

  const { data: sections, error: sectionsError } = await supabase
    .from("sections")
    .select("*")
    .eq("board_id", board.id)
    .order("position", { ascending: true })

  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select("*")
    .eq("board_id", board.id)
    .order("created_at", { ascending: true })

  if (sectionsError || cardsError) {
    return new NextResponse(
      JSON.stringify({ error: "Error fetching board data" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    )
  }

  return new NextResponse(JSON.stringify({ board, sections, cards }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}
