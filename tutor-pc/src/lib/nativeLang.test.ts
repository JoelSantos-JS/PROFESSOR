import { describe, it, expect } from 'vitest'
import {
  resolveNativeLanguage, nativeLanguageName, baseLocale, isSupportedNative, NATIVE_LANGUAGES,
} from './nativeLang'

describe('baseLocale', () => {
  it('extrai o código base', () => {
    expect(baseLocale('pt-BR')).toBe('pt')
    expect(baseLocale('en-US')).toBe('en')
    expect(baseLocale('ja_JP')).toBe('ja')
    expect(baseLocale('EN-us')).toBe('en')
    expect(baseLocale('')).toBe('')
  })
})

describe('resolveNativeLanguage', () => {
  it('mapeia locales conhecidos', () => {
    expect(resolveNativeLanguage('pt-BR')).toBe('pt')
    expect(resolveNativeLanguage('en-US')).toBe('en')
    expect(resolveNativeLanguage('ja-JP')).toBe('ja')
    expect(resolveNativeLanguage('ko-KR')).toBe('ko')
    expect(resolveNativeLanguage('zh-CN')).toBe('zh')
    expect(resolveNativeLanguage('es-ES')).toBe('es')
  })
  it('cai para inglês quando o idioma não é oferecido', () => {
    expect(resolveNativeLanguage('th-TH')).toBe('en')
    expect(resolveNativeLanguage('xx')).toBe('en')
    expect(resolveNativeLanguage('')).toBe('en')
  })
  it('o caso do usuário: morador nos EUA → inglês; no Japão → japonês', () => {
    expect(resolveNativeLanguage('en-US')).toBe('en')
    expect(resolveNativeLanguage('ja-JP')).toBe('ja')
  })
})

describe('nativeLanguageName', () => {
  it('endônimos', () => {
    expect(nativeLanguageName('pt')).toBe('Português')
    expect(nativeLanguageName('en')).toBe('English')
    expect(nativeLanguageName('ja')).toBe('日本語')
    expect(nativeLanguageName('ko')).toBe('한국어')
  })
  it('aceita region codes', () => {
    expect(nativeLanguageName('pt-BR')).toBe('Português')
  })
  it('fallback para o código em maiúsculas', () => {
    expect(nativeLanguageName('xx')).toBe('XX')
  })
})

describe('isSupportedNative / lista', () => {
  it('valida suporte', () => {
    expect(isSupportedNative('ja')).toBe(true)
    expect(isSupportedNative('pt-BR')).toBe(true)
    expect(isSupportedNative('th')).toBe(false)
  })
  it('a lista cobre os principais e tem code+name', () => {
    expect(NATIVE_LANGUAGES.length).toBeGreaterThanOrEqual(8)
    for (const l of NATIVE_LANGUAGES) {
      expect(l.code.length).toBeGreaterThan(0)
      expect(l.name.length).toBeGreaterThan(0)
    }
  })
})
