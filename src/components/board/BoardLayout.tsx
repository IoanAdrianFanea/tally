import BoardCanvasShell from "@/components/board/BoardCanvasShell"
import UserMenu from "@/components/board/UserMenu"
import VaultMenu from "@/components/board/VaultMenu"
import SearchBar from "@/components/board/SearchBar"

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

const soraFont = { fontFamily: "var(--font-sora, 'Sora', sans-serif)" }

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

        {/* Centre — Search, intentionally narrow to keep canvas as focus */}
        <div className="flex-1 flex justify-center items-center px-6">
          <div className="w-full max-w-[280px]">
            <SearchBar hasSearch={hasSearch} />
          </div>
        </div>

        {/* Right — Month pill + Avatar */}
        <div className="flex items-center gap-3 shrink-0">
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-outline-variant/30 bg-surface-container-low/60 text-sm font-medium text-on-surface"
            style={soraFont}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
            {monthLabel}
          </div>
          <UserMenu
            displayName={profile?.display_name ?? null}
            columnColor={profile?.column_color ?? null}
          />
        </div>
      </header>

      {/* ── Board canvas — the main event ── */}
      <main className="h-[calc(100vh-80px)] mt-[4.5rem] mx-4 overflow-hidden">
        <BoardCanvasShell
          users={users}
          cards={cards}
          role={role}
          currentUserId={currentUserId}
          teamId={profile?.team_id ?? ""}
        />
      </main>

      {/* ── Floating Vault menu trigger ── */}
      <VaultMenu
        role={role}
        currentUserId={currentUserId}
        profile={profile}
        users={users}
      />
    </div>
  )
}