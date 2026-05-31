"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, Calendar, ChevronDown } from "lucide-react"
import type { CSSProperties } from "react"

type DateFilter = "" | "today" | "week" | "month"
type SearchBarProps = { hasSearch?: boolean }

const soraFont: CSSProperties = { fontFamily: "var(--font-sora, 'Sora', sans-serif)" }

function normalizeDateFilter(value: string | null): DateFilter {
  if (value === "today" || value === "week" || value === "month") return value
  return ""
}

function SearchBarInner({ hasSearch }: SearchBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [query, setQuery] = useState(searchParams.get("q") ?? "")
  const [date, setDate] = useState<DateFilter>(normalizeDateFilter(searchParams.get("date")))
  const dateRef = useRef(date)
  const queryRef = useRef(query)

  useEffect(() => { dateRef.current = date }, [date])
  useEffect(() => { queryRef.current = query }, [query])

  const pushUrl = useCallback(
    (nextQuery: string, nextDate: DateFilter) => {
      const trimmed = nextQuery.trim()
      const params = new URLSearchParams()
      if (trimmed) params.set("q", trimmed)
      if (nextDate) params.set("date", nextDate)
      const href = params.toString() ? `/board?${params.toString()}` : "/board"
      const curQ = searchParams.get("q") ?? ""
      const curD = normalizeDateFilter(searchParams.get("date"))
      if (curQ === trimmed && curD === nextDate) return
      router.push(href)
    },
    [router, searchParams]
  )

  useEffect(() => {
    const h = setTimeout(() => pushUrl(query, dateRef.current), 300)
    return () => clearTimeout(h)
  }, [pushUrl, query])

  useEffect(() => {
    pushUrl(queryRef.current, date)
  }, [date, pushUrl])

  return (
    <div className="flex items-center gap-1.5 w-full">
      {/* Search input — compact, fills its container */}
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

      {/* Date filter — compact pill */}
      <div className="relative shrink-0">
        <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-outline-variant pointer-events-none" />
        <select
          value={date}
          onChange={(e) => setDate(normalizeDateFilter(e.target.value))}
          className="appearance-none
            pl-6 pr-5 py-1
            text-xs text-on-surface
            bg-surface-container-low/50
            border border-outline-variant/30
            rounded-full
            outline-none
            focus:border-primary
            cursor-pointer
            transition-colors"
          style={soraFont}
        >
          <option value="">Any Date</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
        <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-2.5 w-2.5 text-outline-variant pointer-events-none" />
      </div>

      {hasSearch && (
        <a
          href="/board"
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