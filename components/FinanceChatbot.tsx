"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import Owl from "./Owl"

type ChatMessage = { role: "user" | "assistant"; content: string }

const STORAGE_KEY = "hoot-chat-v1"

function load(): ChatMessage[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ChatMessage[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function save(m: ChatMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(m.slice(-60)))
  } catch {
    /* quota */
  }
}

export default function FinanceChatbot({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [ready, setReady] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessages(load())
    setReady(true)
  }, [])

  useEffect(() => {
    if (ready) save(messages)
  }, [messages, ready])

  useEffect(() => {
    if (!open) return
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [open, messages])

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return
    const next: ChatMessage[] = [...messages, { role: "user", content: text }]
    setMessages(next)
    setInput("")
    setSending(true)
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      })
      const json = (await res.json()) as { reply?: string; error?: string }
      const reply = json.reply ?? (json.error ? `⚠︎ ${json.error}` : "No reply.")
      setMessages((m) => [...m, { role: "assistant", content: reply }])
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error"
      setMessages((m) => [...m, { role: "assistant", content: `⚠︎ ${msg}` }])
    } finally {
      setSending(false)
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="chat"
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.96 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-auto fixed bottom-24 left-4 z-[80] flex h-[520px] w-[380px] flex-col overflow-hidden rounded-3xl border border-emerald-400/30 bg-[#0b1220]/95 shadow-[0_30px_80px_-20px_rgba(16,185,129,0.4)] backdrop-blur-xl"
        >
          <div className="flex items-center justify-between gap-2 border-b border-white/5 bg-gradient-to-b from-white/[0.04] to-transparent px-4 py-3">
            <div className="flex items-center gap-2">
              <Owl pose="think" size={32} />
              <div>
                <div className="text-sm font-semibold text-white">Ask Hoot</div>
                <div className="text-[10px] text-slate-400">
                  Finance-only · context stays local
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setMessages([])}
                  className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-400 hover:border-rose-400/40 hover:text-rose-200"
                  title="Clear chat history"
                >
                  Clear
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-300 hover:border-emerald-400/40 hover:text-emerald-200"
                title="Close chat"
              >
                ✕
              </button>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="scroll-soft flex-1 space-y-3 overflow-y-auto px-4 py-3"
          >
            {messages.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-center">
                <div className="text-sm font-semibold text-white">Ask me anything in markets</div>
                <div className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                  Try: &quot;What does a P/E ratio actually tell me?&quot; · &quot;Why did TSLA
                  pop today?&quot; · &quot;Explain bond yields to me like I&apos;m 12.&quot;
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
                      m.role === "user"
                        ? "bg-emerald-400/15 text-emerald-50"
                        : "bg-white/[0.04] text-slate-100"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))
            )}
            {sending ? (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-white/[0.04] px-3 py-2 text-[12px] text-slate-400">
                  Hoot is thinking…
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t border-white/5 bg-black/30 p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
                placeholder="Ask about a ticker, concept, or move…"
                rows={2}
                className="scroll-soft min-h-[44px] max-h-32 flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/50"
              />
              <button
                type="button"
                onClick={send}
                disabled={sending || input.trim().length === 0}
                className="shrink-0 rounded-xl border border-emerald-400/40 bg-emerald-400/15 px-3 py-2 text-xs font-semibold text-emerald-100 transition-all hover:bg-emerald-400/25 disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
