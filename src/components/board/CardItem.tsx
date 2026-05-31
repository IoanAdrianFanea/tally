"use client"

import { CheckCircle2, RotateCcw, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, type CSSProperties } from "react"
import { createPortal } from "react-dom"
import { Draggable } from "@hello-pangea/dnd"

import EditCardButton from "@/components/board/EditCardButton"
import { Button } from "@/components/ui/button"

type Card = {
  id: string
  content: string
  owner_id: string
  status: string | null
  created_at?: string | null
  completed_at?: string | null
}

type Props = {
  card: Card
  index: number
  role: string
  onOptimisticDelete: (cardId: string) => void
  onOptimisticComplete: (cardId: string) => void
  onOptimisticReopen: (cardId: string) => void
  onRevert: () => void
}

// Sora applied to all card text
const soraFont: CSSProperties = { fontFamily: "var(--font-sora, 'Sora', sans-serif)" }

function formatWhen(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export default function CardItem({
  card,
  index,
  role,
  onOptimisticDelete,
  onOptimisticComplete,
  onOptimisticReopen,
  onRevert,
}: Props) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function deleteCard() {
    setDeleteError(null)
    onOptimisticDelete(card.id)
    try {
      setDeleting(true)
      const res = await fetch(`/api/cards/${card.id}`, { method: "DELETE" })
      if (!res.ok) {
        onRevert()
        const payload = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error || "Failed to delete card")
      }
      setConfirmDeleteOpen(false)
      router.refresh()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setDeleting(false)
    }
  }

  async function completeCard() {
    onOptimisticComplete(card.id)
    const res = await fetch(`/api/cards/${card.id}/complete`, { method: "POST" })
    if (!res.ok) onRevert()
    else router.refresh()
  }

  async function reopenCard() {
    onOptimisticReopen(card.id)
    const res = await fetch(`/api/cards/${card.id}/reopen`, { method: "POST" })
    if (!res.ok) onRevert()
    else router.refresh()
  }

  const isGreen = card.status === "green"
  const when = formatWhen(card.created_at)
  const completedWhen = formatWhen(card.completed_at)

  const now = new Date()
  const created = card.created_at ? new Date(card.created_at) : null
  const daysOld = created
    ? Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
    : 0
  const isStale = !isGreen && daysOld >= 1

  const staleStyle: CSSProperties = isStale
    ? daysOld >= 7
      ? { border: "1px dashed #aaa", filter: "grayscale(40%)" }
      : daysOld >= 3
        ? { border: "1px dashed #bbb", filter: "grayscale(20%)" }
        : { border: "1px dashed #ccc" }
    : {}

  const confirmDeleteModal = confirmDeleteOpen
    ? createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setConfirmDeleteOpen(false) }}
        >
          <div
            className="w-96 bg-white rounded-2xl p-6 shadow-xl"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <p className="font-bold text-on-surface text-base mb-1" style={soraFont}>
              Delete this card?
            </p>
            <p className="text-on-surface-variant text-sm mb-5" style={soraFont}>
              This action cannot be undone.
            </p>
            {deleteError && <p className="mb-3 text-sm text-red-500">{deleteError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setConfirmDeleteOpen(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button type="button" onClick={deleteCard} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null

  // ── Completed card ──────────────────────────────────────────────────────────
  if (isGreen) {
    return (
      <Draggable draggableId={card.id} index={index}>
        {(provided, snapshot) => (
          <>
            <div
              ref={provided.innerRef}
              style={{
                ...provided.draggableProps.style,
                opacity: snapshot.isDragging ? 0.6 : 1,
              }}
              {...provided.draggableProps}
              {...provided.dragHandleProps}
              className="group bg-green-50 rounded-xl p-4 border-t-2 border-green-400 shadow-sm relative"
            >
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                {role === "admin" && (
                  <button
                    type="button"
                    className="p-1 rounded text-outline hover:text-amber-500 transition-colors"
                    aria-label="Reopen"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); reopenCard() }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  className="p-1 rounded text-outline hover:text-red-500 transition-colors"
                  aria-label="Delete"
                  disabled={deleting}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); setDeleteError(null); setConfirmDeleteOpen(true) }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex items-start gap-2 mb-3">
                <CheckCircle2 className="text-green-500 h-4 w-4 mt-0.5 shrink-0" />
                <p className="text-sm text-on-surface line-through opacity-60" style={soraFont}>
                  {card.content}
                </p>
              </div>
              <p className="text-xs text-outline-variant" style={soraFont}>
                Completed {completedWhen ?? ""}
              </p>
            </div>
            {confirmDeleteModal}
          </>
        )}
      </Draggable>
    )
  }

  // ── Open card ───────────────────────────────────────────────────────────────
  return (
    <Draggable draggableId={card.id} index={index}>
      {(provided, snapshot) => (
        <>
          <div
            ref={provided.innerRef}
            style={{
              borderTop: "2px solid #6366f1",
              ...staleStyle,
              ...provided.draggableProps.style,
              opacity: snapshot.isDragging ? 0.6 : 1,
            }}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className="group bg-white rounded-xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 relative cursor-pointer"
          >
            <p className="text-sm font-medium text-on-surface mb-5 pr-16" style={soraFont}>
              {card.content}
              {isStale && daysOld >= 3 && (
                <span className="ml-2 text-xs text-amber-500 font-normal" style={soraFont}>
                  Overdue
                </span>
              )}
            </p>

            <div className="flex items-end justify-between">
              <p className="text-xs text-outline-variant" style={soraFont}>
                {when ?? ""}
              </p>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 items-center">
                <EditCardButton
                  cardId={card.id}
                  initialContent={card.content}
                  onSuccess={() => router.refresh()}
                />
                {role === "admin" && (
                  <button
                    type="button"
                    className="p-1 rounded text-outline hover:text-green-500 transition-colors"
                    aria-label="Mark complete"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); completeCard() }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  className="p-1 rounded text-outline hover:text-red-500 transition-colors"
                  aria-label="Delete"
                  disabled={deleting}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); setDeleteError(null); setConfirmDeleteOpen(true) }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
          {confirmDeleteModal}
        </>
      )}
    </Draggable>
  )
}