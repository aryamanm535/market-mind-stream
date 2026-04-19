"use client"

import { useMemo, useState } from "react"
import type { LearnTerm } from "@/lib/types"
import { useLearningStore } from "@/hooks/useLearningStore"

function byDue(a: { dueAt: number }, b: { dueAt: number }) {
  return a.dueAt - b.dueAt
}

export default function FlashcardsPanel() {
  const { ready, store, dueTermIds, gradeCard } = useLearningStore()
  const [showDef, setShowDef] = useState(false)
  const [idx, setIdx] = useState(0)

  const due = useMemo(() => {
    const t = Date.now()
    return Object.values(store.cards)
      .filter((c) => c.dueAt <= t)
      .sort(byDue)
      .map((c) => c.termId)
  }, [store.cards])

  const activeId = due[idx] ?? null
  const term: LearnTerm | null = activeId ? store.terms[activeId] ?? null : null
  const totalTerms = Object.keys(store.terms).length

  const next = () => {
    setShowDef(false)
    setIdx((i) => Math.min(due.length, i + 1))
  }

  if (!ready) {
    return <div className="p-6 text-sm text-slate-400">Loading flashcards…</div>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-white/5 bg-gradient-to-b from-white/[0.04] to-transparent px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Flashcards</h2>
            <p className="mt-1 text-[11px] text-slate-400">
              Reveal, self-grade, and the card gets rescheduled by spaced repetition.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[11px]">
            <span className="text-slate-400">
              Due <span className="font-mono text-emerald-300">{dueTermIds.length}</span>
            </span>
            <span className="h-4 w-px bg-white/10" />
            <span className="text-slate-400">
              Total <span className="font-mono text-slate-200">{totalTerms}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-soft p-6">
        {term ? (
          <div className="mx-auto max-w-2xl">
            <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {term.topic}
                  </div>
                  <div className="mt-2 text-3xl font-bold tracking-tight text-white">
                    {term.term}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDef((s) => !s)}
                  className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-[12px] font-semibold text-emerald-200 hover:bg-emerald-400/20"
                >
                  {showDef ? "Hide" : "Reveal"}
                </button>
              </div>

              {showDef ? (
                <div className="mt-5 space-y-3 border-t border-white/5 pt-4">
                  <p className="text-[14px] leading-relaxed text-slate-100">{term.definition}</p>
                  {term.example ? (
                    <p className="rounded-2xl border border-white/5 bg-black/30 p-3 text-[12px] text-slate-400">
                      <span className="text-slate-300">Example:</span> {term.example}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-5 text-[12px] text-slate-400">
                  Try to recall the definition first, then reveal.
                </p>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
              {(
                [
                  { g: 0 as const, label: "Again" },
                  { g: 1 as const, label: "Hard" },
                  { g: 2 as const, label: "Good" },
                  { g: 3 as const, label: "Easy" },
                ] as const
              ).map((x) => (
                <button
                  key={x.g}
                  type="button"
                  disabled={!showDef}
                  onClick={() => {
                    gradeCard(term.id, x.g)
                    next()
                  }}
                  className={`rounded-full border px-3 py-2 text-[12px] font-medium transition-all disabled:cursor-not-allowed ${
                    showDef
                      ? "border-white/10 bg-white/5 text-slate-200 hover:border-emerald-400/40 hover:text-emerald-200"
                      : "border-white/5 text-slate-600"
                  }`}
                >
                  {x.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-lg rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400/20 to-violet-400/20 text-2xl">
              📚
            </div>
            <div className="mt-3 text-sm font-semibold text-white">
              {totalTerms === 0 ? "No flashcards yet" : "All caught up for now"}
            </div>
            <div className="mt-1 text-[12px] text-slate-400">
              {totalTerms === 0
                ? "Drag a range on the Chart tab to generate terms from AI explanations."
                : "Come back later — scheduled reviews will show up here."}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
