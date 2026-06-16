"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { DragDropContext, type DropResult } from "@hello-pangea/dnd"
import type { CSSProperties } from "react"
import { TransformWrapper, TransformComponent, useTransformContext, useTransformComponent } from "react-zoom-pan-pinch"

import Column from "@/components/board/Column"
import CanvasSection, { type SectionData } from "@/components/board/CanvasSection"

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
        />
      ))}

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
  const [optimisticCards, setOptimisticCards] = useState<Card[]>(cards)
  const [isDraggingCard, setIsDraggingCard] = useState(false)
  const cardSnapshotRef = useRef<Card[]>([])

  useEffect(() => {
    setOptimisticCards(cards)
  }, [cards.length, cards.map((c) => c.id + c.status + c.position + c.content).join(",")])

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
          setOptimisticCards((prev) => {
            if (prev.some((c) => c.id === newCard.id)) return prev
            return [...prev, newCard]
          })
        }
        if (payload.eventType === "UPDATE") {
          setOptimisticCards((prev) =>
            prev.map((c) => (c.id === (payload.new as Card).id ? (payload.new as Card) : c))
          )
        }
        if (payload.eventType === "DELETE") {
          setOptimisticCards((prev) =>
            prev.filter((c) => c.id !== (payload.old as Card).id)
          )
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
    _dbSections.map((s) => ({ id: s.id, name: s.name, x: s.x, y: s.y, width: s.width, height: s.height }))
  )
  const [pendingRect, setPendingRect] = useState<RectData | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; rect: RectData } | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)



  async function handleCreateSection() {
    if (!contextMenu) return
    const { rect } = contextMenu
    // Optimistic: add with a temp id immediately
    const tempId = crypto.randomUUID()
    const optimistic: SectionData = { id: tempId, name: "Container", ...rect }
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
    }
  }

  function toggleEditMode() {
    setEditMode((v) => !v)
    setPendingRect(null)
    setContextMenu(null)
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
          />
        </TransformComponent>
      </TransformWrapper>

      {/* ── Edit mode toggle button (admin only) ── */}
      {role === "admin" && (
        <button
          onClick={toggleEditMode}
          title={editMode ? "Exit edit mode" : "Enter edit mode"}
          style={{
            position: "absolute",
            right: 16,
            top: "50%",
            transform: "translateY(-50%)",
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
            zIndex: 40,
            transition: "background-color 0.15s, color 0.15s",
            lineHeight: 1,
          }}
        >
          {editMode ? "×" : "+"}
        </button>
      )}

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
