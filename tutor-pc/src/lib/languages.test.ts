import { describe, it, expect } from 'vitest'
import { baseLang, languageName, languageFlag, languageLabel } from './languages'

describe('baseLang', () => {
  it('strips region tags', () => {
    expect(baseLang('zh-CN')).toBe('zh')
    expect(baseLang('en-US')).toBe('en')
  })
  it('lowercases and handles empty', () => {
    expect(baseLang('KO')).toBe('ko')
    expect(baseLang('')).toBe('')
  })
})

describe('languageName', () => {
  it('maps known codes to PT names', () => {
    expect(languageName('en')).toBe('Inglês')
    expect(languageName('ko')).toBe('Coreano')
    expect(languageName('ja')).toBe('Japonês')
  })
  it('handles region tags via base language', () => {
    expect(languageName('zh-TW')).toBe('Chinês')
  })
  it('falls back to uppercase code for unknown', () => {
    expect(languageName('xx')).toBe('XX')
  })
  it('shows "Outro" for empty/unknown bucket', () => {
    expect(languageName('')).toBe('Outro')
    expect(languageName('unknown')).toBe('Outro')
  })
})

describe('languageFlag', () => {
  it('returns the flag for known languages', () => {
    expect(languageFlag('ko')).toBe('🇰🇷')
    expect(languageFlag('en-US')).toBe('🇬🇧')
  })
  it('falls back to a globe', () => {
    expect(languageFlag('xx')).toBe('🌐')
  })
})

describe('languageLabel', () => {
  it('combines flag + name', () => {
    expect(languageLabel('ko')).toBe('🇰🇷 Coreano')
  })
})
