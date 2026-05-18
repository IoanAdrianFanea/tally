import { createClient } from "@/lib/supabase/server"
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
            points: points[card.owner_id] || 0
        })),
        points_by_user: points,
        users: users || [],
        teams: team ? [team] : []
    }

    const { error: archiveError } = await supabase
    .from('archives')
    .insert({
        team_id: profile.team_id,
        month_key: monthKey,
        snapshot: response
    })

    if (archiveError) {
    return NextResponse.json({ error: archiveError.message }, { status: 500 })
    }

    const { error } = await supabase
    .from('cards')
    .delete()
    .eq('team_id', profile.team_id)
    .eq('month_key', monthKey)
        
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })

}