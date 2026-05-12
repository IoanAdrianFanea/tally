import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import BoardLayout from "@/components/board/BoardLayout"

export default async function BoardPage() {
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

  const { data: cards } = await supabase
    .from("cards")
    .select("*")
    .eq("team_id", profile?.team_id)  // ← fixed
    .eq("month_key", monthKey)         // ← add this
    .order("position", { ascending: true })

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
      

  return (
    <BoardLayout
      users={usersWithPoints}
      cards={cards ?? []}
      profile={profile}
      role={profile?.role ?? "member"}
      currentUserId={profile?.id ?? ""}
    />
  )
}