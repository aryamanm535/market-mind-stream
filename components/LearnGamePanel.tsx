"use client"

import { useMemo, useState } from "react"
import type { LearnPack, LearnQuizQuestion, LearnTopic, QuizAttempt } from "@/lib/types"

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function topicColor(topic: LearnTopic) {
  switch (topic) {
    case "Macro":
      return "border-blue-500/30 bg-blue-500/5 text-blue-200"
    case "Earnings":
      return "border-purple-500/30 bg-purple-500/5 text-purple-200"
    case "Technicals":
      return "border-emerald-500/30 bg-emerald-500/5 text-emerald-200"
    case "Sentiment":
      return "border-amber-500/30 bg-amber-500/5 text-amber-200"
    case "Risk":
      return "border-red-500/30 bg-red-500/5 text-red-200"
    default:
      return "border-zinc-700 bg-zinc-900/40 text-zinc-200"
  }
}

function formatAge(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function LearnGamePanel({
  pack,
  onAttempt,
  history = [],
  // initialSection kept for compat with page.tsx callers; unused.
  initialSection: _initialSection,
}: {
  pack: LearnPack
  onAttempt: (a: QuizAttempt) => void
  history?: QuizAttempt[]
  initialSection?: "driver" | "quiz" | "trade"
}) {
  const [picked, setPicked] = useState<Record<string, number>>({})

  const quiz = useMemo(() => pack.quiz?.slice(0, 5) ?? [], [pack.quiz])

  const answer = (q: LearnQuizQuestion, idx: number) => {
    setPicked((p) => ({ ...p, [q.id]: idx }))
    onAttempt({
      id: uid(),
      ts: Date.now(),
      questionId: q.id,
      topic: q.topic,
      correct: idx === q.correctIndex,
      selectedIndex: idx,
      confidence: 2,
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-zinc-800/90 bg-gradient-to-b from-[#0b1020] to-[#070a12] p-4 shadow-[0_0_30px_-18px_rgba(34,197,94,0.35)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold tracking-tight text-zinc-100">Stock quiz</div>
            <div className="mt-0.5 font-mono text-[11px] text-zinc-500">
              Selection: <span className="text-cyan-300/80">{pack.rangeLabel}</span> ·{" "}
              <span className="text-zinc-400">{pack.timeframe}</span>
            </div>
          </div>
          <span className="rounded border border-zinc-800 px-2 py-0.5 font-mono text-[10px] text-zinc-500">
            {quiz.length} questions
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800/90 bg-[#0a0d14] p-4">
        <div className="text-sm font-semibold tracking-tight text-zinc-100">
          Questions about this move
        </div>
        <p className="mt-1 text-[11px] text-zinc-500">
          AI-generated from the range and news. Pick an answer to see the explanation.
        </p>
        <div className="mt-3 space-y-3">
          {quiz.length === 0 ? (
            <div className="rounded-md border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">
              No quiz questions were generated for this selection.
            </div>
          ) : null}
          {quiz.map((q) => {
            const sel = picked[q.id]
            return (
              <div key={q.id} className="rounded-md border border-zinc-800/80 bg-zinc-950/40 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="text-sm font-semibold text-zinc-100">{q.prompt}</div>
                  <span className={`rounded border px-2 py-0.5 font-mono text-[10px] ${topicColor(q.topic)}`}>
                    {q.topic}
                  </span>
                </div>
                <div className="mt-2 flex flex-col gap-2">
                  {q.choices.map((c, i) => {
                    const chosen = sel === i
                    const show = sel != null
                    const correct = i === q.correctIndex
                    const cls = show
                      ? correct
                        ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-100"
                        : chosen
                          ? "border-red-500/60 bg-red-500/10 text-red-100"
                          : "border-zinc-800 text-zinc-400"
                      : "border-zinc-800 text-zinc-300 hover:border-zinc-600"
                    return (
                      <button
                        key={`${q.id}-${i}`}
                        type="button"
                        disabled={sel != null}
                        onClick={() => answer(q, i)}
                        className={`rounded-md border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed ${cls}`}
                      >
                        {c}
                      </button>
                    )
                  })}
                </div>
                {sel != null ? (
                  <p className="mt-2 text-sm text-zinc-300">
                    <span className="font-semibold text-zinc-100">Explanation:</span> {q.explanation}
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      {history.length > 0 ? (
        <div className="rounded-xl border border-zinc-800/90 bg-[#0a0d14] p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold tracking-tight text-zinc-100">Attempt history</div>
            <span className="font-mono text-[10px] text-zinc-500">
              {history.filter((a) => a.correct).length}/{history.length} correct
            </span>
          </div>
          <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto scroll-soft pr-1">
            {history.slice(0, 40).map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-md border border-zinc-800/70 bg-zinc-950/40 px-3 py-1.5 font-mono text-[11px]"
              >
                <span className="flex items-center gap-2 truncate">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      a.correct ? "bg-emerald-400" : "bg-rose-400"
                    }`}
                  />
                  <span className={`rounded border px-1.5 ${topicColor(a.topic)}`}>{a.topic}</span>
                  <span className="truncate text-zinc-400">
                    {a.correct ? "Correct" : "Missed"}
                  </span>
                </span>
                <span className="text-zinc-500">{formatAge(a.ts)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
