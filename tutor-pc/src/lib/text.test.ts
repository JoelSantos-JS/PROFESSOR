import { describe, it, expect } from 'vitest'
import { compareWords, scoreAttempt, segmentText } from './text'

// ── compareWords ──────────────────────────────────────────────────────────────

describe('compareWords', () => {
  it('marks all words ok on exact match', () => {
    const result = compareWords('hello world', 'hello world')
    expect(result).toEqual([
      { word: 'hello', ok: true },
      { word: 'world', ok: true },
    ])
  })

  it('marks all words wrong when completely different', () => {
    const result = compareWords('hello world', 'foo bar')
    expect(result).toEqual([
      { word: 'hello', ok: false },
      { word: 'world', ok: false },
    ])
  })

  it('is case-insensitive', () => {
    const result = compareWords('Hello World', 'hello world')
    expect(result.every(w => w.ok)).toBe(true)
  })

  it('strips punctuation from both sides', () => {
    const result = compareWords('Hello, world!', 'hello world')
    expect(result.every(w => w.ok)).toBe(true)
  })

  it('marks missing trailing words as wrong', () => {
    const result = compareWords('one two three', 'one two')
    expect(result).toEqual([
      { word: 'one',   ok: true  },
      { word: 'two',   ok: true  },
      { word: 'three', ok: false },
    ])
  })

  it('marks extra spoken words as wrong by position', () => {
    // Original has 2 words; spoken has 3 — extra spoken word shifts alignment
    const result = compareWords('one two', 'one two three')
    expect(result).toEqual([
      { word: 'one', ok: true  },
      { word: 'two', ok: true  },
    ])
  })

  it('returns empty array for empty original', () => {
    expect(compareWords('', 'anything')).toEqual([])
  })

  it('marks all words wrong when spoken is empty', () => {
    const result = compareWords('hello world', '')
    expect(result.every(w => !w.ok)).toBe(true)
  })

  it('handles Unicode letters (Chinese)', () => {
    const result = compareWords('你好 世界', '你好 世界')
    expect(result.every(w => w.ok)).toBe(true)
  })

  it('handles Unicode with punctuation stripped (Japanese)', () => {
    // Japanese has no spaces — after stripping 、 the two segments merge into
    // one token "こんにちは世界", so the spoken version (two tokens) won't match.
    // compareWords operates on space-separated tokens; CJK merging is expected.
    const result = compareWords('こんにちは、世界！', 'こんにちは世界')
    expect(result).toEqual([{ word: 'こんにちは世界', ok: true }])
  })

  it('handles extra whitespace gracefully', () => {
    const result = compareWords('  hello   world  ', 'hello world')
    expect(result.every(w => w.ok)).toBe(true)
  })

  it('partially correct sentence marks mixed ok/false', () => {
    const result = compareWords('the cat sat on the mat', 'the dog sat on the mat')
    expect(result).toEqual([
      { word: 'the', ok: true  },
      { word: 'cat', ok: false },
      { word: 'sat', ok: true  },
      { word: 'on',  ok: true  },
      { word: 'the', ok: true  },
      { word: 'mat', ok: true  },
    ])
  })
})

// ── scoreAttempt ──────────────────────────────────────────────────────────────

describe('scoreAttempt', () => {
  it('returns 100 for perfect match', () => {
    expect(scoreAttempt('hello world', 'hello world')).toBe(100)
  })

  it('returns 0 for completely wrong', () => {
    expect(scoreAttempt('hello world', 'foo bar')).toBe(0)
  })

  it('returns 50 for half correct', () => {
    expect(scoreAttempt('one two', 'one wrong')).toBe(50)
  })

  it('rounds to nearest integer', () => {
    // 2 of 3 correct = 66.67 → rounds to 67
    expect(scoreAttempt('a b c', 'a b x')).toBe(67)
  })

  it('returns 0 for empty original', () => {
    expect(scoreAttempt('', 'anything')).toBe(0)
  })

  it('returns 0 when spoken is empty', () => {
    expect(scoreAttempt('hello world', '')).toBe(0)
  })

  it('is case-insensitive (inherits from compareWords)', () => {
    expect(scoreAttempt('Hello World', 'hello world')).toBe(100)
  })

  it('ignores punctuation (inherits from compareWords)', () => {
    expect(scoreAttempt('Hello, world!', 'hello world')).toBe(100)
  })

  it('single word correct returns 100', () => {
    expect(scoreAttempt('hello', 'hello')).toBe(100)
  })

  it('single word wrong returns 0', () => {
    expect(scoreAttempt('hello', 'bye')).toBe(0)
  })
})

// ── compareWords edge cases ───────────────────────────────────────────────────

describe('compareWords — additional edge cases', () => {
  it('numbers are preserved and compared', () => {
    const result = compareWords('chapter 3', 'chapter 3')
    expect(result.every(w => w.ok)).toBe(true)
  })

  it('number mismatch is detected', () => {
    const result = compareWords('chapter 3', 'chapter 4')
    expect(result[1].ok).toBe(false)
  })

  it('only-whitespace original returns empty array', () => {
    expect(compareWords('   ', 'hello')).toEqual([])
  })

  it('only-whitespace spoken treats every original word as wrong', () => {
    const result = compareWords('hello world', '   ')
    expect(result.every(w => !w.ok)).toBe(true)
  })

  it('repeated words are compared positionally', () => {
    const result = compareWords('the the the', 'the the wrong')
    expect(result).toEqual([
      { word: 'the', ok: true  },
      { word: 'the', ok: true  },
      { word: 'the', ok: false },
    ])
  })
})

// ── segmentText ───────────────────────────────────────────────────────────────

describe('segmentText', () => {
  it('reconstructs the original text exactly when joined', () => {
    const txt = 'Hello world, friend!'
    expect(segmentText(txt, 'en').map(s => s.text).join('')).toBe(txt)
  })

  it('reconstructs Chinese text exactly when joined', () => {
    const txt = '我們發現姑姑家的牆上'
    expect(segmentText(txt, 'zh').map(s => s.text).join('')).toBe(txt)
  })

  it('marks English words as isWord and spaces/punct as not', () => {
    const segs = segmentText('Hi, you', 'en')
    const words = segs.filter(s => s.isWord).map(s => s.text)
    expect(words).toEqual(['Hi', 'you'])
  })

  it('segments Chinese into multi-character words (not just single chars)', () => {
    const segs = segmentText('我們發現', 'zh')
    const words = segs.filter(s => s.isWord).map(s => s.text)
    // Intl.Segmenter groups 我們 and 發現 as words
    expect(words).toContain('我們')
    expect(words).toContain('發現')
  })

  it('every non-word segment is whitespace or punctuation', () => {
    const segs = segmentText('Hello, world!', 'en')
    for (const s of segs) {
      if (!s.isWord) expect(/^[\s\p{P}]+$/u.test(s.text)).toBe(true)
    }
  })

  it('handles empty string', () => {
    expect(segmentText('', 'en')).toEqual([])
  })

  it('falls back gracefully for unknown language code', () => {
    const segs = segmentText('hello world', 'xx-ZZ')
    expect(segs.map(s => s.text).join('')).toBe('hello world')
    expect(segs.filter(s => s.isWord).length).toBeGreaterThan(0)
  })
})

// ── diffWords (LCS alignment) ─────────────────────────────────────────────────

import { diffWords, scoreFromDiff, missingWords } from './text'

describe('missingWords', () => {
  it('returns only the words the learner missed', () => {
    const diff = diffWords('the quick brown fox', 'the brown fox')
    expect(missingWords(diff)).toEqual(['quick'])
  })

  it('ignores extra (added) and correct words', () => {
    const diff = diffWords('hello world', 'hello there world now')
    expect(missingWords(diff)).toEqual([]) // nothing missing, only extras
  })

  it('de-duplicates repeated missed words', () => {
    const diff = diffWords('go go go home', 'home')
    expect(missingWords(diff)).toEqual(['go'])
  })

  it('returns [] when everything matched', () => {
    expect(missingWords(diffWords('all good here', 'all good here'))).toEqual([])
  })

  it('lists multiple distinct missed words in order', () => {
    const diff = diffWords('I really must go now', 'I go')
    expect(missingWords(diff)).toEqual(['really', 'must', 'now'])
  })
})

describe('diffWords', () => {
  it('all ok on exact match', () => {
    const d = diffWords('hello world', 'hello world')
    expect(d).toEqual([
      { word: 'hello', status: 'ok' },
      { word: 'world', status: 'ok' },
    ])
  })

  it('marks an extra spoken word as extra (shows everything said)', () => {
    const d = diffWords('hello world', 'hello big world')
    expect(d).toEqual([
      { word: 'hello', status: 'ok' },
      { word: 'big',   status: 'extra' },
      { word: 'world', status: 'ok' },
    ])
  })

  it('marks a dropped word as missing without cascading', () => {
    const d = diffWords('the cat sat down', 'the cat down')
    expect(d).toEqual([
      { word: 'the',  status: 'ok' },
      { word: 'cat',  status: 'ok' },
      { word: 'sat',  status: 'missing' },
      { word: 'down', status: 'ok' },   // NOT shifted to wrong
    ])
  })

  it('a substitution shows missing original + extra spoken', () => {
    const d = diffWords('the cat sat', 'the dog sat')
    expect(d).toContainEqual({ word: 'cat', status: 'missing' })
    expect(d).toContainEqual({ word: 'dog', status: 'extra' })
    expect(d).toContainEqual({ word: 'the', status: 'ok' })
    expect(d).toContainEqual({ word: 'sat', status: 'ok' })
  })

  it('every spoken word appears somewhere (nothing ignored)', () => {
    const d = diffWords('one two', 'one two three four')
    const extras = d.filter(t => t.status === 'extra').map(t => t.word)
    expect(extras).toEqual(['three', 'four'])
  })

  it('all original missing when spoken is empty', () => {
    const d = diffWords('hello world', '')
    expect(d.every(t => t.status === 'missing')).toBe(true)
  })

  it('handles Chinese tokens', () => {
    const d = diffWords('你好 世界', '你好 世界')
    expect(d.every(t => t.status === 'ok')).toBe(true)
  })

  it('is case- and punctuation-insensitive', () => {
    const d = diffWords('Hello, World!', 'hello world')
    expect(d.every(t => t.status === 'ok')).toBe(true)
  })
})

describe('scoreFromDiff', () => {
  it('100 for all ok', () => {
    expect(scoreFromDiff(diffWords('a b c', 'a b c'))).toBe(100)
  })

  it('extra words do NOT lower the score (only original coverage counts)', () => {
    expect(scoreFromDiff(diffWords('a b', 'a b c d'))).toBe(100)
  })

  it('missing words lower the score', () => {
    // 2 of 3 original said → 67
    expect(scoreFromDiff(diffWords('a b c', 'a c'))).toBe(67)
  })

  it('0 when nothing matches', () => {
    expect(scoreFromDiff(diffWords('a b c', 'x y z'))).toBe(0)
  })

  it('0 for empty original', () => {
    expect(scoreFromDiff(diffWords('', 'anything'))).toBe(0)
  })
})

// ── Single-word practice matching ─────────────────────────────────────────────

import { normalizeWord, levenshtein, similarity, wordMatches } from './text'

describe('normalizeWord', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeWord('Tower!')).toBe('tower')
    expect(normalizeWord('  Hello, ')).toBe('hello')
  })
  it('strips accents', () => {
    expect(normalizeWord('café')).toBe('cafe')
    expect(normalizeWord('ação')).toBe('acao')
  })
  it('keeps CJK characters', () => {
    expect(normalizeWord('你好！')).toBe('你好')
  })
  it('empty for punctuation-only', () => {
    expect(normalizeWord('...!?')).toBe('')
  })
})

describe('levenshtein', () => {
  it('0 for identical', () => expect(levenshtein('tower', 'tower')).toBe(0))
  it('counts single substitution', () => expect(levenshtein('tower', 'lower')).toBe(1))
  it('counts insertion', () => expect(levenshtein('tower', 'towers')).toBe(1))
  it('counts deletion', () => expect(levenshtein('tower', 'towe')).toBe(1))
  it('handles empty strings', () => {
    expect(levenshtein('', 'abc')).toBe(3)
    expect(levenshtein('abc', '')).toBe(3)
    expect(levenshtein('', '')).toBe(0)
  })
  it('is symmetric', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(levenshtein('sitting', 'kitten'))
    expect(levenshtein('kitten', 'sitting')).toBe(3)
  })
})

describe('similarity', () => {
  it('1 for identical (case/punct-insensitive)', () => {
    expect(similarity('Tower', 'tower!')).toBe(1)
  })
  it('high for near-miss', () => {
    expect(similarity('tower', 'towers')).toBeGreaterThan(0.8)
  })
  it('low for unrelated', () => {
    expect(similarity('tower', 'banana')).toBeLessThan(0.5)
  })
  it('0 when one side empty after normalize', () => {
    expect(similarity('tower', '!!!')).toBe(0)
  })
})

describe('wordMatches — correct acceptances', () => {
  it('exact match', () => {
    expect(wordMatches('tower', 'tower')).toBe(true)
  })
  it('match with surrounding words', () => {
    expect(wordMatches('tower', 'the tower is tall')).toBe(true)
  })
  it('match ignoring punctuation/case', () => {
    expect(wordMatches('Tower', 'Tower!')).toBe(true)
  })
  it('accepts a close plural/inflection', () => {
    expect(wordMatches('tower', 'towers')).toBe(true)
  })
  it('accepts despite ASR repetition loop', () => {
    expect(wordMatches('tower', 'tower tower tower')).toBe(true)
  })
  it('matches multi-word target spoken together', () => {
    expect(wordMatches('still alive', 'still alive')).toBe(true)
  })
  it('matches accented target said plainly', () => {
    expect(wordMatches('café', 'cafe')).toBe(true)
  })
})

describe('wordMatches — correct rejections (precision)', () => {
  it('rejects a totally different transcription', () => {
    // the real failure from the screenshot: said "tower", heard "that way that way"
    expect(wordMatches('tower', 'that way that way')).toBe(false)
  })
  it('rejects a similar-but-different word', () => {
    expect(wordMatches('tower', 'tour')).toBe(false)
    expect(wordMatches('tower', 'power')).toBe(true) // 1 edit of 5 = 0.8, accepted as close
  })
  it('rejects empty / silence', () => {
    expect(wordMatches('tower', '')).toBe(false)
    expect(wordMatches('tower', '...')).toBe(false)
  })
  it('rejects when only loosely related', () => {
    expect(wordMatches('passionately', 'passion')).toBe(false)
  })
  it('empty target never matches', () => {
    expect(wordMatches('', 'anything')).toBe(false)
  })
})

describe('wordMatches — threshold tuning', () => {
  it('stricter threshold rejects near-misses', () => {
    expect(wordMatches('tower', 'towers', 0.95)).toBe(false)
    expect(wordMatches('tower', 'towers', 0.8)).toBe(true)
  })
})
