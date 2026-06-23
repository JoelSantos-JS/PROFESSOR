import { describe, expect, it } from 'vitest'
import { applyMistake, SESSION_GAP_MS } from './mistakeTracking'

describe('applyMistake', () => {
  it('primeiro erro inicia o estado', () => {
    expect(applyMistake(undefined, 1000)).toEqual({ count: 1, lastAt: 1000, sessionCount: 1, struggleSessions: 0 })
  })

  it('2º erro na MESMA sessão vira dificuldade constante (struggleSessions=1)', () => {
    const s1 = applyMistake(undefined, 1000)
    const s2 = applyMistake(s1, 1000 + 60_000)  // 1 min depois → mesma sessão
    expect(s2.sessionCount).toBe(2)
    expect(s2.struggleSessions).toBe(1)
    expect(s2.count).toBe(2)
  })

  it('erros repetidos na mesma sessão NÃO contam de novo (struggle só sobe ao cruzar o limiar)', () => {
    let s = applyMistake(undefined, 1000)
    s = applyMistake(s, 1000 + 1_000)   // 2º → struggle 1
    s = applyMistake(s, 1000 + 2_000)   // 3º → continua 1
    s = applyMistake(s, 1000 + 3_000)   // 4º → continua 1
    expect(s.struggleSessions).toBe(1)
    expect(s.sessionCount).toBe(4)
    expect(s.count).toBe(4)
  })

  it('erro isolado por sessão NUNCA vira dificuldade (filtra o ruído do ASR)', () => {
    let s = applyMistake(undefined, 0)
    // uma vez por dia, várias sessões
    for (let i = 1; i <= 5; i++) s = applyMistake(s, i * (SESSION_GAP_MS + 1))
    expect(s.struggleSessions).toBe(0)  // nunca repetiu na mesma sessão
    expect(s.count).toBe(6)
    expect(s.sessionCount).toBe(1)
  })

  it('nova sessão reseta o contador da sessão; dificuldade em sessões distintas acumula', () => {
    let s = applyMistake(undefined, 0)
    s = applyMistake(s, 1_000)                    // sessão A, 2º erro → struggle 1
    s = applyMistake(s, SESSION_GAP_MS + 10_000)  // sessão B, 1º erro → reseta sessionCount=1
    expect(s.sessionCount).toBe(1)
    expect(s.struggleSessions).toBe(1)
    s = applyMistake(s, SESSION_GAP_MS + 11_000)  // sessão B, 2º erro → struggle 2
    expect(s.struggleSessions).toBe(2)
  })
})
