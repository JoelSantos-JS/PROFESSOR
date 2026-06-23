// Estimativa de custo em US$ por chamada de IA (BYOK) — para o usuário ver quanto gasta e
// pra avaliarmos preço. Núcleo puro/testável. Tabela de preços APROXIMADA (conferir no provider):
// modelos de chat cobram por token (US$/1M in/out); modelos de transcrição (Whisper) por minuto.

export interface ModelPrice {
  inPerM?: number       // US$ por 1M tokens de entrada
  outPerM?: number      // US$ por 1M tokens de saída
  perAudioMin?: number  // US$ por minuto de áudio (transcrição estilo Whisper)
}

export interface UsageAmount {
  inputTokens?: number
  outputTokens?: number
  audioSeconds?: number
}

// Valores aproximados (~2026). Centralizado: ajustar aqui reflete em todo o app.
export const PRICING: Record<string, Record<string, ModelPrice>> = {
  groq: {
    'llama-3.1-8b-instant':    { inPerM: 0.05, outPerM: 0.08 },
    'llama-3.3-70b-versatile': { inPerM: 0.59, outPerM: 0.79 },   // modelo do tutor
    'whisper-large-v3':        { perAudioMin: 0.04 / 60 },         // Groq cobra ~US$0.04/hora
    'whisper-large-v3-turbo':  { perAudioMin: 0.04 / 60 },
  },
  openai: {
    'gpt-4o-mini': { inPerM: 0.15, outPerM: 0.60 },
    'whisper-1':   { perAudioMin: 0.006 },
  },
  gemini: {
    // O Gemini transcreve pelo modelo multimodal (áudio vira tokens) — tratamos como tokens.
    'gemini-2.5-flash': { inPerM: 0.075, outPerM: 0.30 },
  },
  anthropic: {
    'claude-haiku-4-5': { inPerM: 1.0, outPerM: 5.0 },
  },
}

// Fallback conservador quando o modelo é desconhecido (evita custo "zero" enganoso).
const FALLBACK: ModelPrice = { inPerM: 0.5, outPerM: 1.5, perAudioMin: 0.006 }

/** Preço de um modelo (com fallback). `provider`/`model` toleram maiúsc./minúsc. */
export function priceFor(provider: string, model: string): ModelPrice {
  const p = PRICING[(provider || '').toLowerCase()]
  return (p && p[model]) || FALLBACK
}

/** Custo estimado (US$) de uma chamada, somando tokens + áudio conforme o preço do modelo. */
export function estimateCostUsd(provider: string, model: string, usage: UsageAmount): number {
  const price = priceFor(provider, model)
  const inTok = Math.max(0, usage.inputTokens ?? 0)
  const outTok = Math.max(0, usage.outputTokens ?? 0)
  const audioMin = Math.max(0, usage.audioSeconds ?? 0) / 60
  const cost =
    (inTok / 1_000_000) * (price.inPerM ?? 0) +
    (outTok / 1_000_000) * (price.outPerM ?? 0) +
    audioMin * (price.perAudioMin ?? 0)
  return Number.isFinite(cost) ? cost : 0
}

/** Formata US$ com precisão útil pra valores pequenos (ex.: "$0.0042", "$1.20"). */
export function formatUsd(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return '$0.00'
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  if (usd < 1) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(2)}`
}
