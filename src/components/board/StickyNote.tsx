"use client"

import { useRef, useState, useEffect } from "react"
import { X } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

export type CanvasCard = {
  id: string
  content: string
  owner_id: string
  x: number
  y: number
  status: string | null
}

type Props = {
  note: CanvasCard
  scale: number
  color: string
  canEdit: boolean
  autoEdit?: boolean
  onPositionCommit: (x: number, y: number) => void
  onContentSave: (content: string) => void
  onDelete: () => void
  onAutoEditDone?: () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "")
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean
  const bigint = parseInt(full, 16)
  if (isNaN(bigint)) return `rgba(100, 100, 200, ${alpha})`
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const NOTE_WIDTH = 160
const NOTE_HEIGHT = 120

// ─── Component ───────────────────────────────────────────────────────────────

export default function StickyNote({
  note,
  scale,
  color,
  canEdit,
  autoEdit,
  onPositionCommit,
  onContentSave,
  onDelete,
  onAutoEditDone,
}: Props) {
  const [localX, setLocalX] = useState(note.x)
  const [localY, setLocalY] = useState(note.y)
  const [content, setContent] = useState(note.content)
  const [isEditing, setIsEditing] = useState(autoEdit ?? false)
  const [isHovered, setIsHovered] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setLocalX(note.x) }, [note.x])
  useEffect(() => { setLocalY(note.y) }, [note.y])
  useEffect(() => { setContent(note.content) }, [note.content])

  useEffect(() => {
    if (isEditing) {
      textareaRef.current?.focus()
      textareaRef.current?.select()
    }
  }, [isEditing])

  // Commit editing when user clicks anywhere outside this note
  useEffect(() => {
    if (!isEditing) return
    function onDocMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        commitEdit()
      }
    }
    document.addEventListener("mousedown", onDocMouseDown, true)
    return () => document.removeEventListener("mousedown", onDocMouseDown, true)
  }, [isEditing, content])

  function commitEdit() {
    setIsEditing(false)
    onContentSave(content)
    onAutoEditDone?.()
  }

  const bgColor = hexToRgba(color, 0.18)
  const borderColor = hexToRgba(color, 0.5)

  function handleMouseDown(e: React.MouseEvent) {
    if (isEditing) return
    if (!canEdit) return
    if ((e.target as HTMLElement).dataset.delete) return
    e.preventDefault()
    e.stopPropagation()

    const startX = e.clientX
    const startY = e.clientY
    const origX = localX
    const origY = localY
    let currentX = origX
    let currentY = origY

    function onMove(me: MouseEvent) {
      currentX = origX + (me.clientX - startX) / scale
      currentY = origY + (me.clientY - startY) / scale
      setLocalX(currentX)
      setLocalY(currentY)
    }

    function onUp() {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
      onPositionCommit(currentX, currentY)
    }

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  function handleDoubleClick(e: React.MouseEvent) {
    if (!canEdit) return
    e.stopPropagation()
    setIsEditing(true)
  }

  function handleBlur() {
    commitEdit()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      setIsEditing(false)
      setContent(note.content)
      onAutoEditDone?.()
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      commitEdit()
    }
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        left: localX,
        top: localY,
        width: NOTE_WIDTH,
        height: NOTE_HEIGHT,
        backgroundColor: bgColor,
        border: `1.5px solid ${borderColor}`,
        borderRadius: 8,
        boxSizing: "border-box",
        cursor: canEdit && !isEditing ? "move" : "default",
        boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
        zIndex: 5,
        display: "flex",
        flexDirection: "column",
        padding: "8px 10px",
        userSelect: isEditing ? "text" : "none",
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Delete button — shown on hover */}
      {isHovered && canEdit && !isEditing && (
        <button
          data-delete="true"
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            width: 18,
            height: 18,
            borderRadius: "50%",
            backgroundColor: "rgba(0,0,0,0.15)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            lineHeight: 1,
          }}
          onMouseDown={(e) => {
            e.stopPropagation()
            e.preventDefault()
          }}
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          <X size={10} color="#555" />
        </button>
      )}

      {/* Content area */}
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            resize: "none",
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: 12,
            fontFamily: "var(--font-sora, 'Sora', sans-serif)",
            color: "#333",
            lineHeight: 1.5,
            padding: 0,
          }}
        />
      ) : (
        <p
          style={{
            flex: 1,
            margin: 0,
            fontSize: 12,
            fontFamily: "var(--font-sora, 'Sora', sans-serif)",
            color: content.trim() ? "#333" : "#aaa",
            fontStyle: content.trim() ? "normal" : "italic",
            lineHeight: 1.5,
            overflow: "hidden",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {content.trim() || "Double-click to edit…"}
        </p>
      )}
    </div>
  )
}
