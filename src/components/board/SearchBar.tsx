"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search } from "lucide-react"
import type { CSSProperties } from "react"

type SearchBarProps = { hasSearch?: boolean }

const soraFont: CSSProperties = { fontFamily: "var(--font-sora, 'Sora', sans-serif)" }

function SearchBarInner({ hasSearch }: SearchBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [query, setQuery] = useState(searchParams.get("q") ?? "")

  const pushUrl = useCallback(
    (nextQuery: string) => {
      const trimmed = nextQuery.trim()
      const params = new URLSearchParams()
      if (trimmed) params.set("q", trimmed)
      const existingDate = searchParams.get("date")
      if (existingDate) params.set("date", existingDate)
      const href = params.toString() ? `/board?${params.toString()}` : "/board"
      const curQ = searchParams.get("q") ?? ""
      if (curQ === trimmed) return
      router.push(href)
    },
    [router, searchParams]
  )

  useEffect(() => {
    const h = setTimeout(() => pushUrl(query), 300)
    return () => clearTimeout(h)
  }, [pushUrl, query])

  return (
    <div className="flex items-center gap-1.5 w-full">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-outline-variant pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          className="w-full pl-7 pr-2.5 py-1
            text-xs text-on-surface
            bg-surface-container-low/50
            border border-outline-variant/30
            rounded-full
            outline-none
            focus:border-primary focus:ring-1 focus:ring-primary/20
            placeholder:text-outline-variant/60
            transition-all"
          style={soraFont}
        />
      </div>

      {hasSearch && (
        <a
          href={`/board${searchParams.get("date") ? `?date=${searchParams.get("date")}` : ""}`}
          className="text-[0.6875rem] text-primary hover:text-primary/70 whitespace-nowrap transition-colors shrink-0"
          style={soraFont}
        >
          Clear
        </a>
      )}
    </div>
  )
}

export default function SearchBar(props: SearchBarProps) {
  return (
    <Suspense fallback={null}>
      <SearchBarInner {...props} />
    </Suspense>
  )
}