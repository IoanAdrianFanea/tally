import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import { logActivity } from "@/lib/activity"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=auth_failed", request.url))
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server component — middleware handles session refresh
          }
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(new URL("/login?error=auth_failed", request.url))
  }

  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
  const { data: profile } = await supabase
    .from('users')
    .select('team_id')
    .eq('id', user.id)
    .single()

    if (profile) {
      await logActivity(supabase, {
        team_id: profile.team_id,
        user_id: user.id,
        action_type: 'user_logged_in',
        card_id: null,
        metadata: {}
      })
    }
  }

  return NextResponse.redirect(new URL("/board", request.url))
}
