import { describe, expect, it } from 'vitest'
import { hasEnoughPitch, pitchComparisonScores, voicedCount } from './pitchCompare'

describe('pitchCompare', () => {
  it('counts only voiced frames', () => {
    expect(voicedCount([0, 120, 0, 140])).toBe(2)
  })

  it('requires at least two voiced frames for a useful score', () => {
    expect(hasEnoughPitch([0, 120, 0])).toBe(false)
    expect(hasEnoughPitch([0, 120, 130])).toBe(true)
  })

  it('scores every available reference pair independently', () => {
    const user = [100, 120, 140, 160]
    const original = [110, 130, 150, 170]
    const tts = [220, 240, 260, 280]
    const scores = pitchComparisonScores({ user, original, tts })
    expect(scores.map(s => s.id)).toEqual(['user-original', 'user-tts', 'original-tts'])
    expect(scores.every(s => s.score > 90)).toBe(true)
  })

  it('does not block user-vs-original when TTS is unavailable', () => {
    const scores = pitchComparisonScores({
      user: [100, 120, 140],
      original: [90, 110, 130],
      tts: [],
    })
    expect(scores.map(s => s.id)).toEqual(['user-original'])
  })
})
