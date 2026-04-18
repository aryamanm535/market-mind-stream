import { generateRegionExplanation } from "@/lib/ai"
import { fetchGoogleNewsArticles } from "@/lib/googleNews"
import type { ChartSelectionRange, ChartTimeframe } from "@/lib/types"

const ALLOW_TF = new Set<ChartTimeframe>(["1D", "1W", "1M", "3M", "1Y", "5Y"])

type ExplainBody = {
  stock?: string
  range?: Partial<ChartSelectionRange>
}

export async function POST(req: Request) {
  let body: ExplainBody
  try {
    body = (await req.json()) as ExplainBody
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const stock = String(body.stock ?? "AAPL").toUpperCase()
  const r = body.range

  if (
    r?.startIndex == null ||
    r?.endIndex == null ||
    r?.startLabel == null ||
    r?.endLabel == null ||
    r?.pctChange == null ||
    r?.startPrice == null ||
    r?.endPrice == null
  ) {
    return Response.json(
      { error: "range must include indices, labels, prices, and pctChange" },
      { status: 400 }
    )
  }

  const tfRaw = r.timeframe
  const timeframe: ChartTimeframe =
    typeof tfRaw === "string" && ALLOW_TF.has(tfRaw as ChartTimeframe)
      ? (tfRaw as ChartTimeframe)
      : "1D"

  const startFull = String(r.startLabelFull ?? r.startLabel ?? "").trim()
  const endFull = String(r.endLabelFull ?? r.endLabel ?? "").trim()
  const rangeSummary = `horizon ${timeframe}; index ${r.startIndex}→${
    r.endIndex
  }; window ${startFull || r.startLabel}–${endFull || r.endLabel}; axis ${r.startLabel}–${
    r.endLabel
  }; prices ${r.startPrice} → ${r.endPrice}`

  const articles = await fetchGoogleNewsArticles(stock, 5)

  const result = await generateRegionExplanation(stock, rangeSummary, {
    pctChange: r.pctChange,
    startLabel: r.startLabel,
    endLabel: r.endLabel,
    startLabelFull: startFull || String(r.startLabel),
    endLabelFull: endFull || String(r.endLabel),
    timeframe,
  }, articles)

  return Response.json(result)
}
