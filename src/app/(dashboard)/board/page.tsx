import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import BoardLayout from "@/components/board/BoardLayout"

type BoardPageProps = {
  searchParams: Promise<{ date?: string; q?: string }>
}

export default async function BoardPage({ searchParams }: BoardPageProps) {
  const { date, q } = await searchParams
  const todayStr = new Date().toISOString().slice(0, 10)
  const isValidDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
  const targetDate = isValidDate ? date : todayStr
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single()

  if (!profile) {
    // This should not happen if the user is logged in, but as a safeguard:
    redirect("/login")
  }

  const { data: users } = await supabase
    .from("users")
    .select("*")
    .eq("team_id", profile.team_id)

  let boardId: string | null = null

  if (targetDate === new Date().toISOString().slice(0, 10)) {
    const { data } = await supabase.rpc("get_or_create_today_board", { p_team_id: profile.team_id })
    boardId = data
  } else {
    const { data } = await supabase
      .from("boards")
      .select("id")
      .eq("team_id", profile.team_id)
      .eq("date", targetDate)
      .single()
    boardId = data?.id ?? null
  }

  const { data: sections } = boardId ? await supabase
    .from("sections")
    .select("*")
    .eq("board_id", boardId)
    .order("position", { ascending: true }) : { data: null }

  // Build prefix query for text search
  const buildPrefixQuery = (raw: string) => {
    return raw
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((term) => term.replace(/[':]/g, ""))
      .filter(Boolean)
      .map((term) => `${term}:*`)
      .join(" & ")
  }

  let cardsQuery = boardId
    ? supabase
        .from("cards")
        .select("*")
        .eq("board_id", boardId)
        .order("created_at", { ascending: true })
    : null
  if (cardsQuery && q) {
    const pf = buildPrefixQuery(q)
    if (pf) cardsQuery = cardsQuery.filter("search_vector", "fts", pf)
  }
  const { data: cards } = cardsQuery ? await cardsQuery : { data: null }
  const pointsByOwner: Record<string, number> = {}
  for (const card of cards ?? []) {
    if (card.status === "green" && card.owner_id) {
      pointsByOwner[card.owner_id] = (pointsByOwner[card.owner_id] || 0) + 1
    }
  }

  const usersWithPoints = (users ?? []).map((u) => ({
    ...u,
    points: pointsByOwner[u.id] || 0,
  }))

  return (
    <BoardLayout
      users={usersWithPoints}
      cards={cards ?? []}
      profile={profile}
      role={profile.role ?? "member"}
      currentUserId={profile.id ?? ""}
      sections={sections ?? []}
      boardId={boardId}
      currentDate={targetDate}
      hasSearch={Boolean(q)}
    />
  )
}