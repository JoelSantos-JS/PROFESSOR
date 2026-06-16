import { describe, it, expect } from 'vitest'
import {
  comprehensionPct, unknownWords, unknownCount, isPlusOne,
  normalizeKnownWord, nextMilestone, estimatedCoverage, KNOWN_MILESTONES,
  type WordStatus,
} from './comprehension'

const statusOf = (entries: Record<string, WordStatus>) =>
  new Map<string, WordStatus>(Object.entries(entries))

describe('normalizeKnownWord', () => {
  it('lowercases and trims', () => {
    expect(normalizeKnownWord('  Hello  ')).toBe('hello')
  })
  it('strips edge punctuation but keeps inner', () => {
    expect(normalizeKnownWord('"world,"')).toBe('world')
    expect(normalizeKnownWord("don't!")).toBe("don't")
  })
  it('strips diacritics', () => {
    expect(normalizeKnownWord('Café')).toBe('cafe')
  })
  it('leaves CJK unchanged', () => {
    expect(normalizeKnownWord('你好')).toBe('你好')
    expect(normalizeKnownWord('학교')).toBe('학교')
  })
})

describe('comprehensionPct', () => {
  const known = statusOf({ the: 'known', cat: 'known', sat: 'known' })

  it('100% when all words are known', () => {
    expect(comprehensionPct(['The', 'cat', 'sat'], known)).toBe(100)
  })
  it('counts known / total (rounded)', () => {
    // the, cat known; mat unknown → 2/3 = 67%
    expect(comprehensionPct(['the', 'cat', 'mat'], known)).toBe(67)
  })
  it('0% when nothing is known', () => {
    expect(comprehensionPct(['xyz', 'qwe'], known)).toBe(0)
  })
  it('treats "ignore" (e.g. names) as understood', () => {
    const s = statusOf({ the: 'known', tokyo: 'ignore' })
    expect(comprehensionPct(['the', 'Tokyo'], s)).toBe(100)
  })
  it('does NOT count "learning" as known', () => {
    const s = statusOf({ the: 'known', cat: 'learning' })
    expect(comprehensionPct(['the', 'cat'], s)).toBe(50)
  })
  it('ignores empty/punctuation tokens', () => {
    expect(comprehensionPct(['the', ',', '', 'cat'], known)).toBe(100)
  })
  it('empty sentence → 100%', () => {
    expect(comprehensionPct([], known)).toBe(100)
  })
  it('counts repeated unknowns by occurrence', () => {
    // 'cat' known, 'mao mao' unknown twice → 1/3 known = 33%
    expect(comprehensionPct(['cat', 'mao', 'mao'], known)).toBe(33)
  })
})

describe('unknownWords / unknownCount', () => {
  const known = statusOf({ i: 'known', go: 'known' })

  it('returns DISTINCT unknowns in first-seen order', () => {
    expect(unknownWords(['I', 'really', 'really', 'must', 'go'], known)).toEqual(['really', 'must'])
  })
  it('count matches distinct unknowns', () => {
    expect(unknownCount(['I', 'go', 'now'], known)).toBe(1)   // only 'now'
    expect(unknownCount(['I', 'go'], known)).toBe(0)
  })
  it('dedupes repeats', () => {
    expect(unknownCount(['xyz', 'xyz', 'xyz'], known)).toBe(1)
  })
})

describe('isPlusOne (the i+1 sweet spot)', () => {
  const known = statusOf({ i: 'known', want: 'known', to: 'known' })
  it('true with exactly one new word', () => {
    expect(isPlusOne(['I', 'want', 'to', 'eat'], known)).toBe(true)  // 'eat' new
  })
  it('false with zero new words', () => {
    expect(isPlusOne(['I', 'want', 'to'], known)).toBe(false)
  })
  it('false with two or more new words', () => {
    expect(isPlusOne(['I', 'want', 'pizza', 'now'], known)).toBe(false)
  })
  it('a repeated single new word still counts as +1', () => {
    expect(isPlusOne(['I', 'go', 'go', 'go'], statusOf({ i: 'known' }))).toBe(true) // 'go' once distinct
  })
})

describe('nextMilestone', () => {
  it('returns the next unreached milestone', () => {
    expect(nextMilestone(0)).toBe(100)
    expect(nextMilestone(100)).toBe(250)
    expect(nextMilestone(99)).toBe(100)
    expect(nextMilestone(600)).toBe(1000)
  })
  it('null once all milestones passed', () => {
    expect(nextMilestone(99999)).toBeNull()
  })
  it('milestones are ascending', () => {
    for (let i = 1; i < KNOWN_MILESTONES.length; i++) {
      expect(KNOWN_MILESTONES[i]).toBeGreaterThan(KNOWN_MILESTONES[i - 1])
    }
  })
})

describe('estimatedCoverage', () => {
  it('100 words ≈ 50%', () => {
    expect(estimatedCoverage(100)).toBe(50)
  })
  it('1000 words ≈ 75%', () => {
    expect(estimatedCoverage(1000)).toBe(75)
  })
  it('grows monotonically and caps at 98%', () => {
    expect(estimatedCoverage(5000)).toBeGreaterThan(estimatedCoverage(1000))
    expect(estimatedCoverage(1_000_000)).toBe(98)
  })
  it('0 words → 0%', () => {
    expect(estimatedCoverage(0)).toBe(0)
  })
})
