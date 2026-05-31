"use client"

import type { CSSProperties } from "react"

type Props = {
  displayName: string | null
  columnColor: string | null
}

const soraFont: CSSProperties = { fontFamily: "var(--font-sora, 'Sora', sans-serif)" }

function getInitials(name: string | null | undefined) {
  const t = (name ?? "").trim()
  return t ? t[0]!.toUpperCase() : "?"
}

// Logout is handled exclusively via the VaultMenu footer button.
// This component is now a pure avatar display — no dropdown.
export default function UserMenu({ displayName, columnColor }: Props) {
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center
        text-white text-sm font-bold shrink-0 select-none"
      style={{
        ...soraFont,
        backgroundColor: columnColor ?? "#4648d4",
      }}
      aria-label={displayName ?? "User"}
      title={displayName ?? "User"}
    >
      {getInitials(displayName)}
    </div>
  )
}