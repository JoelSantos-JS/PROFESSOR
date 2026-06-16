import { describe, it, expect } from 'vitest'
import { appLanguage, uiText } from './uiLanguage'

describe('appLanguage', () => {
  it('só "en" (ou en-XX) vira inglês; o resto cai no português', () => {
    expect(appLanguage('en')).toBe('en')
    expect(appLanguage('en-US')).toBe('en')
    expect(appLanguage('pt-BR')).toBe('pt')
    expect(appLanguage('')).toBe('pt')
    expect(appLanguage(undefined)).toBe('pt')
  })
})

describe('uiText — chaves do idioma do conteúdo (antes hardcoded na Settings)', () => {
  it('contentLanguage traduz nos dois idiomas', () => {
    expect(uiText('pt', 'contentLanguage')).toBe('Idioma do conteúdo')
    expect(uiText('en', 'contentLanguage')).toBe('Content language')
  })
  it('contentLanguageLabel e Note diferem por idioma', () => {
    expect(uiText('pt', 'contentLanguageLabel')).not.toBe(uiText('en', 'contentLanguageLabel'))
    expect(uiText('pt', 'contentLanguageNote')).toMatch(/Auto/)
    expect(uiText('en', 'contentLanguageNote')).toMatch(/Auto/)
  })
  it('configured: configurado / configured', () => {
    expect(uiText('pt', 'configured')).toBe('configurado')
    expect(uiText('en', 'configured')).toBe('configured')
  })
})
