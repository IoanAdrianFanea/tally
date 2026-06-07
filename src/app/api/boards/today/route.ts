import { createClient } from "@/lib/supabase/server"
import { NextResponse, type NextRequest } from "next/server"

export async function POST(_request: NextRequest) {
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

  const { data, error: rpcError } = await supabase.rpc(
    "get_or_create_today_board",
    {
      p_team_id: profile.team_id,
    }
  )

  if (rpcError) {
    console.error("RPC Error:", rpcError)
    return new NextResponse(
      JSON.stringify({ error: "Internal Server Error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    )
  }

  return new NextResponse(JSON.stringify({ board_id: data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}
