"use client"

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"

type SwipeConfirmProps = {
  onConfirm: () => Promise<boolean> | boolean
  disabled?: boolean
  label?: string
  confirmedLabel?: string
  className?: string
}

const TRACK_PADDING = 4
const HANDLE_SIZE = 52
const THRESHOLD = 0.88

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="m5 12 4.3 4.3L19 6.8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SwipeConfirm({
  onConfirm,
  disabled = false,
  label = "Deslize para confirmar",
  confirmedLabel = "Confirmado",
  className,
}: SwipeConfirmProps) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const startXRef = useRef(0)
  const startOffsetRef = useRef(0)
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [maxOffset, setMaxOffset] = useState(0)

  const trackClassName = useMemo(() => {
    if (confirmed) {
      return "border-emerald-300/40 bg-emerald-500/18 text-emerald-100"
    }
    return "border-[#f36c20]/35 bg-[#f36c20]/10 text-[#ffe2d2]"
  }, [confirmed])

  useEffect(() => {
    const element = trackRef.current
    if (!element) return

    const observer = new ResizeObserver(() => {
      const nextMaxOffset = Math.max(
        element.getBoundingClientRect().width - HANDLE_SIZE - TRACK_PADDING * 2,
        0
      )
      setMaxOffset(nextMaxOffset)
      setOffset((prev) => Math.min(prev, nextMaxOffset))
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!dragging) return

    const onPointerMove = (event: PointerEvent) => {
      const delta = event.clientX - startXRef.current
      const nextOffset = Math.min(Math.max(startOffsetRef.current + delta, 0), maxOffset)
      setOffset(nextOffset)
    }

    const onPointerUp = async () => {
      setDragging(false)

      if (maxOffset <= 0) {
        setOffset(0)
        return
      }

      const progress = offset / maxOffset
      if (progress >= THRESHOLD) {
        setOffset(maxOffset)
        setBusy(true)
        const confirmedResult = await onConfirm()
        setBusy(false)

        if (confirmedResult) {
          setConfirmed(true)
          return
        }
      }

      setAnimating(true)
      setOffset(0)
      window.setTimeout(() => {
        setAnimating(false)
      }, 240)
    }

    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp, { once: true })
    return () => {
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
    }
  }, [dragging, maxOffset, offset, onConfirm])

  function onPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (disabled || busy || confirmed) return
    if (maxOffset <= 0) return
    startXRef.current = event.clientX
    startOffsetRef.current = offset
    setAnimating(false)
    setDragging(true)
  }

  return (
    <div
      ref={trackRef}
      className={`relative h-[60px] w-full overflow-hidden rounded-full border ${trackClassName} ${className ?? ""}`}
      aria-live="polite"
      aria-label={confirmed ? confirmedLabel : label}
    >
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-14 text-sm font-semibold tracking-[0.02em]">
        {busy ? "Confirmando..." : confirmed ? confirmedLabel : label}
      </div>

      <button
        type="button"
        onPointerDown={onPointerDown}
        disabled={disabled || busy || confirmed}
        className={`absolute left-1 top-1 inline-flex h-[52px] w-[52px] items-center justify-center rounded-full border border-white/20 ${
          confirmed
            ? "bg-emerald-500 text-white"
            : "bg-[linear-gradient(180deg,#f47b34_0%,#f36c20_100%)] text-white"
        } shadow-[0_12px_24px_rgba(0,0,0,0.35)] ${
          animating ? "transition-transform duration-200 ease-out" : ""
        }`}
        style={{
          transform: `translateX(${offset}px)`,
          touchAction: "none",
        }}
        aria-label={confirmed ? confirmedLabel : label}
      >
        {confirmed ? <CheckIcon /> : <ArrowIcon />}
      </button>
    </div>
  )
}
