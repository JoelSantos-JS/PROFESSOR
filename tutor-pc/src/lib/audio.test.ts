import { describe, it, expect } from 'vitest'
import { extractWebMHeader, isVoiced, peakLevel } from './audio'

// ── extractWebMHeader ─────────────────────────────────────────────────────────

describe('extractWebMHeader', () => {
  const CLUSTER_MARKER = [0x1F, 0x43, 0xB6, 0x75]

  function makeBuffer(...parts: number[][]): ArrayBuffer {
    const flat = parts.flat()
    return new Uint8Array(flat).buffer
  }

  it('returns entire buffer when no Cluster marker is present', () => {
    const buf = makeBuffer([0x1A, 0x45, 0xDF, 0xA3, 0x01, 0x02, 0x03])
    const result = extractWebMHeader(buf)
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.length).toBe(7)
    expect(Array.from(result)).toEqual([0x1A, 0x45, 0xDF, 0xA3, 0x01, 0x02, 0x03])
  })

  it('returns empty slice when Cluster marker is at byte 0', () => {
    const buf = makeBuffer(CLUSTER_MARKER, [0xAA, 0xBB])
    const result = extractWebMHeader(buf)
    expect(result.length).toBe(0)
  })

  it('returns header bytes before the first Cluster marker', () => {
    const header = [0x1A, 0x45, 0xDF, 0xA3, 0x10, 0x20]
    const audio  = [0xDE, 0xAD, 0xBE, 0xEF]
    const buf = makeBuffer(header, CLUSTER_MARKER, audio)
    const result = extractWebMHeader(buf)
    expect(Array.from(result)).toEqual(header)
  })

  it('stops at the FIRST Cluster marker when multiple are present', () => {
    const header  = [0x01, 0x02]
    const cluster1 = CLUSTER_MARKER
    const middle  = [0xFF, 0xFF]
    const cluster2 = CLUSTER_MARKER
    const buf = makeBuffer(header, cluster1, middle, cluster2)
    const result = extractWebMHeader(buf)
    expect(Array.from(result)).toEqual(header)
  })

  it('handles buffer shorter than 4 bytes without throwing', () => {
    const buf = new Uint8Array([0x1F, 0x43]).buffer
    const result = extractWebMHeader(buf)
    expect(result.length).toBe(2)
  })

  it('handles empty buffer without throwing', () => {
    const buf = new ArrayBuffer(0)
    const result = extractWebMHeader(buf)
    expect(result.length).toBe(0)
  })

  it('does not detect partial Cluster sequence as a marker', () => {
    // Only 3 of 4 marker bytes, followed by wrong byte
    const buf = makeBuffer([0x1F, 0x43, 0xB6, 0x00, 0xAA])
    const result = extractWebMHeader(buf)
    expect(result.length).toBe(5) // no match → full buffer returned
  })
})

// ── isVoiced ─────────────────────────────────────────────────────────────────

describe('isVoiced', () => {
  function silence(length = 512): Uint8Array {
    // All samples at midpoint = 128 → zero deviation
    return new Uint8Array(length).fill(128)
  }

  function voiced(length = 512, amplitude = 40): Uint8Array {
    // Alternating high/low → large deviation from 128
    return Uint8Array.from({ length }, (_, i) => (i % 2 === 0 ? 128 + amplitude : 128 - amplitude))
  }

  it('returns false for pure silence (all 128)', () => {
    expect(isVoiced(silence())).toBe(false)
  })

  it('returns true for loud voiced signal', () => {
    expect(isVoiced(voiced())).toBe(true)
  })

  it('returns false when only a tiny fraction of samples exceed threshold', () => {
    // 512 samples: only 2 voiced (< 3% of 512)
    const data = silence(512)
    data[10] = 200
    data[11] = 50
    expect(isVoiced(data)).toBe(false)
  })

  it('returns true when enough samples exceed threshold', () => {
    // 512 samples: 40 voiced (~7.8% > default 6%)
    const data = silence(512)
    for (let i = 0; i < 40; i++) data[i * 10] = 200
    expect(isVoiced(data)).toBe(true)
  })

  it('respects custom threshold parameter', () => {
    // amplitude=20, default threshold=14 → voiced; threshold=25 → silent
    const data = voiced(512, 20)
    expect(isVoiced(data, 14)).toBe(true)
    expect(isVoiced(data, 25)).toBe(false)
  })

  it('respects custom minRatio parameter', () => {
    // 20 voiced out of 512 = ~3.9%, passes 0.03 but not 0.05
    const data = silence(512)
    for (let i = 0; i < 20; i++) data[i] = 200
    expect(isVoiced(data, 14, 0.03)).toBe(true)
    expect(isVoiced(data, 14, 0.05)).toBe(false)
  })

  it('handles empty array without throwing', () => {
    expect(isVoiced(new Uint8Array(0))).toBe(false)
  })

  it('handles single-sample array', () => {
    const loud = new Uint8Array([200]) // deviation = 72 > 14
    expect(isVoiced(loud)).toBe(true)  // 1/1 = 100% > 3%
  })

  it('borderline: exactly at minRatio threshold returns false (not strictly greater)', () => {
    // Need count > data.length * minRatio, so equal is false
    // 512 samples, minRatio=0.03 → threshold = 15.36 → need >15 → 16 to pass
    const data = silence(512)
    for (let i = 0; i < 15; i++) data[i] = 200  // exactly 15 = NOT > 15.36
    expect(isVoiced(data, 14, 0.03)).toBe(false)
    data[15] = 200  // 16 voiced → > 15.36 → true
    expect(isVoiced(data, 14, 0.03)).toBe(true)
  })

  it('sample at exactly threshold (not above) is not counted as voiced', () => {
    // threshold=14 means Math.abs(v - 128) > 14, so v=142 → abs=14 → NOT > 14
    const data = silence(512)
    for (let i = 0; i < 100; i++) data[i] = 142  // deviation exactly 14 → not voiced
    expect(isVoiced(data, 14)).toBe(false)

    for (let i = 0; i < 100; i++) data[i] = 143  // deviation 15 → voiced
    expect(isVoiced(data, 14)).toBe(true)
  })
})

// ── peakLevel ─────────────────────────────────────────────────────────────────

describe('peakLevel', () => {
  it('returns 0 for pure silence', () => {
    expect(peakLevel(new Uint8Array(256).fill(128))).toBe(0)
  })

  it('returns the max deviation above the midpoint', () => {
    const d = new Uint8Array(256).fill(128)
    d[5] = 128 + 50
    d[9] = 128 + 30
    expect(peakLevel(d)).toBe(50)
  })

  it('returns the max deviation below the midpoint', () => {
    const d = new Uint8Array(256).fill(128)
    d[5] = 128 - 70
    expect(peakLevel(d)).toBe(70)
  })

  it('handles full-scale extremes', () => {
    expect(peakLevel(new Uint8Array([255]))).toBe(127)
    expect(peakLevel(new Uint8Array([0]))).toBe(128)
  })

  it('returns 0 for empty array', () => {
    expect(peakLevel(new Uint8Array(0))).toBe(0)
  })

  it('quiet ambient noise stays well below a speech gate of ~35', () => {
    // simulate low-level noise (deviation up to ~12)
    const d = Uint8Array.from({ length: 256 }, () => 128 + (Math.random() < 0.5 ? 1 : -1) * 10)
    expect(peakLevel(d)).toBeLessThan(35)
  })
})
