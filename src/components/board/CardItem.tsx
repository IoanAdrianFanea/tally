"use client"

import { CheckCircle2 } from "lucide-react"
import { useRouter } from "next/navigation"

import EditCardButton from "@/components/board/EditCardButton"

type Card = {
  id: string
  content: string
  owner_id: string
  status: string | null
  created_at?: string | null
}

type Props = {
  card: Card
}

function formatWhen(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date)
}

export default function CardItem({ card }: Props) {
  const router = useRouter()

  const isGreen = card.status === "green"
  const when = formatWhen(card.created_at)

  if (isGreen) {
    return (
      <div className="group bg-[#f0fdf4] rounded-lg border border-[#bbf7d0] shadow-[0_2px_4px_rgba(0,0,0,0.04)] p-md relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#22c55e]" />
        <div className="flex items-start gap-sm">
          <CheckCircle2 className="text-[#22c55e] h-[18px] w-[18px] mt-[2px]" />
          <p className="font-body-md text-on-surface line-through opacity-70">
            {card.content}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="group bg-surface-container-lowest rounded-lg border border-surface-variant shadow-[0_2px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_16px_rgba(0,0,0,0.08)] hover:-translate-y-[2px] transition-all duration-200 p-md relative overflow-hidden cursor-pointer">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-[var(--column-accent)] opacity-50" />
      <p className="font-body-md text-on-surface mb-sm">{card.content}</p>
      <div className="flex justify-between items-end mt-sm">
        <span className="font-label-sm text-outline-variant">{when ?? ""}</span>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-xs">
          <EditCardButton
            cardId={card.id}
            initialContent={card.content}
            onSuccess={() => router.refresh()}
          />
        </div>
      </div>
    </div>
  )
}
