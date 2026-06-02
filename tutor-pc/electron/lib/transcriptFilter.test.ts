import { describe, it, expect } from 'vitest'
import {
  isNonSpeech, isHallucinationPhrase, shouldRejectTranscript,
  NO_SPEECH_THRESHOLD, type WhisperSegment,
} from './transcriptFilter'

describe('isNonSpeech — refined signals', () => {
  it('rejects borderline-on-BOTH signals (forced garbage like "Thank you deix toughest")', () => {
    // Neither alone trips a hard threshold, but together they do.
    expect(isNonSpeech([{ no_speech_prob: 0.45, avg_logprob: -0.65 }])).toBe(true)
  })

  it('keeps speech that is borderline on only ONE signal', () => {
    expect(isNonSpeech([{ no_speech_prob: 0.45, avg_logprob: -0.3 }])).toBe(false) // noisy but confident
    expect(isNonSpeech([{ no_speech_prob: 0.1,  avg_logprob: -0.7 }])).toBe(false) // low conf but clearly speech
  })

  it('rejects high compression_ratio (repetitive hallucination)', () => {
    expect(isNonSpeech([{ no_speech_prob: 0.1, avg_logprob: -0.3, compression_ratio: 2.6 }])).toBe(true)
  })

  it('keeps normal compression_ratio', () => {
    expect(isNonSpeech([{ no_speech_prob: 0.1, avg_logprob: -0.3, compression_ratio: 1.8 }])).toBe(false)
  })
})

describe('isNonSpeech', () => {
  it('false for empty segments (no signal → trust text)', () => {
    expect(isNonSpeech([])).toBe(false)
  })

  it('false for confident speech', () => {
    const segs: WhisperSegment[] = [{ no_speech_prob: 0.05, avg_logprob: -0.2 }]
    expect(isNonSpeech(segs)).toBe(false)
  })

  it('true when no_speech_prob is high (music/ambient)', () => {
    expect(isNonSpeech([{ no_speech_prob: 0.85, avg_logprob: -0.3 }])).toBe(true)
  })

  it('true when avg_logprob is very low (low confidence)', () => {
    expect(isNonSpeech([{ no_speech_prob: 0.2, avg_logprob: -1.4 }])).toBe(true)
  })

  it('uses the average across segments', () => {
    const segs: WhisperSegment[] = [
      { no_speech_prob: 0.9, avg_logprob: -0.3 },
      { no_speech_prob: 0.1, avg_logprob: -0.3 },
    ]
    // avg no_speech = 0.5 < 0.6 → not rejected on that signal
    expect(isNonSpeech(segs)).toBe(false)
  })

  it('borderline exactly at threshold is rejected (>=)', () => {
    expect(isNonSpeech([{ no_speech_prob: NO_SPEECH_THRESHOLD, avg_logprob: -0.2 }])).toBe(true)
  })

  it('tolerates missing fields', () => {
    expect(isNonSpeech([{}])).toBe(false)
  })
})

describe('isHallucinationPhrase', () => {
  it('flags common YouTube-style hallucinations', () => {
    expect(isHallucinationPhrase('Thanks for watching!')).toBe(true)
    expect(isHallucinationPhrase('Please subscribe')).toBe(true)
    expect(isHallucinationPhrase('Subtitles by the Amara.org community')).toBe(true)
  })

  it('flags pure music notes', () => {
    expect(isHallucinationPhrase('♪')).toBe(true)
    expect(isHallucinationPhrase('♪♪')).toBe(true)
  })

  it('flags empty / punctuation-only', () => {
    expect(isHallucinationPhrase('')).toBe(true)
    expect(isHallucinationPhrase('  ...  ')).toBe(true)
  })

  it('flags standalone sound-event words', () => {
    expect(isHallucinationPhrase('Music')).toBe(true)
    expect(isHallucinationPhrase('music.')).toBe(true)
    expect(isHallucinationPhrase('Applause')).toBe(true)
    expect(isHallucinationPhrase('Laughter')).toBe(true)
    expect(isHallucinationPhrase('[Music]')).toBe(true)
    expect(isHallucinationPhrase('(applause)')).toBe(true)
  })

  it('flags descriptive sound annotations', () => {
    expect(isHallucinationPhrase('upbeat music')).toBe(true)
    expect(isHallucinationPhrase('soft music')).toBe(true)
    expect(isHallucinationPhrase('[dramatic music]')).toBe(true)
    expect(isHallucinationPhrase('(gentle music playing)')).toBe(true) // fully wrapped = sound event
    expect(isHallucinationPhrase('(door creaks)')).toBe(true)
    expect(isHallucinationPhrase('♪ music ♪')).toBe(true)
  })

  it('does NOT flag real short dialogue', () => {
    expect(isHallucinationPhrase('Thank you.')).toBe(false)  // real in dialogue
    expect(isHallucinationPhrase('I')).toBe(false)
    expect(isHallucinationPhrase('Yes.')).toBe(false)
    expect(isHallucinationPhrase('Sherlock Holmes')).toBe(false)
  })

  it('does NOT flag a sound word inside a real sentence', () => {
    expect(isHallucinationPhrase('I love this music')).toBe(false)
    expect(isHallucinationPhrase('Turn the music down')).toBe(false)
    expect(isHallucinationPhrase('The applause was deafening')).toBe(false)
  })

  it('is case/punctuation insensitive', () => {
    expect(isHallucinationPhrase('THANKS FOR WATCHING...')).toBe(true)
  })
})

describe('shouldRejectTranscript', () => {
  it('rejects a hallucination phrase regardless of segments', () => {
    expect(shouldRejectTranscript('Thanks for watching', [{ no_speech_prob: 0.1 }])).toBe(true)
  })

  it('rejects real-looking text when segments say non-speech', () => {
    // "Thank you" on music → high no_speech_prob → reject
    expect(shouldRejectTranscript('Thank you.', [{ no_speech_prob: 0.9, avg_logprob: -0.4 }])).toBe(true)
  })

  it('keeps real speech with good confidence', () => {
    expect(shouldRejectTranscript('Thank you.', [{ no_speech_prob: 0.1, avg_logprob: -0.2 }])).toBe(false)
  })

  it('keeps speech when there are no segments and text is fine', () => {
    expect(shouldRejectTranscript('There are two professors out there.', [])).toBe(false)
  })

  it('rejects empty/music text even with no segments', () => {
    expect(shouldRejectTranscript('♪', [])).toBe(true)
    expect(shouldRejectTranscript('', [])).toBe(true)
  })
})
