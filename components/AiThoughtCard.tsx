"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { clsx } from "clsx"
import type { LearnPack, MarketThought } from "@/lib/types"
import PredictionQuiz from "./PredictionQuiz"

const actionStyles: Record<string, { border: string; badge: string; glow: string }> = {
  BUY: {
    border: "border-emerald-400/40",
    badge: "bg-emerald-400/15 text-emerald-300",
    glow: "shadow-[0_20px_60px_-20px_rgba(16,185,129,0.5)]",
  },
  WATCH: {
    border: "border-amber-400/40",
    badge: "bg-amber-400/15 text-amber-200",
    glow: "shadow-[0_20px_60px_-20px_rgba(251,191,36,0.4)]",
  },
  IGNORE: {
    border: "border-slate-600/40",
    badge: "bg-slate-500/15 text-slate-300",
    glow: "",
  },
  EXPLAIN: {
    border: "border-violet-400/40",
    badge: "bg-violet-400/15 text-violet-200",
    glow: "shadow-[0_20px_60px_-20px_rgba(139,92,246,0.4)]",
  },
  ERROR: {
    border: "border-rose-500/50",
    badge: "bg-rose-500/15 text-rose-300",
    glow: "",
  },
}

export default function AiThoughtCard({
  item,
  i,
  onLaunchLearn,
}: {
  item: MarketThought
  i: number
  onLaunchLearn?: (pack: LearnPack, dest: "driver" | "quiz" | "trade" | "flashcards" | "mastery") => void
}) {
  const action = (item.action in actionStyles ? item.action : "WATCH") as keyof typeof actionStyles
  const style = actionStyles[action]
  const [predicted, setPredicted] = useState(false)
  const direction =
    item.thought.toLowerCase().includes("gain") ||
    item.thought.toLowerCase().includes("rally") ||
    item.thought.toLowerCase().includes("rose")
      ? "up"
      : item.thought.toLowerCase().includes("drop") ||
        item.thought.toLowerCase().includes("fell") ||
        item.thought.toLowerCase().includes("sell")
      ? "down"
      : null

  const predictionChoices = item.topFactors?.map((f) => f.factor) ?? [
    "Earnings / fundamentals",
    "Macro / rates",
    "Sector flows",
    "Technical setup",
  ]
  const correct = item.topFactors?.[0]?.factor ?? predictionChoices[0]

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.2), ease: [0.16, 1, 0.3, 1] }}
      className={clsx(
        "mb-4 overflow-hidden rounded-3xl border bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-4 backdrop-blur-xl",
        style.border,
        style.glow
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xl font-bold tracking-tight text-white">{item.ticker}</div>
          {item.regionLabel ? (
            <div className="mt-0.5 text-[11px] text-slate-400">{item.regionLabel}</div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={clsx(
              "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider",
              style.badge
            )}
          >
            {action}
          </span>
          <div className="flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1">
            <div className="h-1.5 w-8 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-violet-400"
                style={{ width: `${item.confidence}%` }}
              />
            </div>
            <span className="font-mono text-[11px] text-slate-300">{item.confidence}%</span>
          </div>
        </div>
      </div>

      {/* Prediction quiz */}
      {action !== "ERROR" && !predicted && predictionChoices.length >= 2 ? (
        <PredictionQuiz
          direction={direction}
          choices={predictionChoices.slice(0, 4)}
          correct={correct}
          onDone={() => setPredicted(true)}
        />
      ) : null}

      <AnimatePresence initial={false}>
        {(predicted || action === "ERROR") && (
          <motion.div
            key="body"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <p className="mt-3 text-[14px] leading-relaxed text-slate-100">{item.thought}</p>
            {item.topFactors?.length ? (
              <div className="mt-3 rounded-2xl border border-white/5 bg-black/30 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Top drivers
                </div>
                <ol className="mt-2 space-y-2">
                  {item.topFactors.slice(0, 2).map((f, idx) => (
                    <li key={idx} className="flex gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-[10px] font-bold text-emerald-300">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-emerald-200">{f.factor}</div>
                        <div className="mt-0.5 text-[12px] leading-relaxed text-slate-400">
                          {f.evidence}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
            {item.whatToWatch ? (
              <div className="mt-3 rounded-2xl border border-violet-400/20 bg-violet-500/5 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-violet-300">
                  What to watch
                </div>
                <div className="mt-1 text-[13px] text-slate-200">{item.whatToWatch}</div>
              </div>
            ) : null}
            {item.reasoning.length > 0 ? (
              <ul className="mt-3 space-y-1.5 border-t border-white/5 pt-3">
                {item.reasoning.map((r, j) => (
                  <li key={j} className="flex gap-2 text-[12px] text-slate-400">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-400/70" />
                    <span className="leading-relaxed">{r}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {item.learn && onLaunchLearn ? (
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/5 pt-3">
                {(
                  [
                    { id: "driver" as const, label: "Driver game" },
                    { id: "quiz" as const, label: "Quiz" },
                    { id: "trade" as const, label: "Paper trade" },
                    { id: "flashcards" as const, label: "Flashcards" },
                    { id: "mastery" as const, label: "Mastery" },
                  ] as const
                ).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onLaunchLearn(item.learn as LearnPack, b.id)}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-slate-200 transition-colors hover:border-emerald-400/40 hover:bg-emerald-400/10 hover:text-emerald-200"
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            ) : null}

            {item.sources?.length ? (
              <div className="mt-3 border-t border-white/5 pt-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Sources
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {item.sources.slice(0, 4).map((s) => (
                    <a
                      key={s.url}
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group inline-flex max-w-[220px] items-center gap-1 truncate rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-slate-200 hover:border-violet-400/40 hover:text-violet-200"
                    >
                      <span className="truncate">{s.title}</span>
                      <span className="shrink-0 text-slate-500 group-hover:text-violet-300">↗</span>
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  )
}
