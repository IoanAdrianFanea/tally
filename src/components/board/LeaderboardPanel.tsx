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

  useEffect(() => {
    if (!isOpen) return

    const controller = new AbortController()

    const loadLeaderboard = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch("/api/stats/leaderboard", {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error("Failed to load leaderboard")
        }

        const data = (await response.json()) as LeaderboardResponse
        setLeaderboard(Array.isArray(data.leaderboard) ? data.leaderboard : [])

        const cardsResponse = await fetch("/api/cards", {
          signal: controller.signal,
        })

        if (cardsResponse.ok) {
          const cardsData = (await cardsResponse.json()) as CardResponse
          const cards = Array.isArray(cardsData.cards) ? cardsData.cards : []
          const userCards = currentUserId
            ? cards.filter((card) => card.owner_id === currentUserId)
            : []
          const completed = userCards.filter(
            (card) => card.status === "green"
          ).length

          setCardStats({ total: userCards.length, completed })
        } else {
          setCardStats({ total: 0, completed: 0 })
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
        setError(err instanceof Error ? err.message : "Failed to load leaderboard")
      } finally {
        setIsLoading(false)
      }
    }

    void loadLeaderboard()

    return () => controller.abort()
  }, [isOpen])

  const currentUserIndex = useMemo(() => {
    if (!currentUserId) return -1
    return leaderboard.findIndex((entry) => entry.user_id === currentUserId)
  }, [currentUserId, leaderboard])

  const currentUserEntry = currentUserIndex >= 0 ? leaderboard[currentUserIndex] : null
  const currentUserRank = currentUserIndex >= 0 ? currentUserIndex + 1 : null
  const points = currentUserEntry?.points ?? 0
  const completionRate =
    cardStats.total > 0
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

      <div
        className={`fixed top-16 left-0 right-0 h-[calc(100vh-64px)] z-50 ${
          isOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-black/20 transition-opacity duration-300 ${
            isOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setIsOpen(false)}
          aria-label="Close leaderboard"
        />

        <aside
          id="leaderboard-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Leaderboard"
          className={`absolute right-0 top-0 h-full w-full sm:w-96 bg-surface-container-lowest border-l border-surface-variant shadow-[0_6px_24px_rgba(0,0,0,0.16)] flex flex-col transition-transform duration-300 ${
            isOpen ? "translate-x-0" : "translate-x-full"
          }`}
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

          <div className="flex-1 overflow-y-auto px-md py-sm">
            {isLoading ? (
              <div className="text-outline font-body-md">Loading leaderboard...</div>
            ) : error ? (
              <div className="text-outline font-body-md">Unable to load leaderboard.</div>
            ) : (
              <>
                <section className="border border-surface-variant rounded-lg p-md bg-surface-container-low">
                  <h3 className="text-on-surface font-semibold">Your stats</h3>
                  <div className="mt-sm grid grid-cols-1 sm:grid-cols-3 gap-md">
                    <div className="border border-surface-variant rounded-lg p-sm bg-surface-container-lowest">
                      <p className="text-outline text-xs uppercase tracking-wide">
                        Points this month
                      </p>
                      <p className="text-primary text-xl font-semibold">{points}</p>
                    </div>
                    <div className="border border-surface-variant rounded-lg p-sm bg-surface-container-lowest">
                      <p className="text-outline text-xs uppercase tracking-wide">
                        Total cards
                      </p>
                      <p className="text-primary text-xl font-semibold">
                        {cardStats.total}
                      </p>
                    </div>
                    <div className="border border-surface-variant rounded-lg p-sm bg-surface-container-lowest">
                      <p className="text-outline text-xs uppercase tracking-wide">
                        Completion rate
                      </p>
                      <p className="text-primary text-xl font-semibold">
                        {completionRate}%
                      </p>
                      <p className="text-outline text-xs">
                        {cardStats.completed} of {cardStats.total}
                      </p>
                    </div>
                  </div>
                  <p className="mt-sm text-outline text-sm">
                    {currentUserRank
                      ? `Rank: #${currentUserRank} of ${leaderboard.length}`
                      : "Rank: Unranked"}
                  </p>
                </section>

                <section className="mt-lg">
                  <h3 className="text-on-surface font-semibold">Team leaderboard</h3>
                  {leaderboard.length === 0 ? (
                    <p className="mt-sm text-outline text-sm">No stats yet.</p>
                  ) : (
                    <ul className="mt-sm flex flex-col gap-sm">
                      {leaderboard.map((entry, index) => {
                        const podium = PODIUM[index]
                        return (
                          <li
                            key={entry.user_id}
                            className="flex items-center justify-between border border-surface-variant rounded-lg p-sm bg-surface-container-lowest"
                          >
                            <div className="flex items-center gap-sm">
                              <div
                                className="w-8 h-8 rounded-full border border-surface-variant flex items-center justify-center text-on-surface font-semibold"
                                style={{
                                  backgroundColor: entry.column_color ?? undefined,
                                }}
                              >
                                {getInitials(entry.display_name)}
                              </div>
                              <div>
                                <p className="text-on-surface font-semibold">
                                  {entry.display_name}
                                </p>
                                <p className="text-outline text-xs">#{index + 1}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-sm">
                              {podium ? (
                                <span
                                  className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-surface-variant"
                                  style={{ backgroundColor: podium.color }}
                                  aria-label={`${podium.label} rank`}
                                  title={podium.label}
                                />
                              ) : null}
                              <span className="text-primary font-semibold">
                                {entry.points} pts
                              </span>
                            </div>
                          </li>
                        )
                      })}
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
