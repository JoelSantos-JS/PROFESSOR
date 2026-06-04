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

describe('findWordCue — contraction / tokenization robustness', () => {
  const cues: WordCue[] = [
    { part: "You're ", start: 100, end: 500 },
    { part: 'really ', start: 500, end: 800 },
    { part: 'here.',   start: 800, end: 1100 },
  ]

  it('matches the full contraction "You\'re" exactly', () => {
    expect(findWordCue(cues, "You're")?.start).toBe(100)
  })

  it('matches a split piece "You" to the cue "You\'re" (prefix)', () => {
    expect(findWordCue(cues, 'You')?.start).toBe(100)
  })

  it('matches "youre" (no apostrophe) to "You\'re"', () => {
    expect(findWordCue(cues, 'youre')?.start).toBe(100)
  })

  it('matches when the cue is the shorter piece', () => {
    const c2: WordCue[] = [{ part: 'you ', start: 0, end: 200 }, { part: 'are ', start: 200, end: 400 }]
    // clicked "you're" → cue "you" (cue is a prefix of the word)
    expect(findWordCue(c2, "you're")?.start).toBe(0)
  })

  it('still prefers an EXACT match over a prefix match', () => {
    const c3: WordCue[] = [
      { part: 'investigation ', start: 0, end: 500 },
      { part: 'invest ',        start: 500, end: 800 },
    ]
    expect(findWordCue(c3, 'invest')?.start).toBe(500)  // exact, not the prefix 'investigation'
  })

  it('does not prefix-match very short words (avoids false hits)', () => {
    const c4: WordCue[] = [{ part: 'internal ', start: 0, end: 300 }]
    expect(findWordCue(c4, 'i')).toBeUndefined()  // 'i' too short to prefix-grab 'internal'
  })

  it('matches punctuation-trailing cues like "here."', () => {
    expect(findWordCue(cues, 'here')?.start).toBe(800)
  })
})

import { cueIndexAtTime } from './tts'

describe('cueIndexAtTime (progressive karaoke)', () => {
  const cues: WordCue[] = [
    { part: 'a', start: 0,    end: 300 },
    { part: 'b', start: 300,  end: 600 },
    { part: 'c', start: 900,  end: 1200 },  // gap 600-900
  ]

  it('returns -1 before the first word (no lead)', () => {
    expect(cueIndexAtTime(cues, 0, 0)).toBe(0)        // exactly at start of word 0
    expect(cueIndexAtTime([{ part: 'x', start: 500, end: 700 }], 100, 0)).toBe(-1)
  })

  it('stays on the current word DURING a gap (no flicker to -1)', () => {
    // 700ms is in the 600-900 gap; findActiveCue would give -1, this gives 1
    expect(cueIndexAtTime(cues, 700, 0)).toBe(1)
  })

  it('advances to the next word once it starts', () => {
    expect(cueIndexAtTime(cues, 950, 0)).toBe(2)
  })

  it('holds the last word after the audio ends', () => {
    expect(cueIndexAtTime(cues, 5000, 0)).toBe(2)
  })

  it('is monotonic (never goes backwards as time advances)', () => {
    let prev = -1
    for (let t = 0; t <= 1500; t += 50) {
      const idx = cueIndexAtTime(cues, t, 0)
      expect(idx).toBeGreaterThanOrEqual(prev)
      prev = idx
    }
  })

  it('lead time looks slightly ahead', () => {
    // at 250ms with 120ms lead → 370ms → word 1 already started
    expect(cueIndexAtTime(cues, 250, 120)).toBe(1)
  })

  it('handles empty cues', () => {
    expect(cueIndexAtTime([], 100)).toBe(-1)
  })
})

import { playbackProgress, tokenAtProgress } from './tts'

describe('playbackProgress', () => {
  const cues: WordCue[] = [
    { part: 'a', start: 0,    end: 300 },
    { part: 'b', start: 300,  end: 600 },
    { part: 'c', start: 600,  end: 900 },
  ]
  it('uses cues: maps current word to a 0..1 fraction (no lead)', () => {
    expect(playbackProgress(cues, 0, 0, 0)).toBe(0)        // word 0 → 0
    expect(playbackProgress(cues, 350, 0, 0)).toBe(0.5)    // word 1 of 3 → 1/2
    expect(playbackProgress(cues, 700, 0, 0)).toBe(1)      // word 2 → 1
  })
  it('falls back to elapsed/duration when there are no cues (no lead)', () => {
    expect(playbackProgress([], 500, 1000, 0)).toBe(0.5)
    expect(playbackProgress([{ part: 'x', start: 0, end: 9 }], 250, 1000, 0)).toBe(0.25) // 1 cue → fallback
  })
  it('lead time pushes the highlight slightly ahead', () => {
    // 350ms + 150ms lead = 500ms → halfway through a 1000ms clip
    expect(playbackProgress([], 350, 1000, 150)).toBe(0.5)
  })
  it('clamps the fallback to 0..1', () => {
    expect(playbackProgress([], 2000, 1000, 0)).toBe(1)
    expect(playbackProgress([], -50, 1000, 0)).toBe(0)
  })
  it('returns 0 when nothing is known', () => {
    expect(playbackProgress([], 500, 0)).toBe(0)
  })
})

describe('tokenAtProgress', () => {
  it('maps progress to a token index', () => {
    expect(tokenAtProgress(0, 5)).toBe(0)
    expect(tokenAtProgress(1, 5)).toBe(4)
    expect(tokenAtProgress(0.5, 5)).toBe(2)
  })
  it('returns -1 when idle (progress < 0)', () => {
    expect(tokenAtProgress(-1, 5)).toBe(-1)
  })
  it('handles empty / single token', () => {
    expect(tokenAtProgress(0.5, 0)).toBe(-1)
    expect(tokenAtProgress(0.9, 1)).toBe(0)
  })
  it('never exceeds the last index', () => {
    expect(tokenAtProgress(1.2, 3)).toBe(2)
  })
})

describe('karaoke alignment — end-to-end (playbackProgress → tokenAtProgress)', () => {
  // "you lied and you see what happens" — 7 Whisper word cues (ms)
  const cues: WordCue[] = [
    { part: 'you',     start: 0,    end: 200 },
    { part: 'lied',    start: 200,  end: 500 },
    { part: 'and',     start: 500,  end: 650 },
    { part: 'you',     start: 650,  end: 800 },
    { part: 'see',     start: 800,  end: 1000 },
    { part: 'what',    start: 1000, end: 1200 },
    { part: 'happens', start: 1200, end: 1700 },
  ]
  const WC = 7
  const wordAt = (ms: number) => tokenAtProgress(playbackProgress(cues, ms, 0, 0), WC)

  it('highlights the exact word at each moment (cue count == word count)', () => {
    expect(wordAt(50)).toBe(0)    // you
    expect(wordAt(300)).toBe(1)   // lied
    expect(wordAt(550)).toBe(2)   // and
    expect(wordAt(700)).toBe(3)   // you (2nd)
    expect(wordAt(900)).toBe(4)   // see
    expect(wordAt(1100)).toBe(5)  // what
    expect(wordAt(1500)).toBe(6)  // happens
  })

  it('never moves backwards across the whole timeline', () => {
    let prev = -1
    for (let t = 0; t <= 2000; t += 10) {
      const w = wordAt(t)
      expect(w).toBeGreaterThanOrEqual(prev)
      prev = w
    }
  })

  it('holds the last word after audio ends', () => {
    expect(wordAt(5000)).toBe(6)
  })

  it('the lead makes the word switch slightly BEFORE its cue start', () => {
    // with 150ms lead, at 100ms we are already inside "lied" (starts 200)
    expect(tokenAtProgress(playbackProgress(cues, 100, 0, 150), WC)).toBe(1)
  })

  it('maps proportionally when cue count != displayed word count', () => {
    // 7 cues spread over 9 displayed tokens → monotonic, ends on last
    let prev = -1
    for (let t = 0; t <= 1700; t += 25) {
      const w = tokenAtProgress(playbackProgress(cues, t, 0, 0), 9)
      expect(w).toBeGreaterThanOrEqual(prev)
      expect(w).toBeLessThan(9)
      prev = w
    }
    expect(tokenAtProgress(playbackProgress(cues, 1600, 0, 0), 9)).toBe(8)
  })

  it('WebM fallback (no cues): tracks elapsed/duration across words', () => {
    // 1700ms clip, no cues → progress by time, mapped over 7 words
    const at = (ms: number) => tokenAtProgress(playbackProgress([], ms, 1700, 0), WC)
    expect(at(0)).toBe(0)
    expect(at(850)).toBe(3)     // halfway → middle word
    expect(at(1700)).toBe(6)    // end → last word
  })
})
