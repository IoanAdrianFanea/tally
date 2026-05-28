import { Trophy } from "lucide-react"

import BoardCanvasShell from "@/components/board/BoardCanvasShell"
import SearchBar from "@/components/board/SearchBar"
import LeaderboardPanel from "@/components/board/LeaderboardPanel"
import SettingsPanel from "@/components/board/SettingsPanel"
import UserMenu from "@/components/board/UserMenu"

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

          <UserMenu
            displayName={profile?.display_name ?? null}
            columnColor={profile?.column_color ?? null}
          />
        </div>
      </nav>

      <div className="flex flex-1 pt-16 h-full overflow-hidden">
        <main className="flex-1 h-full overflow-hidden bg-background flex flex-col">
          <BoardCanvasShell
            users={users}
            cards={cards}
            role={role}
            currentUserId={currentUserId}
            teamId={profile?.team_id ?? ''}
          />

          <div className="fixed bottom-20 right-4 z-50 flex flex-col gap-2 items-end">
            <LeaderboardPanel currentUserId={currentUserId} asFloatingButton />
            <SettingsPanel isAdmin={role === "admin"} asFloatingButton />
          </div>

          <SearchBar hasSearch={hasSearch} />
        </main>
      </div>
    </div>
  )
}
