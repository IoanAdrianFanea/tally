"use client"

import { useState } from "react"
import { createPortal } from "react-dom"
import { Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type Props = {
  ownerId: string
  onSuccess: () => void
}

export default function AddCardButton({ ownerId, onSuccess }: Props) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    setError(null)
    const trimmed = content.trim()
    if (!trimmed) { setError("Please enter a card."); return }

    try {
      setSubmitting(true)
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed, owner_id: ownerId }),
      })
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(p?.error || "Failed to create card")
      }
      setOpen(false)
      setContent("")
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Trigger — glass-friendly dashed button */}
      <button
        type="button"
        className="w-full flex items-center justify-center gap-1.5 py-2.5
          rounded-xl text-sm font-medium
          text-outline-variant
          hover:text-on-surface hover:bg-white/50
          border border-dashed border-white/40 hover:border-outline-variant/40
          transition-all duration-150"
        onClick={() => { setError(null); setOpen(true) }}
      >
        <Plus className="h-3.5 w-3.5" />
        Add card
      </button>

      {open ? createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/25 p-4"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setOpen(false) }}
        >
          <div
            className="w-96 bg-white rounded-2xl p-6 shadow-xl border border-outline-variant/10"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="font-bold text-on-surface text-base mb-4">Add a card</div>
            <div className="space-y-2 mb-5">
              <Input
                value={content}
                placeholder="What are you working on?"
                className="w-full"
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void submit() }}
                autoFocus
              />
              {error && <div className="text-sm text-red-500">{error}</div>}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void submit()} disabled={submitting}>
                {submitting ? "Adding…" : "Add card"}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </>
  )
}