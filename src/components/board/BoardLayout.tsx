import { LayoutGrid, Settings, Trophy } from "lucide-react"

import BoardCanvasShell from "@/components/board/BoardCanvasShell"
import SearchBar from "@/components/board/SearchBar"
import LeaderboardPanel from "@/components/board/LeaderboardPanel"

type User = {
  id: string
  display_name: string
  team_id: string | null
  column_color: string | null
  role: string
  points?: number | null
}

type Card = {
  id: string
  content: string
  owner_id: string
  status: string | null
  created_at?: string | null
}

type Profile = User

type Props = {
  users: User[]
  cards: Card[]
  profile: Profile | null
  role: string
  currentUserId?: string
  hasSearch?: boolean
}

function getInitials(name: string | null | undefined) {
  const trimmed = (name ?? "").trim()
  return trimmed ? trimmed[0]!.toUpperCase() : "?"
}

export default function BoardLayout({
  users,
  cards,
  profile,
  role,
  currentUserId: currentUserIdProp,
  hasSearch,
}: Props) {
  const currentUserId = currentUserIdProp ?? profile?.id ?? ""

  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date())

  const currentUserPoints =
    users.find((u) => u.id === currentUserId)?.points ?? 0
  const pointsLabel = new Intl.NumberFormat("en-US").format(currentUserPoints)

  return (
    <div className="bg-background text-on-surface h-screen flex flex-col overflow-hidden">
      <nav className="bg-surface-container-lowest font-label-sm font-medium fixed top-0 w-full z-50 border-b border-surface-variant shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex justify-between items-center px-[24px] h-16">
        <div className="flex items-center gap-sm">
          <span className="text-[20px] font-bold tracking-tight text-primary font-h3">
            Standup Board
          </span>
        </div>

        <div className="flex items-center">
          <span className="text-primary font-bold flex items-center gap-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
            {monthLabel}
          </span>
        </div>

        <div className="flex items-center gap-md">
          <div className="flex items-center gap-sm bg-surface-container-low px-sm py-[4px] rounded-full border border-surface-variant">
            <span className="font-label-sm text-on-surface font-semibold">
              {pointsLabel} pts
            </span>
          </div>
          <div className="flex gap-sm">
            <button
              type="button"
              className="text-outline hover:text-on-surface transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container"
              aria-label="Achievements"
            >
              <Trophy className="h-[20px] w-[20px]" />
            </button>
          </div>

          <div
            className="w-8 h-8 rounded-full border border-surface-variant object-cover flex items-center justify-center font-body-md font-semibold"
            style={{ backgroundColor: profile?.column_color ?? undefined }}
            aria-label="User avatar"
          >
            {getInitials(profile?.display_name)}
          </div>
        </div>
      </nav>

      <div className="flex flex-1 pt-16 h-full overflow-hidden">
        <aside className="bg-surface-container-lowest font-body-md fixed left-0 top-16 h-[calc(100vh-64px)] w-[256px] rounded-none border-r border-surface-variant py-[16px] gap-[8px] z-40 hidden md:flex md:flex-col">
          <div className="px-[16px] mb-[16px] flex items-center gap-md">
            <div className="w-[40px] h-[40px] rounded-lg bg-surface-container-high flex items-center justify-center text-primary font-h3">
              RT
            </div>
            <div>
              <h2 className="font-h3 text-on-surface text-[16px] leading-[20px]">
                Remote Team
              </h2>
            </div>
          </div>

          <nav className="flex-1 px-[8px] flex flex-col gap-[4px]">
            <a
              className="flex items-center gap-md px-3 py-[8px] rounded-lg bg-primary/10 text-primary font-semibold border-l-4 border-primary transition-all active:translate-x-1 duration-150"
              href="#"
            >
              <LayoutGrid className="h-[20px] w-[20px]" />
              <span className="font-body-md">Board</span>
            </a>

            <LeaderboardPanel currentUserId={currentUserId} />

            <a
              className="flex items-center gap-md px-3 py-[8px] rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all active:translate-x-1 duration-150 mt-auto"
              href="#"
            >
              <Settings className="h-[20px] w-[20px]" />
              <span className="font-body-md">Settings</span>
            </a>
          </nav>
        </aside>

        <main className="flex-1 md:ml-64 h-full overflow-hidden bg-background flex flex-col">
          <BoardCanvasShell
            users={users}
            cards={cards}
            role={role}
            currentUserId={currentUserId}
            teamId={profile?.team_id ?? ''}
          />

          <SearchBar hasSearch={hasSearch} />
        </main>
      </div>
    </div>
  )
}
