import { createClient } from "@/lib/supabase/server"
import { NextResponse, type NextRequest } from "next/server"

export async function POST(request: NextRequest) {
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
    .select("team_id, role")
    .eq("id", user.id)
    .single()

  if (!profile) {
    return new NextResponse(JSON.stringify({ error: "Profile not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }

  if (profile.role !== "admin") {
    return new NextResponse(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    })
  }

  const body = await request.json()
  const { board_id, name, x, y, width, height } = body

  if (!board_id) {
    return new NextResponse(JSON.stringify({ error: "board_id is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Verify the board belongs to this team
  const { data: board } = await supabase
    .from("boards")
    .select("id")
    .eq("id", board_id)
    .eq("team_id", profile.team_id)
    .single()

  if (!board) {
    return new NextResponse(JSON.stringify({ error: "Board not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }

  const { data: section, error } = await supabase
    .from("sections")
    .insert({
      board_id,
      team_id: profile.team_id,
      name: name ?? "Container",
      x: x ?? 0,
      y: y ?? 0,
      width: width ?? 400,
      height: height ?? 300,
      is_done_section: false,
      position: 0,
    })
    .select()
    .single()

  if (error) {
    return new NextResponse(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  return new NextResponse(JSON.stringify(section), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  })
}
