import { describe, it, expect } from 'vitest'
import { floatingBarMode, type FloatingBarInput } from './floatingBar'

const base: FloatingBarInput = {
  busy: false, practicing: false, tab: 'transcricao', lineCount: 0, attemptCount: 0,
}

describe('floatingBarMode', () => {
  it('vazia e ociosa → compact', () => {
    expect(floatingBarMode(base)).toBe('compact')
  })

  it('escutando/processando → full (mesmo sem feed)', () => {
    expect(floatingBarMode({ ...base, busy: true })).toBe('full')
  })

  it('treino aberto → full', () => {
    expect(floatingBarMode({ ...base, practicing: true })).toBe('full')
  })

  describe('aba Transcrição olha lineCount', () => {
    it('com transcrições → full', () => {
      expect(floatingBarMode({ ...base, tab: 'transcricao', lineCount: 1 })).toBe('full')
    })
    it('sem transcrições → compact (ignora attempts)', () => {
      expect(floatingBarMode({ ...base, tab: 'transcricao', lineCount: 0, attemptCount: 5 })).toBe('compact')
    })
  })

  describe('aba Sessão olha attemptCount', () => {
    it('com tentativas → full', () => {
      expect(floatingBarMode({ ...base, tab: 'sessao', attemptCount: 1 })).toBe('full')
    })
    it('sem tentativas → compact (ignora lines)', () => {
      expect(floatingBarMode({ ...base, tab: 'sessao', attemptCount: 0, lineCount: 9 })).toBe('compact')
    })
  })

  it('busy tem prioridade mesmo na aba Sessão vazia', () => {
    expect(floatingBarMode({ ...base, tab: 'sessao', busy: true })).toBe('full')
  })

  it('matriz: qualquer condição de conteúdo força full', () => {
    const truthy: Array<Partial<FloatingBarInput>> = [
      { busy: true },
      { practicing: true },
      { tab: 'transcricao', lineCount: 3 },
      { tab: 'sessao', attemptCount: 2 },
    ]
    for (const t of truthy) expect(floatingBarMode({ ...base, ...t })).toBe('full')
  })

  it('só compact quando NADA tem conteúdo', () => {
    expect(floatingBarMode({ busy: false, practicing: false, tab: 'transcricao', lineCount: 0, attemptCount: 0 })).toBe('compact')
    expect(floatingBarMode({ busy: false, practicing: false, tab: 'sessao', lineCount: 0, attemptCount: 0 })).toBe('compact')
  })
})
