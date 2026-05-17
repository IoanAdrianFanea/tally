"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search } from "lucide-react"

type DateFilter = "" | "today" | "week" | "month"

type SearchBarProps = {
	hasSearch?: boolean
}

function normalizeDateFilter(value: string | null): DateFilter {
	if (value === "today" || value === "week" || value === "month") {
		return value
	}
	return ""
}

function SearchBarInner({ hasSearch }: SearchBarProps) {
	const router = useRouter()
	const searchParams = useSearchParams()

	const initialQuery = searchParams.get("q") ?? ""
	const initialDate = normalizeDateFilter(searchParams.get("date"))

	const [query, setQuery] = useState(initialQuery)
	const [date, setDate] = useState<DateFilter>(initialDate)

	const dateRef = useRef(date)
	const queryRef = useRef(query)

	useEffect(() => {
		dateRef.current = date
	}, [date])

	useEffect(() => {
		queryRef.current = query
	}, [query])

	const pushUrl = useCallback(
		(nextQuery: string, nextDate: DateFilter) => {
			const trimmedQuery = nextQuery.trim()
			const params = new URLSearchParams()

			if (trimmedQuery) {
				params.set("q", trimmedQuery)
			}

			if (nextDate) {
				params.set("date", nextDate)
			}

			const href = params.toString() ? `/board?${params.toString()}` : "/board"

			const currentQuery = searchParams.get("q") ?? ""
			const currentDate = normalizeDateFilter(searchParams.get("date"))

			if (currentQuery === trimmedQuery && currentDate === nextDate) {
				return
			}

			router.push(href)
		},
		[router, searchParams]
	)

	useEffect(() => {
		const handle = setTimeout(() => {
			pushUrl(query, dateRef.current)
		}, 300)

		return () => clearTimeout(handle)
	}, [pushUrl, query])

	useEffect(() => {
		pushUrl(queryRef.current, date)
	}, [date, pushUrl])

	return (
		<div className="bg-surface-container-lowest border-t border-surface-variant p-md flex flex-wrap items-center gap-md">
			<div className="flex-1 min-w-50 relative">
				<Search className="absolute left-sm top-1/2 -translate-y-1/2 text-outline h-[20px] w-[20px]" />
				<input
					className="w-full pl-9 pr-sm py-[8px] bg-surface-container-low border border-surface-variant rounded-lg font-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-outline-variant"
					placeholder="Search cards..."
					type="text"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
				/>
			</div>

			<div className="flex items-center gap-sm">
				<select
					className="bg-surface-container-low border border-surface-variant rounded-lg font-body-md text-on-surface px-sm py-[8px] focus:outline-none focus:border-primary"
					value={date}
					onChange={(event) =>
						setDate(normalizeDateFilter(event.target.value))
					}
				>
					<option value="">Any Date</option>
					<option value="today">Today</option>
					<option value="week">This Week</option>
					<option value="month">This Month</option>
				</select>
			</div>

			{hasSearch ? (
				<a
					href="/board"
					className="text-xs font-body-md text-primary hover:text-primary/80"
				>
					Clear search
				</a>
			) : null}
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
