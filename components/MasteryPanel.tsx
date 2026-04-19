"use client"

import { useMemo } from "react"
import { useLearningStore } from "@/hooks/useLearningStore"
import type { LearnTopic, TopicMastery } from "@/lib/types"

const ALL_TOPICS: LearnTopic[] = [
  "Macro",
  "Earnings",
  "Technicals",
  "Sentiment",
  "Risk",
  "MarketStructure",
]

function barColor(score: number) {
  if (score >= 75) return "bg-emerald-400/70"
  if (score >= 55) return "bg-amber-400/70"
  if (score > 0) return "bg-rose-400/70"
  return "bg-white/10"
}

export default function MasteryPanel() {
  const { ready, mastery, store } = useLearningStore()

  const rows = useMemo<TopicMastery[]>(() => {
    const byTopic = new Map<LearnTopic, TopicMastery>(
      mastery.map((m) => [m.topic, m])
    )
    return ALL_TOPICS.map(
      (t): TopicMastery =>
        byTopic.get(t) ?? {
          topic: t,
          score: 0,
          attempts: 0,
          correct: 0,
          streak: 0,
        }
    ).sort((a, b) => b.score - a.score)
  }, [mastery])

  const overall = useMemo(() => {
    if (mastery.length === 0) return 0
    const total = mastery.reduce((acc, m) => acc + m.score * Math.max(1, m.attempts), 0)
    const weight = mastery.reduce((acc, m) => acc + Math.max(1, m.attempts), 0)
    return weight > 0 ? Math.round(total / weight) : 0
  }, [mastery])

  if (!ready) {
    return <div className="p-6 text-sm text-slate-400">Loading mastery…</div>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-white/5 bg-gradient-to-b from-white/[0.04] to-transparent px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Knowledge dashboard</h2>
            <p className="mt-1 text-[11px] text-slate-400">
              Accuracy per topic across all your quiz attempts. Total attempts:{" "}
              <span className="text-slate-200">{store.attempts.length}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Overall
            </span>
            <span className="font-mono text-lg text-white">{overall}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-soft p-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {rows.map((r) => (
            <div
              key={r.topic}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-white">{r.topic}</div>
                <div className="font-mono text-[11px] text-slate-400">
                  {r.attempts > 0
                    ? `${r.correct}/${r.attempts} correct · streak ${r.streak}`
                    : "No attempts yet"}
                </div>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className={`h-full rounded-full transition-all ${barColor(r.score)}`}
                  style={{ width: `${Math.max(0, Math.min(100, r.score))}%` }}
                />
              </div>
              <div className="mt-2 font-mono text-[11px] text-slate-400">
                Score <span className="text-slate-200">{r.score}</span>/100
              </div>
            </div>
          ))}
        </div>

        {store.attempts.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-center text-[12px] text-slate-400">
            No quiz attempts yet. Head to <span className="text-white">Chart</span>, drag across
            a range, and click the <span className="text-white">Quiz</span> button on the card.
          </div>
        ) : null}
      </div>
    </div>
  )
}
