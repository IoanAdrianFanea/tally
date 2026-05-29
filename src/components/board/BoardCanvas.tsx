"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { DragDropContext, type DropResult } from "@hello-pangea/dnd"

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
  completed_at?: string | null
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

  const [optimisticCards, setOptimisticCards] = useState<Card[]>(cards)
  const cardSnapshotRef = useRef<Card[]>([])

  useEffect(() => {
    setOptimisticCards(cards)
  }, [cards.length, cards.map(c => c.id + c.status + c.position + c.content).join(',')])

  function handleOptimisticDelete(cardId: string) {
    cardSnapshotRef.current = optimisticCards
    setOptimisticCards((prev) => prev.filter((c) => c.id !== cardId))
  }

  function handleOptimisticComplete(cardId: string) {
    cardSnapshotRef.current = optimisticCards
    setOptimisticCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? { ...c, status: "green", completed_at: new Date().toISOString() }
          : c
      )
    )
  }

  function handleOptimisticReopen(cardId: string) {
    cardSnapshotRef.current = optimisticCards
    setOptimisticCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? { ...c, status: "open", completed_at: null }
          : c
      )
    )
  }

  function handleRevert() {
    setOptimisticCards(cardSnapshotRef.current)
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
        table: 'cards'
        // ← remove the filter entirely
      },
      (payload) => {
        
        if (payload.eventType === 'INSERT') {
          const newCard = payload.new as Card
          setOptimisticCards(prev => {
            if (prev.some(c => c.id === newCard.id)) return prev
            return [...prev, newCard]
          })
        }
        
        if (payload.eventType === 'INSERT') {
          const newCard = payload.new as Card
          setOptimisticCards(prev => {
            if (prev.some(c => c.id === newCard.id)) return prev
            return [...prev, newCard]
          })
        }
        if (payload.eventType === 'UPDATE') {
          setOptimisticCards(prev =>
            prev.map(c => c.id === (payload.new as Card).id ? payload.new as Card : c)
          )
        }
        if (payload.eventType === 'DELETE') {
          setOptimisticCards(prev =>
            prev.filter(c => c.id !== (payload.old as Card).id)
          )
        }
      }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [teamId])

  async function handleDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result

    if (!destination) return

    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) return

    const sourceOwnerId = source.droppableId
    const destOwnerId = destination.droppableId

    const byOwner = groupAndNormalize(users, optimisticCards)

    const sourceCards = [...(byOwner[sourceOwnerId] ?? [])]
    const destCards = source.droppableId === destination.droppableId
      ? sourceCards
      : [...(byOwner[destOwnerId] ?? [])]

    const [movedCard] = sourceCards.splice(source.index, 1)
    const updatedCard = { ...movedCard, owner_id: destOwnerId }
    destCards.splice(destination.index, 0, updatedCard)

    const updatedByOwner = {
      ...byOwner,
      [sourceOwnerId]: sourceCards,
      [destOwnerId]: destCards,
    }

    const nextCards = Object.values(updatedByOwner).flat()
    setOptimisticCards(nextCards)

    const res = await fetch(`/api/cards/${draggableId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        position: destination.index,
        owner_id: destOwnerId,
      }),
    })

    if (!res.ok) {
      router.refresh()
    } else {
      router.refresh()
    }
  }

  const normalized = groupAndNormalize(
    users,
    optimisticCards.filter((card, index, self) =>
      index === self.findLastIndex(c => c.id === card.id)
    )
  )

  return (
    <DragDropContext
      onDragStart={() => {
        document.body.style.overflow = 'hidden'
        document.documentElement.style.overflow = 'hidden'
      }}
      onDragEnd={(result) => {
        document.body.style.overflow = ''
        document.documentElement.style.overflow = ''
        handleDragEnd(result)
      }}
    >
      <div className="flex-1 overflow-x-auto kanban-scroll p-lg flex items-start gap-[24px]">
        {users.map((user) => (
          <Column
            key={user.id}
            user={user}
            cards={normalized[user.id] ?? []}
            role={role}
            currentUserId={currentUserId}
            onOptimisticDelete={handleOptimisticDelete}
            onOptimisticComplete={handleOptimisticComplete}
            onOptimisticReopen={handleOptimisticReopen}
            onRevert={handleRevert}
          />
        ))}

        <div className="w-[24px] shrink-0" />
      </div>
    </DragDropContext>
  )
}
