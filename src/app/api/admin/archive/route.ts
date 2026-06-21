import { createClient } from "@/lib/supabase/server"
import { NextResponse, type NextRequest } from "next/server"
import { runMonthlyArchive } from "@/lib/archive"

export async function POST(_request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users")
    .select("team_id, role")
    .eq("id", user.id)
    .single()

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 })
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const monthKey = new Date().toISOString().slice(0, 7)

  try {
    const result = await runMonthlyArchive(supabase, profile.team_id, user.id, monthKey)
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Archive failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

