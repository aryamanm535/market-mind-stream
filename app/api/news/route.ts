import { generatePortfolioNewsDigest } from "@/lib/ai"
import { fetchGoogleNewsArticles } from "@/lib/googleNews"
import type { PortfolioNewsItem } from "@/lib/types"

export const runtime = "nodejs"

/** Server cache: default 3m 30s (stay under free-tier bursts; align with client refresh). */
const CACHE_TTL_MS = Math.max(
  180_000,
  Math.min(240_000, Number(process.env.NEWS_CACHE_TTL_MS ?? 210_000))
)

type CacheEntry = { at: number; body: unknown }

const cache = new Map<string, CacheEntry>()

function parseTickers(raw: string | null): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z0-9.\-]{1,20}$/.test(s))
    .slice(0, 24)
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const tickers = parseTickers(searchParams.get("tickers"))
  if (tickers.length === 0) {
    return Response.json({ items: [], tickers: [], cached: false, error: "No valid tickers" })
  }

  const key = [...new Set(tickers)].sort().join(",")
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && now - hit.at < CACHE_TTL_MS) {
    return Response.json({ ...(hit.body as object), cached: true })
  }

  try {
    const articleGroups = await Promise.all(tickers.map((t) => fetchGoogleNewsArticles(t, 6)))
    const articles = articleGroups.flat()
    const rawItems = await generatePortfolioNewsDigest(tickers, articles)
    const items: PortfolioNewsItem[] = rawItems.map((it) => {
      const link = it.link
      const idSafe = encodeURIComponent(String(it.id ?? `${it.ticker}-${it.publishedAt}`))
      const imageUrl = `/api/news/image?ticker=${encodeURIComponent(it.ticker)}&id=${idSafe}`

      return {
        ...it,
        link,
        imageUrl,
        sourceLinks: it.sourceLinks?.length ? it.sourceLinks : [{ title: it.publisher, url: link }],
      }
    })
    const body = {
      items,
      tickers,
      fetchedAt: now,
      cached: false,
      cacheTtlSec: Math.round(CACHE_TTL_MS / 1000),
      source: "llm",
    }
    cache.set(key, { at: now, body })
    return Response.json(body)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "News digest failed"
    return Response.json({ items: [], tickers, cached: false, error: msg }, { status: 502 })
  }
}
