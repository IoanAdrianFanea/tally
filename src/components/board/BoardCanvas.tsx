"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect, useRef, useState } from "react"
import { TransformWrapper, TransformComponent, useTransformContext, useTransformComponent, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch"

import { StickyNote as StickyNoteIcon, Navigation } from "lucide-react"
import CanvasSection, { type SectionData, DONE_PAD, DONE_SECTION_HEADER, DONE_COL_HEADER, DONE_COL_GAP, DONE_NOTE_GAP, DONE_NOTE_W, DONE_NOTE_H } from "@/components/board/CanvasSection"
import StickyNote, { type CanvasCard } from "@/components/board/StickyNote"

// ─── Types ────────────────────────────────────────────────────────────────────

type User = {
  id: string
  display_name: string
  team_id: string | null
  column_color: string | null
  role: string
  points?: number | null
}

type Card = {
  id: string
  content: string
  owner_id: string
  status: string | null
  x?: number | null
  y?: number | null
  section_id?: string | null
}

type Section = {
  id: string
  board_id: string
  team_id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  is_done_section: boolean
  position: number
}

type Props = {
  users: User[]
  cards: Card[]
  role: string
  currentUserId: string
  sections: Section[]
  boardId: string
}

type RectData = { x: number; y: number; width: number; height: number }

// ─── Overlap helper ──────────────────────────────────────────────────────────

function rectsOverlap(a: SectionData, b: SectionData): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CANVAS_WIDTH = 6000
const CANVAS_HEIGHT = 4000
const MIN_DRAW_SIZE = 40

const MINI_SIZE = 120          // circle diameter in px
const MINI_R = MINI_SIZE / 2   // circle radius
// How many canvas-px are shown per minimap-px at the base (unhoverd) zoom.
// Higher = more zoomed out.  2500 canvas-px maps to one minimap-radius.
const MINI_CONTEXT_BASE = 3000
const MINI_CONTEXT_HOVER = 2000

// ─── MinimapOverlay (standalone — no TransformWrapper hooks) ────────────────

type MinimapOverlayProps = {
  sections: SectionData[]
  notes: CanvasCard[]
  users: User[]
  positionX: number
  positionY: number
  scale: number
  vw: number
  vh: number
}

function MinimapOverlay({ sections, notes, users, positionX, positionY, scale: s, vw, vh }: MinimapOverlayProps) {
  const [hovered, setHovered] = useState(false)

  // Canvas coords of viewport center
  const vpCx = -positionX / s + vw / (2 * s)
  const vpCy = -positionY / s + vh / (2 * s)

  // The ratio used for base (constant position math) — based on zoomed-out context
  const baseRatio = MINI_R / MINI_CONTEXT_BASE
  // Content scale factor applied via CSS transform (hover zooms in)
  const contentScale = hovered ? MINI_CONTEXT_BASE / MINI_CONTEXT_HOVER : 1

  // Convert canvas coords → minimap coords (centered on viewport)
  function mx(cx: number) { return MINI_R + (cx - vpCx) * baseRatio }
  function my(cy: number) { return MINI_R + (cy - vpCy) * baseRatio }

  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        left: 16,
        zIndex: 40,
        width: MINI_SIZE,
        height: MINI_SIZE,
        borderRadius: "50%",
        overflow: "hidden",
        boxShadow: hovered
          ? "0 4px 18px rgba(0,0,0,0.18)"
          : "0 2px 10px rgba(0,0,0,0.12)",
        border: "1.5px solid rgba(140,140,175,0.35)",
        cursor: "default",
        pointerEvents: "auto",
        transition: "box-shadow 0.2s ease",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <svg width={MINI_SIZE} height={MINI_SIZE} style={{ display: "block" }}>
        {/* Background */}
        <circle cx={MINI_R} cy={MINI_R} r={MINI_R} fill="rgba(249,249,255,0.96)" />

        {/* Content group — CSS scale on hover zooms the map content in */}
        <g
          style={{
            transform: `translate(${MINI_R}px,${MINI_R}px) scale(${contentScale}) translate(-${MINI_R}px,-${MINI_R}px)`,
            transition: "transform 0.25s ease",
          }}
        >
          {/* Sections */}
          {sections.map((sec) => (
            <rect
              key={sec.id}
              x={mx(sec.x)}
              y={my(sec.y)}
              width={Math.max(1, sec.width * baseRatio)}
              height={Math.max(1, sec.height * baseRatio)}
              fill={sec.isDone ? "rgba(34,197,94,0.22)" : "rgba(215,215,228,0.7)"}
              stroke={sec.isDone ? "rgba(34,197,94,0.55)" : "rgba(140,140,175,0.5)"}
              strokeWidth={0.5}
              rx={0.5}
            />
          ))}

          {/* Notes */}
          {notes.map((n) => {
            const owner = users.find((u) => u.id === n.owner_id)
            const color = owner?.column_color ?? "#6366f1"
            return (
              <rect
                key={n.id}
                x={mx(n.x)}
                y={my(n.y)}
                width={Math.max(1.5, 160 * baseRatio)}
                height={Math.max(1, 120 * baseRatio)}
                fill={color}
                opacity={0.65}
                rx={0.5}
              />
            )
          })}
        </g>

        {/* Subtle vignette ring for depth */}
        <circle cx={MINI_R} cy={MINI_R} r={MINI_R - 0.75} fill="none" stroke="rgba(140,140,175,0.18)" strokeWidth={1.5} />
      </svg>
    </div>
  )
}

// ─── CanvasContent (must be defined at module scope, not inside BoardCanvas) ──

type CanvasContentProps = {
  editMode: boolean
  role: string
  sections: SectionData[]
  selectedSectionId: string | null
  onSelectSection: (id: string | null) => void
  selectedNoteIds: Set<string>
  onNoteSelect: (id: string, addToSelection: boolean) => void
  onClearNoteSelection: () => void
  onNoteContextMenu: (id: string, screenX: number, screenY: number) => void
  onSectionContextMenu: (id: string, screenX: number, screenY: number) => void
  onGroupDragCommit: (dx: number, dy: number) => void
  onLassoSelect: (ids: string[]) => void
  onLassoSelectSections: (ids: string[], anchorInLasso: boolean) => void
  selectedSectionIds: Set<string>
  anchorSelected: boolean
  draggingSectionDelta: {
    dx: number; dy: number
    origSections: Array<{ sectionId: string; origX: number; origY: number; origWidth: number; origHeight: number }>
  } | null
  hasClipboard: boolean
  pendingRect: RectData | null
  onPendingRect: (r: RectData | null) => void
  onShowContextMenu: (x: number, y: number, rect: RectData) => void
  onIsDrawing: (v: boolean) => void
  onUpdateSection: (id: string, updates: Partial<SectionData>) => void
  onSectionDragStart: () => void
  onCommitSection: (id: string, pos: { x: number; y: number }) => void
  onCommitSectionResize: (id: string, rect: { x: number; y: number; width: number; height: number }) => void
  onToggleSectionDone: (id: string) => void
  doneSectionColumns: Record<string, Array<{ displayName: string; color: string }>>
  users: User[]
  currentUserId: string
  boardId: string
  canvasNotes: CanvasCard[]
  autoEditNoteId: string | null
  onAutoEditDone: () => void
  onUpdateNotePosition: (id: string, x: number, y: number) => void
  onUpdateNoteContent: (id: string, content: string) => void
  onDeleteNote: (id: string) => void
  onShowCanvasContextMenu: (screenX: number, screenY: number, canvasX: number, canvasY: number) => void
  anchor: { x: number; y: number } | null
  onAnchorMove: (pos: { x: number; y: number }) => void
  onAnchorDelete: () => void
}

function CanvasContent({
  editMode,
  role,
  sections,
  selectedSectionId,
  onSelectSection,
  selectedNoteIds,
  onNoteSelect,
  onClearNoteSelection,
  onNoteContextMenu,
  onSectionContextMenu,
  onGroupDragCommit,
  onLassoSelect,
  onLassoSelectSections,
  selectedSectionIds,
  anchorSelected,
  draggingSectionDelta,
  hasClipboard,
  pendingRect,
  onPendingRect,
  onShowContextMenu,
  onIsDrawing,
  onUpdateSection,
  onSectionDragStart,
  onCommitSection,
  onCommitSectionResize,
  onToggleSectionDone,
  doneSectionColumns,
  users,
  currentUserId,
  boardId,
  canvasNotes,
  autoEditNoteId,
  onAutoEditDone,
  onUpdateNotePosition,
  onUpdateNoteContent,
  onDeleteNote,
  onShowCanvasContextMenu,
  anchor,
  onAnchorMove,
  onAnchorDelete,
}: CanvasContentProps) {
  const ctx = useTransformContext()
  // Reactive scale for rendering (re-renders CanvasContent when zoom changes)
  const scale = useTransformComponent(({ state }) => state.scale)
  const scaleRef = useRef(scale)
  useEffect(() => { scaleRef.current = scale }, [scale])

  const contentRef = useRef<HTMLDivElement>(null)
  const drawStateRef = useRef<{
    startX: number; startY: number; currentX: number; currentY: number
  } | null>(null)

  const [drawRect, setDrawRect] = useState<RectData | null>(null)
  const [isAnchorHovered, setIsAnchorHovered] = useState(false)
  const [groupDragDelta, setGroupDragDelta] = useState<{ x: number; y: number } | null>(null)
  const lassoRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null)
  const [lassoRect, setLassoRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const didLassoDragRef = useRef(false)

  // ── Per-section min sizes (based on contained card positions) ──
  const NOTE_W_INNER = 160
  const NOTE_H_INNER = 120
  const CONTENT_PAD = 20
  const sectionMinSizes: Record<string, { minWidth: number; minHeight: number }> = {}
  for (const section of sections) {
    const notesInSection = canvasNotes.filter((n) => n.section_id === section.id)
    if (notesInSection.length === 0) continue
    let maxRelRight = NOTE_W_INNER + CONTENT_PAD
    let maxRelBottom = NOTE_H_INNER + CONTENT_PAD
    for (const note of notesInSection) {
      maxRelRight = Math.max(maxRelRight, note.x - section.x + NOTE_W_INNER + CONTENT_PAD)
      maxRelBottom = Math.max(maxRelBottom, note.y - section.y + NOTE_H_INNER + CONTENT_PAD)
    }
    sectionMinSizes[section.id] = { minWidth: maxRelRight, minHeight: maxRelBottom }
  }

  function handleAnchorMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const origX = anchor!.x
    const origY = anchor!.y
    function onMove(me: MouseEvent) {
      onAnchorMove({ x: origX + (me.clientX - startX) / scaleRef.current, y: origY + (me.clientY - startY) / scaleRef.current })
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  useEffect(() => {
    if (!editMode) onSelectSection(null)
  }, [editMode])

  function getCanvasCoords(clientX: number, clientY: number) {
    const rect = contentRef.current!.getBoundingClientRect()
    return {
      x: (clientX - rect.left) / scaleRef.current,
      y: (clientY - rect.top) / scaleRef.current,
    }
  }

  function handleLassoStart(e: React.MouseEvent) {
    e.preventDefault()
    const startCoords = getCanvasCoords(e.clientX, e.clientY)
    didLassoDragRef.current = false

    function onMove(me: MouseEvent) {
      const c = getCanvasCoords(me.clientX, me.clientY)
      const lasso = {
        x: Math.min(startCoords.x, c.x),
        y: Math.min(startCoords.y, c.y),
        w: Math.abs(c.x - startCoords.x),
        h: Math.abs(c.y - startCoords.y),
      }
      if (lasso.w > 5 || lasso.h > 5) {
        didLassoDragRef.current = true
        lassoRectRef.current = lasso
        setLassoRect(lasso)
      }
    }

    function onUp() {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
      const lasso = lassoRectRef.current
      if (lasso && didLassoDragRef.current) {
        if (editMode) {
          // Edit mode: select sections and anchor
          const sectionIds = sections
            .filter((s) =>
              s.x + s.width > lasso.x && s.x < lasso.x + lasso.w &&
              s.y + s.height > lasso.y && s.y < lasso.y + lasso.h
            )
            .map((s) => s.id)
          const anchorInLasso = anchor !== null &&
            anchor.x >= lasso.x && anchor.x <= lasso.x + lasso.w &&
            anchor.y >= lasso.y && anchor.y <= lasso.y + lasso.h
          onLassoSelectSections(sectionIds, anchorInLasso)
        } else {
          // Normal mode: select notes
          const NOTE_W = 160
          const NOTE_H = 120
          const ids = canvasNotes
            .filter((n) =>
              n.x + NOTE_W > lasso.x && n.x < lasso.x + lasso.w &&
              n.y + NOTE_H > lasso.y && n.y < lasso.y + lasso.h
            )
            .map((n) => n.id)
          onLassoSelect(ids)
        }
      }
      lassoRectRef.current = null
      setLassoRect(null)
    }

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  function handleGroupDragStart(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY

    function onMove(me: MouseEvent) {
      const dx = (me.clientX - startX) / scaleRef.current
      const dy = (me.clientY - startY) / scaleRef.current
      setGroupDragDelta({ x: dx, y: dy })
    }

    function onUp(me: MouseEvent) {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
      const dx = (me.clientX - startX) / scaleRef.current
      const dy = (me.clientY - startY) / scaleRef.current
      setGroupDragDelta(null)
      onGroupDragCommit(dx, dy)
    }

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  function handleMouseDown(e: React.MouseEvent) {
    // Right-click drag = lasso select in any mode
    if (e.button === 2) {
      handleLassoStart(e)
      return
    }

    // Non-edit mode: plain left-click = clear selection
    if (!editMode) {
      if (e.button === 0 && !e.ctrlKey && !e.metaKey) {
        onClearNoteSelection()
      }
      return
    }

    // Edit mode: left-click drag draws a section rect (original logic)
    if (e.button !== 0) return
    onSelectSection(null)
    onClearNoteSelection()
    onPendingRect(null)

    const coords = getCanvasCoords(e.clientX, e.clientY)
    drawStateRef.current = {
      startX: coords.x, startY: coords.y,
      currentX: coords.x, currentY: coords.y,
    }
    setDrawRect(null)
    onIsDrawing(true)

    function onMove(me: MouseEvent) {
      if (!drawStateRef.current) return
      const c = getCanvasCoords(me.clientX, me.clientY)
      drawStateRef.current = { ...drawStateRef.current, currentX: c.x, currentY: c.y }
      const ds = drawStateRef.current
      setDrawRect({
        x: Math.min(ds.startX, ds.currentX),
        y: Math.min(ds.startY, ds.currentY),
        width: Math.abs(ds.currentX - ds.startX),
        height: Math.abs(ds.currentY - ds.startY),
      })
    }

    function onUp(me: MouseEvent) {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
      onIsDrawing(false)
      const ds = drawStateRef.current
      drawStateRef.current = null
      setDrawRect(null)
      if (!ds) return
      const x = Math.min(ds.startX, ds.currentX)
      const y = Math.min(ds.startY, ds.currentY)
      const width = Math.abs(ds.currentX - ds.startX)
      const height = Math.abs(ds.currentY - ds.startY)
      if (width >= MIN_DRAW_SIZE && height >= MIN_DRAW_SIZE) {
        const rect = { x, y, width, height }
        onPendingRect(rect)
        onShowContextMenu(me.clientX, me.clientY, rect)
      }
    }

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  return (
    <div
      ref={contentRef}
      style={{
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        position: "relative",
        cursor: editMode ? "crosshair" : "default",
        backgroundColor: "#f9f9fc",
        backgroundImage: "radial-gradient(circle, rgba(100, 100, 160, 0.22) 1.5px, transparent 1.5px)",
        backgroundSize: "28px 28px",
        boxShadow: "0 0 0 1px rgba(100, 100, 160, 0.25), 0 8px 40px rgba(0,0,0,0.10)",
      }}
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => {
        e.preventDefault()
        // Suppress context menu when right-click was a lasso drag
        if (didLassoDragRef.current) {
          didLassoDragRef.current = false
          return
        }
        if (pendingRect) return
        // Show menu when in edit mode OR when there's something to paste
        if (!editMode && !hasClipboard) return
        const coords = getCanvasCoords(e.clientX, e.clientY)
        onShowCanvasContextMenu(e.clientX, e.clientY, coords.x, coords.y)
      }}
    >

      {/* ── Sections ── */}
      {sections.map((s) => (
        <CanvasSection
          key={s.id}
          section={s}
          scale={scale}
          editMode={editMode}
          isSelected={selectedSectionId === s.id}
          isMultiSelected={selectedSectionIds.has(s.id)}
          onSelect={() => onSelectSection(s.id)}
          onChange={(updates) => onUpdateSection(s.id, updates)}
          onDragStart={onSectionDragStart}
          onCommit={(pos) => onCommitSection(s.id, pos)}
          onCommitResize={(rect) => onCommitSectionResize(s.id, rect)}
          onToggleDone={() => onToggleSectionDone(s.id)}
          doneColumns={doneSectionColumns[s.id] ?? []}
          minWidth={sectionMinSizes[s.id]?.minWidth}
          minHeight={sectionMinSizes[s.id]?.minHeight}
          onContextMenu={(e) => onSectionContextMenu(s.id, e.clientX, e.clientY)}
        />
      ))}

      {/* ── Sticky notes ── */}
      {canvasNotes.map((note) => {
        const owner = users.find((u) => u.id === note.owner_id)
        const color = owner?.column_color ?? "#6366f1"
        const canEdit = note.owner_id === currentUserId || role === "admin"
        const noteSection = note.section_id ? sections.find((s) => s.id === note.section_id) : null
        const canMove = canEdit
        const isNoteSelected = selectedNoteIds.has(note.id)
        const isMultiSel = isNoteSelected && selectedNoteIds.size > 1
        let sectionDragDelta: { x: number; y: number } | undefined
        if (draggingSectionDelta) {
          const { dx, dy, origSections } = draggingSectionDelta
          const cx = note.x + 80
          const cy = note.y + 60
          for (const sec of origSections) {
            if (cx >= sec.origX && cx <= sec.origX + sec.origWidth && cy >= sec.origY && cy <= sec.origY + sec.origHeight) {
              sectionDragDelta = { x: dx, y: dy }
              break
            }
          }
        }
        return (
          <StickyNote
            key={note.id}
            note={note}
            scale={scale}
            color={color}
            canEdit={canEdit}
            canMove={canMove}
            isSelected={isNoteSelected}
            isMultiSelected={isMultiSel}
            externalDragDelta={isMultiSel && groupDragDelta ? groupDragDelta : sectionDragDelta}
            autoEdit={note.id === autoEditNoteId}
            onSelect={(addToSelection) => onNoteSelect(note.id, addToSelection)}
            onMultiDragStart={handleGroupDragStart}
            onContextMenu={(e) => onNoteContextMenu(note.id, e.clientX, e.clientY)}
            onPositionCommit={(x, y) => onUpdateNotePosition(note.id, x, y)}
            onContentSave={(content) => onUpdateNoteContent(note.id, content)}
            onDelete={() => onDeleteNote(note.id)}
            onAutoEditDone={onAutoEditDone}
          />
        )
      })}

      {/* ── Draw preview (while actively dragging) ── */}
      {drawRect && drawRect.width > 4 && drawRect.height > 4 && (
        <div
          style={{
            position: "absolute",
            left: drawRect.x,
            top: drawRect.y,
            width: drawRect.width,
            height: drawRect.height,
            border: "2px dashed #6366f1",
            backgroundColor: "rgba(99, 102, 241, 0.06)",
            borderRadius: 6,
            pointerEvents: "none",
            zIndex: 20,
          }}
        />
      )}

      {/* ── Pending rect (drawn, awaiting right-click confirm) ── */}
      {pendingRect && !drawRect && (
        <div
          style={{
            position: "absolute",
            left: pendingRect.x,
            top: pendingRect.y,
            width: pendingRect.width,
            height: pendingRect.height,
            border: "2px dashed #6366f1",
            backgroundColor: "rgba(99, 102, 241, 0.06)",
            borderRadius: 6,
            pointerEvents: "none",
            zIndex: 20,
          }}
        />
      )}

      {/* ── Lasso selection rect ── */}
      {lassoRect && lassoRect.w > 4 && lassoRect.h > 4 && (
        <div
          style={{
            position: "absolute",
            left: lassoRect.x,
            top: lassoRect.y,
            width: lassoRect.w,
            height: lassoRect.h,
            border: "2px dashed #6366f1",
            backgroundColor: "rgba(99, 102, 241, 0.08)",
            borderRadius: 4,
            pointerEvents: "none",
            zIndex: 25,
          }}
        />
      )}

      {/* ── Anchor marker (edit mode only) ── */}
      {editMode && anchor && (
        <div
          style={{
            position: "absolute",
            left: anchor.x - 14,
            top: anchor.y - 14,
            width: 28,
            height: 28,
            zIndex: 60,
            cursor: "move",
            userSelect: "none",
            borderRadius: "50%",
            outline: anchorSelected ? "2px solid #6366f1" : "none",
            outlineOffset: 3,
          }}
          onMouseDown={handleAnchorMouseDown}
          onMouseEnter={() => setIsAnchorHovered(true)}
          onMouseLeave={() => setIsAnchorHovered(false)}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation() }}
        >
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ display: "block" }}>
            <circle cx="14" cy="14" r="12" fill="rgba(234,179,8,0.18)" stroke="#eab308" strokeWidth="1.5" />
            <line x1="9" y1="9" x2="19" y2="19" stroke="#eab308" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="19" y1="9" x2="9" y2="19" stroke="#eab308" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          {/* Delete button on hover */}
          {isAnchorHovered && (
            <div
              style={{
                position: "absolute",
                top: -8,
                right: -8,
                width: 18,
                height: 18,
                borderRadius: "50%",
                backgroundColor: "#ef4444",
                color: "white",
                fontSize: 12,
                fontWeight: 700,
                lineHeight: "18px",
                textAlign: "center",
                cursor: "pointer",
                boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
              }}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
              onClick={(e) => { e.stopPropagation(); onAnchorDelete() }}
            >
              ×
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── BoardCanvas ──────────────────────────────────────────────────────────────

export default function BoardCanvas({
  users,
  cards,
  role,
  currentUserId,
  sections: _dbSections,
  boardId,
}: Props) {

  // ── Card state ──
  const [canvasNotes, setCanvasNotes] = useState<CanvasCard[]>(
    cards
      .map((c) => ({ id: c.id, content: c.content, owner_id: c.owner_id, x: c.x ?? 0, y: c.y ?? 0, status: c.status, section_id: c.section_id }))
  )
  const [autoEditNoteId, setAutoEditNoteId] = useState<string | null>(null)

  useEffect(() => {
    setCanvasNotes(
      cards
        .map((c) => ({ id: c.id, content: c.content, owner_id: c.owner_id, x: c.x ?? 0, y: c.y ?? 0, status: c.status, section_id: c.section_id }))
    )
  }, [cards.length, cards.map((c) => c.id + c.status + c.content + c.x + c.y).join(",")])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("cards-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "cards" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const newCard = payload.new as Card
          setCanvasNotes((prev) => {
            if (prev.some((n) => n.id === newCard.id)) return prev
            return [...prev, { id: newCard.id, content: newCard.content, owner_id: newCard.owner_id, x: newCard.x ?? 0, y: newCard.y ?? 0, status: newCard.status, section_id: newCard.section_id }]
          })
        }
        if (payload.eventType === "UPDATE") {
          const updated = payload.new as Card
          setCanvasNotes((prev) =>
            prev.map((n) =>
              n.id === updated.id
                ? { id: updated.id, content: updated.content, owner_id: updated.owner_id, x: updated.x ?? 0, y: updated.y ?? 0, status: updated.status, section_id: updated.section_id }
                : n
            )
          )
        }
        if (payload.eventType === "DELETE") {
          setCanvasNotes((prev) => prev.filter((n) => n.id !== (payload.old as Card).id))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [boardId])

  // ── Auto-center on mount ──
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!transformRef.current || !outerRef.current) return
      const vw = outerRef.current.clientWidth
      const vh = outerRef.current.clientHeight
      if (anchor) {
        // Anchor set: jump to it
        transformRef.current.setTransform(vw / 2 - anchor.x, vh / 2 - anchor.y, 1, 0, "easeOut")
      } else {
        // No anchor: always center on the middle of the canvas
        transformRef.current.setTransform(
          vw / 2 - CANVAS_WIDTH / 2,
          vh / 2 - CANVAS_HEIGHT / 2,
          1, 0, "easeOut"
        )
      }
    }, 150)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Edit mode + canvas sections state ──
  const [editMode, setEditMode] = useState(false)
  const [canvasSections, setCanvasSections] = useState<SectionData[]>(
    _dbSections.map((s) => ({ id: s.id, name: s.name, x: s.x, y: s.y, width: s.width, height: s.height, isDone: s.is_done_section }))
  )
  const [pendingRect, setPendingRect] = useState<RectData | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; rect: RectData } | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [canvasRightClickMenu, setCanvasRightClickMenu] = useState<{
    screenX: number; screenY: number; canvasX: number; canvasY: number
  } | null>(null)

  const transformRef = useRef<ReactZoomPanPinchRef>(null)
  const outerRef = useRef<HTMLDivElement>(null)
  const [transformState, setTransformState] = useState({ positionX: 0, positionY: 0, scale: 1 })
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(() => {
    if (typeof window === "undefined") return null
    try {
      const stored = localStorage.getItem(`anchor_${boardId}`)
      return stored ? JSON.parse(stored) : null
    } catch { return null }
  })

  // ── Selection + undo ──
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [selectedSectionIds, setSelectedSectionIds] = useState<Set<string>>(new Set())
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set())
  const [draggingSectionDelta, setDraggingSectionDelta] = useState<{
    dx: number; dy: number
    origSections: Array<{ sectionId: string; origX: number; origY: number; origWidth: number; origHeight: number }>
  } | null>(null)
  const [clipboardCards, setClipboardCards] = useState<Array<{
    content: string
    owner_id: string
    relX: number
    relY: number
  }> | null>(null)
  const [clipboardSection, setClipboardSection] = useState<{
    name: string
    width: number
    height: number
    cards: Array<{ content: string; owner_id: string; relX: number; relY: number }>
  } | null>(null)
  const [noteContextMenu, setNoteContextMenu] = useState<{
    screenX: number
    screenY: number
    noteIds: string[]
  } | null>(null)
  const [sectionContextMenu, setSectionContextMenu] = useState<{
    screenX: number
    screenY: number
    sectionId: string
  } | null>(null)
  const [deleteConfirmSectionId, setDeleteConfirmSectionId] = useState<string | null>(null)
  const sectionUndoStack = useRef<SectionData[][]>([])
  const cardUndoStack = useRef<CanvasCard[][]>([])
  const [anchorSelected, setAnchorSelected] = useState(false)
  const anchorBeforeDragRef = useRef<{ x: number; y: number } | null>(null)

  function pushUndo() {
    sectionUndoStack.current = [...sectionUndoStack.current.slice(-19), canvasSections]
  }

  // ── Keyboard: Delete + Ctrl+Z + Ctrl+C + Ctrl+V ──
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedSectionIds.size > 0 && editMode) {
          e.preventDefault()
          const idsToDelete = [...selectedSectionIds]
          setSelectedSectionIds(new Set())
          for (const sid of idsToDelete) handleDeleteSection(sid)
          return
        }
        if (selectedSectionId && editMode) {
          e.preventDefault()
          setDeleteConfirmSectionId(selectedSectionId)
          return
        }
        if (selectedNoteIds.size > 0) {
          e.preventDefault()
          // Push whole batch as one undo entry before deleting
          const toDelete = canvasNotes.filter((n) => selectedNoteIds.has(n.id))
          if (toDelete.length > 0) cardUndoStack.current = [...cardUndoStack.current.slice(-19), toDelete]
          for (const id of selectedNoteIds) handleDeleteNote(id, true)
          setSelectedNoteIds(new Set())
          return
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        if (selectedNoteIds.size > 0) {
          e.preventDefault()
          handleCopySelected()
        } else if (selectedSectionId && editMode && selectedSectionIds.size <= 1) {
          e.preventDefault()
          handleCopySection(selectedSectionId)
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        if (clipboardCards && clipboardCards.length > 0) {
          e.preventDefault()
          handlePaste()
        } else if (clipboardSection) {
          e.preventDefault()
          handlePasteSection()
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !editMode) {
        e.preventDefault()
        const stack = cardUndoStack.current
        if (stack.length === 0) return
        const batch = stack[stack.length - 1]!
        cardUndoStack.current = stack.slice(0, -1)
        ;(async () => {
          const results = await Promise.all(
            batch.map(async (note) => {
              const res = await fetch("/api/cards", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  content: note.content || " ",
                  board_id: boardId,
                  owner_id: note.owner_id,
                  x: note.x,
                  y: note.y,
                  section_id: note.section_id ?? null,
                }),
              })
              if (!res.ok) return null
              return res.json()
            })
          )
          const restored = results.filter(Boolean)
          if (restored.length === 0) return
          setCanvasNotes((prev) => [
            ...prev,
            ...restored.map((c: Record<string, unknown>) => ({
              id: c.id as string,
              content: (c.content as string)?.trim() ?? "",
              owner_id: c.owner_id as string,
              x: (c.x as number) ?? 0,
              y: (c.y as number) ?? 0,
              status: c.status as "open" | "done",
              section_id: (c.section_id as string) ?? undefined,
            })),
          ])
        })()
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && editMode) {
        e.preventDefault()
        const stack = sectionUndoStack.current
        if (stack.length === 0) return
        const prev = stack[stack.length - 1]!
        sectionUndoStack.current = stack.slice(0, -1)
        // Restore sections and re-sync each to DB
        setCanvasSections(prev)
        for (const s of prev) {
          fetch(`/api/sections/${s.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ x: s.x, y: s.y, width: s.width, height: s.height, name: s.name, is_done_section: s.isDone }),
          })
        }
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [editMode, selectedSectionId, selectedSectionIds, selectedNoteIds, canvasSections, clipboardCards, clipboardSection])

  function handleNoteSelect(id: string, addToSelection: boolean) {
    if (addToSelection) {
      setSelectedNoteIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    } else {
      setSelectedNoteIds(new Set([id]))
    }
  }

  function handleCopySelected(overrideIds?: string[]) {
    const ids = overrideIds ?? [...selectedNoteIds]
    const selected = canvasNotes.filter((n) => ids.includes(n.id))
    if (selected.length === 0) return
    const centX = selected.reduce((sum, n) => sum + n.x, 0) / selected.length
    const centY = selected.reduce((sum, n) => sum + n.y, 0) / selected.length
    setClipboardCards(
      selected.map((n) => ({
        content: n.content,
        owner_id: n.owner_id,
        relX: n.x - centX,
        relY: n.y - centY,
      }))
    )
  }

  async function handlePaste(targetX?: number, targetY?: number) {
    if (!clipboardCards || clipboardCards.length === 0) return
    let cx: number, cy: number
    if (targetX !== undefined && targetY !== undefined) {
      cx = targetX
      cy = targetY
    } else {
      const vw = outerRef.current?.clientWidth ?? 800
      const vh = outerRef.current?.clientHeight ?? 600
      cx = (-transformState.positionX + vw / 2) / transformState.scale
      cy = (-transformState.positionY + vh / 2) / transformState.scale
    }
    const tempNotes: CanvasCard[] = clipboardCards.map((card) => ({
      id: crypto.randomUUID(),
      content: card.content,
      owner_id: currentUserId,
      x: cx + card.relX,
      y: cy + card.relY,
      status: "open" as const,
      section_id: null,
    }))
    setCanvasNotes((prev) => [...prev, ...tempNotes])
    // Select the pasted cards
    setSelectedNoteIds(new Set(tempNotes.map((n) => n.id)))

    const results = await Promise.all(
      tempNotes.map((n) =>
        fetch("/api/cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: n.content, board_id: boardId, x: n.x, y: n.y }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    )
    setCanvasNotes((prev) =>
      prev.map((n) => {
        const idx = tempNotes.findIndex((t) => t.id === n.id)
        if (idx === -1) return n
        const saved = results[idx]
        if (!saved) return n
        return {
          id: saved.id,
          content: saved.content?.trim() ?? n.content,
          owner_id: saved.owner_id,
          x: saved.x ?? n.x,
          y: saved.y ?? n.y,
          status: saved.status ?? "open",
          section_id: saved.section_id ?? null,
        }
      })
    )
    // Update selection to use real IDs
    setSelectedNoteIds((prev) => {
      const tempIds = new Set(tempNotes.map((t) => t.id))
      const next = new Set([...prev].filter((id) => !tempIds.has(id)))
      results.forEach((s) => { if (s?.id) next.add(s.id) })
      return next
    })
  }

  async function handleGroupDragCommit(dx: number, dy: number) {
    const updates = canvasNotes
      .filter((n) => selectedNoteIds.has(n.id))
      .map((n) => ({ id: n.id, x: n.x + dx, y: n.y + dy }))
    setCanvasNotes((prev) =>
      prev.map((n) => {
        const u = updates.find((u) => u.id === n.id)
        return u ? { ...n, x: u.x, y: u.y } : n
      })
    )
    await Promise.all(
      updates.map((u) =>
        fetch(`/api/cards/${u.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ x: u.x, y: u.y }),
        })
      )
    )
  }

  function handleNoteContextMenu(id: string, screenX: number, screenY: number) {
    if (!selectedNoteIds.has(id)) {
      setSelectedNoteIds(new Set([id]))
      setNoteContextMenu({ screenX, screenY, noteIds: [id] })
    } else {
      setNoteContextMenu({ screenX, screenY, noteIds: [...selectedNoteIds] })
    }
  }

  function handleCopySection(sectionId: string) {
    const section = canvasSections.find((s) => s.id === sectionId)
    if (!section) return
    const sectionCards = canvasNotes.filter((n) => n.section_id === sectionId)
    setClipboardSection({
      name: section.name,
      width: section.width,
      height: section.height,
      cards: sectionCards.map((n) => ({
        content: n.content,
        owner_id: n.owner_id,
        relX: n.x - section.x,
        relY: n.y - section.y,
      })),
    })
  }

  async function handlePasteSection(targetCenterX?: number, targetCenterY?: number) {
    if (!clipboardSection) return
    let cx: number, cy: number
    if (targetCenterX !== undefined && targetCenterY !== undefined) {
      cx = targetCenterX
      cy = targetCenterY
    } else {
      const vw = outerRef.current?.clientWidth ?? 800
      const vh = outerRef.current?.clientHeight ?? 600
      cx = (-transformState.positionX + vw / 2) / transformState.scale
      cy = (-transformState.positionY + vh / 2) / transformState.scale
    }
    const x = cx - clipboardSection.width / 2
    const y = cy - clipboardSection.height / 2
    const copyName = clipboardSection.name.endsWith(" (copy)")
      ? clipboardSection.name
      : `${clipboardSection.name} (copy)`

    const tempId = crypto.randomUUID()
    const optimistic: SectionData = {
      id: tempId,
      name: copyName,
      x,
      y,
      width: clipboardSection.width,
      height: clipboardSection.height,
      isDone: false,
    }
    setCanvasSections((prev) => [...prev, optimistic])

    const res = await fetch("/api/sections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        board_id: boardId,
        name: copyName,
        x,
        y,
        width: clipboardSection.width,
        height: clipboardSection.height,
      }),
    })

    if (!res.ok) {
      setCanvasSections((prev) => prev.filter((s) => s.id !== tempId))
      return
    }

    const savedSection = await res.json()
    setCanvasSections((prev) =>
      prev.map((s) => (s.id === tempId ? { ...s, id: savedSection.id } : s))
    )

    if (clipboardSection.cards.length > 0) {
      const tempCards: CanvasCard[] = clipboardSection.cards.map((card) => ({
        id: crypto.randomUUID(),
        content: card.content,
        owner_id: currentUserId,
        x: x + card.relX,
        y: y + card.relY,
        status: "open" as const,
        section_id: savedSection.id,
      }))
      setCanvasNotes((prev) => [...prev, ...tempCards])

      const cardResults = await Promise.all(
        tempCards.map((n) =>
          fetch("/api/cards", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content: n.content,
              board_id: boardId,
              x: n.x,
              y: n.y,
              section_id: savedSection.id,
            }),
          })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
        )
      )

      setCanvasNotes((prev) =>
        prev.map((n) => {
          const idx = tempCards.findIndex((t) => t.id === n.id)
          if (idx === -1) return n
          const saved = cardResults[idx]
          if (!saved) return n
          return {
            id: saved.id,
            content: saved.content?.trim() ?? n.content,
            owner_id: saved.owner_id,
            x: saved.x ?? n.x,
            y: saved.y ?? n.y,
            status: "open" as const,
            section_id: savedSection.id,
          }
        })
      )
    }
  }

  function handleSectionContextMenu(sectionId: string, screenX: number, screenY: number) {
    setSelectedSectionId(sectionId)
    setSectionContextMenu({ screenX, screenY, sectionId })
  }

  function handleSelectSection(id: string | null) {
    setSelectedSectionId(id)
    setSelectedSectionIds(new Set())
    setAnchorSelected(false)
  }

  function handleLassoSelectSections(ids: string[], anchorInLasso: boolean) {
    setSelectedSectionIds(new Set(ids))
    setAnchorSelected(anchorInLasso)
    if (ids.length > 0) setSelectedSectionId(ids[ids.length - 1])
  }

  function handleSetAnchor(canvasX: number, canvasY: number) {
    const a = { x: canvasX, y: canvasY }
    setAnchor(a)
    setCanvasRightClickMenu(null)
    try { localStorage.setItem(`anchor_${boardId}`, JSON.stringify(a)) } catch {}
  }

  function handleAnchorMove(pos: { x: number; y: number }) {
    setAnchor(pos)
    try { localStorage.setItem(`anchor_${boardId}`, JSON.stringify(pos)) } catch {}
  }

  function handleAnchorDelete() {
    setAnchor(null)
    try { localStorage.removeItem(`anchor_${boardId}`) } catch {}
  }

  function handleGoToAnchor() {
    if (!anchor || !transformRef.current || !outerRef.current) return
    const vw = outerRef.current.clientWidth
    const vh = outerRef.current.clientHeight
    transformRef.current.setTransform(vw / 2 - anchor.x, vh / 2 - anchor.y, 1, 600, "easeOut")
  }

  async function handleDeleteSection(id: string) {
    setDeleteConfirmSectionId(null)
    setSelectedSectionId(null)
    // Free all cards in section (clear section_id)
    const notesInSection = canvasNotes.filter((n) => n.section_id === id)
    setCanvasNotes((prev) => prev.map((n) => n.section_id === id ? { ...n, section_id: null } : n))
    setCanvasSections((prev) => prev.filter((s) => s.id !== id))
    await fetch(`/api/sections/${id}`, { method: "DELETE" }).catch(() => {})
    // Clear section_id on all cards that were in this section
    await Promise.all(
      notesInSection.map((n) =>
        fetch(`/api/cards/${n.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ section_id: null }),
        })
      )
    )
  }



  async function handleCreateSection() {
    if (!contextMenu) return
    const { rect } = contextMenu
    // Optimistic: add with a temp id immediately
    const tempId = crypto.randomUUID()
    const optimistic: SectionData = { id: tempId, name: "Container", ...rect, isDone: false }
    setCanvasSections((prev) => [...prev, optimistic])
    setPendingRect(null)
    setContextMenu(null)

    const res = await fetch("/api/sections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        board_id: boardId,
        name: "Container",
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      }),
    })

    if (res.ok) {
      const saved = await res.json()
      // Replace temp id with real DB id
      setCanvasSections((prev) =>
        prev.map((s) => (s.id === tempId ? { ...s, id: saved.id } : s))
      )
    } else {
      // Rollback on failure
      setCanvasSections((prev) => prev.filter((s) => s.id !== tempId))
    }
  }

  function handleUpdateSection(id: string, updates: Partial<SectionData>) {
    // Only push undo for name changes (position/resize have their own commit)
    if (updates.name !== undefined) pushUndo()

    if (updates.x !== undefined || updates.y !== undefined) {
      const orig = sectionsBeforeDragRef.current.find((s) => s.id === id)
      if (orig) {
        const dx = (updates.x ?? orig.x) - orig.x
        const dy = (updates.y ?? orig.y) - orig.y

        if (selectedSectionIds.has(id) && selectedSectionIds.size > 1) {
          // Multi-section group drag: apply same delta to every selected section
          setCanvasSections((prev) =>
            prev.map((s) => {
              if (s.id === id) return { ...s, ...updates }
              if (selectedSectionIds.has(s.id)) {
                const origS = sectionsBeforeDragRef.current.find((os) => os.id === s.id)
                if (origS) return { ...s, x: origS.x + dx, y: origS.y + dy }
              }
              return s
            })
          )
          const origSections = [...selectedSectionIds].map((sid) => {
            const os = sectionsBeforeDragRef.current.find((s) => s.id === sid)!
            return { sectionId: sid, origX: os.x, origY: os.y, origWidth: os.width, origHeight: os.height }
          })
          setDraggingSectionDelta({ dx, dy, origSections })
          // Move anchor along with group drag (live)
          if (anchorSelected && anchorBeforeDragRef.current) {
            setAnchor({ x: anchorBeforeDragRef.current.x + dx, y: anchorBeforeDragRef.current.y + dy })
          }
          return
        }

        // Single section drag
        setCanvasSections((prev) =>
          prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
        )
        setDraggingSectionDelta({
          dx, dy,
          origSections: [{ sectionId: id, origX: orig.x, origY: orig.y, origWidth: orig.width, origHeight: orig.height }],
        })
        return
      }
    }

    setCanvasSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    )
    // Name is only set on commitRename — persist immediately
    if (updates.name !== undefined) {
      fetch(`/api/sections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: updates.name }),
      })
    }
  }

  const sectionsBeforeDragRef = useRef<SectionData[]>([])

  function handleSectionDragStart() {
    sectionsBeforeDragRef.current = canvasSections
    anchorBeforeDragRef.current = anchor
    setDraggingSectionDelta(null)
  }

  function handleCommitSection(id: string, pos: { x: number; y: number }) {
    const orig = sectionsBeforeDragRef.current.find((s) => s.id === id)
    if (!orig) { setDraggingSectionDelta(null); return }

    const isGroupDrag = selectedSectionIds.has(id) && selectedSectionIds.size > 1

    if (isGroupDrag) {
      const dx = pos.x - orig.x
      const dy = pos.y - orig.y
      const groupOrigs = [...selectedSectionIds].map((sid) => sectionsBeforeDragRef.current.find((s) => s.id === sid)!)
      const nonSelected = sectionsBeforeDragRef.current.filter((s) => !selectedSectionIds.has(s.id))

      // Check each moved section against non-selected sections for overlap
      const hasOverlap = groupOrigs.some((os) => {
        const moved = { ...os, x: os.x + dx, y: os.y + dy }
        return nonSelected.some((other) => rectsOverlap(moved, other))
      })

      if (hasOverlap) {
        setCanvasSections(sectionsBeforeDragRef.current)
        setDraggingSectionDelta(null)
        return
      }

      pushUndo()
      setDraggingSectionDelta(null)

      // Commit anchor move if it was part of the group selection
      if (anchorSelected && anchorBeforeDragRef.current) {
        const newAnchor = { x: anchorBeforeDragRef.current.x + dx, y: anchorBeforeDragRef.current.y + dy }
        setAnchor(newAnchor)
        try { localStorage.setItem(`anchor_${boardId}`, JSON.stringify(newAnchor)) } catch {}
      }

      // Persist all selected sections to DB
      Promise.all(
        groupOrigs.map((os) =>
          fetch(`/api/sections/${os.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ x: os.x + dx, y: os.y + dy }),
          })
        )
      )

      // Move cards physically inside any selected section
      if (dx !== 0 || dy !== 0) {
        const notesInSections = canvasNotes.filter((n) => {
          const cx = n.x + 80
          const cy = n.y + 60
          return groupOrigs.some((os) => cx >= os.x && cx <= os.x + os.width && cy >= os.y && cy <= os.y + os.height)
        })
        if (notesInSections.length > 0) {
          const movedNotes = notesInSections.map((n) => ({ ...n, x: n.x + dx, y: n.y + dy }))
          setCanvasNotes((prev) => prev.map((n) => movedNotes.find((m) => m.id === n.id) ?? n))
          Promise.all(
            movedNotes.map((n) =>
              fetch(`/api/cards/${n.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ x: n.x, y: n.y }),
              })
            )
          )
        }
      }
      return
    }

    // Single section drag
    const moved = { ...orig, ...pos }
    const others = sectionsBeforeDragRef.current.filter((s) => s.id !== id)
    if (others.some((other) => rectsOverlap(moved, other))) {
      setCanvasSections(sectionsBeforeDragRef.current)
      setDraggingSectionDelta(null)
      return
    }
    pushUndo()
    fetch(`/api/sections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ x: pos.x, y: pos.y }),
    })
    const dx = pos.x - orig.x
    const dy = pos.y - orig.y
    setDraggingSectionDelta(null)
    if (dx !== 0 || dy !== 0) {
      const notesInSection = canvasNotes.filter((n) => {
        const cx = n.x + 80
        const cy = n.y + 60
        return cx >= orig.x && cx <= orig.x + orig.width &&
               cy >= orig.y && cy <= orig.y + orig.height
      })
      if (notesInSection.length > 0) {
        const movedNotes = notesInSection.map((n) => ({ ...n, x: n.x + dx, y: n.y + dy }))
        setCanvasNotes((prev) =>
          prev.map((n) => movedNotes.find((m) => m.id === n.id) ?? n)
        )
        Promise.all(
          movedNotes.map((n) =>
            fetch(`/api/cards/${n.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ x: n.x, y: n.y }),
            })
          )
        )
      }
    }
  }

  async function handleToggleSectionDone(id: string) {
    const section = canvasSections.find((s) => s.id === id)
    if (!section) return
    const newIsDone = !section.isDone

    if (newIsDone) {
      // Collect notes physically inside this section's bounds
      const notesInSection = canvasNotes.filter(
        (n) =>
          n.x >= section.x &&
          n.x + DONE_NOTE_W <= section.x + section.width &&
          n.y >= section.y &&
          n.y + DONE_NOTE_H <= section.y + section.height
      )

      // Group by owner (stable insertion order)
      const ownerIds = [...new Set(notesInSection.map((n) => n.owner_id))]
      const byOwner: Record<string, CanvasCard[]> = {}
      for (const ownerId of ownerIds) {
        byOwner[ownerId] = notesInSection.filter((n) => n.owner_id === ownerId)
      }

      const maxNotes = ownerIds.length > 0
        ? Math.max(...ownerIds.map((o) => byOwner[o].length))
        : 0

      // Required size — expand section if needed
      const requiredW =
        DONE_PAD * 2 + ownerIds.length * DONE_NOTE_W + Math.max(0, ownerIds.length - 1) * DONE_COL_GAP
      const requiredH =
        DONE_SECTION_HEADER + DONE_PAD + DONE_COL_HEADER + maxNotes * (DONE_NOTE_H + DONE_NOTE_GAP)

      const newWidth = Math.max(section.width, requiredW)
      const newHeight = Math.max(section.height, requiredH)

      // Compute new absolute positions for each note
      const posUpdates: Array<{ id: string; x: number; y: number; section_id: string }> = []
      ownerIds.forEach((ownerId, colIdx) => {
        byOwner[ownerId].forEach((note, noteIdx) => {
          posUpdates.push({
            id: note.id,
            x: section.x + DONE_PAD + colIdx * (DONE_NOTE_W + DONE_COL_GAP),
            y: section.y + DONE_SECTION_HEADER + DONE_PAD + DONE_COL_HEADER + noteIdx * (DONE_NOTE_H + DONE_NOTE_GAP),
            section_id: id,
          })
        })
      })

      // Optimistic state update
      setCanvasSections((prev) =>
        prev.map((s) => s.id === id ? { ...s, isDone: true, width: newWidth, height: newHeight } : s)
      )
      setCanvasNotes((prev) =>
        prev.map((n) => {
          const u = posUpdates.find((p) => p.id === n.id)
          return u ? { ...n, x: u.x, y: u.y, section_id: u.section_id, status: "green" } : n
        })
      )

      // Persist
      await fetch(`/api/sections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_done_section: true, width: newWidth, height: newHeight }),
      })
      const completedAtNow = new Date().toISOString()
      await Promise.all(
        posUpdates.map((u) =>
          fetch(`/api/cards/${u.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ x: u.x, y: u.y, section_id: u.section_id, status: "green", completed_at: completedAtNow }),
          })
        )
      )
    } else {
      // Unmark as done — keep notes where they are, revert status to open
      const notesInSection = canvasNotes.filter((n) => n.section_id === id)
      setCanvasSections((prev) =>
        prev.map((s) => s.id === id ? { ...s, isDone: false } : s)
      )
      setCanvasNotes((prev) =>
        prev.map((n) => n.section_id === id ? { ...n, status: "open" } : n)
      )
      await fetch(`/api/sections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_done_section: false }),
      })
      await Promise.all(
        notesInSection.map((n) =>
          fetch(`/api/cards/${n.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "open", completed_at: null }),
          })
        )
      )
    }
  }

  function handleCommitSectionResize(id: string, rect: { x: number; y: number; width: number; height: number }) {
    pushUndo()
    fetch(`/api/sections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rect),
    })
    // Re-layout notes in done section to match new origin
    const section = canvasSections.find((s) => s.id === id)
    if (section?.isDone) {
      // Build snapshot with updated section geometry
      const updatedSections = canvasSections.map((s) => s.id === id ? { ...s, ...rect } : s)
      setCanvasSections(updatedSections)
      // Re-layout notes relative to new section origin
      const notesInSection = canvasNotes.filter((n) => n.section_id === id)
      const ownerIds = [...new Set(notesInSection.map((n) => n.owner_id))]
      const posUpdates: Array<{ id: string; x: number; y: number }> = []
      const baseY = rect.y + DONE_SECTION_HEADER + DONE_PAD + DONE_COL_HEADER
      ownerIds.forEach((ownerId, colIdx) => {
        notesInSection
          .filter((n) => n.owner_id === ownerId)
          .forEach((n, rowIdx) => {
            posUpdates.push({
              id: n.id,
              x: rect.x + DONE_PAD + colIdx * (DONE_NOTE_W + DONE_COL_GAP),
              y: baseY + rowIdx * (DONE_NOTE_H + DONE_NOTE_GAP),
            })
          })
      })
      if (posUpdates.length > 0) {
        setCanvasNotes((prev) =>
          prev.map((n) => {
            const u = posUpdates.find((p) => p.id === n.id)
            return u ? { ...n, x: u.x, y: u.y } : n
          })
        )
        Promise.all(
          posUpdates.map((u) =>
            fetch(`/api/cards/${u.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ x: u.x, y: u.y }),
            })
          )
        )
      }
    }
  }

  function toggleEditMode() {
    setEditMode((v) => !v)
    setPendingRect(null)
    setContextMenu(null)
    setSelectedSectionId(null)
    setSelectedSectionIds(new Set())
    setSelectedNoteIds(new Set())
    setDraggingSectionDelta(null)
    setAnchorSelected(false)
    sectionUndoStack.current = []
  }

  // ── Canvas note handlers ──

  async function handleAddNote() {
    // Compute canvas position so the note appears just left of the button panel
    // at the current viewport scroll/zoom — independent of where the canvas is.
    const NOTE_W = 160
    const NOTE_H = 120
    const vw = outerRef.current?.clientWidth ?? 800
    const vh = outerRef.current?.clientHeight ?? 600
    const { positionX, positionY, scale } = transformState
    // Button panel: right: 16, button width: 40, gap between note and button: 12
    const buttonAreaWidth = 16 + 40 + 12
    // Note right edge aligns with left of button area; note centered vertically on button
    const noteRightScreen = vw - buttonAreaWidth
    const noteCenterYScreen = vh / 2
    const rawX = (noteRightScreen - positionX) / scale - NOTE_W
    const rawY = (noteCenterYScreen - positionY) / scale - NOTE_H / 2
    const x = Math.max(0, Math.min(CANVAS_WIDTH - NOTE_W, Math.round(rawX)))
    const y = Math.max(0, Math.min(CANVAS_HEIGHT - NOTE_H, Math.round(rawY)))

    // Check if spawn position is inside a section and assign section_id
    const spawnCx = x + 80
    const spawnCy = y + 60
    const spawnSection = canvasSections.find(
      (s) => spawnCx >= s.x && spawnCx <= s.x + s.width && spawnCy >= s.y && spawnCy <= s.y + s.height
    )
    const spawnSectionId = spawnSection?.id ?? null

    const tempId = crypto.randomUUID()
    const newNote: CanvasCard = {
      id: tempId,
      content: "",
      owner_id: currentUserId,
      x,
      y,
      status: "open",
      section_id: spawnSectionId ?? undefined,
    }
    setCanvasNotes((prev) => [...prev, newNote])
    setAutoEditNoteId(tempId)

    const res = await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: " ", board_id: boardId, x, y, section_id: spawnSectionId }),
    })

    if (res.ok) {
      const saved = await res.json()
      setCanvasNotes((prev) =>
        prev.map((n) =>
          n.id === tempId
            ? { id: saved.id, content: saved.content?.trim() ?? "", owner_id: saved.owner_id, x: saved.x ?? x, y: saved.y ?? y, status: saved.status, section_id: saved.section_id ?? null }
            : n
        )
      )
      setAutoEditNoteId(saved.id)
    } else {
      setCanvasNotes((prev) => prev.filter((n) => n.id !== tempId))
      setAutoEditNoteId(null)
    }
  }

  // Re-layout all notes still in a done section after one leaves (collapses gaps)
  function reLayoutDoneSection(sectionId: string, notesSnapshot: CanvasCard[]) {
    const section = canvasSections.find((s) => s.id === sectionId)
    if (!section) return
    const remaining = notesSnapshot.filter((n) => n.section_id === sectionId)
    const ownerIds = [...new Set(remaining.map((n) => n.owner_id))]

    const posUpdates: Array<{ id: string; x: number; y: number }> = []
    ownerIds.forEach((ownerId, colIdx) => {
      remaining
        .filter((n) => n.owner_id === ownerId)
        .forEach((note, noteIdx) => {
          posUpdates.push({
            id: note.id,
            x: section.x + DONE_PAD + colIdx * (DONE_NOTE_W + DONE_COL_GAP),
            y:
              section.y +
              DONE_SECTION_HEADER +
              DONE_PAD +
              DONE_COL_HEADER +
              noteIdx * (DONE_NOTE_H + DONE_NOTE_GAP),
          })
        })
    })

    setCanvasNotes((prev) =>
      prev.map((n) => {
        const u = posUpdates.find((p) => p.id === n.id)
        return u ? { ...n, x: u.x, y: u.y } : n
      })
    )
    Promise.all(
      posUpdates.map((u) =>
        fetch(`/api/cards/${u.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ x: u.x, y: u.y }),
        })
      )
    )
  }

  async function handleUpdateNotePosition(id: string, x: number, y: number) {
    // Use center-point of the note to detect the containing section
    const cx = x + DONE_NOTE_W / 2
    const cy = y + DONE_NOTE_H / 2
    const containingSection = canvasSections.find(
      (s) => cx >= s.x && cx <= s.x + s.width && cy >= s.y && cy <= s.y + s.height
    )

    // Note's previous done section (if any) — needed for re-layout on exit
    const prevNote = canvasNotes.find((n) => n.id === id)
    const prevDoneSectionId =
      prevNote?.section_id &&
      canvasSections.find((s) => s.id === prevNote.section_id)?.isDone
        ? prevNote.section_id
        : null

    if (containingSection?.isDone) {
      const note = canvasNotes.find((n) => n.id === id)
      if (!note) return

      // All other notes already in this done section
      const otherNotes = canvasNotes.filter(
        (n) => n.section_id === containingSection.id && n.id !== id
      )

      // Column order — preserve existing owners, append this note's owner if new
      const ownerIds = [...new Set(otherNotes.map((n) => n.owner_id))]
      if (!ownerIds.includes(note.owner_id)) ownerIds.push(note.owner_id)

      // Compute insert row from the dropped y position
      const baseY = containingSection.y + DONE_SECTION_HEADER + DONE_PAD + DONE_COL_HEADER
      const notesInOwnerCol = otherNotes.filter((n) => n.owner_id === note.owner_id)
      const rawIdx = Math.round((y - baseY) / (DONE_NOTE_H + DONE_NOTE_GAP))
      const insertIdx = Math.max(0, Math.min(rawIdx, notesInOwnerCol.length))

      // Build ordered note list for the whole section with the moved note inserted
      const noteWithSection = { ...note, section_id: containingSection.id }
      const allSectionNotes: CanvasCard[] = []
      for (const ownerId of ownerIds) {
        const col = otherNotes.filter((n) => n.owner_id === ownerId)
        if (ownerId === note.owner_id) col.splice(insertIdx, 0, noteWithSection)
        allSectionNotes.push(...col)
      }

      // Compute absolute grid positions for every note in the section
      const posUpdates: Array<{ id: string; x: number; y: number; section_id: string }> = []
      ownerIds.forEach((ownerId, colIdx) => {
        allSectionNotes
          .filter((n) => n.owner_id === ownerId)
          .forEach((n, rowIdx) => {
            posUpdates.push({
              id: n.id,
              x: containingSection.x + DONE_PAD + colIdx * (DONE_NOTE_W + DONE_COL_GAP),
              y: baseY + rowIdx * (DONE_NOTE_H + DONE_NOTE_GAP),
              section_id: containingSection.id,
            })
          })
      })

      // Expand section only if needed
      const maxRows = ownerIds.length
        ? Math.max(...ownerIds.map((o) => allSectionNotes.filter((n) => n.owner_id === o).length))
        : 0
      const requiredW =
        DONE_PAD * 2 + ownerIds.length * DONE_NOTE_W + Math.max(0, ownerIds.length - 1) * DONE_COL_GAP
      const requiredH =
        DONE_SECTION_HEADER + DONE_PAD + DONE_COL_HEADER + maxRows * (DONE_NOTE_H + DONE_NOTE_GAP)
      const newWidth = Math.max(containingSection.width, requiredW)
      const newHeight = Math.max(containingSection.height, requiredH)

      // Optimistic state — update every note in the section at once
      setCanvasNotes((prev) =>
        prev.map((n) => {
          const u = posUpdates.find((p) => p.id === n.id)
          if (!u) return n
          return { ...n, x: u.x, y: u.y, section_id: u.section_id, ...(n.id === id ? { status: "green" } : {}) }
        })
      )
      if (newWidth !== containingSection.width || newHeight !== containingSection.height) {
        setCanvasSections((prev) =>
          prev.map((s) =>
            s.id === containingSection.id ? { ...s, width: newWidth, height: newHeight } : s
          )
        )
        fetch(`/api/sections/${containingSection.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ width: newWidth, height: newHeight }),
        })
      }

      const completedAt = new Date().toISOString()
      await Promise.all(
        posUpdates.map((u) => {
          const statusFields = u.id === id ? { status: "green", completed_at: completedAt } : {}
          return fetch(`/api/cards/${u.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ x: u.x, y: u.y, section_id: u.section_id, ...statusFields }),
          })
        })
      )
      if (prevDoneSectionId && prevDoneSectionId !== containingSection.id) {
        const afterMove = canvasNotes.map((n) =>
          n.id === id ? { ...n, section_id: containingSection.id } : n
        )
        reLayoutDoneSection(prevDoneSectionId, afterMove)
      }
    } else {
      // Free placement — drop outside any done section
      const section_id = containingSection?.id ?? null
      const statusFields = prevDoneSectionId ? { status: "open" as const } : {}
      setCanvasNotes((prev) => prev.map((n) => (n.id === id ? { ...n, x, y, section_id, ...statusFields } : n)))
      await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x, y, section_id, ...(prevDoneSectionId ? { status: "open", completed_at: null } : {}) }),
      })

      // Re-layout remaining notes in the old done section
      if (prevDoneSectionId) {
        const afterMove = canvasNotes.map((n) =>
          n.id === id ? { ...n, x, y, section_id } : n
        )
        reLayoutDoneSection(prevDoneSectionId, afterMove)
      }
    }
  }

  async function handleUpdateNoteContent(id: string, content: string) {
    const stored = content.trim() || " "
    setCanvasNotes((prev) => prev.map((n) => (n.id === id ? { ...n, content: content.trim() } : n)))
    await fetch(`/api/cards/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: stored }),
    })
  }

  async function handleDeleteNote(id: string, suppressUndoPush = false) {
    if (!suppressUndoPush) {
      setCanvasNotes((prev) => {
        const note = prev.find((n) => n.id === id)
        if (note) cardUndoStack.current = [...cardUndoStack.current.slice(-19), [note]]
        return prev.filter((n) => n.id !== id)
      })
    } else {
      setCanvasNotes((prev) => prev.filter((n) => n.id !== id))
    }
    await fetch(`/api/cards/${id}`, { method: "DELETE" })
  }

  // ── Derived ──
  const doneSectionColumns: Record<string, Array<{ displayName: string; color: string }>> = {}
  for (const section of canvasSections) {
    if (!section.isDone) continue
    const notesInSection = canvasNotes.filter((n) => n.section_id === section.id)
    const ownerIds = [...new Set(notesInSection.map((n) => n.owner_id))]
    doneSectionColumns[section.id] = ownerIds.map((ownerId) => {
      const user = users.find((u) => u.id === ownerId)
      return { displayName: user?.display_name ?? "Unknown", color: user?.column_color ?? "#6366f1" }
    })
  }

  return (
    <div
      ref={outerRef}
      className="h-full w-full overflow-hidden rounded-xl relative"
      style={{
        backgroundColor: "#e8e8f0",
        ...(editMode ? { boxShadow: "inset 0 0 0 2px rgba(99, 102, 241, 0.45)" } : {}),
      }}
    >
      {/* ── Edit mode vignette tint ── */}
      {editMode && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, rgba(99,102,241,0.05) 0%, transparent 14%, transparent 86%, rgba(99,102,241,0.05) 100%)",
            pointerEvents: "none",
            zIndex: 30,
            borderRadius: "inherit",
          }}
        />
      )}

      <TransformWrapper
        ref={transformRef}
        initialScale={1}
        minScale={0.25}
        maxScale={2.5}
        limitToBounds={false}
        panning={{ disabled: isDrawing, velocityDisabled: true, allowRightClickPan: false }}
        smooth={true}
        wheel={{ step: 0.0015 }}
        doubleClick={{ disabled: true }}
        onTransform={(_ref, state) => setTransformState({ positionX: state.positionX, positionY: state.positionY, scale: state.scale })}
      >
        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
          <CanvasContent
            editMode={editMode}
            role={role}
            sections={canvasSections}
            selectedSectionId={selectedSectionId}
            onSelectSection={handleSelectSection}
            selectedSectionIds={selectedSectionIds}
            selectedNoteIds={selectedNoteIds}
            onNoteSelect={handleNoteSelect}
            onClearNoteSelection={() => setSelectedNoteIds(new Set())}
            onNoteContextMenu={handleNoteContextMenu}
            onSectionContextMenu={handleSectionContextMenu}
            onGroupDragCommit={handleGroupDragCommit}
            onLassoSelect={(ids) => setSelectedNoteIds(new Set(ids))}
            onLassoSelectSections={handleLassoSelectSections}
            anchorSelected={anchorSelected}
            draggingSectionDelta={draggingSectionDelta}
            hasClipboard={(clipboardCards !== null && clipboardCards.length > 0) || clipboardSection !== null}
            pendingRect={pendingRect}
            onPendingRect={setPendingRect}
            onShowContextMenu={(x, y, rect) => setContextMenu({ x, y, rect })}
            onIsDrawing={setIsDrawing}
            onUpdateSection={handleUpdateSection}
            onSectionDragStart={handleSectionDragStart}
            onCommitSection={handleCommitSection}
            onCommitSectionResize={handleCommitSectionResize}
            onToggleSectionDone={handleToggleSectionDone}
            doneSectionColumns={doneSectionColumns}
            users={users}
            currentUserId={currentUserId}
            boardId={boardId}
            canvasNotes={canvasNotes}
            autoEditNoteId={autoEditNoteId}
            onAutoEditDone={() => setAutoEditNoteId(null)}
            onUpdateNotePosition={handleUpdateNotePosition}
            onUpdateNoteContent={handleUpdateNoteContent}
            onDeleteNote={handleDeleteNote}
            onShowCanvasContextMenu={(sx, sy, cx, cy) => setCanvasRightClickMenu({ screenX: sx, screenY: sy, canvasX: cx, canvasY: cy })}
            anchor={anchor}
            onAnchorMove={handleAnchorMove}
            onAnchorDelete={handleAnchorDelete}
          />
        </TransformComponent>
      </TransformWrapper>

      {/* ── Minimap ── */}
      <MinimapOverlay
        sections={canvasSections}
        notes={canvasNotes}
        users={users}
        positionX={transformState.positionX}
        positionY={transformState.positionY}
        scale={transformState.scale}
        vw={outerRef.current?.clientWidth ?? 0}
        vh={outerRef.current?.clientHeight ?? 0}
      />

      {/* ── Right-side floating buttons ── */}
      <div
        style={{
          position: "absolute",
          right: 16,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          alignItems: "center",
          zIndex: 40,
        }}
      >
        {/* Add note button — visible to all users */}
        <button
          onClick={handleAddNote}
          title="Add sticky note"
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            backgroundColor: "white",
            color: "#6366f1",
            border: "2px solid #6366f1",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            transition: "background-color 0.15s, color 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#6366f1"
            e.currentTarget.style.color = "white"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "white"
            e.currentTarget.style.color = "#6366f1"
          }}
        >
          <StickyNoteIcon size={18} />
        </button>

        {/* Go to anchor button — visible when anchor is set */}
        {anchor && (
          <button
            onClick={handleGoToAnchor}
            title="Return to anchor"
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              backgroundColor: "white",
              color: "#6366f1",
              border: "2px solid #6366f1",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
              transition: "background-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#6366f1"
              e.currentTarget.style.color = "white"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "white"
              e.currentTarget.style.color = "#6366f1"
            }}
          >
            <Navigation size={18} />
          </button>
        )}

        {/* Edit mode toggle — admin only */}
        {role === "admin" && (
          <button
            onClick={toggleEditMode}
            title={editMode ? "Exit edit mode" : "Enter edit mode"}
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              backgroundColor: editMode ? "#6366f1" : "white",
              color: editMode ? "white" : "#6366f1",
              border: "2px solid #6366f1",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: editMode ? 22 : 24,
              fontWeight: 600,
              boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
              transition: "background-color 0.15s, color 0.15s",
              lineHeight: 1,
            }}
          >
            {editMode ? "×" : "+"}
          </button>
        )}
      </div>

      {/* ── Context menu ── */}
      {contextMenu && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 99 }}
            onMouseDown={() => setContextMenu(null)}
          />
          <div
            style={{
              position: "fixed",
              left: contextMenu.x,
              top: contextMenu.y,
              zIndex: 100,
              backgroundColor: "white",
              borderRadius: 8,
              boxShadow: "0 4px 20px rgba(0,0,0,0.14)",
              border: "1px solid rgba(0,0,0,0.07)",
              overflow: "hidden",
              minWidth: 160,
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleCreateSection}
              style={{
                display: "block",
                width: "100%",
                padding: "9px 16px",
                textAlign: "left",
                fontSize: 13,
                fontWeight: 500,
                color: "#333",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "#f0f0ff")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
            >
              Create container
            </button>
          </div>
        </>
      )}

      {/* ── Canvas right-click (anchor) menu ── */}
      {canvasRightClickMenu && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 99 }}
            onMouseDown={() => setCanvasRightClickMenu(null)}
          />
          <div
            style={{
              position: "fixed",
              left: canvasRightClickMenu.screenX,
              top: canvasRightClickMenu.screenY,
              zIndex: 100,
              backgroundColor: "white",
              borderRadius: 8,
              boxShadow: "0 4px 20px rgba(0,0,0,0.14)",
              border: "1px solid rgba(0,0,0,0.07)",
              overflow: "hidden",
              minWidth: 160,
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {editMode && (
              <button
                onClick={() => handleSetAnchor(canvasRightClickMenu.canvasX, canvasRightClickMenu.canvasY)}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "9px 16px",
                  textAlign: "left",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#333",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0f0ff")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                Set as anchor
              </button>
            )}
            {clipboardCards && clipboardCards.length > 0 && (
              <button
                onClick={() => {
                  handlePaste(canvasRightClickMenu.canvasX, canvasRightClickMenu.canvasY)
                  setCanvasRightClickMenu(null)
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "9px 16px",
                  textAlign: "left",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#333",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0f0ff")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                Paste {clipboardCards.length} card{clipboardCards.length !== 1 ? "s" : ""}
              </button>
            )}
            {clipboardSection && (
              <button
                onClick={() => {
                  handlePasteSection(canvasRightClickMenu.canvasX, canvasRightClickMenu.canvasY)
                  setCanvasRightClickMenu(null)
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "9px 16px",
                  textAlign: "left",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#333",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0f0ff")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                Paste section
              </button>
            )}
          </div>
        </>
      )}

      {/* ── Section context menu ── */}
      {sectionContextMenu && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 99 }}
            onMouseDown={() => setSectionContextMenu(null)}
          />
          <div
            style={{
              position: "fixed",
              left: sectionContextMenu.screenX,
              top: sectionContextMenu.screenY,
              zIndex: 100,
              backgroundColor: "white",
              borderRadius: 8,
              boxShadow: "0 4px 20px rgba(0,0,0,0.14)",
              border: "1px solid rgba(0,0,0,0.07)",
              overflow: "hidden",
              minWidth: 160,
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                handleCopySection(sectionContextMenu.sectionId)
                setSectionContextMenu(null)
              }}
              style={{
                display: "block",
                width: "100%",
                padding: "9px 16px",
                textAlign: "left",
                fontSize: 13,
                fontWeight: 500,
                color: "#333",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0f0ff")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              Copy section
            </button>
            {role === "admin" && (
              <button
                onClick={() => {
                  setDeleteConfirmSectionId(sectionContextMenu.sectionId)
                  setSectionContextMenu(null)
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "9px 16px",
                  textAlign: "left",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#ef4444",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fff0f0")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                Delete section
              </button>
            )}
          </div>
        </>
      )}

      {/* ── Note context menu ── */}
      {noteContextMenu && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 99 }}
            onMouseDown={() => setNoteContextMenu(null)}
          />
          <div
            style={{
              position: "fixed",
              left: noteContextMenu.screenX,
              top: noteContextMenu.screenY,
              zIndex: 100,
              backgroundColor: "white",
              borderRadius: 8,
              boxShadow: "0 4px 20px rgba(0,0,0,0.14)",
              border: "1px solid rgba(0,0,0,0.07)",
              overflow: "hidden",
              minWidth: 160,
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                handleCopySelected(noteContextMenu.noteIds)
                setSelectedNoteIds(new Set(noteContextMenu.noteIds))
                setNoteContextMenu(null)
              }}
              style={{
                display: "block",
                width: "100%",
                padding: "9px 16px",
                textAlign: "left",
                fontSize: 13,
                fontWeight: 500,
                color: "#333",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0f0ff")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              {noteContextMenu.noteIds.length > 1 ? `Copy ${noteContextMenu.noteIds.length} cards` : "Copy card"}
            </button>
            {(role === "admin" || noteContextMenu.noteIds.every((id) => {
              const note = canvasNotes.find((n) => n.id === id)
              return note?.owner_id === currentUserId
            })) && (
              <button
                onClick={() => {
                  const toDelete = canvasNotes.filter((n) => noteContextMenu.noteIds.includes(n.id))
                  if (toDelete.length > 0) cardUndoStack.current = [...cardUndoStack.current.slice(-19), toDelete]
                  for (const id of noteContextMenu.noteIds) handleDeleteNote(id, true)
                  setSelectedNoteIds(new Set())
                  setNoteContextMenu(null)
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "9px 16px",
                  textAlign: "left",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#ef4444",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fff0f0")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                {noteContextMenu.noteIds.length > 1 ? `Delete ${noteContextMenu.noteIds.length} cards` : "Delete card"}
              </button>
            )}
          </div>
        </>
      )}

      {/* ── Section delete confirm ── */}
      {deleteConfirmSectionId && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 200, backgroundColor: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div
            style={{ background: "white", borderRadius: 14, padding: "28px 32px", boxShadow: "0 8px 32px rgba(0,0,0,0.18)", minWidth: 320, fontFamily: "var(--font-sora,'Sora',sans-serif)" }}
          >
            <p style={{ fontSize: 15, fontWeight: 600, color: "#222", marginBottom: 8 }}>Delete section?</p>
            <p style={{ fontSize: 13, color: "#666", marginBottom: 24, lineHeight: 1.5 }}>
              The section will be removed. All cards inside will remain on the canvas as free notes.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => setDeleteConfirmSectionId(null)}
                style={{ padding: "7px 18px", borderRadius: 8, border: "1.5px solid #ddd", background: "white", fontSize: 13, fontWeight: 500, cursor: "pointer", color: "#555" }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteSection(deleteConfirmSectionId)}
                style={{ padding: "7px 18px", borderRadius: 8, border: "none", background: "#ef4444", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
