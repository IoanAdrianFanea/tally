// post and get card apis
import { createClient } from "@/lib/supabase/server"
import { NextResponse, type NextRequest } from "next/server"

export async function GET(request: NextRequest) { 
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

    const { data: cards, error } = await supabase
        .from('cards')              // ← from the cards table
        .select('*')                // ← get all columns
        .eq('team_id', profile.team_id)  // ← WHERE team_id = profile.team_id
        .eq('month_key', monthKey)       // ← AND month_key = '2026-05'
        .order('position', { ascending: true })  // ← ORDER BY position ASC
    
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ cards }, { status: 200 })
    
}

export async function POST(request: NextRequest) { 
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
  
  const body = await request.json()
  const { content } = body
  
  if (!content) {
    return NextResponse.json({ error: 'Content is required' }, { status: 400 })
  }
  
  const monthKey = new Date().toISOString().slice(0, 7)
  
  const { data: card, error } = await supabase
    .from('cards')
    .insert({
      content,
      owner_id: user.id,
      team_id: profile.team_id,
      month_key: monthKey,
      status: 'open',
      position: 0
    })
    .select()
    .single()
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json({ card }, { status: 201 })
}
