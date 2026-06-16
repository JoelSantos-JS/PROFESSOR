import { describe, expect, it } from 'vitest'
import { compactProfessorSession } from './sessionCompaction'

describe('compactProfessorSession', () => {
  it('keeps recent context and summarizes older context', () => {
    const context = Array.from({ length: 20 }, (_, i) => `frase ${i + 1}`)
    const result = compactProfessorSession(context, [], { keepContext: 5 })
    expect(result.removedContextCount).toBe(15)
    expect(result.context).toHaveLength(6)
    expect(result.context[0]).toContain('Resumo compactado')
    expect(result.context.slice(1)).toEqual(['frase 16', 'frase 17', 'frase 18', 'frase 19', 'frase 20'])
  })

  it('keeps recent history and summarizes older messages', () => {
    const history = Array.from({ length: 12 }, (_, i) => ({
      role: i % 2 === 0 ? 'assistant' as const : 'user' as const,
      text: `mensagem ${i + 1}`,
    }))
    const result = compactProfessorSession([], history, { keepHistory: 4 })
    expect(result.removedMessageCount).toBe(8)
    expect(result.history.map(m => m.text)).toEqual(['mensagem 9', 'mensagem 10', 'mensagem 11', 'mensagem 12'])
    expect(result.context[0]).toContain('Conversa anterior')
  })

  it('is a no-op when there is nothing old to compact', () => {
    const result = compactProfessorSession(['a', 'b'], [{ role: 'assistant', text: 'q' }])
    expect(result.summary).toBe('')
    expect(result.context).toEqual(['a', 'b'])
    expect(result.history).toEqual([{ role: 'assistant', text: 'q' }])
  })
})
