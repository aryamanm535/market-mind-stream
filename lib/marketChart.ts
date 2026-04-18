/**
 * Live chart prices — provider chain:
 *
 * 1. **yahoo-finance2** — Uses the same Yahoo Finance chart API as the website, with proper
 *    sessions (works when raw `fetch` gets HTTP 429).
 * 2. **FINNHUB_API_KEY** — `/stock/candle` (many free keys only allow **quote**, not candles;
 *    if Finnhub returns "no access", we skip silently).
 * 3. **TWELVE_DATA_API_KEY** — backup time series API.
 */

import YahooFinance from "yahoo-finance2"
import type { ChartPoint, ChartTimeframe } from "./types"

const yahooFinance = new YahooFinance()

function formatAxisLabel(tsSec: number, tf: ChartTimeframe): string {
  const d = new Date(tsSec * 1000)
  if (tf === "1D") {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })
  }
  if (tf === "1W") {
    return d.toLocaleString(undefined, {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  }
  if (tf === "1M" || tf === "3M") {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  }
  if (tf === "1Y") {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" })
  }
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" })
}

function toChartPoints(timestamps: number[], prices: Array<number | null>, tf: ChartTimeframe): ChartPoint[] {
  const out: ChartPoint[] = []
  let last: number | null = null
  for (let i = 0; i < timestamps.length; i++) {
    const t = timestamps[i]!
    let v = prices[i]
    if (v == null || Number.isNaN(v)) {
      if (last != null) v = last
      else continue
    } else {
      last = v
    }
    out.push({
      time: out.length,
      label: formatAxisLabel(t, tf),
      price: Math.round(v * 100) / 100,
      ts: t,
    })
  }
  return out
}

/** Same Yahoo ranges as finance.yahoo.com chart widget. */
const YF2: Record<
  ChartTimeframe,
  { lookbackMs: number; interval: "5m" | "15m" | "1d" | "1wk" | "1mo" }
> = {
  "1D": { lookbackMs: 5 * 86400000, interval: "5m" },
  "1W": { lookbackMs: 10 * 86400000, interval: "15m" },
  "1M": { lookbackMs: 46 * 86400000, interval: "1d" },
  "3M": { lookbackMs: 100 * 86400000, interval: "1d" },
  "1Y": { lookbackMs: 400 * 86400000, interval: "1wk" },
  "5Y": { lookbackMs: 6 * 365 * 86400000, interval: "1mo" },
}

async function fetchYahooFinance2Series(symbol: string, timeframe: ChartTimeframe): Promise<ChartPoint[]> {
  const now = Date.now()
  const period2 = new Date(now)
  const { lookbackMs, interval } = YF2[timeframe]
  const period1 = new Date(now - lookbackMs)

  const result = await yahooFinance.chart(symbol, {
    period1,
    period2,
    interval,
  })

  const quotes = result.quotes
  if (!quotes?.length) throw new Error("Yahoo chart returned no bars")

  const pts: ChartPoint[] = []
  let idx = 0
  for (const q of quotes) {
    const close = q.close
    if (close == null || Number.isNaN(Number(close))) continue
    const d = q.date instanceof Date ? q.date : new Date(q.date as string)
    const ts = Math.floor(d.getTime() / 1000)
    pts.push({
      time: idx++,
      label: formatAxisLabel(ts, timeframe),
      price: Math.round(Number(close) * 100) / 100,
      ts,
    })
  }

  if (pts.length === 0) throw new Error("Yahoo chart had no usable closes")
  return pts
}

// --- Finnhub (optional; free tier often excludes candles) ---

const FINNHUB_CFG: Record<ChartTimeframe, { resolution: string; daysBack: number }> = {
  "1D": { resolution: "5", daysBack: 5 },
  "1W": { resolution: "60", daysBack: 14 },
  "1M": { resolution: "D", daysBack: 45 },
  "3M": { resolution: "D", daysBack: 120 },
  "1Y": { resolution: "W", daysBack: 450 },
  "5Y": { resolution: "M", daysBack: 365 * 7 },
}

async function fetchFinnhubSeries(
  symbol: string,
  timeframe: ChartTimeframe,
  token: string
): Promise<ChartPoint[]> {
  const { resolution, daysBack } = FINNHUB_CFG[timeframe]
  const now = Math.floor(Date.now() / 1000)
  const from = now - daysBack * 86400
  const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(
    symbol
  )}&resolution=${resolution}&from=${from}&to=${now}&token=${encodeURIComponent(token)}`

  const res = await fetch(url, { cache: "no-store" })
  const json = (await res.json()) as {
    s?: string
    t?: number[]
    c?: number[]
    error?: string
  }

  if ((json as { error?: string }).error === "You don't have access to this resource.") {
    throw new Error("finnhub_no_candle_access")
  }

  if (json.s !== "ok" || !json.t?.length || !json.c?.length) {
    throw new Error(json.error || json.s || "Finnhub returned no candles")
  }

  return toChartPoints(json.t, json.c, timeframe)
}

// --- Twelve Data ---

const TD_INTERVAL: Record<ChartTimeframe, string> = {
  "1D": "5min",
  "1W": "30min",
  "1M": "1day",
  "3M": "1day",
  "1Y": "1week",
  "5Y": "1month",
}

const TD_OUTPUTSIZE: Record<ChartTimeframe, string> = {
  "1D": "100",
  "1W": "80",
  "1M": "120",
  "3M": "120",
  "1Y": "60",
  "5Y": "80",
}

async function fetchTwelveDataSeries(
  symbol: string,
  timeframe: ChartTimeframe,
  apikey: string
): Promise<ChartPoint[]> {
  const interval = TD_INTERVAL[timeframe]
  const outputsize = TD_OUTPUTSIZE[timeframe]
  const url = new URL("https://api.twelvedata.com/time_series")
  url.searchParams.set("symbol", symbol)
  url.searchParams.set("interval", interval)
  url.searchParams.set("outputsize", outputsize)
  url.searchParams.set("apikey", apikey)

  const res = await fetch(url.toString(), { cache: "no-store" })
  const json = (await res.json()) as {
    values?: Array<{ datetime: string; close: string }>
    message?: string
    status?: string
  }

  if (!json.values?.length) {
    throw new Error(json.message || json.status || "Twelve Data returned no rows")
  }

  const ts: number[] = []
  const closes: Array<number | null> = []
  for (const row of json.values) {
    const d = new Date(row.datetime.replace(" ", "T"))
    const sec = Math.floor(d.getTime() / 1000)
    ts.push(sec)
    closes.push(parseFloat(row.close))
  }
  ts.reverse()
  closes.reverse()
  return toChartPoints(ts, closes, timeframe)
}

export type ChartFetchSource = "yahoo" | "finnhub" | "twelvedata"

export async function fetchMarketChartSeries(
  symbol: string,
  timeframe: ChartTimeframe
): Promise<{ points: ChartPoint[]; source: ChartFetchSource }> {
  const sym = symbol.trim().toUpperCase()
  if (!/^[A-Z0-9.\-]{1,32}$/.test(sym)) {
    throw new Error("Invalid symbol")
  }

  try {
    const points = await fetchYahooFinance2Series(sym, timeframe)
    if (points.length > 0) return { points, source: "yahoo" }
  } catch {
    /* fall through */
  }

  const finnhubKey = process.env.FINNHUB_API_KEY?.trim()
  if (finnhubKey) {
    try {
      const points = await fetchFinnhubSeries(sym, timeframe, finnhubKey)
      if (points.length > 0) return { points, source: "finnhub" }
    } catch {
      /* try next */
    }
  }

  const twelveKey = process.env.TWELVE_DATA_API_KEY?.trim()
  if (twelveKey) {
    try {
      const points = await fetchTwelveDataSeries(sym, timeframe, twelveKey)
      if (points.length > 0) return { points, source: "twelvedata" }
    } catch {
      /* try next */
    }
  }

  throw new Error(
    "Could not load market data. Check the symbol, try again, or set TWELVE_DATA_API_KEY as a backup."
  )
}
