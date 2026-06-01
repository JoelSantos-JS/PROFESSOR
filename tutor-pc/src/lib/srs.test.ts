import { describe, it, expect } from 'vitest'
import { reviewCard, nextDue, isDue, INITIAL_SRS, type SrsState } from './srs'

describe('reviewCard — passing grades', () => {
  it('first pass sets interval to 1 day and reps to 1', () => {
    const s = reviewCard(INITIAL_SRS, 4)
    expect(s.interval).toBe(1)
    expect(s.reps).toBe(1)
  })

  it('second pass sets interval to 6 days', () => {
    let s = reviewCard(INITIAL_SRS, 4)
    s = reviewCard(s, 4)
    expect(s.interval).toBe(6)
    expect(s.reps).toBe(2)
  })

  it('third pass multiplies interval by ease', () => {
    let s = reviewCard(INITIAL_SRS, 4) // 1
    s = reviewCard(s, 4)               // 6
    const before = s.interval
    s = reviewCard(s, 4)               // 6 * ease
    expect(s.interval).toBe(Math.round(before * s.ease))
    expect(s.reps).toBe(3)
  })

  it('perfect grades (5) increase ease', () => {
    const s = reviewCard(INITIAL_SRS, 5)
    expect(s.ease).toBeGreaterThan(INITIAL_SRS.ease)
  })

  it('grade 3 (barely passed) slightly decreases ease but still graduates', () => {
    const s = reviewCard(INITIAL_SRS, 3)
    expect(s.reps).toBe(1)
    expect(s.interval).toBe(1)
    expect(s.ease).toBeLessThan(INITIAL_SRS.ease)
  })
})

describe('reviewCard — failing grades', () => {
  it('a lapse resets reps and interval', () => {
    let s = reviewCard(INITIAL_SRS, 4)
    s = reviewCard(s, 4) // interval 6, reps 2
    s = reviewCard(s, 1) // fail
    expect(s.reps).toBe(0)
    expect(s.interval).toBe(1)
  })

  it('failing lowers ease but never below 1.3', () => {
    let s: SrsState = { ease: 1.4, interval: 10, reps: 5 }
    s = reviewCard(s, 0)
    expect(s.ease).toBe(1.3)
    s = reviewCard(s, 0)
    expect(s.ease).toBe(1.3) // floored
  })

  it('quality 2 counts as a fail', () => {
    const s = reviewCard({ ease: 2.5, interval: 6, reps: 2 }, 2)
    expect(s.reps).toBe(0)
    expect(s.interval).toBe(1)
  })
})

describe('nextDue / isDue', () => {
  it('nextDue adds interval days', () => {
    const now = 1_000_000_000_000
    expect(nextDue(1, now)).toBe(now + 86_400_000)
    expect(nextDue(6, now)).toBe(now + 6 * 86_400_000)
  })

  it('isDue true when due is in the past', () => {
    const now = 1_000_000_000_000
    expect(isDue(now - 1, now)).toBe(true)
    expect(isDue(now, now)).toBe(true)
    expect(isDue(now + 1, now)).toBe(false)
  })

  it('a freshly graded card is not due immediately', () => {
    const now = Date.now()
    const s = reviewCard(INITIAL_SRS, 4)
    expect(isDue(nextDue(s.interval, now), now)).toBe(false)
  })
})
