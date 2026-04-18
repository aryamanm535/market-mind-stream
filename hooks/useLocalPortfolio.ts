"use client"

import { useCallback, useEffect, useState } from "react"

const KEY = "mms-portfolio-v1"
const DEFAULTS = ["AAPL", "NVDA", "TSLA"]

function load(): string[] {
  if (typeof window === "undefined") return [...DEFAULTS]
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return [...DEFAULTS]
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return [...DEFAULTS]
    return arr
      .map((x) => String(x).trim().toUpperCase())
      .filter((s) => /^[A-Z0-9.\-]{1,20}$/.test(s))
      .slice(0, 40)
  } catch {
    return [...DEFAULTS]
  }
}

function save(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* quota */
  }
}

export function useLocalPortfolio() {
  const [symbols, setSymbols] = useState<string[]>(DEFAULTS)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setSymbols(load())
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    save(symbols)
  }, [symbols, ready])

  const add = useCallback((raw: string) => {
    const s = raw.trim().toUpperCase()
    if (!/^[A-Z0-9.\-]{1,20}$/.test(s)) return false
    setSymbols((prev) => {
      if (prev.includes(s)) return prev
      if (prev.length >= 40) return prev
      return [...prev, s]
    })
    return true
  }, [])

  const remove = useCallback((sym: string) => {
    const u = sym.toUpperCase()
    setSymbols((prev) => prev.filter((x) => x !== u))
  }, [])

  return { symbols, add, remove, ready }
}
