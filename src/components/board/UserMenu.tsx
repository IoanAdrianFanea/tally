"use client"

import type { CSSProperties } from "react"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

type Props = {
  displayName: string | null
  columnColor: string | null
  points?: number | null
  boardId?: string | null
  currentUserId?: string
}

const soraFont: CSSProperties = { fontFamily: "var(--font-sora, 'Sora', sans-serif)" }

function getInitials(name: string | null | undefined) {
  const t = (name ?? "").trim()
  return t ? t[0]!.toUpperCase() : "?"
}

export default function UserMenu({ displayName, columnColor, points: initialPoints, boardId, currentUserId }: Props) {
  const [hovered, setHovered] = useState(false)
  const [livePoints, setLivePoints] = useState<number | null>(initialPoints ?? null)

  // Keep initial points in sync if props change (e.g. board navigation)
  useEffect(() => { setLivePoints(initialPoints ?? null) }, [initialPoints])

  // Subscribe to card changes on this board to keep points live
  useEffect(() => {
    if (!boardId || !currentUserId) return
    const supabase = createClient()

    // Fetch current count immediately
    supabase
      .from("cards")
      .select("id", { count: "exact", head: true })
      .eq("board_id", boardId)
      .eq("owner_id", currentUserId)
      .eq("status", "green")
      .then(({ count }) => { if (count !== null) setLivePoints(count) })

    const channel = supabase
      .channel(`user-points-${boardId}-${currentUserId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cards", filter: `board_id=eq.${boardId}` }, () => {
        supabase
          .from("cards")
          .select("id", { count: "exact", head: true })
          .eq("board_id", boardId)
          .eq("owner_id", currentUserId)
          .eq("status", "green")
          .then(({ count }) => { if (count !== null) setLivePoints(count) })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [boardId, currentUserId])

  const displayPoints = livePoints

  async function handleLogout() {
    // The signout route handles Supabase signout + redirect server-side
    window.location.href = "/auth/signout"
  }

  return (
    <div
      style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 8 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Points pill */}
      {typeof displayPoints === "number" && (
        <div
          style={{
            ...soraFont,
            display: "flex",
            alignItems: "center",
            gap: 3,
            padding: "2px 8px",
            borderRadius: 999,
            backgroundColor: "rgba(99,102,241,0.10)",
            border: "1px solid rgba(99,102,241,0.20)",
            fontSize: 12,
            fontWeight: 700,
            color: "#6366f1",
            userSelect: "none",
            whiteSpace: "nowrap",
          }}
        >
          {displayPoints} pts
        </div>
      )}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center
          text-white text-sm font-bold shrink-0 select-none cursor-pointer"
        style={{ ...soraFont, backgroundColor: columnColor ?? "#4648d4" }}
        aria-label={displayName ?? "User"}
        title={displayName ?? "User"}
      >
        {getInitials(displayName)}
      </div>

      {hovered && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            backgroundColor: "white",
            borderRadius: 10,
            boxShadow: "0 4px 20px rgba(0,0,0,0.14)",
            border: "1px solid rgba(0,0,0,0.07)",
            overflow: "hidden",
            minWidth: 140,
            zIndex: 200,
            ...soraFont,
          }}
        >
          {displayName && (
            <div style={{ padding: "9px 14px 6px", fontSize: 12, fontWeight: 600, color: "#888" }}>
              {displayName}
            </div>
          )}
          <button
            onClick={handleLogout}
            style={{
              display: "block",
              width: "100%",
              padding: "8px 14px",
              textAlign: "left",
              fontSize: 13,
              fontWeight: 500,
              color: "#ef4444",
              background: "none",
              border: "none",
              cursor: "pointer",
              borderTop: displayName ? "1px solid #f3f3f3" : "none",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#fff5f5" }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent" }}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  )
}