import { createClient } from "@/lib/supabase/server"
import { logActivity } from "@/lib/activity"
import { NextResponse, type NextRequest } from "next/server"

export async function POST(
    _request: NextRequest
) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { data: profile } = await supabase
    .from('users')
    .select('team_id, role')
    .eq('id', user.id)
    .single()
  
    if (!profile) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (profile.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }


    const monthKey = new Date().toISOString().slice(0, 7) // e.g. "2024-06"

    const { data: cards} = await supabase
        .from('cards')
        .select('*')
        .eq('team_id', profile.team_id)
        .eq('month_key', monthKey)


    const { data: users } = await supabase
        .from('users')
        .select('id, display_name, column_color, role')
        .in('id', (cards ?? []).map(card => card.owner_id))
        
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

    const {data: team} = await supabase
        .from('teams')
        .select('id, name')
        .eq('id', profile.team_id)
        .single()

    const response = {
        month: monthKey,
        archived_at: new Date().toISOString(),
        archived_cards: (cards ?? []).map(card => ({
            id: card.id,
            content: card.content,
            owner_name: users?.find(user => user.id === card.owner_id)?.display_name || 'Unknown',
            points: card.status === 'green' ? 1 : 0
        })),
        points_by_user: points,
        users: users || [],
        teams: team ? [team] : []
    }

    const { error: archiveError } = await supabase
    .from('archives')
    .upsert({
        team_id: profile.team_id,
        month_key: monthKey,
        snapshot: response,
        is_manual: true
    }, {
        onConflict: 'team_id,month_key'
    })

    if (archiveError) {
    return NextResponse.json({ error: archiveError.message }, { status: 500 })
    }

    await logActivity(supabase, {
            team_id: profile.team_id,
            user_id: user.id,
            action_type: "board_archived",
            card_id: null,
            metadata: { month_key: monthKey, is_manual: true },
        })

    return NextResponse.json({ success: true }, { status: 200 })

}