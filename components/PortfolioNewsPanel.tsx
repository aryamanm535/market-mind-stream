"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { PortfolioNewsItem } from "@/lib/types"

/** Client refresh cadence — keep ≥ server NEWS_CACHE_TTL_MS to reuse cache. */
const REFRESH_MS = Math.max(
  180_000,
  Math.min(240_000, Number(process.env.NEXT_PUBLIC_NEWS_REFRESH_MS ?? 210_000))
)

function formatAge(ms: number): string {
  const m = Math.floor((Date.now() - ms) / 60_000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function PortfolioNewsPanel({
  tickers,
  ready,
}: {
  tickers: string[]
  ready: boolean
}) {
  const [items, setItems] = useState<PortfolioNewsItem[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [lastFetchAt, setLastFetchAt] = useState<number | null>(null)
  const [cached, setCached] = useState(false)
  const [clock, setClock] = useState(0)

  const key = useMemo(() => [...new Set(tickers)].sort().join(","), [tickers])

  const load = useCallback(async () => {
    if (!ready) return
    if (tickers.length === 0) {
      setItems([])
      setLastFetchAt(null)
      return
    }
    setLoading(true)
    setErr(null)
    try {
      const q = encodeURIComponent(key)
      const res = await fetch(`/api/news?tickers=${q}`)
      const j = (await res.json()) as {
        items?: PortfolioNewsItem[]
        fetchedAt?: number
        cached?: boolean
        error?: string
      }
      if (!res.ok) throw new Error(j.error || "News request failed")
      setItems(j.items ?? [])
      setLastFetchAt(typeof j.fetchedAt === "number" ? j.fetchedAt : Date.now())
      setCached(!!j.cached)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load news")
    } finally {
      setLoading(false)
    }
  }, [key, ready, tickers.length])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const id = setInterval(() => void load(), REFRESH_MS)
    return () => clearInterval(id)
  }, [load])

  useEffect(() => {
    const t = setInterval(() => setClock((c) => c + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const nextRefreshSec = useMemo(() => {
    void clock
    if (lastFetchAt == null) return null
    return Math.max(0, Math.ceil((lastFetchAt + REFRESH_MS - Date.now()) / 1000))
  }, [lastFetchAt, clock])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/90 bg-[#06080c] px-5 py-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            Gemini portfolio scan
          </div>
          <p className="mt-0.5 max-w-xl font-mono text-[11px] text-zinc-500">
            Synthetic desk-style lines ranked by impact on your book (not live Yahoo). Refreshes
            about every {Math.round(REFRESH_MS / 60_000)} minutes; server caches the same window to
            limit API usage.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-zinc-400">
          {loading ? <span className="text-amber-300/90">Loading…</span> : null}
          {cached ? (
            <span className="rounded border border-zinc-700 px-2 py-1 text-zinc-500">cached</span>
          ) : null}
          {nextRefreshSec != null ? (
            <span className="rounded border border-emerald-500/25 bg-emerald-500/5 px-2 py-1 text-emerald-300/90">
              next refresh ~{Math.floor(nextRefreshSec / 60)}:
              {String(nextRefreshSec % 60).padStart(2, "0")}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md border border-zinc-600 px-3 py-1.5 text-zinc-200 hover:border-emerald-500/40 hover:text-emerald-200"
          >
            Refresh now
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {err ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 font-mono text-sm text-red-300">
            {err}
          </div>
        ) : null}

        {tickers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-amber-500/25 bg-amber-500/5 p-8 text-center font-mono text-sm text-amber-200/90">
            Add at least one ticker to your portfolio to generate a Gemini news scan.
          </div>
        ) : items.length === 0 && !loading && !err ? (
          <div className="rounded-lg border border-dashed border-zinc-800 p-8 text-center font-mono text-sm text-zinc-500">
            No items returned. Try refresh or check GEMINI_API_KEY.
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((it) => {
              const external = it.link.startsWith("http://") || it.link.startsWith("https://")
              const titleEl = external ? (
                <a
                  href={it.link}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-sm font-medium text-zinc-100 underline decoration-zinc-600 decoration-1 underline-offset-2 hover:text-emerald-200"
                >
                  {it.title}
                </a>
              ) : (
                <span className="font-mono text-sm font-medium text-zinc-100">{it.title}</span>
              )
              return (
                <li
                  key={it.id}
                  className="rounded-lg border border-zinc-800/90 bg-[#0a0d14] p-4 transition-colors hover:border-zinc-700"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    {titleEl}
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase ${
                          it.impactLabel === "high"
                            ? "border border-amber-500/40 bg-amber-500/10 text-amber-200"
                            : it.impactLabel === "medium"
                              ? "border border-zinc-600 bg-zinc-800/60 text-zinc-300"
                              : "border border-zinc-800 text-zinc-500"
                        }`}
                      >
                        impact {it.impactScore}
                      </span>
                    </div>
                  </div>
                  {it.summary ? (
                    <p className="mt-2 font-mono text-xs leading-relaxed text-zinc-400">{it.summary}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px] text-zinc-500">
                    <span>{it.publisher}</span>
                    <span>·</span>
                    <span>{formatAge(it.publishedAt)}</span>
                    {it.matchedTickers.length > 0 ? (
                      <>
                        <span>·</span>
                        <span className="text-emerald-400/80">book: {it.matchedTickers.join(", ")}</span>
                      </>
                    ) : null}
                    <span className="text-zinc-600">· {it.ticker}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
