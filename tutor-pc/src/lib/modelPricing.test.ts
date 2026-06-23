import { describe, it, expect } from 'vitest'
import { estimateCostUsd, priceFor, formatUsd } from './modelPricing'

describe('estimateCostUsd', () => {
  it('cobra por token (entrada + saída)', () => {
    // groq llama: 0.05/M in, 0.08/M out → 1M+1M = 0.13
    expect(estimateCostUsd('groq', 'llama-3.1-8b-instant', { inputTokens: 1_000_000, outputTokens: 1_000_000 }))
      .toBeCloseTo(0.13, 6)
  })
  it('cobra por minuto de áudio (Whisper)', () => {
    expect(estimateCostUsd('openai', 'whisper-1', { audioSeconds: 120 })).toBeCloseTo(0.012, 6)  // 2 min × 0.006
    expect(estimateCostUsd('groq', 'whisper-large-v3', { audioSeconds: 3600 })).toBeCloseTo(0.04, 6)  // 1h = $0.04
  })
  it('soma tokens + áudio quando ambos existem', () => {
    const c = estimateCostUsd('openai', 'gpt-4o-mini', { inputTokens: 1_000_000, audioSeconds: 0 })
    expect(c).toBeCloseTo(0.15, 6)
  })
  it('modelo/provider desconhecido → fallback conservador (não zera)', () => {
    expect(estimateCostUsd('foo', 'bar', { inputTokens: 1_000_000 })).toBeCloseTo(0.5, 6)
    expect(estimateCostUsd('openai', 'modelo-novo', { inputTokens: 1_000_000 })).toBeCloseTo(0.5, 6)
  })
  it('uso vazio/negativo → 0 (clampa)', () => {
    expect(estimateCostUsd('groq', 'llama-3.1-8b-instant', {})).toBe(0)
    expect(estimateCostUsd('groq', 'llama-3.1-8b-instant', { inputTokens: -100, outputTokens: -5 })).toBe(0)
  })
})

describe('priceFor', () => {
  it('acha o preço (provider case-insensitive)', () => {
    expect(priceFor('GROQ', 'llama-3.1-8b-instant').inPerM).toBe(0.05)
    expect(priceFor('openai', 'whisper-1').perAudioMin).toBe(0.006)
  })
  it('cai no fallback pra desconhecido', () => {
    expect(priceFor('x', 'y').inPerM).toBe(0.5)
  })
})

describe('formatUsd', () => {
  it('formata por faixa', () => {
    expect(formatUsd(0)).toBe('$0.00')
    expect(formatUsd(-1)).toBe('$0.00')
    expect(formatUsd(0.004)).toBe('$0.0040')
    expect(formatUsd(0.5)).toBe('$0.500')
    expect(formatUsd(1.2)).toBe('$1.20')
  })
})
