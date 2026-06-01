import { describe, it, expect } from 'vitest'
import { dataUrlBytes, capAudioMemory, AUDIO_BUDGET_BYTES } from './audioCache'

// Build a data URL whose decoded size is ~`bytes` (base64 len = bytes/0.75).
function clipOf(bytes: number): string {
  const b64len = Math.ceil(bytes / 0.75)
  return 'data:audio/webm;base64,' + 'A'.repeat(b64len)
}

describe('dataUrlBytes', () => {
  it('returns 0 for undefined', () => {
    expect(dataUrlBytes(undefined)).toBe(0)
  })
  it('estimates decoded size from base64 length', () => {
    // 100 base64 chars → 75 bytes
    expect(dataUrlBytes('data:audio/webm;base64,' + 'A'.repeat(100))).toBe(75)
  })
  it('handles raw base64 without a data: prefix', () => {
    expect(dataUrlBytes('A'.repeat(8))).toBe(6)
  })
})

describe('capAudioMemory', () => {
  it('returns items unchanged when under budget', () => {
    const items = [{ audioUrl: clipOf(1000) }, { audioUrl: clipOf(2000) }]
    expect(capAudioMemory(items, 10_000)).toBe(items)
  })

  it('drops the oldest clips until under budget', () => {
    const items = [
      { id: 'a', audioUrl: clipOf(4000) },
      { id: 'b', audioUrl: clipOf(4000) },
      { id: 'c', audioUrl: clipOf(4000) },
    ]
    const out = capAudioMemory(items, 9000) // only ~2 clips fit
    expect(out.map(i => i.id)).toEqual(['b', 'c'])
  })

  it('always keeps the most recent item', () => {
    const items = [
      { id: 'old', audioUrl: clipOf(100_000) },
      { id: 'new', audioUrl: clipOf(100_000) },
    ]
    const out = capAudioMemory(items, 1000) // budget smaller than one clip
    expect(out.map(i => i.id)).toEqual(['new'])
  })

  it('counts items without audio as zero size', () => {
    const items = [
      { id: 'x' },                         // no audio
      { id: 'y', audioUrl: clipOf(3000) },
    ]
    expect(capAudioMemory(items, 5000)).toBe(items) // total 3000 < 5000
  })

  it('handles an empty array', () => {
    expect(capAudioMemory([], 1000)).toEqual([])
  })

  it('uses the 50MB default budget', () => {
    expect(AUDIO_BUDGET_BYTES).toBe(50 * 1024 * 1024)
    const small = [{ audioUrl: clipOf(1_000_000) }]
    expect(capAudioMemory(small)).toBe(small) // 1MB well under 50MB
  })

  it('keeps a suffix (contiguous newest run), never reorders', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ i, audioUrl: clipOf(1000) }))
    const out = capAudioMemory(items, 3500) // ~3 clips
    expect(out.map(o => o.i)).toEqual([7, 8, 9])
  })
})
