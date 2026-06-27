// Extrai quanto esperar (ms) de um erro 429 (rate limit) do Groq/OpenAI. O corpo costuma trazer
// "Please try again in 3s" (ou "...in 1.5s" / "...in 800ms"). Sem isso, usa um fallback.
export function parseRetryDelayMs(body: string, fallbackMs = 3000): number {
  const m = body.match(/try again in\s*([\d.]+)\s*(ms|s)\b/i)
  if (m) {
    const n = parseFloat(m[1])
    const ms = m[2].toLowerCase() === 'ms' ? n : n * 1000
    return Math.min(10_000, Math.ceil(ms) + 300)  // +buffer p/ garantir que o limite já reabriu
  }
  return fallbackMs
}
