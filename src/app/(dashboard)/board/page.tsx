import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import BoardLayout from "@/components/board/BoardLayout"

type BoardPageProps = {
  searchParams: Promise<{ q?: string; date?: string }>
}

export default async function BoardPage({ searchParams }: BoardPageProps) {
  const { q, date } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single()

  const { data: users } = await supabase
    .from("users")
    .select("*")
    .eq("team_id", profile?.team_id)

  const monthKey = new Date().toISOString().slice(0, 7)

  let cardsQuery = supabase
    .from("cards")
    .select("*")
    .eq("team_id", profile?.team_id)
    .eq("month_key", monthKey)

  if (q) {
    const prefixQuery = q
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((term) => term.replace(/[':]/g, ""))
      .filter(Boolean)
      .map((term) => `${term}:*`)
      .join(" & ")

    if (prefixQuery) {
      cardsQuery = cardsQuery.filter("search_vector", "fts", prefixQuery)
    }
  }

  if (date === "today") {
    const now = new Date()
    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)

    const endOfToday = new Date(now)
    endOfToday.setHours(23, 59, 59, 999)

    cardsQuery = cardsQuery
      .gte("created_at", startOfToday.toISOString())
      .lte("created_at", endOfToday.toISOString())
  } else if (date === "week") {
    const now = new Date()
    const startOfMonday = new Date(now)
    const day = startOfMonday.getDay()
    const diffToMonday = (day + 6) % 7
    startOfMonday.setDate(startOfMonday.getDate() - diffToMonday)
    startOfMonday.setHours(0, 0, 0, 0)

    cardsQuery = cardsQuery.gte("created_at", startOfMonday.toISOString())
  } else if (date === "month") {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    startOfMonth.setHours(0, 0, 0, 0)

    cardsQuery = cardsQuery.gte("created_at", startOfMonth.toISOString())
  }

  const { data: cards } = await cardsQuery.order("position", {
    ascending: true,
  })
    
  const pointsByOwner: Record<string, number> = {}
  for (const card of cards ?? []) {
    if (card.status === "green") {
      pointsByOwner[card.owner_id] = (pointsByOwner[card.owner_id] || 0) + 1
    }
  }

  const usersWithPoints = (users ?? []).map((user) => ({
    ...user,
    points: pointsByOwner[user.id] || 0,
  }))
      

  const hasSearch = Boolean(q || date)

  return (
    <BoardLayout
      users={usersWithPoints}
      cards={cards ?? []}
      profile={profile}
      role={profile?.role ?? "member"}
      currentUserId={profile?.id ?? ""}
      hasSearch={hasSearch}
    />
  )
}