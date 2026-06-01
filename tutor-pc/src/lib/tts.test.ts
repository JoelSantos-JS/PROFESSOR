import { describe, it, expect } from 'vitest'
import { findActiveCue, mapProgressIndex, type WordCue } from './tts'

const cues: WordCue[] = [
  { part: 'Hello ', start: 100, end: 462 },
  { part: 'world, ', start: 475, end: 837 },
  { part: 'how ',   start: 1037, end: 1200 },
  { part: 'today?', start: 1450, end: 1937 },
]

describe('findActiveCue', () => {
  it('returns -1 before the first cue starts', () => {
    expect(findActiveCue(cues, 0)).toBe(-1)
    expect(findActiveCue(cues, 99)).toBe(-1)
  })

  it('matches the first cue at its exact start (inclusive)', () => {
    expect(findActiveCue(cues, 100)).toBe(0)
  })

  it('matches a cue in the middle of its range', () => {
    expect(findActiveCue(cues, 300)).toBe(0)
    expect(findActiveCue(cues, 600)).toBe(1)
    expect(findActiveCue(cues, 1100)).toBe(2)
  })

  it('is end-exclusive — the end boundary belongs to no cue', () => {
    expect(findActiveCue(cues, 462)).toBe(-1) // exactly end of cue 0, before cue 1 starts
  })

  it('returns -1 in the gap between two cues', () => {
    expect(findActiveCue(cues, 900)).toBe(-1)  // between world(end 837) and how(start 1037)
    expect(findActiveCue(cues, 1300)).toBe(-1) // between how(end 1200) and today(start 1450)
  })

  it('matches the last cue', () => {
    expect(findActiveCue(cues, 1600)).toBe(3)
  })

  it('returns -1 after the last cue ends', () => {
    expect(findActiveCue(cues, 1937)).toBe(-1)
    expect(findActiveCue(cues, 5000)).toBe(-1)
  })

  it('returns -1 for empty cue list', () => {
    expect(findActiveCue([], 500)).toBe(-1)
  })

  it('progresses monotonically as time advances through a clip', () => {
    const seen: number[] = []
    for (let t = 0; t <= 2000; t += 50) {
      const idx = findActiveCue(cues, t)
      if (idx !== -1 && seen[seen.length - 1] !== idx) seen.push(idx)
    }
    // Indices should appear in increasing order (no going backwards)
    expect(seen).toEqual([...seen].sort((a, b) => a - b))
    expect(seen).toContain(0)
    expect(seen).toContain(3)
  })
})

describe('mapProgressIndex', () => {
  it('returns -1 when nothing is active', () => {
    expect(mapProgressIndex(-1, 10, 5)).toBe(-1)
  })

  it('returns -1 for empty cues or tokens', () => {
    expect(mapProgressIndex(2, 0, 5)).toBe(-1)
    expect(mapProgressIndex(2, 10, 0)).toBe(-1)
  })

  it('aligns endpoints exactly (first→first, last→last)', () => {
    expect(mapProgressIndex(0, 10, 6)).toBe(0)
    expect(mapProgressIndex(9, 10, 6)).toBe(5)
  })

  it('maps the middle proportionally', () => {
    // halfway through 11 cues → halfway through 11 tokens
    expect(mapProgressIndex(5, 11, 11)).toBe(5)
  })

  it('handles equal counts as identity', () => {
    for (let i = 0; i < 8; i++) expect(mapProgressIndex(i, 8, 8)).toBe(i)
  })

  it('compresses when fewer tokens than cues', () => {
    // 10 cues → 3 tokens
    expect(mapProgressIndex(0, 10, 3)).toBe(0)
    expect(mapProgressIndex(9, 10, 3)).toBe(2)
  })

  it('expands when more tokens than cues', () => {
    // 3 cues → 9 tokens
    expect(mapProgressIndex(0, 3, 9)).toBe(0)
    expect(mapProgressIndex(1, 3, 9)).toBe(4)
    expect(mapProgressIndex(2, 3, 9)).toBe(8)
  })

  it('single token always maps to 0', () => {
    expect(mapProgressIndex(3, 10, 1)).toBe(0)
  })

  it('single cue maps to 0', () => {
    expect(mapProgressIndex(0, 1, 5)).toBe(0)
  })

  it('never returns an out-of-range index', () => {
    for (let c = 0; c < 20; c++) {
      const idx = mapProgressIndex(c, 20, 7)
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(idx).toBeLessThan(7)
    }
  })
})

// ── findWordCue ───────────────────────────────────────────────────────────────

import { findWordCue } from './tts'

describe('findWordCue', () => {
  const cues: WordCue[] = [
    { part: 'Hong',  start: 0,   end: 300 },
    { part: 'Kong',  start: 300, end: 600 },
    { part: 'guys',  start: 600, end: 900 },
    { part: 'Kong',  start: 1200, end: 1500 },
  ]

  it('finds a cue by normalized word', () => {
    expect(findWordCue(cues, 'guys')).toEqual({ part: 'guys', start: 600, end: 900 })
  })

  it('is case/punctuation insensitive', () => {
    expect(findWordCue(cues, 'HONG!')).toEqual({ part: 'Hong', start: 0, end: 300 })
  })

  it('returns the first match by default for repeats', () => {
    expect(findWordCue(cues, 'Kong')?.start).toBe(300)
  })

  it('prefers the occurrence at/after fromIndex for repeats', () => {
    expect(findWordCue(cues, 'Kong', 2)?.start).toBe(1200)
  })

  it('falls back to first match if none at/after fromIndex', () => {
    expect(findWordCue(cues, 'Hong', 3)?.start).toBe(0)
  })

  it('returns undefined when not found', () => {
    expect(findWordCue(cues, 'banana')).toBeUndefined()
  })

  it('returns undefined for empty word or empty cues', () => {
    expect(findWordCue(cues, '')).toBeUndefined()
    expect(findWordCue([], 'Hong')).toBeUndefined()
  })

  it('matches accented words ignoring diacritics', () => {
    const c: WordCue[] = [{ part: 'café', start: 0, end: 200 }]
    expect(findWordCue(c, 'cafe')?.start).toBe(0)
  })
})
