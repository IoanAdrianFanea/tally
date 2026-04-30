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

  const displayName = profile?.display_name ?? "there"
  const role = profile?.role ?? "unknown"

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">Hello {displayName}, you&apos;re logged in</h1>
      <div className="mt-4 space-y-1 text-sm">
        <p>
          <span className="font-medium">Email:</span> {user.email}
        </p>
        <p>
          <span className="font-medium">Role:</span> {role}
        </p>
      </div>
    </div>
  )
}
