export const runtime = "nodejs"

function clampSym(s: string) {
  const u = s.trim().toUpperCase()
  if (!/^[A-Z0-9.\-]{1,12}$/.test(u)) return "NEWS"
  return u
}

function colorFrom(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  const hue = Math.abs(h) % 360
  return hue
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const ticker = clampSym(searchParams.get("ticker") ?? "NEWS")
  const hue = colorFrom(ticker)
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue}, 85%, 55%)" stop-opacity="0.95"/>
      <stop offset="1" stop-color="hsl(${(hue + 42) % 360}, 90%, 45%)" stop-opacity="0.95"/>
    </linearGradient>
    <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="rgba(0,0,0,0.55)"/>
    </filter>
  </defs>
  <rect x="6" y="6" width="52" height="52" rx="14" fill="url(#g)" filter="url(#s)"/>
  <rect x="10" y="10" width="44" height="44" rx="12" fill="rgba(0,0,0,0.12)"/>
  <text x="32" y="38" text-anchor="middle"
        font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
        font-size="16" font-weight="700" fill="rgba(255,255,255,0.92)">
    ${ticker.slice(0, 5)}
  </text>
</svg>`

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  })
}

