"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError("Please enter an email address.")
      return
    }

    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      const supabase = createClient()
      const redirectTo = new URL(
        "/auth/callback",
        window.location.origin
      ).toString()
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: false,
        },
      })

      if (error) {
        const message = error.message.toLowerCase()
        if (message.includes("user not found") || message.includes("not found")) {
          setError(
            "This email needs to be added by an admin before you can log in."
          )
        } else {
          setError(error.message)
        }
        return
      }

      setEmail(trimmedEmail)
      setMessage("Check your email for a magic link to sign in.")
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught)
      if (message.toLowerCase().includes("failed to fetch")) {
        setError(
          "Could not reach Supabase. Check NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY and your network."
        )
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-background text-on-surface font-body-md antialiased min-h-screen relative overflow-hidden flex items-center">
      <div
        className="absolute top-[-10%] left-[-10%] h-[60vw] w-[60vw] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(70,72,212,0.15) 0%, rgba(248,249,255,0) 70%)",
        }}
      />
      <div
        className="absolute bottom-[-20%] right-[-10%] h-[70vw] w-[70vw] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(192,193,255,0.2) 0%, rgba(248,249,255,0) 70%)",
        }}
      />

      <main className="w-full md:px-[60px] lg:px-[120px] relative z-10 flex flex-col items-center justify-center p-lg">
        <div className="flex flex-col items-center justify-center w-full">
          <div className="w-full max-w-[500px] text-center mb-xl">
            <div className="mb-md">
              <span className="text-xs font-label-sm tracking-[0.2em] uppercase text-on-surface-variant">
                Standup Board
              </span>
            </div>
            <h1 className="text-[40px] leading-[48px] font-h1 font-semibold text-primary mb-md">
              Welcome back
            </h1>
            <p className="text-base font-body-lg text-on-surface-variant mb-xl mx-auto max-w-[380px]">
              Sign in to continue the daily rhythm and keep the board moving. No
              passwords required.
            </p>
            <div className="flex flex-wrap gap-sm justify-center">
              <span className="px-md py-sm rounded-full border border-outline-variant text-xs font-label-sm text-on-surface-variant bg-surface-container-lowest/50 backdrop-blur-sm shadow-sm">
                Daily momentum
              </span>
              <span className="px-md py-sm rounded-full border border-outline-variant text-xs font-label-sm text-on-surface-variant bg-surface-container-lowest/50 backdrop-blur-sm shadow-sm">
                Team visibility
              </span>
              <span className="px-md py-sm rounded-full border border-outline-variant text-xs font-label-sm text-on-surface-variant bg-surface-container-lowest/50 backdrop-blur-sm shadow-sm">
                Accountability
              </span>
            </div>
          </div>

          <div className="w-full max-w-[440px]">
            <div className="bg-surface-container-lowest rounded-xl border border-surface-variant shadow-[0_8px_32px_rgba(0,0,0,0.04)] p-[40px] relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary w-full" />
              <form onSubmit={onSubmit} className="space-y-lg">
                <div>
                  <Label
                    htmlFor="email"
                    className="block text-xs font-label-sm text-on-surface mb-sm"
                  >
                    Email
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="h-auto w-full bg-surface-bright border-outline-variant rounded-lg px-md py-[12px] text-sm font-body-md text-on-surface placeholder:text-outline focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                {error ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </div>
                ) : null}

                {message ? (
                  <div className="rounded-lg border border-surface-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface-variant">
                    {message}
                  </div>
                ) : null}

                <button
                  type="submit"
                  className="w-full bg-primary hover:bg-on-primary-fixed-variant text-on-primary font-label-sm text-xs py-[14px] px-md rounded-lg shadow-sm transition-all duration-200 flex items-center justify-center gap-sm disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Send magic link"}
                </button>
              </form>
            </div>

            <div className="mt-lg flex flex-col sm:flex-row items-center justify-between gap-md px-sm">
              <p className="text-xs font-label-sm text-on-surface-variant">
                Need access?{" "}
                <span className="text-primary">Ask your admin to add you.</span>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
