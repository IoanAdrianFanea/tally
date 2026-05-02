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

  const { data: users} = await supabase    
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
      

  return (
    <BoardLayout users={users ?? []} cards={cards ?? []} profile={profile} />
  )
}