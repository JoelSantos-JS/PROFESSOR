import { describe, it, expect } from 'vitest'
import { advanceStreak, dayStr, type StreakState } from './streak'

const DAY = 86_400_000
// A fixed UTC noon to avoid timezone edge cases in tests.
const NOON = Date.parse('2026-06-01T12:00:00Z')

describe('dayStr', () => {
  it('formats as YYYY-MM-DD (UTC)', () => {
    expect(dayStr(NOON)).toBe('2026-06-01')
  })
  it('rolls to the next day after +24h', () => {
    expect(dayStr(NOON + DAY)).toBe('2026-06-02')
  })
})

describe('advanceStreak', () => {
  it('first ever activity starts the streak at 1', () => {
    const s = advanceStreak({ streak: 0, lastActiveDate: '' }, NOON)
    expect(s).toEqual({ streak: 1, lastActiveDate: '2026-06-01' })
  })

  it('same-day activity does not change the streak', () => {
    const start: StreakState = { streak: 3, lastActiveDate: '2026-06-01' }
    const s = advanceStreak(start, NOON + 1000) // a bit later, same day
    expect(s).toBe(start) // unchanged reference
  })

  it('next-day activity increments the streak', () => {
    const s = advanceStreak({ streak: 3, lastActiveDate: '2026-06-01' }, NOON + DAY)
    expect(s).toEqual({ streak: 4, lastActiveDate: '2026-06-02' })
  })

  it('a skipped day resets the streak to 1', () => {
    const s = advanceStreak({ streak: 9, lastActiveDate: '2026-06-01' }, NOON + 2 * DAY)
    expect(s).toEqual({ streak: 1, lastActiveDate: '2026-06-03' })
  })

  it('a long gap resets to 1', () => {
    const s = advanceStreak({ streak: 50, lastActiveDate: '2026-01-01' }, NOON)
    expect(s.streak).toBe(1)
    expect(s.lastActiveDate).toBe('2026-06-01')
  })

  it('builds a multi-day streak across consecutive days', () => {
    let s: StreakState = { streak: 0, lastActiveDate: '' }
    s = advanceStreak(s, NOON)            // day 1 → 1
    s = advanceStreak(s, NOON + DAY)      // day 2 → 2
    s = advanceStreak(s, NOON + 2 * DAY)  // day 3 → 3
    expect(s.streak).toBe(3)
    expect(s.lastActiveDate).toBe('2026-06-03')
  })

  it('multiple touches on the same day count once', () => {
    let s: StreakState = { streak: 0, lastActiveDate: '' }
    s = advanceStreak(s, NOON)
    s = advanceStreak(s, NOON + 1000)
    s = advanceStreak(s, NOON + 2000)
    expect(s.streak).toBe(1)
  })

  it('streak survives across a month boundary', () => {
    const s = advanceStreak({ streak: 2, lastActiveDate: '2026-05-31' }, Date.parse('2026-06-01T08:00:00Z'))
    expect(s).toEqual({ streak: 3, lastActiveDate: '2026-06-01' })
  })
})
