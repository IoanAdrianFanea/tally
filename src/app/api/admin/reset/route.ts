import { logActivity } from "@/lib/activity"
import { createClient } from "@/lib/supabase/server"
import { NextResponse, type NextRequest } from "next/server"

export async function POST(_request: NextRequest) {
	const supabase = await createClient()

	const {
		data: { user },
	} = await supabase.auth.getUser()

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
	}

	const { data: profile } = await supabase
		.from("users")
		.select("team_id, role")
		.eq("id", user.id)
		.single()

	if (!profile) {
		return NextResponse.json({ error: "Profile not found" }, { status: 404 })
	}

	if (profile.role !== "admin") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 })
	}

	const monthKey = new Date().toISOString().slice(0, 7)

	const { error: deleteError } = await supabase
		.from("cards")
		.delete()
		.eq("team_id", profile.team_id)
		.eq("month_key", monthKey)

	if (deleteError) {
		return NextResponse.json({ error: deleteError.message }, { status: 500 })
	}

	await logActivity(supabase, {
		team_id: profile.team_id,
		user_id: user.id,
		action_type: "board_reset",
		card_id: null,
		metadata: { month_key: monthKey },
	})

	return NextResponse.json({ success: true }, { status: 200 })
}
