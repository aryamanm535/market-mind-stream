"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  bumpStreak,
  earnedBadges,
  INITIAL_PROFILE,
  rankForXp,
  todayStamp,
  type GameProfile,
} from "@/lib/game"

const KEY = "mms-game-profile-v1"

function load(): GameProfile {
  if (typeof window === "undefined") return { ...INITIAL_PROFILE }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...INITIAL_PROFILE }
    const parsed = JSON.parse(raw) as Partial<GameProfile>
    return { ...INITIAL_PROFILE, ...parsed, topicsCorrect: { ...(parsed.topicsCorrect ?? {}) } }
  } catch {
    return { ...INITIAL_PROFILE }
  }
}

function save(p: GameProfile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* quota */
  }
}

export type GameEvent =
  | { kind: "xp"; amount: number; reason: string }
  | { kind: "badge"; badgeId: string }
  | { kind: "rank-up"; rankId: string }
  | { kind: "streak"; days: number }
  | { kind: "greet"; days: number }

type Listener = (e: GameEvent) => void

export function useGameProfile() {
  const [profile, setProfile] = useState<GameProfile>(INITIAL_PROFILE)
  const [ready, setReady] = useState(false)
  const listeners = useRef<Set<Listener>>(new Set())
  const greetedRef = useRef(false)

  useEffect(() => {
    setProfile(load())
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    save(profile)
  }, [profile, ready])

  // Daily greeting (fires once per session if it's a new day)
  useEffect(() => {
    if (!ready || greetedRef.current) return
    greetedRef.current = true
    const today = todayStamp()
    if (profile.lastActiveDay !== today) {
      emit({ kind: "greet", days: profile.streakDays })
    }
  }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps

  const subscribe = useCallback((fn: Listener) => {
    listeners.current.add(fn)
    return () => {
      listeners.current.delete(fn)
    }
  }, [])

  const emit = useCallback((e: GameEvent) => {
    for (const fn of listeners.current) fn(e)
  }, [])

  const update = useCallback(
    (mut: (p: GameProfile) => GameProfile, xpGain = 0, xpReason = "") => {
      setProfile((prev) => {
        const mutated = mut(prev)
        const prevRank = rankForXp(prev.xp).rank.id
        const newXp = mutated.xp + xpGain
        const nextRank = rankForXp(newXp).rank.id
        const next: GameProfile = { ...mutated, xp: newXp }

        const prevBadges = new Set(prev.badges)
        const newEarned = earnedBadges(next)
        next.badges = newEarned

        if (xpGain > 0 && xpReason) emit({ kind: "xp", amount: xpGain, reason: xpReason })
        for (const b of newEarned) {
          if (!prevBadges.has(b)) emit({ kind: "badge", badgeId: b })
        }
        if (prevRank !== nextRank) emit({ kind: "rank-up", rankId: nextRank })
        return next
      })
    },
    [emit]
  )

  const touchActivity = useCallback(() => {
    update((p) => {
      const today = todayStamp()
      if (p.lastActiveDay === today) return p
      const days = bumpStreak(p.lastActiveDay, p.streakDays)
      if (days > p.streakDays) emit({ kind: "streak", days })
      return { ...p, lastActiveDay: today, streakDays: days }
    })
  }, [update, emit])

  const recordTicker = useCallback(
    (sym: string) => {
      update((p) =>
        p.tickersExplored.includes(sym)
          ? p
          : { ...p, tickersExplored: [...p.tickersExplored, sym] }
      )
      touchActivity()
    },
    [update, touchActivity]
  )

  const recordTimeframe = useCallback(
    (tf: string) => {
      update((p) =>
        p.timeframesSeen.includes(tf)
          ? p
          : { ...p, timeframesSeen: [...p.timeframesSeen, tf] }
      )
    },
    [update]
  )

  const recordExplain = useCallback(() => {
    update((p) => ({ ...p, rangesExplained: p.rangesExplained + 1 }), 10, "Range explained")
    touchActivity()
  }, [update, touchActivity])

  const recordQuiz = useCallback(
    (correct: boolean, topic: string) => {
      update(
        (p) => ({
          ...p,
          quizTotal: p.quizTotal + 1,
          quizCorrect: p.quizCorrect + (correct ? 1 : 0),
          topicsCorrect: correct
            ? { ...p.topicsCorrect, [topic]: (p.topicsCorrect[topic] ?? 0) + 1 }
            : p.topicsCorrect,
        }),
        correct ? 15 : 3,
        correct ? "Correct answer" : "Nice try"
      )
      touchActivity()
    },
    [update, touchActivity]
  )

  const recordDraw = useCallback(() => {
    update((p) => ({ ...p, drawLines: p.drawLines + 1 }), 5, "Drew a comparison")
    touchActivity()
  }, [update, touchActivity])

  const recordCandles = useCallback(() => {
    update((p) => (p.candlesViewed ? p : { ...p, candlesViewed: true }), 5, "Candlestick view")
  }, [update])

  const rank = useMemo(() => rankForXp(profile.xp), [profile.xp])

  const reset = useCallback(() => {
    setProfile({ ...INITIAL_PROFILE })
  }, [])

  return {
    profile,
    ready,
    rank,
    subscribe,
    recordTicker,
    recordTimeframe,
    recordExplain,
    recordQuiz,
    recordDraw,
    recordCandles,
    touchActivity,
    reset,
  }
}

export type GameProfileHook = ReturnType<typeof useGameProfile>
