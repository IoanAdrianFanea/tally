"use client"

import dynamic from "next/dynamic"

const BoardCanvas = dynamic(() => import("@/components/board/BoardCanvas"), {
  ssr: false,
})

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

type Props = {
  users: User[]
  cards: Card[]
  role: string
  currentUserId: string
  teamId: string
}

export default function BoardCanvasShell(props: Props) {
  return <BoardCanvas {...props} />
}
