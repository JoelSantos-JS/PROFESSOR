import { describe, it, expect } from 'vitest'
import { wordsToCues } from './whisperWords'

describe('wordsToCues', () => {
  it('converts seconds to milliseconds', () => {
    const cues = wordsToCues([{ word: 'The', start: 0.22, end: 0.34 }])
    expect(cues).toEqual([{ part: 'The', start: 220, end: 340 }])
  })

  it('maps a sequence preserving order', () => {
    const cues = wordsToCues([
      { word: 'The',   start: 0.2, end: 0.3 },
      { word: 'quick', start: 0.3, end: 0.6 },
      { word: 'fox',   start: 0.6, end: 1.0 },
    ])
    expect(cues.map(c => c.part)).toEqual(['The', 'quick', 'fox'])
    expect(cues[2]).toEqual({ part: 'fox', start: 600, end: 1000 })
  })

  it('returns [] for missing/invalid input', () => {
    expect(wordsToCues(undefined)).toEqual([])
    expect(wordsToCues([])).toEqual([])
    // @ts-expect-error testing runtime guard
    expect(wordsToCues(null)).toEqual([])
  })

  it('skips entries without a word string', () => {
    const cues = wordsToCues([
      { word: 'ok', start: 0, end: 0.1 },
      // @ts-expect-error missing word
      { start: 0.1, end: 0.2 },
      { word: '', start: 0.2, end: 0.3 },
    ])
    expect(cues).toEqual([{ part: 'ok', start: 0, end: 100 }])
  })

  it('defaults end to start when end is missing', () => {
    const cues = wordsToCues([{ word: 'hi', start: 0.5 }])
    expect(cues).toEqual([{ part: 'hi', start: 500, end: 500 }])
  })

  it('never produces negative times', () => {
    const cues = wordsToCues([{ word: 'x', start: -0.1, end: -0.05 }])
    expect(cues[0].start).toBe(0)
    expect(cues[0].end).toBe(0)
  })

  it('handles CJK words', () => {
    const cues = wordsToCues([{ word: '가만히', start: 0.1, end: 0.5 }])
    expect(cues).toEqual([{ part: '가만히', start: 100, end: 500 }])
  })
})
