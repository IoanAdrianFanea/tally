import BoardCanvasShell from "@/components/board/BoardCanvasShell"
import UserMenu from "@/components/board/UserMenu"
import VaultMenu from "@/components/board/VaultMenu"
import SearchBar from "@/components/board/SearchBar"
import DayNavigator from "@/components/board/DayNavigator"

type Section = {
  id: string
  board_id: string
  team_id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  is_done_section: boolean
  position: number
}

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
  sections: Section[]
  boardId: string | null
  currentDate: string
  hasSearch?: boolean
}

const soraFont = { fontFamily: "var(--font-sora, 'Sora', sans-serif)" }

export default function BoardLayout({
  users,
  cards,
  profile,
  role,
  currentUserId: currentUserIdProp,
  sections,
  boardId,
  currentDate,
  hasSearch,
}: Props) {
  const currentUserId = currentUserIdProp ?? profile?.id ?? ""

  return (
    <div className="min-h-screen flex flex-col bg-[#f9f9ff]">
      {/* ── Floating glassmorphism pill header ── */}
      <header
        className="fixed top-4 left-4 right-4 z-50
          flex items-center justify-between
          px-6 py-2.5
          bg-white/80 backdrop-blur-xl
          rounded-full
          border border-white/60
          shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05),0_10px_15px_-3px_rgba(0,0,0,0.08)]"
      >
        {/* Left — Logo */}
        <span
          className="text-primary font-bold text-[1.75rem] leading-none tracking-tight shrink-0"
          style={soraFont}
        >
          Vault
        </span>

        {/* Centre — Search + Day navigator */}
        <div className="flex-1 flex justify-center items-center gap-3 px-6">
          <div className="w-full max-w-[660px]">
            <SearchBar hasSearch={hasSearch} />
          </div>
          <div style={soraFont}>
            <DayNavigator currentDate={currentDate} />
          </div>
        </div>

        {/* Right — Avatar */}
        <div className="flex items-center gap-3 shrink-0">
          <UserMenu
            displayName={profile?.display_name ?? null}
            columnColor={profile?.column_color ?? null}
            points={users.find((u) => u.id === currentUserId)?.points ?? null}
            boardId={boardId}
            currentUserId={currentUserId}
          />
        </div>
      </header>

      {/* ── Board canvas — the main event ── */}
      <main className="h-[calc(100vh-80px)] mt-[4.5rem] mx-4 overflow-hidden">
        {boardId ? (
          <BoardCanvasShell
            key={boardId}
            users={users}
            cards={cards}
            role={role}
            currentUserId={currentUserId}
            sections={sections}
            boardId={boardId}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-outline text-sm"
          style={soraFont}>
            No board for this date
          </div>
        )}
      </main>

      {/* ── Floating Vault menu trigger ── */}
      <VaultMenu
        role={role}
        currentUserId={currentUserId}
        profile={profile}
        users={users}
        boardId={boardId}
        currentDate={currentDate}
      />
    </div>
  )
}