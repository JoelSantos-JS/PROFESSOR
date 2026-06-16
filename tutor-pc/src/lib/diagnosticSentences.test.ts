import { describe, it, expect } from 'vitest'
import { diagnosticSet, hasDiagnosticSet } from './diagnosticSentences'

describe('diagnosticSet', () => {
  it('idiomas principais têm frases com texto + foco', () => {
    for (const lang of ['en', 'zh', 'ko', 'ja', 'es']) {
      const set = diagnosticSet(lang)
      expect(set.length).toBeGreaterThan(0)
      for (const item of set) {
        expect(item.text.length).toBeGreaterThan(0)
        expect(item.focus.length).toBeGreaterThan(0)
      }
    }
  })
  it('idiomas principais têm um conjunto variado (≥ 6 frases)', () => {
    for (const lang of ['en', 'zh', 'ko', 'ja', 'es']) {
      expect(diagnosticSet(lang).length).toBeGreaterThanOrEqual(6)
    }
  })
  it('os demais idiomas têm pelo menos algumas frases (≥ 5)', () => {
    for (const lang of ['fr', 'de', 'it', 'pt', 'ru']) {
      expect(diagnosticSet(lang).length).toBeGreaterThanOrEqual(5)
    }
  })
  it('sem frases nem focos repetidos dentro de um idioma', () => {
    for (const lang of ['en', 'zh', 'ko', 'ja', 'es', 'fr', 'de', 'it', 'pt', 'ru']) {
      const set = diagnosticSet(lang)
      const texts = set.map(i => i.text)
      const focuses = set.map(i => i.focus)
      expect(new Set(texts).size).toBe(texts.length)     // frases únicas
      expect(new Set(focuses).size).toBe(focuses.length) // focos únicos
    }
  })
  it('normaliza variantes regionais (zh-CN → zh)', () => {
    expect(diagnosticSet('zh-CN')).toEqual(diagnosticSet('zh'))
    expect(diagnosticSet('en-US').length).toBeGreaterThan(0)
  })
  it('idioma sem set → vazio', () => {
    expect(diagnosticSet('th')).toEqual([])
    expect(diagnosticSet('')).toEqual([])
  })
})

describe('hasDiagnosticSet', () => {
  it('true para suportados, false para o resto', () => {
    expect(hasDiagnosticSet('ko')).toBe(true)
    expect(hasDiagnosticSet('th')).toBe(false)
  })
})
