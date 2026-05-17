

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
    .select('team_id, display_name, column_color')
    .eq('id', user.id)
    .single()
  
    if (!profile) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const now = new Date()
    const dayOfWeek = now.getDay() // 0 = Sunday, 1 = Monday...
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const monday = new Date(now)
    monday.setDate(now.getDate() - daysToMonday)
    monday.setHours(0, 0, 0, 0)

    const { data: cards } = await supabase
        .from('cards')
        .select('status, created_at, completed_at, owner_id')
        .eq('team_id', profile.team_id)
        .gte('created_at', monday.toISOString())

    const completedCards = Array.isArray(cards) ? cards.filter(card => card.status === 'green') : []

    // Store total seconds and counts per user to compute average
    const totals: Record<string, { seconds: number; count: number }> = {}

    if (Array.isArray(completedCards)) {
        for (const card of completedCards) {
            const createdAt = new Date(card.created_at)
            const finishedAt = new Date(card.completed_at)
            const completionSeconds = (finishedAt.getTime() - createdAt.getTime()) / 1000

            const id = card.owner_id
            if (!totals[id]) totals[id] = { seconds: 0, count: 0 }
            totals[id].seconds += completionSeconds
            totals[id].count += 1
        }
    }

    // average completion time per user formatted as "Hh Mm"
    const avgCompletionTime: Record<string, string> = {}
    for (const id in totals) {
        const avgSeconds = totals[id].seconds / totals[id].count
        const hours = Math.floor(avgSeconds / 3600)
        const minutes = Math.floor((avgSeconds % 3600) / 60)
        avgCompletionTime[id] = `${hours}h ${minutes}m`
    }

    const { data: users } = await supabase
        .from('users')
        .select('id, display_name, column_color')
        .eq('team_id', profile.team_id)

    // Build stats array per user
    const stats = (users ?? []).map(member => {
        const memberCards = (cards ?? []).filter(c => c.owner_id === member.id)
        const memberCompleted = memberCards.filter(c => c.status === 'green')

        const avgTime = totals[member.id]
            ? `${Math.floor(totals[member.id].seconds / totals[member.id].count / 3600)}h ${Math.floor((totals[member.id].seconds / totals[member.id].count % 3600) / 60)}m`
            : '0h 0m'

        return {
            user_id: member.id,
            display_name: member.display_name,
            column_color: member.column_color,
            total_cards: memberCards.length,
            completed_cards: memberCompleted.length,
            avg_completion_time: avgTime
        }
    })

    return NextResponse.json({
        week_starting: monday.toISOString(),
        stats
    })
}