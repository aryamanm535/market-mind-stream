import type { ChartPoint, ChartTimeframe } from "./types"

function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h) + 1
}

/** Deterministic pseudo-random in [0, 1) from seed + index */
function prng(seed: number, i: number): number {
  const x = Math.sin(seed * 9999 + i * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function intradayLabel(i: number): string {
  const minutes = 9 * 60 + 30 + i * 5
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function quarterLabel(i: number): string {
  const baseYear = 2021
  const y = baseYear + Math.floor(i / 4)
  const q = (i % 4) + 1
  return `${y} Q${q}`
}

type TfSpec = { points: number; vol: number; drift: number; wave: number; cycle: number }

const TF: Record<ChartTimeframe, TfSpec> = {
  "1D": { points: 48, vol: 0.35, drift: 0.02, wave: 0.08, cycle: 1 },
  "1W": { points: 7, vol: 1.1, drift: 0.12, wave: 0.22, cycle: 1.2 },
  "1M": { points: 22, vol: 0.85, drift: 0.07, wave: 0.14, cycle: 2.5 },
  "3M": { points: 13, vol: 1.4, drift: 0.18, wave: 0.35, cycle: 2 },
  "1Y": { points: 12, vol: 2.8, drift: 0.35, wave: 0.75, cycle: 1.8 },
  "5Y": { points: 20, vol: 5.5, drift: 0.8, wave: 1.3, cycle: 2.2 },
}

function labelFor(tf: ChartTimeframe, i: number): string {
  switch (tf) {
    case "1D":
      return intradayLabel(i)
    case "1W":
      return WEEKDAYS[i] ?? `D${i + 1}`
    case "1M":
      return `D${i + 1}`
    case "3M":
      return `W${i + 1}`
    case "1Y":
      return MONTHS[i] ?? `M${i + 1}`
    case "5Y":
      return quarterLabel(i)
    default:
      return String(i)
  }
}

/**
 * Simulated price path per ticker + horizon (no external API).
 * Volatility / drift scale with timeframe so longer horizons swing more in % terms.
 */
export function buildSimulatedSeries(ticker: string, timeframe: ChartTimeframe): ChartPoint[] {
  const seed = hashSeed(`${ticker}|${timeframe}`)
  const spec = TF[timeframe]
  const base = 80 + (seed % 120)
  const driftSign = ((seed % 17) - 8) * 0.001
  const cycleLen = spec.cycle * (3 + (seed % 5))

  let price = base
  const out: ChartPoint[] = []

  for (let i = 0; i < spec.points; i++) {
    const noise = (prng(seed, i * 17 + timeframe.length) - 0.5) * spec.vol
    const wave = Math.sin(i / cycleLen) * spec.wave * (2 + (seed % 3) * 0.15)
    price += spec.drift * driftSign * 10 + wave + noise * 0.4
    price = Math.max(12, price)

    out.push({
      time: i,
      label: labelFor(timeframe, i),
      price: Math.round(price * 100) / 100,
    })
  }

  return out
}
