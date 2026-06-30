import { describe, it, expect } from 'vitest'
import { sessionMistakes } from './sessionDrill'
import type { SessionAttempt, DiffToken } from '../types'

function attempt(lang: string, diff: DiffToken[]): SessionAttempt {
  return { original: '', spoken: '', score: 0, diff, lang, at: 0 }
}
const ok = (word: string): DiffToken => ({ word, status: 'ok' })
const miss = (word: string): DiffToken => ({ word, status: 'missing' })
const extra = (word: string): DiffToken => ({ word, status: 'extra' })

describe('sessionMistakes', () => {
  it('junta só as palavras erradas (missing), ignorando ok/extra', () => {
    const r = sessionMistakes([attempt('en', [ok('the'), miss('thorough'), extra('uhh'), miss('beach')])])
    expect(r.lang).toBe('en')
    expect(r.words).toEqual(['thorough', 'beach'])
  })

  it('deduplica entre tentativas (case-insensitive), preservando a ordem', () => {
    const r = sessionMistakes([
      attempt('en', [miss('Beach')]),
      attempt('en', [miss('beach'), miss('world')]),
    ])
    expect(r.words).toEqual(['Beach', 'world'])
  })

  it('escolhe o idioma DOMINANTE (mais erros)', () => {
    const r = sessionMistakes([
      attempt('ko', [miss('안녕')]),
      attempt('en', [miss('cat'), miss('dog')]),
    ])
    expect(r.lang).toBe('en')
    expect(r.words).toEqual(['cat', 'dog'])
  })

  it('sem erros → vazio', () => {
    expect(sessionMistakes([])).toEqual({ lang: '', words: [] })
    expect(sessionMistakes([attempt('en', [ok('all'), ok('good')])])).toEqual({ lang: '', words: [] })
  })

  it('ignora tokens em branco e tentativas sem idioma', () => {
    const r = sessionMistakes([
      attempt('', [miss('orphan')]),
      attempt('en', [miss('  '), miss('real')]),
    ])
    expect(r).toEqual({ lang: 'en', words: ['real'] })
  })
})
