import { describe, it, expect } from 'vitest'
import { summarizeUsage, type UsageEvent, type SessionLite } from './usageStats'

const now = new Date('2026-06-17T12:00:00').getTime()
const lastMonth = new Date('2026-05-10T12:00:00').getTime()

const events: UsageEvent[] = [
  { at: now,       provider: 'groq',   model: 'llama-3.1-8b-instant', feature: 'analysis',      inputTokens: 2_000_000, outputTokens: 1_000_000 }, // 0.18
  { at: now,       provider: 'openai', model: 'whisper-1',            feature: 'transcription', audioSeconds: 300 },                                  // 0.03 (5 min)
  { at: lastMonth, provider: 'groq',   model: 'llama-3.1-8b-instant', feature: 'analysis',      inputTokens: 1_000_000 },                             // 0.05
]

const sessions: SessionLite[] = [
  { startedAt: now - 600_000, endedAt: now },                 // 10 min, hoje
  { startedAt: lastMonth, endedAt: lastMonth + 300_000 },     // 5 min, mês passado
  { startedAt: now, endedAt: undefined },                     // sem fim → ignorada
]

describe('summarizeUsage', () => {
  it('entrada vazia → tudo zero', () => {
    const s = summarizeUsage([], [], now)
    expect(s.totalUsd).toBe(0)
    expect(s.callCount).toBe(0)
    expect(s.usageMinutes).toBe(0)
    expect(s.byProvider).toEqual([])
    expect(s.avgUsdPerSession).toBe(0)
  })

  it('custo total + hoje + mês', () => {
    const s = summarizeUsage(events, sessions, now)
    expect(s.totalUsd).toBeCloseTo(0.26, 6)   // 0.18 + 0.03 + 0.05
    expect(s.todayUsd).toBeCloseTo(0.21, 6)   // 0.18 + 0.03
    expect(s.monthUsd).toBeCloseTo(0.21, 6)   // junho: 0.18 + 0.03 (o de maio fora)
  })

  it('tokens e minutos de áudio agregados', () => {
    const s = summarizeUsage(events, sessions, now)
    expect(s.totalTokens).toBe(4_000_000)     // 3M + 0 + 1M
    expect(s.audioMinutes).toBeCloseTo(5, 6)  // 300s
    expect(s.callCount).toBe(3)
  })

  it('agrupa por provider e por feature, ordenado por custo', () => {
    const s = summarizeUsage(events, sessions, now)
    expect(s.byProvider[0]).toMatchObject({ provider: 'groq', calls: 2 })
    expect(s.byProvider[0].usd).toBeCloseTo(0.23, 6)   // 0.18 + 0.05
    expect(s.byProvider[1]).toMatchObject({ provider: 'openai', calls: 1 })
    expect(s.byFeature[0]).toMatchObject({ feature: 'analysis', calls: 2 })
    expect(s.byFeature.find(f => f.feature === 'transcription')!.usd).toBeCloseTo(0.03, 6)
  })

  it('tempo de uso só conta sessões com duração válida', () => {
    const s = summarizeUsage(events, sessions, now)
    expect(s.usageMinutes).toBeCloseTo(15, 6)        // 10 + 5 (a sem fim é ignorada)
    expect(s.usageMinutesToday).toBeCloseTo(10, 6)
    expect(s.sessionCount).toBe(2)
  })

  it('custo médio por sessão (pra avaliar preço)', () => {
    const s = summarizeUsage(events, sessions, now)
    expect(s.avgUsdPerSession).toBeCloseTo(0.13, 6)  // 0.26 / 2
  })
})
