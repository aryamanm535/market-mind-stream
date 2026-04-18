"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
  CartesianGrid,
  useOffset,
  usePlotArea,
  useXAxisScale,
  useYAxisScale,
  type ChartOffset,
} from "recharts"
import { explainDateLabel } from "@/lib/chartDateLabels"
import type { ChartPoint, ChartSelectionRange, ChartTimeframe } from "@/lib/types"

/** Fallback until Recharts reports real plot offsets (matches margin + default Y-axis width ~52px). */
const PLOT_FALLBACK = { L: 52, R: 22, T: 18, B: 42 }

/** Inner plot height (outer box is this + p-3 vertical padding). Keeps ResponsiveContainer > 0. */
const CHART_INNER_H = 356
const CHART_MIN_H = 240

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
      startLabelFull: "",
      endLabelFull: "",
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
    startLabelFull: explainDateLabel(timeframe, lo, a),
    endLabelFull: explainDateLabel(timeframe, hi, b),
    startPrice: a.price,
    endPrice: b.price,
    pctChange: Math.round(pct * 100) / 100,
  }
}

function xToIndex(clientX: number, rect: DOMRect, n: number, plot: ChartOffset | null): number {
  if (n <= 1) return 0
  const insetL = plot?.left ?? PLOT_FALLBACK.L
  const insetR = plot?.right ?? PLOT_FALLBACK.R
  const plotLeft = rect.left + insetL
  const plotRight = rect.right - insetR
  const w = Math.max(1, plotRight - plotLeft)
  const t = (clientX - plotLeft) / w
  const clamped = Math.max(0, Math.min(1, t))
  return Math.round(clamped * (n - 1))
}

function PlotOffsetSync({ onOffset }: { onOffset: (o: ChartOffset) => void }) {
  const off = useOffset()
  useEffect(() => {
    if (off) onOffset(off)
  }, [off, onOffset])
  return null
}

function ChartCrosshairG({
  data,
  hoverIndex,
  hoverXPx,
  show,
}: {
  data: ChartPoint[]
  hoverIndex: number | null
  hoverXPx: number | null
  show: boolean
}) {
  const area = usePlotArea()
  const yScale = useYAxisScale(0)
  const xScale = useXAxisScale(0)
  if (!show || hoverIndex == null || !area || !yScale || !xScale) return null
  const p = data[hoverIndex]
  if (!p) return null
  const yPix = yScale(p.price)
  if (yPix == null || Number.isNaN(Number(yPix))) return null
  const snapped = xScale(p.time)
  const rawX = hoverXPx ?? (typeof snapped === "number" ? snapped : null)
  if (rawX == null || Number.isNaN(rawX)) return null
  const left = area.x
  const right = area.x + area.width
  const top = area.y
  const bottom = area.y + area.height
  const xLine = Math.max(left, Math.min(right, rawX))
  const priceStr = formatPx(p.price)
  const timeStr = p.label
  return (
    <g className="pointer-events-none" aria-hidden>
      <line
        x1={xLine}
        x2={xLine}
        y1={top}
        y2={bottom}
        stroke="#64748b"
        strokeOpacity={0.55}
        strokeDasharray="4 6"
      />
      <line
        x1={left}
        x2={right}
        y1={yPix}
        y2={yPix}
        stroke="#64748b"
        strokeOpacity={0.45}
        strokeDasharray="4 6"
      />
      <g transform={`translate(${right - 6}, ${yPix})`}>
        <rect x={-76} y={-11} width={76} height={22} rx={4} fill="#070b12" stroke="#22c55e" strokeOpacity={0.55} />
        <text
          x={-8}
          y={4}
          textAnchor="end"
          fill="#86efac"
          fontSize={12}
          fontWeight={600}
          fontFamily="var(--font-geist-mono), ui-monospace, monospace"
        >
          {priceStr}
        </text>
      </g>
      <g transform={`translate(${xLine}, ${bottom + 14})`}>
        <rect x={-42} y={-10} width={84} height={20} rx={4} fill="#070b12" stroke="#334155" strokeOpacity={0.65} />
        <text
          x={0}
          y={4}
          textAnchor="middle"
          fill="#cbd5e1"
          fontSize={11}
          fontWeight={600}
          fontFamily="var(--font-geist-mono), ui-monospace, monospace"
        >
          {timeStr}
        </text>
      </g>
    </g>
  )
}

function formatPx(v: number): string {
  const a = Math.abs(v)
  const d = a < 1 ? 4 : a < 10 ? 3 : 2
  return v.toFixed(d)
}

type Props = {
  data: ChartPoint[]
  ticker: string
  timeframe: ChartTimeframe
  mode: "explain" | "draw"
  onSelect: (range: ChartSelectionRange) => void
  busy?: boolean
}

type DrawLine = { id: string; a: number; b: number }

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export default function StockChart({ data, ticker, timeframe, mode, onSelect, busy }: Props) {
  /** Plot box (matches drag overlay) — not the padded outer wrapper. */
  const plotRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ a: number; b: number } | null>(null)
  const [drag, setDrag] = useState<{ a: number; b: number } | null>(null)
  const [committed, setCommitted] = useState<{ lo: number; hi: number } | null>(null)
  const [drawLines, setDrawLines] = useState<DrawLine[]>([])
  const [drawStart, setDrawStart] = useState<number | null>(null)
  const [drawHover, setDrawHover] = useState<number | null>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [hoverXPx, setHoverXPx] = useState<number | null>(null)
  const [plotOffset, setPlotOffset] = useState<ChartOffset | null>(null)

  const onPlotOffset = useCallback((o: ChartOffset) => setPlotOffset(o), [])

  useEffect(() => {
    setCommitted(null)
    setDrag(null)
    dragRef.current = null
    setDrawLines([])
    setDrawStart(null)
    setDrawHover(null)
    setHoverIndex(null)
    setHoverXPx(null)
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
    const insetL = plotOffset?.left ?? PLOT_FALLBACK.L
    const insetR = plotOffset?.right ?? PLOT_FALLBACK.R
    if (x < rect.left + insetL || x > rect.right - insetR) return
    const i = xToIndex(x, rect, data.length, plotOffset)
    if (mode === "draw") {
      if (drawStart == null) {
        setDrawStart(i)
        setDrawHover(i)
      } else {
        const a = drawStart
        const b = i
        setDrawLines((prev) => [...prev, { id: uid(), a, b }].slice(-8))
        setDrawStart(null)
        setDrawHover(null)
      }
      return
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    const next = { a: i, b: i }
    dragRef.current = next
    setDrag(next)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (data.length === 0) return
    const el = plotRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const i = xToIndex(e.clientX, rect, data.length, plotOffset)
    setHoverIndex(i)
    const insetL = plotOffset?.left ?? PLOT_FALLBACK.L
    const insetR = plotOffset?.right ?? PLOT_FALLBACK.R
    const plotLeft = rect.left + insetL
    const plotRight = rect.right - insetR
    const xClamped = Math.max(plotLeft, Math.min(plotRight, e.clientX))
    setHoverXPx(xClamped - rect.left)
    if (mode === "draw") {
      if (drawStart != null) setDrawHover(i)
      return
    }
    if (dragRef.current === null) return
    const next = { a: dragRef.current.a, b: i }
    dragRef.current = next
    setDrag(next)
  }

  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (mode === "draw") return
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

  const prices = data.map((d) => d.price)
  const dMin = prices.length ? Math.min(...prices) : 0
  const dMax = prices.length ? Math.max(...prices) : 0
  const span = dMax - dMin || Math.abs(dMax) * 0.02 || 1
  const pad = span * 0.06
  const yMin = dMin - pad
  const yMax = dMax + pad

  return (
    <div className="flex flex-col gap-3">
      <div
        role="application"
        aria-label={`Price chart (${timeframe}) — ${mode === "draw" ? "draw mode" : "drag-select explain mode"}`}
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
          {mode === "draw" ? (
            <div className="absolute right-2 top-2 z-30 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setDrawLines([])
                  setDrawStart(null)
                  setDrawHover(null)
                }}
                className="rounded-md border border-zinc-700 bg-zinc-950/60 px-2.5 py-1.5 font-mono text-[11px] text-zinc-200 hover:border-emerald-500/40 hover:text-emerald-200"
              >
                Clear lines
              </button>
            </div>
          ) : null}
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={CHART_MIN_H}
            initialDimension={{ width: 800, height: CHART_INNER_H }}
            debounce={32}
          >
            <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 20 }}>
              <PlotOffsetSync onOffset={onPlotOffset} />
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
                domain={[yMin, yMax]}
                tick={{ fill: "#64748b", fontSize: 11, fontFamily: "var(--font-geist-mono)" }}
                tickFormatter={(v: number) => formatPx(v)}
                tickLine={false}
                axisLine={{ stroke: "#27272a" }}
                width={52}
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
              type="linear"
              dataKey="price"
              stroke="#4ade80"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#86efac", stroke: "#14532d" }}
            />

            {drawLines.map((ln) => {
              const a = data[Math.max(0, Math.min(data.length - 1, ln.a))]!
              const b = data[Math.max(0, Math.min(data.length - 1, ln.b))]!
              const pct = a.price !== 0 ? ((b.price - a.price) / a.price) * 100 : 0
              return (
                <ReferenceLine
                  key={ln.id}
                  segment={[
                    { x: a.time, y: a.price },
                    { x: b.time, y: b.price },
                  ]}
                  stroke="#38bdf8"
                  strokeWidth={2}
                  strokeOpacity={0.75}
                  ifOverflow="discard"
                  label={{
                    value: `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`,
                    position: "insideTopRight",
                    fill: "#7dd3fc",
                    fontSize: 11,
                  }}
                />
              )
            })}
            {mode === "draw" && drawStart != null && drawHover != null ? (() => {
              const a = data[Math.max(0, Math.min(data.length - 1, drawStart))]!
              const b = data[Math.max(0, Math.min(data.length - 1, drawHover))]!
              return (
                <ReferenceLine
                  segment={[
                    { x: a.time, y: a.price },
                    { x: b.time, y: b.price },
                  ]}
                  stroke="#38bdf8"
                  strokeWidth={2}
                  strokeOpacity={0.35}
                  strokeDasharray="6 6"
                  ifOverflow="discard"
                />
              )
            })() : null}
            <ChartCrosshairG
              data={data}
              hoverIndex={hoverIndex}
              hoverXPx={hoverXPx}
              show={Boolean(!busy && hoverIndex != null && data[hoverIndex])}
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
              onPointerLeave={() => {
                setHoverIndex(null)
                setHoverXPx(null)
              }}
            />
          ) : null}
        </div>
      </div>
      <p className="font-mono text-[11px] leading-relaxed text-zinc-500">
        {mode === "draw" ? (
          <>
            <span className="text-sky-300/90">Click two points</span> to draw a comparison line. Use
            the percent label to compare moves.
          </>
        ) : (
          <>
            <span className="text-emerald-400/90">Click and drag</span> across the price line to pick
            a session window. On release, the analyst explains{" "}
            <span className="text-zinc-300">why price rose or fell</span> in that range.
          </>
        )}
      </p>
    </div>
  )
}
