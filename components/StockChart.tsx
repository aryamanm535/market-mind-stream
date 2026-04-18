"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  CartesianGrid,
} from "recharts"
import type { ChartPoint, ChartSelectionRange, ChartTimeframe } from "@/lib/types"

/** Approximate plot insets vs Recharts margins + YAxis width (tweak if misaligned). */
const PLOT = { L: 58, R: 18, T: 10, B: 34 }

/** Inner plot height (outer box is this + p-3 vertical padding). Keeps ResponsiveContainer > 0. */
const CHART_INNER_H = 356

function buildSelection(
  ticker: string,
  timeframe: ChartTimeframe,
  data: ChartPoint[],
  startIndex: number,
  endIndex: number
): ChartSelectionRange {
  const n = data.length
  if (n === 0) {
    return {
      ticker,
      timeframe,
      startIndex: 0,
      endIndex: 0,
      startLabel: "",
      endLabel: "",
      startPrice: 0,
      endPrice: 0,
      pctChange: 0,
    }
  }
  let lo = Math.max(0, Math.min(startIndex, endIndex, n - 1))
  let hi = Math.max(0, Math.max(startIndex, endIndex, 0))
  lo = Math.min(lo, hi)
  if (lo === hi && n > 1) {
    lo = Math.max(0, lo - 1)
    hi = Math.min(n - 1, hi + 1)
  }
  const a = data[lo]!
  const b = data[hi]!
  const pct = a.price !== 0 ? ((b.price - a.price) / a.price) * 100 : 0
  return {
    ticker,
    timeframe,
    startIndex: lo,
    endIndex: hi,
    startLabel: a.label,
    endLabel: b.label,
    startPrice: a.price,
    endPrice: b.price,
    pctChange: Math.round(pct * 100) / 100,
  }
}

function xToIndex(clientX: number, rect: DOMRect, n: number): number {
  if (n <= 1) return 0
  const plotLeft = rect.left + PLOT.L
  const plotRight = rect.right - PLOT.R
  const w = Math.max(1, plotRight - plotLeft)
  const t = (clientX - plotLeft) / w
  const clamped = Math.max(0, Math.min(1, t))
  return Math.round(clamped * (n - 1))
}

type Props = {
  data: ChartPoint[]
  ticker: string
  timeframe: ChartTimeframe
  onSelect: (range: ChartSelectionRange) => void
  busy?: boolean
}

export default function StockChart({ data, ticker, timeframe, onSelect, busy }: Props) {
  /** Plot box (matches drag overlay) — not the padded outer wrapper. */
  const plotRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ a: number; b: number } | null>(null)
  const [drag, setDrag] = useState<{ a: number; b: number } | null>(null)
  const [committed, setCommitted] = useState<{ lo: number; hi: number } | null>(null)

  useEffect(() => {
    setCommitted(null)
    setDrag(null)
    dragRef.current = null
  }, [data, ticker, timeframe])

  const finishDrag = useCallback(() => {
    const d = dragRef.current
    if (!d || data.length === 0) return
    dragRef.current = null
    setDrag(null)
    const sel = buildSelection(ticker, timeframe, data, d.a, d.b)
    setCommitted({ lo: sel.startIndex, hi: sel.endIndex })
    onSelect(sel)
  }, [data, onSelect, ticker, timeframe])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (busy || data.length === 0) return
    const el = plotRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX
    if (x < rect.left + PLOT.L || x > rect.right - PLOT.R) return
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    const i = xToIndex(x, rect, data.length)
    const next = { a: i, b: i }
    dragRef.current = next
    setDrag(next)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current === null || data.length === 0) return
    const el = plotRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const i = xToIndex(e.clientX, rect, data.length)
    const next = { a: dragRef.current.a, b: i }
    dragRef.current = next
    setDrag(next)
  }

  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current === null) return
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
    } catch {
      /* ignore */
    }
    finishDrag()
  }

  const lo = drag ? Math.min(drag.a, drag.b) : committed?.lo ?? 0
  const hi = drag ? Math.max(drag.a, drag.b) : committed?.hi ?? Math.max(0, data.length - 1)
  const x0 = data[lo]?.time ?? 0
  const x1 = data[hi]?.time ?? x0

  return (
    <div className="flex flex-col gap-3">
      <div
        role="application"
        aria-label={`Price chart (${timeframe}) — drag horizontally to select a time range`}
        className="relative w-full min-w-0 rounded-lg border border-zinc-800/80 bg-[#070b12] p-3 shadow-[inset_0_0_0_1px_rgba(34,197,94,0.06)]"
      >
        {busy ? (
          <div className="absolute inset-0 z-20 flex cursor-wait items-center justify-center rounded-md bg-black/55 p-3">
            <span className="rounded border border-emerald-500/40 bg-zinc-950/95 px-3 py-1.5 font-mono text-xs text-emerald-300">
              Reasoning…
            </span>
          </div>
        ) : null}
        <div
          ref={plotRef}
          className="relative w-full min-w-0"
          style={{ height: CHART_INNER_H, minHeight: CHART_INNER_H }}
        >
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={240}
            initialDimension={{ width: 800, height: CHART_INNER_H }}
            debounce={32}
          >
            <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 6" stroke="#1f2937" vertical={false} />
            <XAxis
              dataKey="time"
              interval={data.length > 18 ? 2 : data.length > 12 ? 1 : 0}
              tick={{ fill: "#64748b", fontSize: 10, fontFamily: "var(--font-geist-mono)" }}
              tickLine={false}
              axisLine={{ stroke: "#27272a" }}
              tickFormatter={(v: number) => data[v]?.label ?? String(v)}
            />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fill: "#64748b", fontSize: 11, fontFamily: "var(--font-geist-mono)" }}
              tickLine={false}
              axisLine={{ stroke: "#27272a" }}
              width={52}
            />
            <Tooltip
              contentStyle={{
                background: "#0a0f18",
                border: "1px solid #27272a",
                borderRadius: 8,
                fontFamily: "var(--font-geist-mono)",
                fontSize: 12,
              }}
              labelFormatter={(_, payload) => {
                const p = payload?.[0]?.payload as ChartPoint | undefined
                return p?.label ?? ""
              }}
              formatter={(value) => {
                const n = typeof value === "number" ? value : Number(value)
                const s = Number.isFinite(n) ? n.toFixed(2) : "—"
                return [s, "px"]
              }}
            />
            {data.length > 0 ? (
              <ReferenceArea
                x1={x0}
                x2={x1}
                stroke="#22c55e"
                strokeOpacity={drag ? 0.55 : 0.35}
                fill="#22c55e"
                fillOpacity={drag ? 0.12 : 0.06}
              />
            ) : null}
            <Line
              type="monotone"
              dataKey="price"
              stroke="#4ade80"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#86efac", stroke: "#14532d" }}
            />
            </LineChart>
          </ResponsiveContainer>
          {!busy ? (
            <div
              className="absolute inset-0 z-10 cursor-crosshair touch-none"
              style={{ background: "transparent" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerEnd}
              onPointerCancel={onPointerEnd}
            />
          ) : null}
        </div>
      </div>
      <p className="font-mono text-[11px] leading-relaxed text-zinc-500">
        <span className="text-emerald-400/90">Click and drag</span> across the price line to pick a
        session window. On release, the analyst explains{" "}
        <span className="text-zinc-300">why price rose or fell</span> in that range (simulated
        tape).
      </p>
    </div>
  )
}
