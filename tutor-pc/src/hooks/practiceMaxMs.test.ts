import { describe, it, expect } from 'vitest'
import { practiceMaxMs } from './usePractice'

describe('practiceMaxMs', () => {
  it('gives a short floor for single words', () => {
    expect(practiceMaxMs('tower')).toBe(6_000)
  })

  it('scales with word count (~700ms/word + 4s)', () => {
    // 5 words → 5*700 + 4000 = 7500
    expect(practiceMaxMs('one two three four five')).toBe(7_500)
  })

  it('grows for long sentences', () => {
    const long = Array.from({ length: 30 }, () => 'word').join(' ')
    expect(practiceMaxMs(long)).toBe(30 * 700 + 4_000) // 25000
  })

  it('caps at 90 seconds for very long input', () => {
    const huge = Array.from({ length: 300 }, () => 'word').join(' ')
    expect(practiceMaxMs(huge)).toBe(90_000)
  })

  it('handles empty / whitespace as the floor', () => {
    expect(practiceMaxMs('')).toBe(6_000)
    expect(practiceMaxMs('   ')).toBe(6_000)
  })

  it('ignores extra whitespace between words', () => {
    // 8 words → above the 6s floor, so whitespace handling is observable
    const eight = 'a  b   c    d  e f  g   h'
    expect(practiceMaxMs(eight)).toBe(8 * 700 + 4_000) // 9600
  })

  it('is monotonic — more words never gives less time', () => {
    let prev = 0
    for (let n = 1; n <= 50; n++) {
      const s = Array.from({ length: n }, () => 'w').join(' ')
      const ms = practiceMaxMs(s)
      expect(ms).toBeGreaterThanOrEqual(prev)
      prev = ms
    }
  })
})
