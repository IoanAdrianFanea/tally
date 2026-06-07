// post and get card apis
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"
import { logActivity } from "@/lib/activity"

export async function GET(request: NextRequest) {
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

  const boardId = request.nextUrl.searchParams.get("board_id")

  if (!boardId) {
    return new NextResponse(JSON.stringify({ cards: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }

  const q = request.nextUrl.searchParams.get("q")

  let query = supabase
    .from("cards")
    .select("*")
    .eq("board_id", boardId)
    .eq("team_id", profile.team_id)

  if (q) {
    query = query.textSearch("search_vector", q + ":*", { type: "plain" })
  }

  const { data, error } = await query.order("created_at", { ascending: true })

  if (error) {
    return new NextResponse(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  return new NextResponse(JSON.stringify({ cards: data ?? [] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

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

  const { content, board_id, owner_id, section_id, x, y } = await request.json()

  if (!content) {
    return new NextResponse(JSON.stringify({ error: "Content is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  if (!board_id) {
    return new NextResponse(JSON.stringify({ error: "board_id is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const cardOwnerId =
    profile.role === "admin" && owner_id ? owner_id : user.id

  const { data, error } = await supabase
    .from("cards")
    .insert({
      board_id,
      team_id: profile.team_id,
      owner_id: cardOwnerId,
      content: content.trim(),
      section_id: section_id ?? null,
      x: x ?? 0,
      y: y ?? 0,
      position: 0,
      status: "open",
    })
    .select()
    .single()

  if (error) {
    return new NextResponse(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  await logActivity(supabase, {
    team_id: profile.team_id,
    user_id: user.id,
    action_type: "card_created",
    card_id: data.id,
    metadata: { content: data.content, owner_id: data.owner_id },
  })

  return new NextResponse(JSON.stringify(data), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  })
}
