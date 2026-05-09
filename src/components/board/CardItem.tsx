"use client"

import { CheckCircle2, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, type CSSProperties } from "react"
import { createPortal } from "react-dom"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

import EditCardButton from "@/components/board/EditCardButton"
import { Button } from "@/components/ui/button"

type Card = {
  id: string
  content: string
  owner_id: string
  status: string | null
  created_at?: string | null
}

type Props = {
  card: Card
  role: string
}

function formatWhen(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date)
}

export default function CardItem({ card, role }: Props) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id })

  const dndStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  }

  async function deleteCard() {
    setDeleteError(null)

    try {
      setDeleting(true)
      const res = await fetch(`/api/cards/${card.id}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: string }
          | null
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
    const res = await fetch(`/api/cards/${card.id}/complete`, {
      method: 'POST',
    })
    if (res.ok) router.refresh()
  }

  const isGreen = card.status === "green"
  const when = formatWhen(card.created_at)

  if (isGreen) {
    return (
      <div
        ref={setNodeRef}
        style={dndStyle}
        {...attributes}
        {...listeners}
        className="group bg-[#f0fdf4] rounded-lg border border-[#bbf7d0] shadow-[0_2px_4px_rgba(0,0,0,0.04)] p-md relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#22c55e]" />
        <div className="flex items-start gap-sm">
          <CheckCircle2 className="text-[#22c55e] h-[18px] w-[18px] mt-[2px]" />
          <p className="font-body-md text-on-surface line-through opacity-70">
            {card.content}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={dndStyle}
      {...attributes}
      {...listeners}
      className="group bg-surface-container-lowest rounded-lg border border-surface-variant shadow-[0_2px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_16px_rgba(0,0,0,0.08)] hover:-translate-y-[2px] transition-all duration-200 p-md relative overflow-hidden cursor-pointer"
    >
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-[var(--column-accent)] opacity-50" />
      <p className="font-body-md text-on-surface mb-sm">{card.content}</p>
      <div className="flex justify-between items-end mt-sm">
        <span className="font-label-sm text-outline-variant">{when ?? ""}</span>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-xs">
  
          <EditCardButton
            cardId={card.id}
            initialContent={card.content}
            onSuccess={() => router.refresh()}
          />

          {role === 'admin' && (
            <button
              type="button"
              className="text-outline hover:text-green-500 transition-colors"
              aria-label="Mark complete"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                completeCard()
              }}
            >
              <CheckCircle2 className="h-[16px] w-[16px]" />
            </button>
          )}

          {/* Delete button */}
          <button
            type="button"
            className="text-outline hover:text-destructive transition-colors disabled:opacity-50 disabled:hover:text-outline"
            aria-label="Delete"
            disabled={deleting}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              setDeleteError(null)
              setConfirmDeleteOpen(true)
            }}
          >
            <Trash2 className="h-[16px] w-[16px]" />
          </button>

        </div>
      </div>

      {confirmDeleteOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
              onClick={() => setConfirmDeleteOpen(false)}
            >
              <div
                className="w-[420px] min-w-[420px] rounded-lg border border-surface-variant bg-surface-container-lowest p-4 shadow-lg"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
              >
                <div className="font-h3 text-on-surface text-[16px] leading-[20px] mb-2 whitespace-nowrap">
                  Delete this card?
                </div>
                <div className="font-body-md text-on-surface-variant text-sm">
                  This action cannot be undone.
                </div>

                {deleteError ? (
                  <div className="mt-2 text-sm text-destructive">{deleteError}</div>
                ) : null}

                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setConfirmDeleteOpen(false)}
                    disabled={deleting}
                  >
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
        : null}
    </div>
  )
}
