import { describe, it, expect } from 'vitest'
import { appLanguage, uiText } from './uiLanguage'

describe('appLanguage', () => {
  it('respeita a escolha explícita do usuário (pt/en)', () => {
    expect(appLanguage('en')).toBe('en')
    expect(appLanguage('en-US')).toBe('en')
    expect(appLanguage('pt-BR')).toBe('pt')
  })
  it('sem escolha (1º uso) → segue o LOCALE do PC: pt → pt, resto → en', () => {
    expect(appLanguage('', 'pt-BR')).toBe('pt')
    expect(appLanguage(undefined, 'pt')).toBe('pt')
    expect(appLanguage('', 'en-US')).toBe('en')
    expect(appLanguage('', 'ko-KR')).toBe('en')   // coreano → inglês (não pt)
    expect(appLanguage('', 'es-ES')).toBe('en')
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
