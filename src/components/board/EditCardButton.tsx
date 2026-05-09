"use client"

import { useState } from "react"
import { createPortal } from "react-dom"
import { Pencil } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type Props = {
  cardId: string
  initialContent: string
  onSuccess: () => void
}

export default function EditCardButton({
  cardId,
  initialContent,
  onSuccess,
}: Props) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState(initialContent)
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
      const res = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      })

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: string }
          | null
        throw new Error(payload?.error || "Failed to update card")
      }

      setOpen(false)
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
        className="text-outline hover:text-primary transition-colors"
        aria-label="Edit"
        onClick={(e) => {
          e.stopPropagation()
          setError(null)
          setContent(initialContent)
          setOpen(true)
        }}
      >
        <Pencil className="h-[16px] w-[16px]" />
      </button>

      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
              onClick={() => setOpen(false)}
            >
              <div
                className="w-[420px] min-w-[420px] rounded-lg border border-surface-variant bg-surface-container-lowest p-4 shadow-lg"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
              >
                <div className="font-h3 text-on-surface text-[16px] leading-[20px] mb-3 whitespace-nowrap">
                  Edit a card
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
                    {submitting ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
