"use client"

import { useEffect, useMemo, useState } from "react"
import { BarChart3, X } from "lucide-react"

type LeaderboardEntry = {
  user_id: string
  display_name: string
  column_color: string | null
  points: number
}

type LeaderboardResponse = {
  leaderboard: LeaderboardEntry[]
}

type Card = {
  owner_id: string
  status: string | null
}

type CardResponse = {
  cards: Card[]
}

type WeeklyStatsEntry = {
  user_id: string
  display_name: string
  column_color: string | null
  total_cards: number
  completed_cards: number
  avg_completion_time: string
}

type WeeklyStatsResponse = {
  stats: WeeklyStatsEntry[]
}

type Props = {
  currentUserId: string
}

const PODIUM = [
  { label: "Gold", color: "#d4af37" },
  { label: "Silver", color: "#c0c0c0" },
  { label: "Bronze", color: "#cd7f32" },
]

function getInitials(name: string | null | undefined) {
  const trimmed = (name ?? "").trim()
  return trimmed ? trimmed[0]!.toUpperCase() : "?"
}

export default function LeaderboardPanel({ currentUserId }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [cardStats, setCardStats] = useState({ total: 0, completed: 0 })
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStatsEntry[]>([])

  useEffect(() => {
    if (!isOpen) return

    const controller = new AbortController()

    const loadData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Leaderboard
        const leaderboardRes = await fetch("/api/stats/leaderboard", {
          signal: controller.signal,
        })
        if (!leaderboardRes.ok) throw new Error("Failed to load leaderboard")
        const leaderboardData = (await leaderboardRes.json()) as LeaderboardResponse
        setLeaderboard(Array.isArray(leaderboardData.leaderboard) ? leaderboardData.leaderboard : [])

        // Cards for current user stats
        const cardsRes = await fetch("/api/cards", { signal: controller.signal })
        if (cardsRes.ok) {
          const cardsData = (await cardsRes.json()) as CardResponse
          const cards = Array.isArray(cardsData.cards) ? cardsData.cards : []
          const userCards = cards.filter(c => c.owner_id === currentUserId)
          const completed = userCards.filter(c => c.status === "green").length
          setCardStats({ total: userCards.length, completed })
        }

        // Weekly stats
        const weekRes = await fetch("/api/stats/week", { signal: controller.signal })
        if (!weekRes.ok) throw new Error("Failed to load weekly stats")
        const weekData = (await weekRes.json()) as WeeklyStatsResponse
        setWeeklyStats(Array.isArray(weekData.stats) ? weekData.stats : [])

      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
        setError(err instanceof Error ? err.message : "Failed to load data")
      } finally {
        setIsLoading(false)
      }
    }

    void loadData()

    return () => controller.abort()
  }, [isOpen, currentUserId])

  const currentUserIndex = useMemo(() => {
    if (!currentUserId) return -1
    return leaderboard.findIndex(e => e.user_id === currentUserId)
  }, [currentUserId, leaderboard])

  const currentUserEntry = currentUserIndex >= 0 ? leaderboard[currentUserIndex] : null
  const currentUserRank = currentUserIndex >= 0 ? currentUserIndex + 1 : null
  const points = currentUserEntry?.points ?? 0
  const completionRate = cardStats.total > 0
    ? Math.round((cardStats.completed / cardStats.total) * 100)
    : 0

  return (
    <>
      <button
        type="button"
        className="flex items-center gap-md px-3 py-[8px] rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all active:translate-x-1 duration-150"
        onClick={() => setIsOpen(true)}
        aria-expanded={isOpen}
        aria-controls="leaderboard-panel"
      >
        <BarChart3 className="h-[20px] w-[20px]" />
        <span className="font-body-md">Leaderboard</span>
      </button>

      <div className={`fixed top-16 left-0 right-0 h-[calc(100vh-64px)] z-50 ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`}>
        <button
          type="button"
          className={`absolute inset-0 bg-black/20 transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setIsOpen(false)}
          aria-label="Close leaderboard"
        />

        <aside
          id="leaderboard-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Leaderboard"
          className={`absolute right-0 top-0 h-full w-full sm:w-96 bg-surface-container-lowest border-l border-surface-variant shadow-[0_6px_24px_rgba(0,0,0,0.16)] flex flex-col transition-transform duration-300 ${isOpen ? "translate-x-0" : "translate-x-full"}`}
        >
          <div className="flex items-center justify-between px-md py-sm border-b border-surface-variant">
            <h2 className="font-h3 text-on-surface text-[16px]">Leaderboard</h2>
            <button
              type="button"
              className="text-outline hover:text-on-surface transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container"
              onClick={() => setIsOpen(false)}
              aria-label="Close leaderboard"
            >
              <X className="h-[18px] w-[18px]" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-md py-sm space-y-lg">
            {isLoading ? (
              <p className="text-outline font-body-md">Loading...</p>
            ) : error ? (
              <p className="text-outline font-body-md">Unable to load data.</p>
            ) : (
              <>
                {/* Your stats */}
                <section className="border border-surface-variant rounded-lg p-md bg-surface-container-low">
                  <h3 className="text-on-surface font-semibold mb-sm">Your stats</h3>
                  <div className="grid grid-cols-3 gap-sm">
                    <div className="border border-surface-variant rounded-lg p-sm bg-surface-container-lowest">
                      <p className="text-outline text-xs uppercase tracking-wide">Points</p>
                      <p className="text-primary text-xl font-semibold">{points}</p>
                    </div>
                    <div className="border border-surface-variant rounded-lg p-sm bg-surface-container-lowest">
                      <p className="text-outline text-xs uppercase tracking-wide">Cards</p>
                      <p className="text-primary text-xl font-semibold">{cardStats.total}</p>
                    </div>
                    <div className="border border-surface-variant rounded-lg p-sm bg-surface-container-lowest">
                      <p className="text-outline text-xs uppercase tracking-wide">Done</p>
                      <p className="text-primary text-xl font-semibold">{completionRate}%</p>
                      <p className="text-outline text-xs">{cardStats.completed} of {cardStats.total}</p>
                    </div>
                  </div>
                  <p className="mt-sm text-outline text-sm">
                    {currentUserRank ? `Rank: #${currentUserRank} of ${leaderboard.length}` : "Unranked"}
                  </p>
                </section>

                {/* Team leaderboard */}
                <section>
                  <h3 className="text-on-surface font-semibold mb-sm">Team leaderboard</h3>
                  {leaderboard.length === 0 ? (
                    <p className="text-outline text-sm">No stats yet.</p>
                  ) : (
                    <ul className="flex flex-col gap-sm">
                      {leaderboard.map((entry, index) => {
                        const podium = PODIUM[index]
                        return (
                          <li
                            key={entry.user_id}
                            className="flex items-center justify-between border border-surface-variant rounded-lg p-sm bg-surface-container-lowest"
                          >
                            <div className="flex items-center gap-sm">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface font-semibold text-sm"
                                style={{ backgroundColor: entry.column_color ?? undefined }}
                              >
                                {getInitials(entry.display_name)}
                              </div>
                              <div>
                                <p className="text-on-surface font-semibold">{entry.display_name}</p>
                                <p className="text-outline text-xs">#{index + 1}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-sm">
                              {podium && (
                                <span
                                  className="w-4 h-4 rounded-full border border-surface-variant inline-block"
                                  style={{ backgroundColor: podium.color }}
                                  title={podium.label}
                                />
                              )}
                              <span className="text-primary font-semibold">{entry.points} pts</span>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>

                {/* Weekly stats */}
                <section>
                  <h3 className="text-on-surface font-semibold mb-sm">This week</h3>
                  {weeklyStats.length === 0 ? (
                    <p className="text-outline text-sm">No activity this week.</p>
                  ) : (
                    <ul className="flex flex-col gap-sm">
                      {weeklyStats.map(entry => (
                        <li
                          key={entry.user_id}
                          className="border border-surface-variant rounded-lg p-sm bg-surface-container-lowest"
                        >
                          <div className="flex items-center gap-sm mb-sm">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-on-surface font-semibold text-xs"
                              style={{ backgroundColor: entry.column_color ?? undefined }}
                            >
                              {getInitials(entry.display_name)}
                            </div>
                            <p className="text-on-surface font-semibold">{entry.display_name}</p>
                          </div>
                          <div className="grid grid-cols-3 gap-sm">
                            <div>
                              <p className="text-outline text-xs">Total</p>
                              <p className="text-on-surface font-semibold">{entry.total_cards}</p>
                            </div>
                            <div>
                              <p className="text-outline text-xs">Done</p>
                              <p className="text-on-surface font-semibold">{entry.completed_cards}</p>
                            </div>
                            <div>
                              <p className="text-outline text-xs">Avg time</p>
                              <p className="text-on-surface font-semibold">{entry.avg_completion_time}</p>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </div>
        </aside>
      </div>
    </>
  )
}