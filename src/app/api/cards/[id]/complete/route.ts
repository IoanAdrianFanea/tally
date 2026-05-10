import { createClient } from "@/lib/supabase/server"
import { NextResponse, type NextRequest } from "next/server"
import { logActivity } from "@/lib/activity"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
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

    const { data, error } = await supabase
        .from('cards')
        .update({ 
            status: 'green',
            completed_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()
        
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logActivity(supabase, {
        team_id: profile.team_id,
        user_id: user.id,
        action_type: 'card_completed',
        card_id: id,
        metadata: {
            content: data.content,
            owner_id: data.owner_id
        }
    })

    return NextResponse.json({ message: 'Card updated successfully' }, { status: 200 })

}
