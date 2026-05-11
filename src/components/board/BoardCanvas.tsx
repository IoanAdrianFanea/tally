"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect } from "react"
import { startTransition, useOptimistic } from "react"
import { useRouter } from "next/navigation"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable"

import Column from "@/components/board/Column"

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
  position?: number | null
  created_at?: string | null
}

type Props = {
  users: User[]
  cards: Card[]
  role: string
  currentUserId: string
  teamId: string
}

function groupAndNormalize(users: User[], cards: Card[]) {
  const byOwner: Record<string, Card[]> = Object.fromEntries(
    users.map((u) => [u.id, [] as Card[]])
  )

  for (const card of cards) {
    const ownerId = card.owner_id
    if (!byOwner[ownerId]) byOwner[ownerId] = []
    byOwner[ownerId].push(card)
  }

  for (const ownerId of Object.keys(byOwner)) {
    byOwner[ownerId] = [...byOwner[ownerId]]
      .sort((a, b) => {
        const ap = typeof a.position === "number" ? a.position : 0
        const bp = typeof b.position === "number" ? b.position : 0
        if (ap !== bp) return ap - bp
        return a.created_at && b.created_at
          ? a.created_at.localeCompare(b.created_at)
          : 0
      })
      .map((c, index) => ({ ...c, position: index }))
  }

  return byOwner
}

export default function BoardCanvas({ users, cards, role, currentUserId, teamId }: Props) {
  const router = useRouter()

  const [optimisticCards, setOptimisticCards] = useOptimistic<Card[], Card[]>(
    cards,
    (_state, next: Card[]) => next
  )

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function getOwnerForId(id: string): string | null {
    if (users.some((u) => u.id === id)) return id
    const card = optimisticCards.find((c) => c.id === id)
    return card ? card.owner_id : null
  }

  useEffect(() => {
  const supabase = createClient()

  const channel = supabase
    .channel('cards-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'cards',
        filter: `team_id=eq.${teamId}`
      },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          startTransition(() => {
            setOptimisticCards([...optimisticCards, payload.new as Card])
          })
        }
        if (payload.eventType === 'UPDATE') {
          startTransition(() => {
            setOptimisticCards(
              optimisticCards.map(c => 
                c.id === (payload.new as Card).id ? payload.new as Card : c
              )
            )
          })
        }
        if (payload.eventType === 'DELETE') {
          startTransition(() => {
            setOptimisticCards(
              optimisticCards.filter(c => c.id !== (payload.old as Card).id)
            )
          })
        }
      }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [teamId])

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    if (activeId === overId) return

    const activeOwner = getOwnerForId(activeId)
    const overOwner = getOwnerForId(overId)

    if (!activeOwner || !overOwner) return

    const byOwner = groupAndNormalize(users, optimisticCards)

    const sourceCards = byOwner[activeOwner] ?? []
    const destCards = byOwner[overOwner] ?? []

    const sourceIndex = sourceCards.findIndex((c) => c.id === activeId)
    if (sourceIndex < 0) return

    const isOverAColumn = users.some((u) => u.id === overId)
    const overIndexInDest = destCards.findIndex((c) => c.id === overId)
    const targetIndex = isOverAColumn
      ? destCards.length
      : overIndexInDest >= 0
          ? overIndexInDest
          : destCards.length

    if (activeOwner === overOwner) {
      if (sourceIndex === targetIndex) return

      const moved = arrayMove(sourceCards, sourceIndex, targetIndex).map(
        (c, index) => ({ ...c, position: index })
      )
      byOwner[activeOwner] = moved
    } else {
      const nextSource = [...sourceCards]
      const [movedCard] = nextSource.splice(sourceIndex, 1)

      const nextDest = [...destCards]
      const overIndexInNextDest = nextDest.findIndex((c) => c.id === overId)
      const insertIndex = isOverAColumn
        ? nextDest.length
        : overIndexInNextDest >= 0
            ? overIndexInNextDest
            : nextDest.length

      nextDest.splice(insertIndex, 0, {
        ...movedCard,
        owner_id: overOwner,
      })

      byOwner[activeOwner] = nextSource.map((c, index) => ({
        ...c,
        position: index,
      }))
      byOwner[overOwner] = nextDest.map((c, index) => ({
        ...c,
        position: index,
      }))
    }

    const nextOptimisticCards = Object.values(byOwner).flat()
    startTransition(() => {
      setOptimisticCards(nextOptimisticCards)
    })

    const newPosition = (byOwner[overOwner] ?? []).findIndex(
      (c) => c.id === activeId
    )

    const payload: Record<string, unknown> = {
      position: newPosition < 0 ? 0 : newPosition,
    }
    if (activeOwner !== overOwner) payload.owner_id = overOwner

    try {
      const res = await fetch(`/api/cards/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        // fall back to server state
        router.refresh()
        return
      }

      router.refresh()
    } catch {
      router.refresh()
    }
  }

  const normalized = groupAndNormalize(users, optimisticCards)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 overflow-x-auto kanban-scroll p-lg flex items-start gap-[24px]">
        {users.map((user) => (
          <Column
            key={user.id}
            user={user}
            cards={normalized[user.id] ?? []}
            role={role}
            currentUserId={currentUserId}
          />
        ))}

        <div className="w-[24px] shrink-0" />
      </div>
    </DndContext>
  )
}
