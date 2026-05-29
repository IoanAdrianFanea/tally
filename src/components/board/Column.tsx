"use client"

import { useRouter } from "next/navigation"
import { Droppable } from "@hello-pangea/dnd"

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
  onOptimisticDelete: (cardId: string) => void
  onOptimisticComplete: (cardId: string) => void
  onOptimisticReopen: (cardId: string) => void
  onRevert: () => void
}

function getInitials(name: string | null | undefined) {
  const trimmed = (name ?? "").trim()
  return trimmed ? trimmed[0]!.toUpperCase() : "?"
}

export default function Column({
  user,
  cards,
  role,
  currentUserId,
  onOptimisticDelete,
  onOptimisticComplete,
  onOptimisticReopen,
  onRevert,
}: Props) {
  const router = useRouter()

  const points = typeof user.points === "number" ? user.points : null
  const xpPercent = Math.min(
    100,
    Math.max(10, points != null ? Math.round((points / 800) * 100) : cards.length * 20)
  )

  return (
    <div
      className="w-70 shrink-0 flex flex-col max-h-full"
      style={{
        ["--column-accent" as never]: user.column_color ?? "var(--color-primary)",
      }}
    >
      <div className="mb-sm flex items-center justify-between bg-surface-container-lowest p-sm rounded-lg border border-surface-variant shadow-sm relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-(--column-accent)" />
        <div className="flex items-center gap-sm pl-sm">
          <div
            className="w-[24px] h-[24px] rounded-full object-cover flex items-center justify-center text-on-surface font-label-sm font-semibold"
            style={{ backgroundColor: user.column_color ?? undefined }}
            aria-label={`${user.display_name} avatar`}
          >
            {getInitials(user.display_name)}
          </div>
          <h3 className="font-body-md font-semibold text-on-surface">
            {user.display_name}
          </h3>
        </div>
        <div className="font-label-sm text-primary font-semibold bg-primary/10 px-xs py-0.5 rounded">
          {points ?? 0} pts
        </div>
      </div>

      <div className="h-[4px] bg-surface-container-high rounded-full mb-md overflow-hidden">
        <div
          className="h-full bg-(--column-accent)"
          style={{ width: `${xpPercent}%` }}
        />
      </div>

      <Droppable droppableId={user.id}>
        {(provided, _snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="flex flex-col gap-sm overflow-y-auto pb-sm custom-scrollbar min-h-[24px]"
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

      {role === "admin" || user.id === currentUserId ? (
        <AddCardButton
          ownerId={user.id}
          onSuccess={() => router.refresh()}
        />
      ) : null}
    </div>
  )
}
