import { describe, it, expect } from 'vitest'
import { baseLang } from './useKnownWords'

describe('baseLang', () => {
  it('mantém códigos ISO simples', () => {
    expect(baseLang('zh')).toBe('zh')
    expect(baseLang('ko')).toBe('ko')
    expect(baseLang('ja')).toBe('ja')
    expect(baseLang('en')).toBe('en')
  })

  it('remove a região (zh-CN → zh, ko-KR → ko)', () => {
    expect(baseLang('zh-CN')).toBe('zh')
    expect(baseLang('zh-TW')).toBe('zh')
    expect(baseLang('ko-KR')).toBe('ko')
    expect(baseLang('en-US')).toBe('en')
    expect(baseLang('pt-BR')).toBe('pt')
  })

  it('normaliza caixa', () => {
    expect(baseLang('ZH')).toBe('zh')
    expect(baseLang('Ko-KR')).toBe('ko')
    expect(baseLang('EN-us')).toBe('en')
  })

  it('lida com vazio/indefinido sem quebrar', () => {
    expect(baseLang('')).toBe('')
    expect(baseLang(undefined as unknown as string)).toBe('')
  })

  it('agrupa variantes do mesmo idioma no mesmo balde', () => {
    expect(baseLang('zh')).toBe(baseLang('zh-CN'))
    expect(baseLang('zh-CN')).toBe(baseLang('zh-TW'))
    expect(baseLang('ko')).toBe(baseLang('ko-KR'))
  })
})
