import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

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
    <div className="p-6">
      <h1>Standup Board</h1>
      
      <div className="flex flex-row gap-4 mt-6">
        {users?.map((member) => {
          const userCards = cards?.filter((card) => card.owner_id === member.id) ?? []
          
          return (
            <div key={member.id} className="flex flex-col gap-2 w-64">
              <h2>{member.display_name}</h2>
              
              {userCards.length === 0 ? (
                <p>No cards yet</p>
              ) : (
                userCards.map((card) => (
                  <div key={card.id}>
                    {card.content}
                  </div>
                ))
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}