import { describe, expect, it } from 'vitest'
import { isReviewableSentence, reviewableSentenceReason } from './reviewableSentence'

describe('isReviewableSentence', () => {
  it('aceita frases conversacionais reais', () => {
    expect(isReviewableSentence("I don't know what he wants.")).toBe(true)
    expect(isReviewableSentence('What do you want to do today?')).toBe(true)
    expect(isReviewableSentence('Thank you so much')).toBe(true)
    expect(isReviewableSentence('Can you help me with this?')).toBe(true)
  })

  it('rejeita fragmentos quebrados de legenda/transcricao', () => {
    expect(isReviewableSentence('great for this you can upload youtube videos of your favorite topics and generate')).toBe(false)
    expect(isReviewableSentence('and then we went to')).toBe(false)
    expect(isReviewableSentence('because I wanted to')).toBe(false)
    expect(isReviewableSentence('this is something that')).toBe(false)
  })

  it('rejeita conteudo que nao e frase de conversa', () => {
    expect(isReviewableSentence('subscribe like share')).toBe(false)
    expect(isReviewableSentence('uh um like yeah okay')).toBe(false)
    expect(isReviewableSentence('test test test test test')).toBe(false)
    expect(isReviewableSentence('https://example.com')).toBe(false)
  })

  it('aceita CJK/Hangul com tamanho suficiente', () => {
    expect(isReviewableSentence('오늘 뭐 했어요')).toBe(true)
    expect(isReviewableSentence('你想吃什么')).toBe(true)
    expect(isReviewableSentence('ありがとう')).toBe(true)
  })

  it('retorna motivo para diagnostico', () => {
    expect(reviewableSentenceReason('and then').reason).toBe('fragment-start')
  })
})
