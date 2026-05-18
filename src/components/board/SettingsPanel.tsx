"use client"

import { useState } from "react"
import { createPortal } from "react-dom"
import { Settings, X } from "lucide-react"

import { Button } from "@/components/ui/button"

type Props = {
  isAdmin: boolean
}

export default function SettingsPanel({ isAdmin }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const confirmModal = confirmOpen
    ? createPortal(
        <div
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 p-4"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setConfirmOpen(false) }}
        >
          <div
            className="w-105 min-w-105 rounded-lg border border-surface-variant bg-surface-container-lowest p-4 shadow-lg"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="font-h3 text-on-surface text-[16px] leading-[20px] mb-2 whitespace-nowrap">
              Are you sure?
            </div>
            <div className="font-body-md text-on-surface-variant text-sm">
              This will archive all cards and reset the board. This cannot be undone.
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  // TODO: call archive endpoint here
                  console.log("archive triggered")
                  setConfirmOpen(false)
                  setIsOpen(false)
                }}
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null

  return (
    <>
      <button
        type="button"
        className="flex items-center gap-md px-3 py-[8px] rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all active:translate-x-1 duration-150"
        onClick={() => setIsOpen(true)}
        aria-expanded={isOpen}
        aria-controls="settings-panel"
      >
        <Settings className="h-[20px] w-[20px]" />
        <span className="font-body-md">Settings</span>
      </button>

      <div className={`fixed top-16 left-0 right-0 h-[calc(100vh-64px)] z-50 ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`}>
        <button
          type="button"
          className={`absolute inset-0 bg-black/20 transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setIsOpen(false)}
          aria-label="Close settings"
        />

        <aside
          id="settings-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Settings"
          className={`absolute right-0 top-0 h-full w-full sm:w-96 bg-surface-container-lowest border-l border-surface-variant shadow-[0_6px_24px_rgba(0,0,0,0.16)] flex flex-col transition-transform duration-300 ${isOpen ? "translate-x-0" : "translate-x-full"}`}
        >
          <div className="flex items-center justify-between px-md py-sm border-b border-surface-variant">
            <h2 className="font-h3 text-on-surface text-[16px]">Settings</h2>
            <button
              type="button"
              className="text-outline hover:text-on-surface transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container"
              onClick={() => setIsOpen(false)}
              aria-label="Close settings"
            >
              <X className="h-[18px] w-[18px]" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-md py-sm space-y-lg">
            {!isAdmin ? (
              <p className="text-outline text-sm">You don't have permission to access settings.</p>
            ) : (
              <section className="border border-surface-variant rounded-lg p-md bg-surface-container-low">
                <h3 className="text-on-surface font-semibold mb-sm">Month management</h3>
                <p className="text-outline text-sm mb-md">
                  Archive the current month and reset the board for a new month. This action cannot be undone.
                </p>
                <Button type="button" variant="destructive" onClick={() => setConfirmOpen(true)}>
                  Archive &amp; Reset Month
                </Button>
              </section>
            )}
          </div>
        </aside>
      </div>
      {confirmModal}
    </>
  )
}
