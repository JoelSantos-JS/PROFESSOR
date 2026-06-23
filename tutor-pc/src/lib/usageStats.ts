// Agrega eventos de uso de IA (+ sessões) em um resumo de CUSTO (US$) e TEMPO de uso.
// Puro/testável — alimenta o painel "Uso & Custo" e a avaliação de preço. Não conhece Electron.

import { estimateCostUsd, type UsageAmount } from './modelPricing'

export interface UsageEvent extends UsageAmount {
  at: number          // epoch ms
  provider: string    // 'groq' | 'openai' | 'gemini' | 'anthropic' | ...
  model?: string
  feature: string     // 'transcription' | 'analysis' | 'lookup' | 'professor' | ...
}

export interface SessionLite {
  startedAt: number
  endedAt?: number
}

export interface UsageStats {
  totalUsd: number
  todayUsd: number
  monthUsd: number
  totalTokens: number
  audioMinutes: number
  callCount: number
  byProvider: Array<{ provider: string; usd: number; calls: number }>
  byFeature: Array<{ feature: string; usd: number; calls: number }>
  usageMinutes: number        // soma das durações de sessão (tempo de uso)
  usageMinutesToday: number
  sessionCount: number
  avgUsdPerSession: number     // custo médio por sessão — útil pra precificar
}

const sameDay = (a: number, b: number): boolean => {
  const x = new Date(a), y = new Date(b)
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
}
const sameMonth = (a: number, b: number): boolean => {
  const x = new Date(a), y = new Date(b)
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth()
}

export function summarizeUsage(events: UsageEvent[], sessions: SessionLite[] = [], now = Date.now()): UsageStats {
  const evs = events ?? []

  let totalUsd = 0, todayUsd = 0, monthUsd = 0, totalTokens = 0, audioSeconds = 0
  const provMap = new Map<string, { usd: number; calls: number }>()
  const featMap = new Map<string, { usd: number; calls: number }>()

  for (const e of evs) {
    const usd = estimateCostUsd(e.provider, e.model ?? '', e)
    totalUsd += usd
    if (sameDay(e.at, now)) todayUsd += usd
    if (sameMonth(e.at, now)) monthUsd += usd
    totalTokens += (e.inputTokens ?? 0) + (e.outputTokens ?? 0)
    audioSeconds += e.audioSeconds ?? 0

    const prov = (e.provider || 'unknown').toLowerCase()
    const p = provMap.get(prov) ?? { usd: 0, calls: 0 }
    p.usd += usd; p.calls += 1; provMap.set(prov, p)

    const feat = e.feature || 'other'
    const f = featMap.get(feat) ?? { usd: 0, calls: 0 }
    f.usd += usd; f.calls += 1; featMap.set(feat, f)
  }

  // Tempo de uso a partir das sessões (só as com duração válida).
  let usageMs = 0, usageMsToday = 0, sessionCount = 0
  for (const s of sessions ?? []) {
    if (!s.endedAt || s.endedAt <= s.startedAt) continue
    const dur = s.endedAt - s.startedAt
    usageMs += dur
    sessionCount += 1
    if (sameDay(s.startedAt, now)) usageMsToday += dur
  }

  const byProvider = [...provMap.entries()]
    .map(([provider, v]) => ({ provider, usd: v.usd, calls: v.calls }))
    .sort((a, b) => b.usd - a.usd)
  const byFeature = [...featMap.entries()]
    .map(([feature, v]) => ({ feature, usd: v.usd, calls: v.calls }))
    .sort((a, b) => b.usd - a.usd)

  return {
    totalUsd,
    todayUsd,
    monthUsd,
    totalTokens,
    audioMinutes: audioSeconds / 60,
    callCount: evs.length,
    byProvider,
    byFeature,
    usageMinutes: usageMs / 60000,
    usageMinutesToday: usageMsToday / 60000,
    sessionCount,
    avgUsdPerSession: sessionCount > 0 ? totalUsd / sessionCount : 0,
  }
}
