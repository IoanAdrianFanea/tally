// changing and removing cards


import { createClient } from "@/lib/supabase/server"
import { NextResponse, type NextRequest } from "next/server"

export async function PATCH(
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
    .select('team_id')
    .eq('id', user.id)
    .single()
  
    if (!profile) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const body = (await request.json().catch(() => ({}))) as {
        content?: unknown
        position?: unknown
        owner_id?: unknown
    }

    const update: Record<string, unknown> = {}
    if (typeof body.content === 'string') update.content = body.content
    if (typeof body.position === 'number' && Number.isFinite(body.position)) {
        update.position = body.position
    }
    if (typeof body.owner_id === 'string' && body.owner_id) {
        update.owner_id = body.owner_id
    }

    if (Object.keys(update).length === 0) {
        return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { error } = await supabase
        .from('cards')
        .update(update)
        .eq('id', id)
        .eq('team_id', profile.team_id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Card updated successfully' }, { status: 200 })

}

export async function DELETE(
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
    .select('team_id')
    .eq('id', user.id)
    .single()
  
    if (!profile) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }
    
    const { error } = await supabase
        .from('cards')
        .delete()
        .eq('id', id)
        .eq('team_id', profile.team_id)
        
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Card deleted successfully' }, { status: 200 })
}