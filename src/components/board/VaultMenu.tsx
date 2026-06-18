"use client"

import { useEffect, useState } from "react"
import {
  LayoutGrid,
  Settings,
  BarChart3,
  X,
  LogOut,
  ChevronRight,
  AlertTriangle,
  Archive,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"

// ─── Types ───────────────────────────────────────────────────────────────────

type User = {
  id: string
  display_name: string
  column_color: string | null
  points?: number | null
}

type Profile = {
  id: string
  display_name: string | null
  column_color: string | null
  email?: string | null
  team_id?: string | null
}

type LeaderboardEntry = {
  user_id: string
  display_name: string
  column_color: string | null
  points: number
  total_cards: number
}

type Props = {
  role: string
  currentUserId: string
  profile: Profile | null
  users: User[]
}

type NavView = "board" | "settings" | "leaderboard"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string | null | undefined) {
  const t = (name ?? "").trim()
  return t ? t[0]!.toUpperCase() : "?"
}

// ─── Component ───────────────────────────────────────────────────────────────

// Shared Sora font style — applied to all text elements
const soraFont: React.CSSProperties = { fontFamily: "var(--font-sora, 'Sora', sans-serif)" }

export default function VaultMenu({ role, currentUserId, profile }: Props) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [activeView, setActiveView] = useState<NavView>("leaderboard")

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [todayLeaderboard, setTodayLeaderboard] = useState<LeaderboardEntry[]>([])
  const [cardStats, setCardStats] = useState({ total: 0, completed: 0 })
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false)

  // Settings
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)

  useEffect(() => {
    if (!isOpen || activeView !== "leaderboard") return
    const controller = new AbortController()
    setLoadingLeaderboard(true)

    Promise.all([
      fetch("/api/stats/leaderboard", { signal: controller.signal }).then(r => r.json()),
      fetch("/api/stats/today", { signal: controller.signal }).then(r => r.json()),
      fetch("/api/cards", { signal: controller.signal }).then(r => r.json()),
    ])
      .then(([lbData, todayData, cardsData]) => {
        setLeaderboard(lbData.leaderboard ?? [])
        setTodayLeaderboard(todayData.leaderboard ?? [])
        const allCards = cardsData.cards ?? []
        const mine = allCards.filter((c: { owner_id: string }) => c.owner_id === currentUserId)
        setCardStats({
          total: mine.length,
          completed: mine.filter((c: { status: string }) => c.status === "green").length,
        })
      })
      .catch(() => {})
      .finally(() => setLoadingLeaderboard(false))

    return () => controller.abort()
  }, [isOpen, activeView, currentUserId])

  async function handleArchiveOnly() {
    setArchiveLoading(true)
    try {
      const res = await fetch("/api/admin/archive", { method: "POST" })
      if (!res.ok) {
        const d = await res.json().catch(() => null)
        alert("Failed: " + (d?.error ?? "Unknown"))
        return
      }
      setArchiveConfirmOpen(false)
      setIsOpen(false)
      router.refresh()
    } finally {
      setArchiveLoading(false)
    }
  }

  async function handleArchiveAndReset() {
    setResetLoading(true)
    try {
      const a = await fetch("/api/admin/archive", { method: "POST" })
      if (!a.ok) { alert("Archive failed"); return }
      const r = await fetch("/api/admin/reset", { method: "POST" })
      if (!r.ok) { alert("Reset failed"); return }
      setResetConfirmOpen(false)
      setIsOpen(false)
      router.refresh()
    } finally {
      setResetLoading(false)
    }
  }

  // Derived stats
  const myEntry = leaderboard.find(e => e.user_id === currentUserId)
  const myPoints = myEntry?.points ?? 0
  const completionRate =
    cardStats.total > 0
      ? Math.round((cardStats.completed / cardStats.total) * 100)
      : 0

  // ── Confirm modal (portal) ──────────────────────────────────────────────────
  const confirmModal = (
    title: string,
    body: string,
    onConfirm: () => void,
    onCancel: () => void,
    loading: boolean
  ) =>
    createPortal(
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 p-4"
        onClick={(e) => { e.stopPropagation(); onCancel() }}
      >
        <div
          className="w-96 bg-white rounded-2xl p-6 shadow-2xl border border-outline-variant/20"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <p className="font-extrabold text-base text-on-surface mb-2" style={soraFont}>{title}</p>
          <p className="text-sm text-on-surface-variant mb-5">{body}</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={onConfirm} disabled={loading}>
              {loading ? "Working…" : "Confirm"}
            </Button>
          </div>
        </div>
      </div>,
      document.body
    )

  // ── Nav config ─────────────────────────────────────────────────────────────
  const navItems: { id: NavView; label: string; icon: React.ElementType }[] = [
    { id: "board",        label: "Board View",  icon: LayoutGrid },
    { id: "settings",    label: "Settings",    icon: Settings   },
    { id: "leaderboard", label: "Leaderboard", icon: BarChart3  },
  ]

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Floating trigger ── */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open menu"
        className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50
          w-11 h-11 rounded-full
          bg-primary text-primary-foreground
          flex items-center justify-center
          shadow-[0_6px_18px_rgba(70,72,212,0.35)]
          hover:bg-primary/90 active:scale-95
          transition-all duration-200"
      >
        <LayoutGrid className="h-5 w-5" />
      </button>

      {/* ── Backdrop ── */}
      <div
        className={`fixed inset-0 z-[100] transition-opacity duration-300
          ${isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
        style={{ background: "rgba(0,0,0,0.12)" }}
        onClick={() => setIsOpen(false)}
      />

      {/* ── Panel ── */}
      <aside
        className={`fixed right-0 top-0 h-full w-[22rem] z-[110] flex flex-col
          bg-white
          border-l border-outline-variant/30
          shadow-[-8px_0_32px_rgba(0,0,0,0.08)]
          transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >

        {/* ── Header + Nav ── */}
        <div className="relative px-6 pt-6 pb-5 border-b border-outline-variant/20">
          {/* Title — uses Sora if available via CSS variable or Google Fonts import */}
          <h2
            className="font-extrabold text-[1.375rem] leading-tight text-primary"
            style={soraFont}
          >
            Vault Menu
          </h2>
          <p className="text-[0.8125rem] text-on-surface-variant mt-0.5 mb-5"
          style={soraFont}>
            Manage your assets
          </p>

          {/* Nav */}
          <nav className="flex flex-col gap-0.5">
            {navItems.map(({ id, label, icon: Icon }) => {
              const isActive = activeView === id && id !== "board"
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    if (id === "board") { setIsOpen(false); return }
                    setActiveView(id)
                  }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg
                    text-[0.875rem] font-semibold transition-colors text-left
                    ${isActive
                      ? "text-primary border-r-2 border-primary"
                      : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container/50"
                    }`}
                  style={soraFont}
                >
                  <Icon className="h-[1.125rem] w-[1.125rem] shrink-0" strokeWidth={isActive ? 2 : 1.75} />
                  {label}
                </button>
              )
            })}
          </nav>

          {/* Close */}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close menu"
            className="absolute top-5 right-5 p-1.5 rounded-full
              text-on-surface-variant hover:bg-surface-container
              transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ────────────────────────── LEADERBOARD VIEW */}
          {activeView === "leaderboard" && (
            <div className="space-y-7">

              {/* Your Stats */}
              <section>
                <p className="text-[0.6875rem] font-bold text-on-surface-variant/70 uppercase tracking-[0.08em] mb-3" style={soraFont}>
                  Your Stats
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {/* Points */}
                  <div className="bg-surface-container-low rounded-xl p-4 flex flex-col items-center justify-center">
                    <span
                      className="text-[2rem] font-extrabold leading-none text-primary"
                      style={soraFont}
                    >
                      {myPoints}
                    </span>
                    <span className="text-[0.75rem] font-medium text-on-surface-variant mt-1.5" style={soraFont}>Points</span>
                  </div>
                  {/* Cards */}
                  <div className="bg-surface-container-low rounded-xl p-4 flex flex-col items-center justify-center">
                    <span
                      className="text-[2rem] font-extrabold leading-none text-primary"
                      style={soraFont}
                    >
                      {cardStats.total}
                    </span>
                    <span className="text-[0.75rem] font-medium text-on-surface-variant mt-1.5" style={soraFont}>Cards</span>
                  </div>
                  {/* Completion */}
                  <div className="col-span-2 bg-surface-container-low rounded-xl p-4 flex flex-col items-center">
                    <span
                      className="text-[2.25rem] font-extrabold leading-none text-primary"
                      style={soraFont}
                    >
                      {completionRate}%
                    </span>
                    <span className="text-[0.75rem] font-medium text-on-surface-variant mt-1.5 mb-3" style={soraFont}>Done</span>
                    <div className="w-full bg-surface-container-high rounded-full h-1.5">
                      <div
                        className="bg-primary h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${completionRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Team Leaderboard */}
              <section>
                <p className="text-[0.6875rem] font-bold text-on-surface-variant/70 uppercase tracking-[0.08em] mb-3" style={soraFont}>
                  Team Leaderboard
                </p>
                {loadingLeaderboard ? (
                  <p className="text-sm text-on-surface-variant">Loading…</p>
                ) : leaderboard.length === 0 ? (
                  <p className="text-sm text-on-surface-variant">No stats yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {leaderboard.map((entry, i) => (
                      <li
                        key={entry.user_id}
                        className="flex items-center justify-between px-3 py-2.5 rounded-xl
                          transition-colors hover:bg-surface-container-low/60"
                      >
                        <div className="flex items-center gap-3">
                          {/* Rank badge */}
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center
                              text-sm font-extrabold shrink-0
                              ${i === 0
                                ? "bg-primary text-white"
                                : "bg-surface-container-high text-on-surface-variant"
                              }`}
                            style={soraFont}
                          >
                            {i + 1}
                          </div>
                          <span className="text-[0.875rem] font-semibold text-on-surface" style={soraFont}>
                            {entry.display_name}
                          </span>
                        </div>
                        <span
                          className={`text-[0.875rem] font-bold shrink-0
                            ${i === 0 ? "text-primary" : "text-on-surface-variant"}`}
                          style={soraFont}
                        >
                          {entry.points} pts
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Today's Points */}
              <section>
                <p className="text-[0.6875rem] font-bold text-on-surface-variant/70 uppercase tracking-[0.08em] mb-3" style={soraFont}>
                  Today&apos;s Points
                </p>
                {loadingLeaderboard ? (
                  <p className="text-sm text-on-surface-variant">Loading…</p>
                ) : todayLeaderboard.filter(e => e.points > 0).length === 0 ? (
                  <p className="text-sm text-on-surface-variant" style={soraFont}>No completions today yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {todayLeaderboard.filter(e => e.points > 0).map((entry, i) => (
                      <li
                        key={entry.user_id}
                        className="flex items-center justify-between px-3 py-2 rounded-xl
                          transition-colors hover:bg-surface-container-low/60"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: entry.column_color ?? "#6366f1" }}
                          />
                          <span className="text-[0.875rem] font-semibold text-on-surface" style={soraFont}>
                            {entry.display_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`text-[0.875rem] font-bold ${
                              i === 0 ? "text-primary" : "text-on-surface-variant"
                            }`}
                            style={soraFont}
                          >
                            {entry.points}
                          </span>
                          <span className="text-[0.75rem] text-on-surface-variant/60" style={soraFont}>pts</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

            </div>
          )}

          {/* ────────────────────────── SETTINGS VIEW */}
          {activeView === "settings" && (
            <div>
              <p className="text-[0.6875rem] font-bold text-on-surface-variant/70 uppercase tracking-[0.08em] mb-3" style={soraFont}>
                Month Management
              </p>
              {role !== "admin" ? (
                <p className="text-sm text-on-surface-variant" style={soraFont}>
                  You don&apos;t have permission to manage settings.
                </p>
              ) : (
                <div className="space-y-2">
                  {/* Archive only */}
                  <button
                    type="button"
                    onClick={() => setArchiveConfirmOpen(true)}
                    className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl
                      border border-outline-variant/30 bg-surface-container-low/40
                      hover:bg-surface-container-low transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Archive className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm font-semibold text-on-surface" style={soraFont}>Archive month</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-on-surface-variant/60 group-hover:text-on-surface transition-colors" />
                  </button>

                  {/* Archive + Reset */}
                  <button
                    type="button"
                    onClick={() => setResetConfirmOpen(true)}
                    className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl
                      border border-red-100 bg-red-50/30
                      hover:bg-red-50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                        <Archive className="h-4 w-4 text-red-500" />
                      </div>
                      <span className="text-sm font-semibold text-red-600" style={soraFont}>Archive &amp; Reset</span>
                    </div>
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer — user info ── */}
        <div className="px-6 py-4 border-t border-outline-variant/20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center
                  text-white text-sm font-bold shrink-0"
                style={{ backgroundColor: profile?.column_color ?? "#4648d4" }}
              >
                {getInitials(profile?.display_name)}
              </div>
              <div className="min-w-0">
                <p className="text-[0.875rem] font-semibold text-on-surface leading-tight truncate" style={soraFont}>
                  {profile?.display_name ?? "User"}
                </p>
                <p className="text-[0.75rem] text-on-surface-variant truncate" style={soraFont}>
                  {(profile as { email?: string } | null)?.email ?? ""}
                </p>
              </div>
            </div>
            {/* Logout — hover reveals a small popup above the icon */}
            <div className="relative group/logout shrink-0">
              {/* Hover popup */}
              <div
                className="absolute bottom-full right-0 mb-2
                  opacity-0 invisible
                  group-hover/logout:opacity-100 group-hover/logout:visible
                  transition-all duration-150 z-20"
              >
                <div className="bg-white rounded-xl shadow-lg border border-outline-variant/15 py-1 overflow-hidden min-w-[120px]">
                  <button
                    type="button"
                    onClick={() => window.location.assign("/auth/signout")}
                    className="w-full flex items-center gap-2 px-3 py-2
                      text-sm font-medium text-red-500
                      hover:bg-red-50 transition-colors"
                    style={soraFont}
                  >
                    <LogOut className="h-3.5 w-3.5 shrink-0" />
                    Log out
                  </button>
                </div>
              </div>
              {/* Icon trigger */}
              <button
                type="button"
                aria-label="Log out"
                className="w-8 h-8 flex items-center justify-center rounded-full
                  text-on-surface-variant
                  hover:text-on-surface hover:bg-surface-container
                  transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Confirm modals ── */}
      {archiveConfirmOpen && confirmModal(
        "Archive this month?",
        "Saves a snapshot of the current board. Cards will not be deleted. You can archive again to update the snapshot.",
        handleArchiveOnly,
        () => setArchiveConfirmOpen(false),
        archiveLoading
      )}
      {resetConfirmOpen && confirmModal(
        "Archive & Reset?",
        "Saves a snapshot then permanently deletes all cards. The board will be empty after this. Cannot be undone.",
        handleArchiveAndReset,
        () => setResetConfirmOpen(false),
        resetLoading
      )}
    </>
  )
}