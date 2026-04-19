"use client"

import { useCallback, useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import StockChart from "@/components/StockChart"
import AiThoughtCard from "@/components/AiThoughtCard"
import PortfolioNewsPanel from "@/components/PortfolioNewsPanel"
import LearnGamePanel from "@/components/LearnGamePanel"
import FlashcardsPanel from "@/components/FlashcardsPanel"
import MasteryPanel from "@/components/MasteryPanel"
import LandingView from "@/components/LandingView"
import { useLocalPortfolio } from "@/hooks/useLocalPortfolio"
import { useLearningStore } from "@/hooks/useLearningStore"
import { buildSimulatedSeries } from "@/lib/chartSeries"
import {
  CHART_TIMEFRAMES,
  type ChartPoint,
  type ChartSelectionRange,
  type ChartTimeframe,
  type ExplainMode,
  type LearnPack,
  type MarketThought,
} from "@/lib/types"

const PRESETS = ["AAPL", "NVDA", "TSLA", "AMZN", "GOOG"] as const

const EXPLAIN_CLIENT_MS = Math.max(
  8000,
  Number(process.env.NEXT_PUBLIC_EXPLAIN_CLIENT_TIMEOUT_MS ?? 22_000)
)

type Tab = "home" | "terminal" | "news" | "learn"
type LearnTab = "game" | "flashcards" | "mastery"
type GameSection = "driver" | "quiz" | "trade"

export default function Home() {
  const [tab, setTab] = useState<Tab>("home")
  const [learnTab, setLearnTab] = useState<LearnTab>("game")
  const [gameSection, setGameSection] = useState<GameSection>("driver")
  const [feed, setFeed] = useState<MarketThought[]>([])
  const [lastPack, setLastPack] = useState<LearnPack | null>(null)
  const [chartSymbol, setChartSymbol] = useState("AAPL")
  const [symbolDraft, setSymbolDraft] = useState("")
  const [chartBusy, setChartBusy] = useState(false)
  const [chartTimeframe, setChartTimeframe] = useState<ChartTimeframe>("1M")
  const [chartMode, setChartMode] = useState<"explain" | "draw">("explain")
  const [explainMode, setExplainMode] = useState<ExplainMode>("beginner")
  const [newTicker, setNewTicker] = useState("")
  const portfolio = useLocalPortfolio()
  const learning = useLearningStore()

  const sym = chartSymbol.trim().toUpperCase()
  const [chartData, setChartData] = useState<ChartPoint[]>([])
  const [chartHint, setChartHint] = useState<string | null>(null)
  const [chartSource, setChartSource] = useState<"finnhub" | "twelvedata" | "yahoo" | "demo">(
    "yahoo"
  )

  useEffect(() => {
    let cancelled = false
    setChartHint(null)
    ;(async () => {
      try {
        const res = await fetch(
          `/api/chart?symbol=${encodeURIComponent(sym)}&timeframe=${chartTimeframe}`
        )
        const json = (await res.json()) as {
          points?: ChartPoint[]
          error?: string
          source?: string
        }
        if (cancelled) return
        const pts = Array.isArray(json.points) ? json.points : []
        if (res.ok && pts.length > 0) {
          setChartData(pts)
          setChartHint(null)
          const src = json.source
          if (src === "finnhub" || src === "twelvedata" || src === "yahoo") {
            setChartSource(src)
          } else {
            setChartSource("yahoo")
          }
          return
        }
        throw new Error(typeof json.error === "string" ? json.error : "No chart bars returned")
      } catch {
        if (cancelled) return
        setChartData(buildSimulatedSeries(sym || "AAPL", chartTimeframe))
        setChartSource("demo")
        setChartHint(
          "Live prices unavailable — showing a simulated series. Add TWELVE_DATA_API_KEY in .env.local for backup."
        )
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sym, chartTimeframe])

  useEffect(() => {
    setFeed([])
  }, [sym, chartTimeframe])

  const explainMove = useCallback(
    async (range: ChartSelectionRange) => {
      if (chartMode !== "explain") return
      setChartBusy(true)
      const ac = new AbortController()
      const t = window.setTimeout(() => ac.abort(), EXPLAIN_CLIENT_MS)
      try {
        const res = await fetch("/api/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stock: sym, range, mode: explainMode }),
          signal: ac.signal,
        })
        const text = await res.text()
        let data: MarketThought & { error?: string }
        try {
          data = JSON.parse(text) as MarketThought & { error?: string }
        } catch {
          const errCard: MarketThought = {
            ticker: sym,
            thought: "Server returned non-JSON (check dev server / API route).",
            reasoning: [text.slice(0, 200)],
            confidence: 0,
            action: "ERROR",
          }
          setFeed((p) => [errCard, ...p].slice(0, 3))
          return
        }
        if (!res.ok || data.error) {
          const errCard: MarketThought = {
            ticker: sym,
            thought: typeof data.error === "string" ? data.error : "Explain request failed.",
            reasoning: [],
            confidence: 0,
            action: "ERROR",
          }
          setFeed((p) => [errCard, ...p].slice(0, 3))
          return
        }
        setFeed((p) => [data, ...p].slice(0, 3))
        if (data.learn) {
          learning.ingestLearnPack(data.learn)
          setLastPack(data.learn)
        }
      } catch (e) {
        const msg =
          e instanceof Error
            ? e.name === "AbortError"
              ? `Request timed out (${Math.round(EXPLAIN_CLIENT_MS / 1000)}s).`
              : e.message
            : "Network error"
        const errCard: MarketThought = {
          ticker: sym,
          thought: msg,
          reasoning: [],
          confidence: 0,
          action: "ERROR",
        }
        setFeed((p) => [errCard, ...p].slice(0, 3))
      } finally {
        clearTimeout(t)
        setChartBusy(false)
      }
    },
    [chartMode, learning, sym, explainMode]
  )

  const launchLearn = useCallback(
    (pack: LearnPack, dest: "driver" | "quiz" | "trade" | "flashcards" | "mastery") => {
      setLastPack(pack)
      if (dest === "flashcards") setLearnTab("flashcards")
      else if (dest === "mastery") setLearnTab("mastery")
      else {
        setLearnTab("game")
        setGameSection(dest)
      }
      setTab("learn")
    },
    []
  )

  const applyChartSymbol = (raw: string) => {
    const u = raw.trim().toUpperCase()
    if (/^[A-Z0-9.\-]{1,20}$/.test(u)) setChartSymbol(u)
  }

  const addPortfolio = () => {
    const ok = portfolio.add(newTicker)
    if (ok) setNewTicker("")
  }

  const goExplore = (symbol: string, tf: ChartTimeframe) => {
    applyChartSymbol(symbol)
    setChartTimeframe(tf)
    setTab("terminal")
  }

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav tab={tab} onTab={setTab} />

      <AnimatePresence mode="wait">
        {tab === "home" ? (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1"
          >
            <LandingView
              onSelect={(s, tf) => goExplore(s, tf)}
              onSearch={(s) => goExplore(s, "1M")}
            />
          </motion.div>
        ) : tab === "terminal" ? (
          <motion.div
            key="terminal"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex min-h-0 flex-1"
          >
            <aside className="flex w-[260px] shrink-0 flex-col border-r border-white/5 bg-black/20 backdrop-blur-xl">
              <div className="border-b border-white/5 p-5">
                <h1 className="text-sm font-semibold text-white">Chart symbol</h1>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  Pick a ticker + horizon. Drag on the chart to explain that window.
                </p>
              </div>
              <div className="border-b border-white/5 p-4">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Horizon
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {CHART_TIMEFRAMES.map((tf) => (
                    <button
                      key={tf.id}
                      type="button"
                      onClick={() => setChartTimeframe(tf.id)}
                      title={tf.detail}
                      className={`rounded-full border px-2.5 py-1 font-mono text-[10px] transition-all ${
                        chartTimeframe === tf.id
                          ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-100"
                          : "border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200"
                      }`}
                    >
                      {tf.short}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-4">
                <div className="mb-2 flex gap-2">
                  <input
                    value={symbolDraft}
                    onChange={(e) => setSymbolDraft(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        applyChartSymbol(symbolDraft)
                        setSymbolDraft("")
                      }
                    }}
                    placeholder="e.g. AMD"
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/50"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      applyChartSymbol(symbolDraft)
                      setSymbolDraft("")
                    }}
                    className="shrink-0 rounded-xl brand-gradient-bg px-3 py-2 text-xs font-semibold text-white hover:scale-105 active:scale-95"
                  >
                    Go
                  </button>
                </div>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Presets
                </div>
                <nav className="space-y-1">
                  {PRESETS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setChartSymbol(s)}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left font-mono text-sm transition-all ${
                        sym === s
                          ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-100"
                          : "border-transparent text-slate-300 hover:border-white/10 hover:bg-white/5"
                      }`}
                    >
                      {s}
                      {sym === s ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                      ) : null}
                    </button>
                  ))}
                </nav>
              </div>
            </aside>

            <main className="flex min-h-0 min-w-0 flex-1 flex-col">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-6 py-4">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Active chart
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold tracking-tight text-white">{sym}</span>
                    <span className="text-[12px] text-slate-400">
                      {CHART_TIMEFRAMES.find((x) => x.id === chartTimeframe)?.detail ?? ""}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {chartHint ? (
                        <span className="text-amber-400/90">· simulated</span>
                      ) : chartSource === "finnhub" ? (
                        <span className="text-emerald-400/70">· Finnhub</span>
                      ) : chartSource === "twelvedata" ? (
                        <span className="text-emerald-400/70">· Twelve Data</span>
                      ) : (
                        <span className="text-emerald-400/70">· Yahoo Finance</span>
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Beginner / Analyst toggle */}
                  <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
                    {(["beginner", "analyst"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setExplainMode(m)}
                        className={`rounded-full px-3 py-1 text-[11px] font-medium capitalize transition-all ${
                          explainMode === m
                            ? m === "beginner"
                              ? "bg-emerald-400/20 text-emerald-200"
                              : "bg-violet-400/20 text-violet-200"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setChartMode((m) => (m === "explain" ? "draw" : "explain"))}
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all ${
                      chartMode === "explain"
                        ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
                        : "border-violet-400/40 bg-violet-400/10 text-violet-100"
                    }`}
                  >
                    {chartMode === "explain" ? "Explain: drag" : "Draw: compare"}
                  </button>
                </div>
              </header>

              <div className="min-h-0 min-w-0 flex-1 overflow-auto scroll-soft p-6">
                {chartHint ? (
                  <div className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-[12px] text-amber-100">
                    {chartHint}
                  </div>
                ) : null}
                <StockChart
                  data={chartData}
                  ticker={sym}
                  timeframe={chartTimeframe}
                  mode={chartMode}
                  onSelect={explainMove}
                  busy={chartBusy}
                />
              </div>
            </main>

            <section className="flex w-[min(420px,38vw)] shrink-0 flex-col border-l border-white/5 bg-black/20 backdrop-blur-xl">
              <div className="border-b border-white/5 p-5">
                <h2 className="text-sm font-semibold text-white">AI Explanations</h2>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  Drag across the chart — each card explains the move using recent news.
                </p>
              </div>
              <div className="flex-1 overflow-y-auto scroll-soft p-4">
                {feed.length === 0 ? (
                  <EmptyFeed />
                ) : (
                  feed.map((item, i) => (
                    <AiThoughtCard
                      key={`${i}-${item.ticker}-${item.confidence}-${item.action}-${item.thought.length}`}
                      item={item}
                      i={i}
                      onLaunchLearn={launchLearn}
                    />
                  ))
                )}
              </div>
            </section>
          </motion.div>
        ) : tab === "learn" ? (
          <motion.div
            key="learn"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex min-h-0 flex-1"
          >
            <aside className="flex w-[260px] shrink-0 flex-col border-r border-white/5 bg-black/20 backdrop-blur-xl">
              <div className="border-b border-white/5 p-5">
                <h2 className="text-sm font-semibold text-white">Learn</h2>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  Game, flashcards, and mastery — all stored locally.
                </p>
              </div>
              <div className="border-b border-white/5 p-4">
                <div className="flex gap-1">
                  {(["game", "flashcards", "mastery"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setLearnTab(t)}
                      className={`flex-1 rounded-full border px-3 py-1.5 text-[11px] font-medium capitalize transition-all ${
                        learnTab === t
                          ? "border-amber-400/40 bg-amber-400/10 text-amber-100"
                          : "border-transparent text-slate-400 hover:border-white/10 hover:text-slate-200"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Latest selection
                  </div>
                  <div className="mt-1 text-[13px] text-white">
                    {lastPack ? `${lastPack.rangeLabel} · ${lastPack.timeframe}` : "—"}
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400">
                    Terms tracked:{" "}
                    <span className="font-semibold text-emerald-300">
                      {Object.keys(learning.store.terms).length}
                    </span>
                  </div>
                </div>
              </div>
            </aside>

            <main className="flex min-h-0 min-w-0 flex-1 flex-col">
              {learnTab === "game" ? (
                <div className="min-h-0 min-w-0 flex-1 overflow-y-auto scroll-soft p-6">
                  {lastPack ? (
                    <LearnGamePanel
                      pack={lastPack}
                      onAttempt={learning.recordAttempt}
                      initialSection={gameSection}
                    />
                  ) : (
                    <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-400">
                      Select a chart range in the Terminal to generate a game pack.
                    </div>
                  )}
                </div>
              ) : learnTab === "flashcards" ? (
                <FlashcardsPanel />
              ) : (
                <MasteryPanel />
              )}
            </main>
          </motion.div>
        ) : (
          <motion.div
            key="news"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex min-h-0 flex-1"
          >
            <aside className="flex w-[260px] shrink-0 flex-col border-r border-white/5 bg-black/20 backdrop-blur-xl">
              <div className="border-b border-white/5 p-5">
                <h2 className="text-sm font-semibold text-white">Portfolio</h2>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  Stored locally. Scans built from Gemini synthesis.
                </p>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex gap-2">
                  <input
                    value={newTicker}
                    onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addPortfolio()
                    }}
                    placeholder="Add ticker"
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-400/50"
                  />
                  <button
                    type="button"
                    onClick={addPortfolio}
                    className="shrink-0 rounded-xl border border-violet-400/40 bg-violet-400/10 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-400/20"
                  >
                    Add
                  </button>
                </div>
                <ul className="flex flex-1 flex-col gap-1.5 overflow-y-auto scroll-soft">
                  {portfolio.symbols.map((t) => (
                    <li
                      key={t}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                    >
                      <span className="font-medium">{t}</span>
                      <button
                        type="button"
                        onClick={() => portfolio.remove(t)}
                        className="text-[11px] text-slate-500 transition-colors hover:text-rose-400"
                      >
                        remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
            <PortfolioNewsPanel tickers={portfolio.symbols} ready={portfolio.ready} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function TopNav({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const items: { id: Tab; label: string; color: string }[] = [
    { id: "home", label: "Home", color: "emerald" },
    { id: "terminal", label: "Chart", color: "emerald" },
    { id: "news", label: "Portfolio", color: "violet" },
    { id: "learn", label: "Learn", color: "amber" },
  ]
  return (
    <header className="sticky top-0 z-40 flex shrink-0 flex-wrap items-center gap-3 border-b border-white/5 bg-black/40 px-6 py-3 backdrop-blur-xl">
      <button
        type="button"
        onClick={() => onTab("home")}
        className="flex items-center gap-2"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-lg brand-gradient-bg font-bold text-white">
          M
        </div>
        <div className="text-sm font-semibold tracking-tight text-white">
          Market<span className="brand-gradient-text">Lens</span>
        </div>
      </button>
      <nav className="ml-6 flex gap-1">
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            onClick={() => onTab(it.id)}
            className={`relative rounded-full px-4 py-1.5 text-[12px] font-medium transition-all ${
              tab === it.id ? "text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab === it.id ? (
              <motion.span
                layoutId="nav-pill"
                className="absolute inset-0 rounded-full bg-white/10"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            ) : null}
            <span className="relative">{it.label}</span>
          </button>
        ))}
      </nav>
    </header>
  )
}

function EmptyFeed() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400/20 to-violet-400/20 text-2xl">
        ✨
      </div>
      <div>
        <div className="text-sm font-semibold text-white">Drag across the chart</div>
        <div className="mt-1 text-[12px] text-slate-400">
          Or tap an auto-detected moment to see why that window moved.
        </div>
      </div>
    </motion.div>
  )
}
