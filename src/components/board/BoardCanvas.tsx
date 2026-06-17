"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { DragDropContext, type DropResult } from "@hello-pangea/dnd"
import type { CSSProperties } from "react"
import { TransformWrapper, TransformComponent, useTransformContext, useTransformComponent } from "react-zoom-pan-pinch"

import { StickyNote as StickyNoteIcon } from "lucide-react"
import Column from "@/components/board/Column"
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
  position?: number | null
  created_at?: string | null
  completed_at?: string | null
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

// ─── Column width / gap helpers ───────────────────────────────────────────────

function getColumnStyle(count: number): CSSProperties {
  if (count === 1) return { flex: "1 1 0", minWidth: "200px", maxWidth: "480px" }
  if (count === 2) return { flex: "1 1 0", minWidth: "200px", maxWidth: "360px" }
  if (count === 3) return { flex: "1 1 0", minWidth: "200px", maxWidth: "300px" }
  if (count === 4) return { flex: "1 1 0", minWidth: "190px", maxWidth: "270px" }
  if (count === 5) return { flex: "1 1 0", minWidth: "180px", maxWidth: "240px" }
  if (count <= 10) return { flex: "1 1 0", minWidth: "170px" }
  return { flexShrink: 0, width: "160px", minWidth: "160px" }
}

function getContainerGap(count: number): string {
  if (count <= 5) return "24px"
  if (count <= 8) return "16px"
  return "12px"
}

// ─── Normalize helpers ────────────────────────────────────────────────────────

function groupAndNormalize(users: User[], cards: Card[]) {
  const byOwner: Record<string, Card[]> = Object.fromEntries(
    users.map((u) => [u.id, [] as Card[]])
  )
  for (const card of cards) {
    const ownerId = card.owner_id
    if (!byOwner[ownerId]) byOwner[ownerId] = []
    byOwner[ownerId].push(card)
  }
  for (const ownerId of Object.keys(byOwner)) {
    byOwner[ownerId] = [...byOwner[ownerId]]
      .sort((a, b) => {
        const ap = typeof a.position === "number" ? a.position : 0
        const bp = typeof b.position === "number" ? b.position : 0
        if (ap !== bp) return ap - bp
        return a.created_at && b.created_at
          ? a.created_at.localeCompare(b.created_at)
          : 0
      })
      .map((c, index) => ({ ...c, position: index }))
  }
  return byOwner
}

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

// ─── CanvasContent (must be defined at module scope, not inside BoardCanvas) ──

type CanvasContentProps = {
  editMode: boolean
  role: string
  sections: SectionData[]
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
  normalizedCards: Record<string, Card[]>
  currentUserId: string
  boardId: string
  colStyle: CSSProperties
  gap: string
  setIsDraggingCard: (v: boolean) => void
  handleDragEnd: (result: DropResult) => void
  onOptimisticDelete: (id: string) => void
  onOptimisticComplete: (id: string) => void
  onOptimisticReopen: (id: string) => void
  onRevert: () => void
  canvasNotes: CanvasCard[]
  autoEditNoteId: string | null
  onAutoEditDone: () => void
  onUpdateNotePosition: (id: string, x: number, y: number) => void
  onUpdateNoteContent: (id: string, content: string) => void
  onDeleteNote: (id: string) => void
}

function CanvasContent({
  editMode,
  role,
  sections,
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
  normalizedCards,
  currentUserId,
  boardId,
  colStyle,
  gap,
  setIsDraggingCard,
  handleDragEnd,
  onOptimisticDelete,
  onOptimisticComplete,
  onOptimisticReopen,
  onRevert,
  canvasNotes,
  autoEditNoteId,
  onAutoEditDone,
  onUpdateNotePosition,
  onUpdateNoteContent,
  onDeleteNote,
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
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)

  useEffect(() => {
    if (!editMode) setSelectedSectionId(null)
  }, [editMode])

  function getCanvasCoords(clientX: number, clientY: number) {
    const rect = contentRef.current!.getBoundingClientRect()
    return {
      x: (clientX - rect.left) / scaleRef.current,
      y: (clientY - rect.top) / scaleRef.current,
    }
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (!editMode || e.button !== 0) return
    setSelectedSectionId(null)
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
        backgroundImage:
          "radial-gradient(circle, rgba(100, 100, 160, 0.22) 1.5px, transparent 1.5px)",
        backgroundSize: "28px 28px",
      }}
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => { if (editMode) e.preventDefault() }}
    >

      {/* ── Sections ── */}
      {sections.map((s) => (
        <CanvasSection
          key={s.id}
          section={s}
          scale={scale}
          editMode={editMode}
          isSelected={selectedSectionId === s.id}
          onSelect={() => setSelectedSectionId(s.id)}
          onChange={(updates) => onUpdateSection(s.id, updates)}
          onDragStart={onSectionDragStart}
          onCommit={(pos) => onCommitSection(s.id, pos)}
          onCommitResize={(rect) => onCommitSectionResize(s.id, rect)}
          onToggleDone={() => onToggleSectionDone(s.id)}
          doneColumns={doneSectionColumns[s.id] ?? []}
        />
      ))}

      {/* ── Sticky notes ── */}
      {canvasNotes.map((note) => {
        const owner = users.find((u) => u.id === note.owner_id)
        const color = owner?.column_color ?? "#6366f1"
        const canEdit = note.owner_id === currentUserId || role === "admin"
        const noteSection = note.section_id ? sections.find((s) => s.id === note.section_id) : null
        const canMove = canEdit
        return (
          <StickyNote
            key={note.id}
            note={note}
            scale={scale}
            color={color}
            canEdit={canEdit}
            canMove={canMove}
            autoEdit={note.id === autoEditNoteId}
            onPositionCommit={(x, y) => onUpdateNotePosition(note.id, x, y)}
            onContentSave={(content) => onUpdateNoteContent(note.id, content)}
            onDelete={() => onDeleteNote(note.id)}
            onAutoEditDone={onAutoEditDone}
          />
        )
      })}

      {/* ── Columns ── */}
      <DragDropContext
        onDragStart={() => {
          setIsDraggingCard(true)
          document.body.style.overflow = "hidden"
          document.documentElement.style.overflow = "hidden"
        }}
        onDragEnd={(result) => {
          setIsDraggingCard(false)
          document.body.style.overflow = ""
          document.documentElement.style.overflow = ""
          handleDragEnd(result)
        }}
      >
        <div
          className="absolute flex items-start pt-6 px-6 pb-4"
          style={{ top: 0, left: 0, gap, zIndex: 10 }}
          onMouseDown={(e) => { if (editMode) e.stopPropagation() }}
        >
          {users.map((user) => (
            <Column
              key={user.id}
              user={user}
              cards={normalizedCards[user.id] ?? []}
              role={role}
              currentUserId={currentUserId}
              boardId={boardId}
              colStyle={colStyle}
              onOptimisticDelete={onOptimisticDelete}
              onOptimisticComplete={onOptimisticComplete}
              onOptimisticReopen={onOptimisticReopen}
              onRevert={onRevert}
            />
          ))}
        </div>
      </DragDropContext>

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
  const router = useRouter()

  // ── Card state ──
  const [optimisticCards, setOptimisticCards] = useState<Card[]>(
    cards.filter((c) => (c.x ?? 0) === 0 && (c.y ?? 0) === 0)
  )
  const [canvasNotes, setCanvasNotes] = useState<CanvasCard[]>(
    cards
      .filter((c) => (c.x ?? 0) !== 0 || (c.y ?? 0) !== 0)
      .map((c) => ({ id: c.id, content: c.content, owner_id: c.owner_id, x: c.x ?? 0, y: c.y ?? 0, status: c.status, section_id: c.section_id }))
  )
  const [autoEditNoteId, setAutoEditNoteId] = useState<string | null>(null)
  const [isDraggingCard, setIsDraggingCard] = useState(false)
  const cardSnapshotRef = useRef<Card[]>([])

  useEffect(() => {
    setOptimisticCards(cards.filter((c) => (c.x ?? 0) === 0 && (c.y ?? 0) === 0))
    setCanvasNotes(
      cards
        .filter((c) => (c.x ?? 0) !== 0 || (c.y ?? 0) !== 0)
        .map((c) => ({ id: c.id, content: c.content, owner_id: c.owner_id, x: c.x ?? 0, y: c.y ?? 0, status: c.status, section_id: c.section_id }))
    )
  }, [cards.length, cards.map((c) => c.id + c.status + c.position + c.content + c.x + c.y).join(",")])

  function handleOptimisticDelete(cardId: string) {
    cardSnapshotRef.current = optimisticCards
    setOptimisticCards((prev) => prev.filter((c) => c.id !== cardId))
  }

  function handleOptimisticComplete(cardId: string) {
    cardSnapshotRef.current = optimisticCards
    setOptimisticCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? { ...c, status: "green", completed_at: new Date().toISOString() }
          : c
      )
    )
  }

  function handleOptimisticReopen(cardId: string) {
    cardSnapshotRef.current = optimisticCards
    setOptimisticCards((prev) =>
      prev.map((c) =>
        c.id === cardId ? { ...c, status: "open", completed_at: null } : c
      )
    )
  }

  function handleRevert() {
    setOptimisticCards(cardSnapshotRef.current)
  }

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("cards-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "cards" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const newCard = payload.new as Card
          const isCanvasNote = (newCard.x ?? 0) !== 0 || (newCard.y ?? 0) !== 0
          if (isCanvasNote) {
            setCanvasNotes((prev) => {
              if (prev.some((n) => n.id === newCard.id)) return prev
              return [...prev, { id: newCard.id, content: newCard.content, owner_id: newCard.owner_id, x: newCard.x ?? 0, y: newCard.y ?? 0, status: newCard.status, section_id: newCard.section_id }]
            })
          } else {
            setOptimisticCards((prev) => {
              if (prev.some((c) => c.id === newCard.id)) return prev
              return [...prev, newCard]
            })
          }
        }
        if (payload.eventType === "UPDATE") {
          const updated = payload.new as Card
          const isCanvasNote = (updated.x ?? 0) !== 0 || (updated.y ?? 0) !== 0
          if (isCanvasNote) {
            setCanvasNotes((prev) =>
              prev.map((n) =>
                n.id === updated.id
                  ? { id: updated.id, content: updated.content, owner_id: updated.owner_id, x: updated.x ?? 0, y: updated.y ?? 0, status: updated.status, section_id: updated.section_id }
                  : n
              )
            )
          } else {
            setOptimisticCards((prev) =>
              prev.map((c) => (c.id === updated.id ? updated : c))
            )
          }
        }
        if (payload.eventType === "DELETE") {
          const deleted = payload.old as Card
          setOptimisticCards((prev) => prev.filter((c) => c.id !== deleted.id))
          setCanvasNotes((prev) => prev.filter((n) => n.id !== deleted.id))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [boardId])

  async function handleDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result
    if (!destination) return
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    )
      return

    const sourceOwnerId = source.droppableId
    const destOwnerId = destination.droppableId
    const byOwner = groupAndNormalize(users, optimisticCards)
    const sourceCards = [...(byOwner[sourceOwnerId] ?? [])]
    const destCards =
      source.droppableId === destination.droppableId
        ? sourceCards
        : [...(byOwner[destOwnerId] ?? [])]

    const [movedCard] = sourceCards.splice(source.index, 1)
    const updatedCard = { ...movedCard, owner_id: destOwnerId }
    destCards.splice(destination.index, 0, updatedCard)

    const updatedByOwner = {
      ...byOwner,
      [sourceOwnerId]: sourceCards,
      [destOwnerId]: destCards,
    }
    setOptimisticCards(Object.values(updatedByOwner).flat())

    const res = await fetch(`/api/cards/${draggableId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position: destination.index, owner_id: destOwnerId }),
    })
    router.refresh()
    if (!res.ok) router.refresh()
  }

  // ── Edit mode + canvas sections state ──
  const [editMode, setEditMode] = useState(false)
  const [canvasSections, setCanvasSections] = useState<SectionData[]>(
    _dbSections.map((s) => ({ id: s.id, name: s.name, x: s.x, y: s.y, width: s.width, height: s.height, isDone: s.is_done_section }))
  )
  const [pendingRect, setPendingRect] = useState<RectData | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; rect: RectData } | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)



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
  }

  function handleCommitSection(id: string, pos: { x: number; y: number }) {
    const orig = sectionsBeforeDragRef.current.find((s) => s.id === id)
    if (!orig) return
    const moved = { ...orig, ...pos }
    const others = sectionsBeforeDragRef.current.filter((s) => s.id !== id)
    if (others.some((other) => rectsOverlap(moved, other))) {
      setCanvasSections(sectionsBeforeDragRef.current)
      return
    }
    fetch(`/api/sections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ x: pos.x, y: pos.y }),
    })
    // If this is a done section, also translate all its notes
    const dx = pos.x - orig.x
    const dy = pos.y - orig.y
    if (orig.isDone && (dx !== 0 || dy !== 0)) {
      const notesInSection = canvasNotes.filter((n) => n.section_id === id)
      if (notesInSection.length > 0) {
        const moved = notesInSection.map((n) => ({ ...n, x: n.x + dx, y: n.y + dy }))
        setCanvasNotes((prev) =>
          prev.map((n) => moved.find((m) => m.id === n.id) ?? n)
        )
        Promise.all(
          moved.map((n) =>
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
          return u ? { ...n, x: u.x, y: u.y, section_id: u.section_id } : n
        })
      )

      // Persist
      await fetch(`/api/sections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_done_section: true, width: newWidth, height: newHeight }),
      })
      await Promise.all(
        posUpdates.map((u) =>
          fetch(`/api/cards/${u.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ x: u.x, y: u.y, section_id: u.section_id }),
          })
        )
      )
    } else {
      // Unmark as done — keep notes where they are
      setCanvasSections((prev) =>
        prev.map((s) => s.id === id ? { ...s, isDone: false } : s)
      )
      await fetch(`/api/sections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_done_section: false }),
      })
    }
  }

  function handleCommitSectionResize(id: string, rect: { x: number; y: number; width: number; height: number }) {
    fetch(`/api/sections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rect),
    })
  }

  function toggleEditMode() {
    setEditMode((v) => !v)
    setPendingRect(null)
    setContextMenu(null)
  }

  // ── Canvas note handlers ──

  async function handleAddNote() {
    const tempId = crypto.randomUUID()
    const newNote: CanvasCard = {
      id: tempId,
      content: "",
      owner_id: currentUserId,
      x: 300,
      y: 300,
      status: "open",
    }
    setCanvasNotes((prev) => [...prev, newNote])
    setAutoEditNoteId(tempId)

    const res = await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: " ", board_id: boardId, x: 300, y: 300 }),
    })

    if (res.ok) {
      const saved = await res.json()
      setCanvasNotes((prev) =>
        prev.map((n) =>
          n.id === tempId
            ? { id: saved.id, content: saved.content?.trim() ?? "", owner_id: saved.owner_id, x: saved.x ?? 300, y: saved.y ?? 300, status: saved.status, section_id: saved.section_id ?? null }
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
          return u ? { ...n, x: u.x, y: u.y, section_id: u.section_id } : n
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

      await Promise.all(
        posUpdates.map((u) =>
          fetch(`/api/cards/${u.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ x: u.x, y: u.y, section_id: u.section_id }),
          })
        )
      )

      // Re-layout the old done section if this note moved from a different one
      if (prevDoneSectionId && prevDoneSectionId !== containingSection.id) {
        const afterMove = canvasNotes.map((n) =>
          n.id === id ? { ...n, section_id: containingSection.id } : n
        )
        reLayoutDoneSection(prevDoneSectionId, afterMove)
      }
    } else {
      // Free placement — drop outside any done section
      const section_id = containingSection?.id ?? null
      setCanvasNotes((prev) => prev.map((n) => (n.id === id ? { ...n, x, y, section_id } : n)))
      await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x, y, section_id }),
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

  async function handleDeleteNote(id: string) {
    setCanvasNotes((prev) => prev.filter((n) => n.id !== id))
    await fetch(`/api/cards/${id}`, { method: "DELETE" })
  }

  // ── Derived ──
  const normalized = groupAndNormalize(
    users,
    optimisticCards.filter((card, index, self) =>
      index === self.findLastIndex((c) => c.id === card.id)
    )
  )
  const colStyle = getColumnStyle(users.length)
  const gap = getContainerGap(users.length)

  // Column info for each done section (owner columns ordered by first appearance)
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
      className="h-full w-full overflow-hidden rounded-xl relative"
      style={
        editMode
          ? { boxShadow: "inset 0 0 0 2px rgba(99, 102, 241, 0.45)" }
          : undefined
      }
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
        initialScale={1}
        minScale={0.25}
        maxScale={2.5}
        limitToBounds={false}
        panning={{ disabled: isDraggingCard || isDrawing, velocityDisabled: true }}
        smooth={true}
        wheel={{ step: 0.0015 }}
        doubleClick={{ disabled: true }}
      >
        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
          <CanvasContent
            editMode={editMode}
            role={role}
            sections={canvasSections}
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
            normalizedCards={normalized}
            currentUserId={currentUserId}
            boardId={boardId}
            colStyle={colStyle}
            gap={gap}
            setIsDraggingCard={setIsDraggingCard}
            handleDragEnd={handleDragEnd}
            onOptimisticDelete={handleOptimisticDelete}
            onOptimisticComplete={handleOptimisticComplete}
            onOptimisticReopen={handleOptimisticReopen}
            onRevert={handleRevert}
            canvasNotes={canvasNotes}
            autoEditNoteId={autoEditNoteId}
            onAutoEditDone={() => setAutoEditNoteId(null)}
            onUpdateNotePosition={handleUpdateNotePosition}
            onUpdateNoteContent={handleUpdateNoteContent}
            onDeleteNote={handleDeleteNote}
          />
        </TransformComponent>
      </TransformWrapper>

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
    </div>
  )
}
