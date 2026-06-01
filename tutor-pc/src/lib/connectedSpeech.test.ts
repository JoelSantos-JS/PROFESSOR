import { describe, it, expect } from 'vitest'
import { connectedSpeech, hasConnectedSpeech } from './connectedSpeech'

describe('connectedSpeech — linking', () => {
  it('links a consonant to a following vowel with a tie', () => {
    expect(connectedSpeech('in a hat')).toBe('in‿a hat')
  })

  it('links multiple times in a sentence', () => {
    // "that's all" (s→a) and "well and" (l→a) link; others don't
    expect(connectedSpeech("that's all well and good")).toBe("that's‿all well‿and good")
  })

  it('does NOT link vowel → vowel', () => {
    expect(connectedSpeech('the apple')).toBe('the apple') // e→a is vowel→vowel
  })

  it('does NOT link consonant → consonant', () => {
    expect(connectedSpeech('good dog')).toBe('good dog')
  })

  it('does NOT link across punctuation', () => {
    expect(connectedSpeech('good, ok')).toBe('good, ok')   // comma blocks
    expect(connectedSpeech('wait. always')).toBe('wait. always')
  })

  it('handles multiple spaces', () => {
    expect(connectedSpeech('in   a')).toBe('in‿a')
  })

  it('is case-insensitive for the vowel/consonant check', () => {
    expect(connectedSpeech('In A')).toBe('In‿A')
  })

  it('returns plain text when nothing links', () => {
    expect(connectedSpeech('big dog')).toBe('big dog')
  })

  it('handles empty string', () => {
    expect(connectedSpeech('')).toBe('')
  })
})

describe('connectedSpeech — reductions', () => {
  it.each([
    ['I want to go',        'I wanna go'],
    ['going to rain',       'gonna rain'],
    ['I have to leave',     'I hafta leave'],
    ['got to run',          'gotta run'],
    ['kind of cold',        'kinda cold'],
    ['sort of',             'sorta'],
    ['out of time',         'outta time'],
    ['let me see',          'lemme see'],
    ['give me that',        'gimme that'],
    ['did you eat',         'didja eat'],     // note: also no extra link added inside "didja"
    ['would you mind',      'wouldja mind'],
  ])('reduces %s → %s', (input, expected) => {
    expect(connectedSpeech(input)).toBe(expected)
  })

  it('is case-insensitive for reductions', () => {
    expect(connectedSpeech('I WANT TO')).toBe('I wanna')
  })

  it('applies reduction AND linking together', () => {
    // "want to" → "wanna"; then "wanna eat": a→e is vowel→vowel, no link
    expect(connectedSpeech('want to eat')).toBe('wanna eat')
  })

  it('reduction then linking on remaining words', () => {
    // "let me in" → "lemme in": e→i vowel→vowel no link; keep as is
    expect(connectedSpeech('let me in')).toBe('lemme in')
  })

  it('does not reduce partial-word matches', () => {
    expect(connectedSpeech('wanted')).toBe('wanted')  // not "want to"
    expect(connectedSpeech('about')).toBe('about')
  })
})

describe('hasConnectedSpeech', () => {
  it('true when linking changes the text', () => {
    expect(hasConnectedSpeech('in a hat')).toBe(true)
  })
  it('true when a reduction applies', () => {
    expect(hasConnectedSpeech('want to go')).toBe(true)
  })
  it('false when nothing changes', () => {
    expect(hasConnectedSpeech('big red dog')).toBe(false)
    expect(hasConnectedSpeech('')).toBe(false)
  })
})
