import { describe, it, expect } from 'vitest'
import { normalizeLang } from './langNormalize'

describe('normalizeLang', () => {
  it('maps full Whisper names to ISO codes', () => {
    expect(normalizeLang('korean')).toBe('ko')
    expect(normalizeLang('english')).toBe('en')
    expect(normalizeLang('chinese')).toBe('zh')
    expect(normalizeLang('japanese')).toBe('ja')
    expect(normalizeLang('portuguese')).toBe('pt')
    expect(normalizeLang('spanish')).toBe('es')
  })

  it('is case-insensitive for names', () => {
    expect(normalizeLang('Korean')).toBe('ko')
    expect(normalizeLang('ENGLISH')).toBe('en')
    expect(normalizeLang('  Japanese ')).toBe('ja')
  })

  it('maps language synonyms', () => {
    expect(normalizeLang('mandarin')).toBe('zh')
    expect(normalizeLang('cantonese')).toBe('zh')
    expect(normalizeLang('castilian')).toBe('es')
  })

  it('passes through existing ISO codes unchanged', () => {
    expect(normalizeLang('ko')).toBe('ko')
    expect(normalizeLang('en')).toBe('en')
    expect(normalizeLang('zh')).toBe('zh')
  })

  it('preserves BCP-47 region tags', () => {
    expect(normalizeLang('ko-KR')).toBe('ko-KR')
    expect(normalizeLang('zh-CN')).toBe('zh-CN')
    expect(normalizeLang('en-US')).toBe('en-US')
  })

  it('returns empty for empty / undefined', () => {
    expect(normalizeLang('')).toBe('')
    expect(normalizeLang(undefined)).toBe('')
  })

  it('returns unknown values unchanged (caller handles fallback)', () => {
    expect(normalizeLang('auto')).toBe('auto')
    expect(normalizeLang('klingon')).toBe('klingon')
  })
})
