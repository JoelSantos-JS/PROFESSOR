import { describe, expect, it } from 'vitest'
import { contextStatus, estimateProfessorTurnUsage, estimateTokens, formatTokenCount, hasDenseScript, summarizeProfessorTokenBudget } from './tokenBudget'

describe('tokenBudget', () => {
  it('estimates latin text conservatively', () => {
    expect(estimateTokens('This is a short sentence in English.')).toBeGreaterThanOrEqual(8)
  })

  it('uses a denser estimate for Korean/Japanese/Chinese text', () => {
    expect(hasDenseScript('안녕하세요', 'ko')).toBe(true)
    expect(estimateTokens('안녕하세요 여러분', 'ko')).toBeGreaterThanOrEqual(4)
  })

  it('maps context percentages to alert status', () => {
    expect(contextStatus(7)).toBe('ok')
    expect(contextStatus(70)).toBe('watch')
    expect(contextStatus(85)).toBe('warning')
    expect(contextStatus(95)).toBe('critical')
  })

  it('summarizes professor context, history and pending user message', () => {
    const summary = summarizeProfessorTokenBudget({
      context: ['sentence one', 'sentence two'],
      history: [{ role: 'assistant', text: 'Question?' }, { role: 'user', text: 'Answer.' }],
      userMessage: 'Next answer.',
      limitTokens: 1000,
    })
    expect(summary.contextSentenceCount).toBe(2)
    expect(summary.messageCount).toBe(3)
    expect(summary.usedTokens).toBeGreaterThan(650)
    expect(summary.percent).toBeGreaterThan(0)
  })

  it('formats token counts with thousands separators', () => {
    expect(formatTokenCount(3678)).toBe('3,678')
  })

  it('estimates professor call usage with input and output tokens', () => {
    const usage = estimateProfessorTurnUsage({
      context: ['one context sentence'],
      history: [{ role: 'assistant', text: 'Question?' }],
      userMessage: 'Answer.',
      outputText: 'Next question.',
    })
    expect(usage.inputTokens).toBeGreaterThan(650)
    expect(usage.outputTokens).toBeGreaterThan(0)
    expect(usage.totalTokens).toBe(usage.inputTokens + usage.outputTokens)
  })
})
