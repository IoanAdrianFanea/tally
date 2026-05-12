

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
    .from('users')
    .select('team_id')
    .eq('id', user.id)
    .single()
  
    if (!profile) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const monthKey = new Date().toISOString().slice(0, 7)

    const { data: greenCards } = await supabase
        .from('cards')
        .select('owner_id')
        .eq('team_id', profile.team_id)
        .eq('status', 'green')
        .eq('month_key', monthKey)
        
    const points: Record<string, number> = {}

    for (const card of greenCards || []) {
        points[card.owner_id] = (points[card.owner_id] || 0) + 1
    }

    const { data: users } = await supabase
        .from('users')
        .select('id, display_name, column_color')
        .eq('team_id', profile.team_id)

    const leaderboard = (users || [])
    .map(user => ({
        user_id: user.id,
        display_name: user.display_name,
        column_color: user.column_color,
        points: points[user.id] || 0
    }))
    .sort((a, b) => b.points - a.points)

    return NextResponse.json({ leaderboard })

}