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
}

type Props = {
  section: SectionData
  scale: number
  editMode: boolean
  isSelected: boolean
  onSelect: () => void
  onChange: (updates: Partial<SectionData>) => void
  onDragStart: () => void
  onCommit: (pos: { x: number; y: number }) => void
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
  onSelect,
  onChange,
  onDragStart,
  onCommit,
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

    function onMove(me: MouseEvent) {
      const dx = (me.clientX - startX) / scale
      const dy = (me.clientY - startY) / scale
      let { x, y, width, height } = orig

      if (handle.includes("e")) width = Math.max(MIN_SIZE, orig.width + dx)
      if (handle.includes("s")) height = Math.max(MIN_SIZE, orig.height + dy)
      if (handle.includes("w")) {
        const newW = Math.max(MIN_SIZE, orig.width - dx)
        x = orig.x + orig.width - newW
        width = newW
      }
      if (handle.includes("n")) {
        const newH = Math.max(MIN_SIZE, orig.height - dy)
        y = orig.y + orig.height - newH
        height = newH
      }
      onChange({ x, y, width, height })
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
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
        backgroundColor: "rgba(215, 215, 228, 0.52)",
        border:
          isSelected && editMode
            ? "2px solid #6366f1"
            : "1.5px solid rgba(140, 140, 175, 0.4)",
        borderRadius: 10,
        boxSizing: "border-box",
        cursor: editMode ? (isSelected ? "move" : "pointer") : "default",
        userSelect: "none",
      }}
      onMouseDown={handleBodyMouseDown}
      onClick={(e) => {
        if (!editMode) return
        e.stopPropagation()
        onSelect()
      }}
    >
      {/* Name label */}
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
              color: "#666",
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
