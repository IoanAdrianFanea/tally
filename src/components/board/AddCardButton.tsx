"use client"

import { useState } from "react"
import { createPortal } from "react-dom"
import { Plus } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type Props = {
  ownerId: string
  teamId: string
  onSuccess: () => void
}

export default function AddCardButton({ ownerId, teamId, onSuccess }: Props) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    setError(null)

    const trimmed = content.trim()
    if (!trimmed) {
      setError("Please enter a card.")
      return
    }

    try {
      setSubmitting(true)
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed, owner_id: ownerId }),
      })

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: string }
          | null
        throw new Error(payload?.error || "Failed to create card")
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
      <button
        type="button"
        className="mt-xs text-outline hover:text-on-surface hover:bg-surface-container-low transition-colors font-body-md py-sm rounded-lg flex items-center justify-center gap-xs border border-transparent hover:border-surface-variant border-dashed w-full"
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
      >
        <Plus className="h-4.5 w-4.5" />
        Add card
      </button>

      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 p-4"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
              }}
            >
              <div
                className="w-105 min-w-105 rounded-lg border border-surface-variant bg-surface-container-lowest p-4 shadow-lg"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
              >
                <div className="font-h3 text-on-surface text-[16px] leading-[20px] mb-3 whitespace-nowrap">
                  Add a card
                </div>

                <div className="space-y-2">
                  <Input
                    value={content}
                    placeholder="Card content"
                    className="w-full"
                    onChange={(e) => setContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submit()
                    }}
                  />
                  {error ? (
                    <div className="text-sm text-destructive">{error}</div>
                  ) : null}
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={submit}
                    disabled={submitting}
                  >
                    {submitting ? "Submitting…" : "Submit"}
                  </Button>
                </div>

                {/* keep props referenced so they remain part of the public API */}
                <div className="sr-only" aria-hidden="true">
                  {ownerId} {teamId}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
