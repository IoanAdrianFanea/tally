import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { logActivity } from "@/lib/activity"
import BoardLayout from "@/components/board/BoardLayout"
import { runMonthlyArchive } from "@/lib/archive"

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

  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single()

  if (!profile) redirect("/login")

  const { data: users } = await supabase
    .from("users")
    .select("*")
    .eq("team_id", profile.team_id)

  // ── Auto-archive: trigger if previous month has unarchived boards ─────────
  // Runs silently on any page load. Idempotent — skips if already archived.
  const today = new Date()
  const prevMonthKey = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    .toISOString().slice(0, 7)

  const { data: prevArchive } = await supabase
    .from("archives")
    .select("id")
    .eq("team_id", profile.team_id)
    .eq("month_key", prevMonthKey)
    .maybeSingle()

  if (!prevArchive) {
    // Previous month not yet archived — run auto-archive (best-effort, non-blocking on failure)
    await runMonthlyArchive(supabase, profile.team_id, user.id, prevMonthKey).catch(() => {})
  }

  // ── Fetch board for target date ───────────────────────────────────────────
  let boardId: string | null = null
  let boardIsArchived = false
  let boardUnarchivedUntil: string | null = null

  if (targetDate === todayStr) {
    const { data } = await supabase.rpc("get_or_create_today_board", { p_team_id: profile.team_id })
    boardId = data
  } else {
    // Use select("*") — safe even if is_archived/unarchived_until don't exist yet
    const { data } = await supabase
      .from("boards")
      .select("*")
      .eq("team_id", profile.team_id)
      .eq("date", targetDate)
      .maybeSingle()
    boardId = data?.id ?? null
    boardIsArchived = data?.is_archived ?? false
    boardUnarchivedUntil = data?.unarchived_until ?? null
  }

  // ── Auto-rearchive if the 24h unarchive window has expired ────────────────
  if (boardId && !boardIsArchived && boardUnarchivedUntil) {
    if (new Date(boardUnarchivedUntil) < new Date()) {
      const [{ data: boardSections }, { data: boardCards }] = await Promise.all([
        supabase.from("sections").select("id, name, x, y, width, height, is_done_section, position").eq("board_id", boardId),
        supabase.from("cards").select("id, content, owner_id, status, x, y, section_id, completed_at").eq("board_id", boardId),
      ])

      const pointsByUser: Record<string, number> = {}
      for (const card of boardCards ?? []) {
        if (card.status === "green" && card.owner_id) {
          pointsByUser[card.owner_id] = (pointsByUser[card.owner_id] ?? 0) + 1
        }
      }

      const monthKey = targetDate.slice(0, 7)
      const { data: archiveRecord } = await supabase
        .from("archives")
        .select("id")
        .eq("team_id", profile.team_id)
        .eq("month_key", monthKey)
        .maybeSingle()

      if (archiveRecord) {
        await Promise.all([
          supabase.from("archive_days")
            .update({
              is_open: false,
              day_snapshot: {
                sections: boardSections ?? [],
                cards: boardCards ?? [],
                points_by_user: pointsByUser,
                rearchived_at: new Date().toISOString(),
              },
            })
            .eq("archive_id", archiveRecord.id)
            .eq("date", targetDate),
          // Clear is_open on archive if no other days are open
          supabase.from("archive_days")
            .select("id", { count: "exact", head: true })
            .eq("archive_id", archiveRecord.id)
            .eq("is_open", true)
            .then(({ count }) => {
              if ((count ?? 0) <= 1) {
                return supabase.from("archives").update({ is_open: false }).eq("id", archiveRecord.id)
              }
            }),
        ])
      }

      await supabase
        .from("boards")
        .update({ is_archived: true, unarchived_until: null })
        .eq("id", boardId)

      await logActivity(supabase, {
        team_id: profile.team_id,
        user_id: user.id,
        action_type: "day_rearchived",
        card_id: null,
        metadata: {
          board_id: boardId,
          date: targetDate,
          reason: "24h_window_expired",
          cards_count: boardCards?.length ?? 0,
          completed_cards: (boardCards ?? []).filter((c) => c.status === "green").length,
          points_by_user: pointsByUser,
          archive_id: archiveRecord?.id ?? null,
        },
      })

      boardIsArchived = true
      boardUnarchivedUntil = null
    }
  }

  // ── Fetch sections + cards ─────────────────────────────────────────────────
  const { data: sections } = boardId
    ? await supabase
        .from("sections")
        .select("*")
        .eq("board_id", boardId)
        .order("position", { ascending: true })
    : { data: null }

  const buildPrefixQuery = (raw: string) =>
    raw.trim().split(/\s+/).filter(Boolean)
      .map((t) => t.replace(/[':]/g, "")).filter(Boolean)
      .map((t) => `${t}:*`).join(" & ")

  let cardsQuery = boardId
    ? supabase.from("cards").select("*").eq("board_id", boardId).order("created_at", { ascending: true })
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
      isArchived={boardIsArchived}
      unarchivedUntil={boardUnarchivedUntil}
    />
  )
}

