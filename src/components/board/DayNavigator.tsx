"use client"

import { useRouter } from "next/navigation"
import { useRef } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

type Props = {
  currentDate: string // ISO date string e.g. '2026-06-07'
}

function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().slice(0, 10)
}

function isFuture(dateStr: string): boolean {
  return dateStr > new Date().toISOString().slice(0, 10)
}

export default function DayNavigator({ currentDate }: Props) {
  const router = useRouter()
  const dateInputRef = useRef<HTMLInputElement>(null)

  const prevDay = addDays(currentDate, -1)
  const nextDay = addDays(currentDate, 1)
  const nextDisabled = isFuture(nextDay)
  const onToday = isToday(currentDate)

  const formattedDate = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(currentDate + "T00:00:00Z"))

  const btnClass =
    "w-7 h-7 rounded-full hover:bg-surface-container flex items-center justify-center text-outline hover:text-on-surface transition-colors"

  return (
    <div className="flex items-center gap-1">
      <button
        className={btnClass}
        onClick={() => router.push(`/board?date=${prevDay}`)}
        aria-label="Previous day"
      >
        <ChevronLeft size={16} />
      </button>

      <button
        className="relative px-3 py-1 rounded-full text-sm font-medium text-on-surface hover:bg-surface-container transition-colors"
        onClick={() => dateInputRef.current?.showPicker()}
      >
        {formattedDate}
        <input
          ref={dateInputRef}
          type="date"
          style={{ fontFamily: "var(--font-sora, 'Sora', sans-serif)", fontSize: "1rem" }}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          value={currentDate}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => {
            const val = e.target.value
            if (!val) return
            if (isToday(val)) {
              router.push("/board")
            } else {
              router.push(`/board?date=${val}`)
            }
          }}
        />
      </button>

      <button
        className={btnClass}
        onClick={() => !nextDisabled && router.push(`/board?date=${nextDay}`)}
        disabled={nextDisabled}
        aria-label="Next day"
        aria-disabled={nextDisabled}
      >
        <ChevronRight size={16} />
      </button>

      {!onToday && (
        <button
          className="ml-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          onClick={() => router.push("/board")}
        >
          Today
        </button>
      )}
    </div>
  )
}
