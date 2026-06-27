import { describe, expect, it } from 'vitest'
import { addLangVote, lockedLanguage } from './sessionLanguage'

describe('addLangVote', () => {
  it('soma peso pelo tamanho do texto e usa a base do idioma', () => {
    let v = addLangVote({}, 'ko', 20)
    v = addLangVote(v, 'ko-KR', 10)
    expect(v).toEqual({ ko: 30 })
  })
  it('ignora auto/vazio/tamanho não positivo', () => {
    expect(addLangVote({}, 'auto', 10)).toEqual({})
    expect(addLangVote({}, '', 10)).toEqual({})
    expect(addLangVote({}, 'ko', 0)).toEqual({})
  })
})

describe('lockedLanguage', () => {
  it('vazio enquanto não atinge o mínimo de confiança', () => {
    expect(lockedLanguage({ ko: 10 }, 15)).toBe('')
  })
  it('trava a dominante ao cruzar o mínimo', () => {
    expect(lockedLanguage({ ko: 25 }, 15)).toBe('ko')
  })
  it('uma frase coreana real vence o ruído que flipou (you/japonês)', () => {
    // 'you' (en, 3) + 'ちょっと待って' (ja, 7) + uma frase coreana (28) → trava ko
    let v: Record<string, number> = {}
    v = addLangVote(v, 'en', 3)
    v = addLangVote(v, 'ja', 7)
    v = addLangVote(v, 'ko', 28)
    expect(lockedLanguage(v)).toBe('ko')
  })
  it('escolhe a de maior pontuação acumulada', () => {
    expect(lockedLanguage({ en: 12, ko: 40, ja: 8 })).toBe('ko')
  })
})
