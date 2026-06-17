import { createClient } from "@/lib/supabase/server"
import { NextResponse, type NextRequest } from "next/server"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

  if (!profile || profile.role !== "admin") {
    return new NextResponse(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    })
  }

  const { id } = await context.params
  const body = await request.json()
  const { name, x, y, width, height, is_done_section } = body

  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name
  if (x !== undefined) updates.x = x
  if (y !== undefined) updates.y = y
  if (width !== undefined) updates.width = width
  if (height !== undefined) updates.height = height
  if (is_done_section !== undefined) updates.is_done_section = is_done_section

  const { data, error } = await supabase
    .from("sections")
    .update(updates)
    .eq("id", id)
    .eq("team_id", profile.team_id)
    .select()
    .single()

  if (error) {
    return new NextResponse(JSON.stringify({ error: error.message }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }

  return new NextResponse(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}
