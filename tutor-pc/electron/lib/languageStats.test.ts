import { describe, it, expect } from 'vitest'
import { languageStats } from './languageStats'

const NOW = 1_000_000

describe('languageStats', () => {
  it('groups cards by language with totals', () => {
    const stats = languageStats([
      { lang: 'en', due: NOW - 1 },
      { lang: 'en', due: NOW + 999 },
      { lang: 'ko', due: NOW - 1 },
    ], NOW)
    const en = stats.find(s => s.lang === 'en')!
    const ko = stats.find(s => s.lang === 'ko')!
    expect(en.total).toBe(2)
    expect(ko.total).toBe(1)
  })

  it('counts only due cards in `due`', () => {
    const stats = languageStats([
      { lang: 'en', due: NOW - 1 },     // due
      { lang: 'en', due: NOW },         // due (<=)
      { lang: 'en', due: NOW + 1 },     // not due
    ], NOW)
    expect(stats[0].due).toBe(2)
    expect(stats[0].total).toBe(3)
  })

  it('sorts by most-due first, then largest deck', () => {
    const stats = languageStats([
      { lang: 'en', due: NOW + 10 },   // en: 0 due, 1 total
      { lang: 'ko', due: NOW - 1 },    // ko: 1 due
      { lang: 'ko', due: NOW - 1 },    // ko: 2 due
    ], NOW)
    expect(stats[0].lang).toBe('ko')
    expect(stats[0].due).toBe(2)
  })

  it('breaks ties by total when due counts equal', () => {
    const stats = languageStats([
      { lang: 'en', due: NOW + 5 },
      { lang: 'en', due: NOW + 5 },
      { lang: 'ja', due: NOW + 5 },
    ], NOW)
    expect(stats[0].lang).toBe('en') // both 0 due → en has more total
  })

  it('returns [] for no cards', () => {
    expect(languageStats([], NOW)).toEqual([])
  })

  it('buckets empty language as "unknown"', () => {
    const stats = languageStats([{ lang: '', due: NOW }], NOW)
    expect(stats[0].lang).toBe('unknown')
  })
})
