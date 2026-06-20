"use client"

import { useRef, useState, useEffect } from "react"

type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w"

export type SectionData = {
  id: string
  x: number
  y: number
  width: number
  height: number
  name: string
  isDone: boolean
}

// ─── Done-section layout constants (shared with BoardCanvas) ─────────────────
export const DONE_PAD = 12
export const DONE_SECTION_HEADER = 34
export const DONE_COL_HEADER = 28
export const DONE_COL_GAP = 16
export const DONE_NOTE_GAP = 8
export const DONE_NOTE_W = 160
export const DONE_NOTE_H = 120

type Props = {
  section: SectionData
  scale: number
  editMode: boolean
  isSelected: boolean
  isMultiSelected?: boolean
  onSelect: () => void
  onChange: (updates: Partial<SectionData>) => void
  onDragStart: () => void
  onCommit: (pos: { x: number; y: number }) => void
  onCommitResize: (rect: { x: number; y: number; width: number; height: number }) => void
  onToggleDone: () => void
  doneColumns: Array<{ displayName: string; color: string }>
  minWidth?: number
  minHeight?: number
  onContextMenu?: (e: React.MouseEvent) => void
}

const MIN_SIZE = 80

const HANDLE_DEFS: { id: Handle; style: React.CSSProperties }[] = [
  { id: "nw", style: { top: -5, left: -5, cursor: "nw-resize" } },
  { id: "n",  style: { top: -5, left: "50%", transform: "translateX(-50%)", cursor: "n-resize" } },
  { id: "ne", style: { top: -5, right: -5, cursor: "ne-resize" } },
  { id: "e",  style: { top: "50%", right: -5, transform: "translateY(-50%)", cursor: "e-resize" } },
  { id: "se", style: { bottom: -5, right: -5, cursor: "se-resize" } },
  { id: "s",  style: { bottom: -5, left: "50%", transform: "translateX(-50%)", cursor: "s-resize" } },
  { id: "sw", style: { bottom: -5, left: -5, cursor: "sw-resize" } },
  { id: "w",  style: { top: "50%", left: -5, transform: "translateY(-50%)", cursor: "w-resize" } },
]

export default function CanvasSection({
  section,
  scale,
  editMode,
  isSelected,
  isMultiSelected,
  onSelect,
  onChange,
  onDragStart,
  onCommit,
  onCommitResize,
  onToggleDone,
  doneColumns,
  minWidth,
  minHeight,
  onContextMenu,
}: Props) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [nameValue, setNameValue] = useState(section.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setNameValue(section.name) }, [section.name])
  useEffect(() => { if (isRenaming) inputRef.current?.focus() }, [isRenaming])

  function commitRename() {
    setIsRenaming(false)
    onChange({ name: nameValue.trim() || "Container" })
  }

  function handleBodyMouseDown(e: React.MouseEvent) {
    if (!editMode) return
    e.stopPropagation()
    if (isRenaming) return
    if ((e.target as HTMLElement).hasAttribute("data-handle")) return
    e.preventDefault()

    onSelect()
    onDragStart()

    const startX = e.clientX
    const startY = e.clientY
    const origX = section.x
    const origY = section.y
    let currentX = origX
    let currentY = origY

    function onMove(me: MouseEvent) {
      currentX = origX + (me.clientX - startX) / scale
      currentY = origY + (me.clientY - startY) / scale
      onChange({ x: currentX, y: currentY })
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
      onCommit({ x: currentX, y: currentY })
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  function handleHandleMouseDown(e: React.MouseEvent, handle: Handle) {
    e.preventDefault()
    e.stopPropagation()

    const startX = e.clientX
    const startY = e.clientY
    const orig = { x: section.x, y: section.y, width: section.width, height: section.height }

    let finalRect = { ...orig }
    const effectiveMinW = Math.max(MIN_SIZE, minWidth ?? 0)
    const effectiveMinH = Math.max(MIN_SIZE, minHeight ?? 0)
    function onMove(me: MouseEvent) {
      const dx = (me.clientX - startX) / scale
      const dy = (me.clientY - startY) / scale
      let { x, y, width, height } = orig

      if (handle.includes("e")) width = Math.max(effectiveMinW, orig.width + dx)
      if (handle.includes("s")) height = Math.max(effectiveMinH, orig.height + dy)
      if (handle.includes("w")) {
        const newW = Math.max(effectiveMinW, orig.width - dx)
        x = orig.x + orig.width - newW
        width = newW
      }
      if (handle.includes("n")) {
        const newH = Math.max(effectiveMinH, orig.height - dy)
        y = orig.y + orig.height - newH
        height = newH
      }
      finalRect = { x, y, width, height }
      onChange(finalRect)
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
      onCommitResize(finalRect)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  return (
    <div
      style={{
        position: "absolute",
        left: section.x,
        top: section.y,
        width: section.width,
        height: section.height,
        backgroundColor: section.isDone
          ? "rgba(34, 197, 94, 0.06)"
          : "rgba(215, 215, 228, 0.52)",
        border:
          (isSelected || isMultiSelected) && editMode
            ? "2px solid #6366f1"
            : section.isDone
            ? "1.5px solid rgba(34, 197, 94, 0.45)"
            : "1.5px solid rgba(140, 140, 175, 0.4)",
        borderRadius: 10,
        boxSizing: "border-box",
        cursor: editMode ? ((isSelected || isMultiSelected) ? "move" : "pointer") : "default",
        userSelect: "none",
      }}
      onMouseDown={handleBodyMouseDown}
      onClick={(e) => {
        if (!editMode) return
        e.stopPropagation()
        onSelect()
      }}
      onContextMenu={(e) => {
        if (!editMode) return
        e.preventDefault()
        e.stopPropagation()
        onContextMenu?.(e)
      }}
    >
      {/* Name label — top-left */}
      <div style={{ position: "absolute", top: 7, left: 10, zIndex: 1 }}>
        {isRenaming && editMode ? (
          <input
            ref={inputRef}
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") commitRename()
            }}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#444",
              background: "rgba(255,255,255,0.75)",
              border: "none",
              borderBottom: "1px solid #aaa",
              outline: "none",
              width: 140,
              borderRadius: 2,
              padding: "1px 3px",
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: section.isDone ? "#16a34a" : "#666",
              cursor: editMode ? "text" : "default",
            }}
            onDoubleClick={(e) => {
              if (!editMode) return
              e.stopPropagation()
              setIsRenaming(true)
            }}
          >
            {section.name || "Container"}
          </span>
        )}
      </div>

      {/* Done toggle button — top-right, edit mode only */}
      {editMode && (
        <button
          style={{
            position: "absolute",
            top: 5,
            right: 8,
            fontSize: 10,
            fontWeight: 600,
            padding: "2px 7px",
            borderRadius: 8,
            border: `1.5px solid ${section.isDone ? "#22c55e" : "#ccc"}`,
            backgroundColor: section.isDone ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.8)",
            color: section.isDone ? "#16a34a" : "#888",
            cursor: "pointer",
            lineHeight: 1.4,
            zIndex: 3,
            fontFamily: "var(--font-sora, 'Sora', sans-serif)",
          }}
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault() }}
          onClick={(e) => { e.stopPropagation(); onToggleDone() }}
        >
          {section.isDone ? "✓ Done" : "Set as Done"}
        </button>
      )}

      {/* Column headers — shown inside done sections */}
      {section.isDone && doneColumns.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: DONE_SECTION_HEADER,
            left: DONE_PAD,
            display: "flex",
            gap: DONE_COL_GAP,
            zIndex: 1,
            pointerEvents: "none",
          }}
        >
          {doneColumns.map((col, i) => (
            <div
              key={i}
              style={{
                width: DONE_NOTE_W,
                height: DONE_COL_HEADER,
                display: "flex",
                alignItems: "center",
                gap: 6,
                paddingBottom: 4,
                borderBottom: `2px solid ${col.color}`,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: col.color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#555",
                  fontFamily: "var(--font-sora, 'Sora', sans-serif)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {col.displayName}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Resize handles — shown only when selected in edit mode */}
      {editMode &&
        isSelected &&
        HANDLE_DEFS.map(({ id, style }) => (
          <div
            key={id}
            data-handle={id}
            style={{
              position: "absolute",
              width: 10,
              height: 10,
              backgroundColor: "#6366f1",
              border: "1.5px solid white",
              borderRadius: 2,
              zIndex: 10,
              ...style,
            }}
            onMouseDown={(e) => handleHandleMouseDown(e, id)}
          />
        ))}
    </div>
  )
}
