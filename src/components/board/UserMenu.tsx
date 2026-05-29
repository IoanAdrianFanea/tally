"use client"

import { useEffect, useRef, useState, type FocusEvent } from "react"

type Props = {
  displayName: string | null
  columnColor: string | null
}

function getInitials(name: string | null | undefined) {
  const trimmed = (name ?? "").trim()
  return trimmed ? trimmed[0]!.toUpperCase() : "?"
}

export default function UserMenu({ displayName, columnColor }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (!menuRef.current) return
      if (!menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleMouseDown)
    return () => document.removeEventListener("mousedown", handleMouseDown)
  }, [])

  const handleLogout = () => {
    window.location.assign("/auth/signout")
  }

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!menuRef.current?.contains(event.relatedTarget as Node | null)) {
      setIsOpen(false)
    }
  }

  return (
    <div
      className="relative"
      ref={menuRef}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={handleBlur}
    >
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-8 h-8 rounded-full border border-surface-variant object-cover flex items-center justify-center font-body-md font-semibold"
        style={{ backgroundColor: columnColor ?? undefined }}
        aria-label="User menu"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        {getInitials(displayName)}
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-full mt-0 bg-surface-container-lowest border border-surface-variant rounded-lg shadow-md p-1 min-w-32 z-50">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-surface-container"
          >
            Log out
          </button>
        </div>
      ) : null}
    </div>
  )
}
