"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"

type Props = {
  direction: "up" | "down" | null
  choices: string[]
  correct: string
  onDone: () => void
}

export default function PredictionQuiz({ direction, choices, correct, onDone }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)

  const handlePick = (c: string) => {
    if (revealed) return
    setSelected(c)
    setRevealed(true)
    window.setTimeout(() => onDone(), 1200)
  }

  const isCorrect = selected === correct

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/5 via-violet-500/5 to-transparent p-3"
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-violet-400/20 text-[10px]">
          ?
        </span>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-violet-300">
          Your call
        </div>
      </div>
      <div className="mt-1.5 text-[13px] text-slate-100">
        {direction === "up"
          ? "This range moved up. What do you think drove it?"
          : direction === "down"
          ? "This range moved down. What do you think drove it?"
          : "What do you think drove this move?"}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {choices.map((c) => {
          const isSel = selected === c
          const isCor = c === correct
          const show = revealed
          return (
            <motion.button
              key={c}
              whileTap={{ scale: 0.97 }}
              disabled={revealed}
              onClick={() => handlePick(c)}
              className={`rounded-xl border px-3 py-2 text-left text-[12px] font-medium transition-all ${
                show
                  ? isCor
                    ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-100"
                    : isSel
                    ? "border-rose-400/60 bg-rose-400/10 text-rose-200"
                    : "border-white/5 bg-white/[0.02] text-slate-500"
                  : "border-white/10 bg-white/5 text-slate-100 hover:border-violet-400/40 hover:bg-violet-400/10"
              }`}
            >
              {c}
              {show && isCor ? <span className="ml-2 text-emerald-300">✓</span> : null}
              {show && isSel && !isCor ? <span className="ml-2 text-rose-300">✗</span> : null}
            </motion.button>
          )
        })}
      </div>
      <AnimatePresence>
        {revealed ? (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 text-[11px] text-slate-400"
          >
            {isCorrect
              ? "Nice — that matched the AI's top driver. Revealing full breakdown…"
              : `Close — the AI's top driver was ${correct}. Here's why…`}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  )
}
