// changing and removing cards

import { logActivity } from "@/lib/activity"
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

  if (!profile) {
    return new NextResponse(JSON.stringify({ error: "Profile not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }

  const { id } = await context.params
  const {
    content,
    x,
    y,
    position,
    section_id,
    owner_id,
    status,
    completed_at,
  } = await request.json()

  const updates: Record<string, unknown> = {}
  if (content !== undefined) updates.content = content.trim()
  if (x !== undefined) updates.x = x
  if (y !== undefined) updates.y = y
  if (position !== undefined) updates.position = position
  if (section_id !== undefined) updates.section_id = section_id
  if (owner_id !== undefined && profile.role === "admin")
    updates.owner_id = owner_id
  if (status !== undefined) updates.status = status
  if (completed_at !== undefined) updates.completed_at = completed_at

  const { data, error } = await supabase
    .from("cards")
    .update(updates)
    .eq("id", id)
    .eq("team_id", profile.team_id)
    .select()
    .single()

  if (error) {
    return new NextResponse(JSON.stringify({ error: "Card not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }

  await logActivity(supabase, {
    team_id: profile.team_id,
    user_id: user.id,
    action_type: "card_updated",
    card_id: id,
    metadata: updates,
  })

  return new NextResponse(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

export async function DELETE(
  _request: NextRequest,
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
    .select("team_id")
    .eq("id", user.id)
    .single()

  if (!profile) {
    return new NextResponse(JSON.stringify({ error: "Profile not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }

  const { id } = await context.params

  const { error } = await supabase
    .from("cards")
    .delete()
    .eq("id", id)
    .eq("team_id", profile.team_id)

  if (error) {
    return new NextResponse(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  await logActivity(supabase, {
    team_id: profile.team_id,
    user_id: user.id,
    action_type: "card_deleted",
    card_id: id,
  })

  return new NextResponse(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}