"use client"

import { Droppable } from "@hello-pangea/dnd"
import { useRouter } from "next/navigation"
import type { CSSProperties } from "react"

import AddCardButton from "@/components/board/AddCardButton"
import CardItem from "@/components/board/CardItem"

type User = {
  id: string
  display_name: string
  team_id: string | null
  column_color: string | null
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
  user: User
  cards: Card[]
  role: string
  currentUserId: string
  colStyle?: CSSProperties
  onOptimisticDelete: (cardId: string) => void
  onOptimisticComplete: (cardId: string) => void
  onOptimisticReopen: (cardId: string) => void
  onRevert: () => void
}

const soraFont: CSSProperties = { fontFamily: "var(--font-sora, 'Sora', sans-serif)" }

export default function Column({
  user,
  cards,
  role,
  currentUserId,
  colStyle,
  onOptimisticDelete,
  onOptimisticComplete,
  onOptimisticReopen,
  onRevert,
}: Props) {
  const router = useRouter()
  const totalCards = cards.length
  const canAdd = role === "admin" || user.id === currentUserId

  return (
    <div className="flex flex-col min-h-0 self-stretch" style={colStyle}>
      {/* ── Column header ── */}
      <div className="mb-3 shrink-0">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <h2
            className="font-bold text-[1.125rem] text-on-background leading-tight truncate"
            style={soraFont}
          >
            {user.display_name}
          </h2>
          <span
            className="shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full"
            style={{
              ...soraFont,
              backgroundColor: (user.column_color ?? "#4648d4") + "18",
              color: user.column_color ?? "#4648d4",
            }}
          >
            {totalCards} {totalCards === 1 ? "Item" : "Items"}
          </span>
        </div>
        <div
          className="h-0.5 w-full rounded-full"
          style={{ backgroundColor: user.column_color ?? "#4648d4" }}
        />
      </div>

      {/* ── Cards area ── */}
      <Droppable droppableId={user.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="flex-1 overflow-y-auto flex flex-col gap-3 pb-3"
            style={{
              minHeight: "60px",
              background: snapshot.isDraggingOver ? "rgba(70,72,212,0.03)" : "transparent",
              borderRadius: "8px",
              transition: "background 0.15s",
            }}
          >
            {cards.map((card, index) => (
              <CardItem
                key={card.id}
                card={card}
                index={index}
                role={role}
                onOptimisticDelete={onOptimisticDelete}
                onOptimisticComplete={onOptimisticComplete}
                onOptimisticReopen={onOptimisticReopen}
                onRevert={onRevert}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
      {canAdd ? (
        <div className="mt-2 shrink-0">
          <AddCardButton ownerId={user.id} onSuccess={() => router.refresh()} />
        </div>
      ) : null}
    </div>
  )
}