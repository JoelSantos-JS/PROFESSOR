import { describe, it, expect } from 'vitest'
import { nativeLanguageEnglishName } from './nativeLang'

describe('nativeLanguageEnglishName', () => {
  it('nomes em inglês para o prompt', () => {
    expect(nativeLanguageEnglishName('pt')).toBe('Brazilian Portuguese')
    expect(nativeLanguageEnglishName('en')).toBe('English')
    expect(nativeLanguageEnglishName('ja')).toBe('Japanese')
    expect(nativeLanguageEnglishName('zh')).toBe('Mandarin Chinese')
    expect(nativeLanguageEnglishName('ko')).toBe('Korean')
  })
  it('aceita region codes', () => {
    expect(nativeLanguageEnglishName('pt-BR')).toBe('Brazilian Portuguese')
    expect(nativeLanguageEnglishName('en-US')).toBe('English')
  })
  it('default e desconhecido → Brazilian Portuguese', () => {
    expect(nativeLanguageEnglishName(undefined)).toBe('Brazilian Portuguese')
    expect(nativeLanguageEnglishName('')).toBe('Brazilian Portuguese')
    expect(nativeLanguageEnglishName('xx')).toBe('Brazilian Portuguese')
  })
})
