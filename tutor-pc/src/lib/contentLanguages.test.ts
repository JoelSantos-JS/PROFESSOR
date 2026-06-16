import { describe, it, expect } from 'vitest'
import {
  contentLanguageOptions, contentLanguageLabel, normalizeContentLanguage, CONTENT_LANGUAGE_CODES,
} from './contentLanguages'

describe('contentLanguageOptions', () => {
  it('começa com "auto"', () => {
    expect(contentLanguageOptions()[0].code).toBe('auto')
  })
  it('inclui todos os códigos suportados, com rótulos não-vazios', () => {
    const opts = contentLanguageOptions()
    for (const code of CONTENT_LANGUAGE_CODES) {
      const opt = opts.find(o => o.code === code)
      expect(opt).toBeDefined()
      expect(opt!.label.length).toBeGreaterThan(0)
    }
    expect(opts).toHaveLength(CONTENT_LANGUAGE_CODES.length + 1)  // + auto
  })
  it('localiza o rótulo "auto" e os nomes conforme o idioma da UI', () => {
    const pt = contentLanguageOptions('pt')
    const en = contentLanguageOptions('en')
    expect(pt[0].label).toMatch(/Detectar automaticamente/)
    expect(en[0].label).toMatch(/Detect automatically/)
    expect(en.find(o => o.code === 'zh')!.label).toMatch(/Chinese/i)
    expect(pt.find(o => o.code === 'zh')!.label).toMatch(/Chin[eê]s/i)
  })
  it('default sem argumento = português (compat)', () => {
    expect(contentLanguageOptions()[0].label).toMatch(/Detectar/)
  })
})

describe('contentLanguageLabel', () => {
  it('auto/vazio → "Auto"', () => {
    expect(contentLanguageLabel('auto')).toBe('Auto')
    expect(contentLanguageLabel('')).toBe('Auto')
  })
  it('código → nome do idioma', () => {
    expect(contentLanguageLabel('zh')).toMatch(/Chin/i)
    expect(contentLanguageLabel('en')).toMatch(/Ingl/i)
  })
})

describe('normalizeContentLanguage', () => {
  it('mantém códigos suportados', () => {
    expect(normalizeContentLanguage('zh')).toBe('zh')
    expect(normalizeContentLanguage('en')).toBe('en')
  })
  it('tira a região (zh-CN → zh)', () => {
    expect(normalizeContentLanguage('zh-CN')).toBe('zh')
    expect(normalizeContentLanguage('EN-us')).toBe('en')
  })
  it('auto/vazio/desconhecido → auto', () => {
    expect(normalizeContentLanguage('auto')).toBe('auto')
    expect(normalizeContentLanguage('')).toBe('auto')
    expect(normalizeContentLanguage(undefined)).toBe('auto')
    expect(normalizeContentLanguage('th')).toBe('auto')   // não suportado
  })
})
