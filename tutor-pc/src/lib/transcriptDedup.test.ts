import { describe, expect, it } from 'vitest'
import { isLikelyDuplicate } from './transcriptDedup'

describe('isLikelyDuplicate', () => {
  it('descarta repetição exata e curta (assinatura de alucinação)', () => {
    expect(isLikelyDuplicate('Thank you.', 'Thank you.')).toBe(true)
    expect(isLikelyDuplicate('you', 'you')).toBe(true)
  })

  it('MANTÉM repetição longa idêntica (provável fala real)', () => {
    const long = 'I summoned my engineering manager and put him in defense mode.'
    expect(isLikelyDuplicate(long, long)).toBe(false)
  })

  it('mantém textos diferentes', () => {
    expect(isLikelyDuplicate('olá mundo', 'tchau mundo')).toBe(false)
  })

  it('ignora espaços ao comparar', () => {
    expect(isLikelyDuplicate('  oi  ', 'oi')).toBe(true)
  })

  it('texto vazio nunca é duplicado', () => {
    expect(isLikelyDuplicate('', '')).toBe(false)
    expect(isLikelyDuplicate('   ', 'x')).toBe(false)
  })

  it('respeita o limite de tamanho configurável', () => {
    expect(isLikelyDuplicate('abcdef', 'abcdef', 3)).toBe(false)  // > maxLen → mantém
    expect(isLikelyDuplicate('ab', 'ab', 3)).toBe(true)
  })
})
