import { describe, it, expect } from 'vitest'
import { detectPitch, pitchContour, normalizeContour } from './pitch'

const SR = 16000

function sine(freq: number, length: number, sampleRate = SR, amp = 0.5): Float32Array {
  const buf = new Float32Array(length)
  for (let i = 0; i < length; i++) buf[i] = amp * Math.sin((2 * Math.PI * freq * i) / sampleRate)
  return buf
}

describe('detectPitch', () => {
  it('detects a 220 Hz tone within tolerance', () => {
    const f = detectPitch(sine(220, 2048), SR)
    expect(f).toBeGreaterThan(210)
    expect(f).toBeLessThan(230)
  })

  it('detects a 150 Hz tone within tolerance', () => {
    const f = detectPitch(sine(150, 2048), SR)
    expect(f).toBeGreaterThan(143)
    expect(f).toBeLessThan(157)
  })

  it('returns 0 for silence', () => {
    expect(detectPitch(new Float32Array(2048), SR)).toBe(0)
  })

  it('returns 0 for very quiet signal (below RMS gate)', () => {
    expect(detectPitch(sine(200, 2048, SR, 0.001), SR)).toBe(0)
  })

  it('detects soft-but-real speech levels (acima do gate afrouxado)', () => {
    // amp 0.008 → RMS ≈ 0.0057: abaixo do gate antigo (0.006) mas acima do novo (0.004)
    const f = detectPitch(sine(200, 2048, SR, 0.008), SR)
    expect(f).toBeGreaterThan(190)
    expect(f).toBeLessThan(210)
  })

  it('returns 0 for white noise (no clear period)', () => {
    const noise = Float32Array.from({ length: 2048 }, () => (Math.random() * 2 - 1) * 0.5)
    // noise occasionally yields a weak peak; just assert it is not a confident musical tone
    const f = detectPitch(noise, SR)
    expect(f === 0 || f < 70 || f > 400).toBe(true)
  })

  it('respects the min/max Hz search range', () => {
    // a 1000 Hz tone is outside the default 70-400 range → not returned as 1000
    const f = detectPitch(sine(1000, 2048), SR)
    expect(f).not.toBeGreaterThan(400)
  })

  it('handles empty buffer / invalid sample rate', () => {
    expect(detectPitch(new Float32Array(0), SR)).toBe(0)
    expect(detectPitch(sine(220, 1024), 0)).toBe(0)
  })
})

describe('pitchContour', () => {
  it('returns a frame per hop over the signal', () => {
    const sig = sine(200, 4096)
    const contour = pitchContour(sig, SR, 1024, 512)
    // (4096 - 1024) / 512 + 1 = 7 frames
    expect(contour.length).toBe(7)
  })

  it('detects roughly constant pitch for a steady tone', () => {
    const contour = pitchContour(sine(180, 8192), SR, 2048, 1024)
    const voiced = contour.filter(v => v > 0)
    expect(voiced.length).toBeGreaterThan(0)
    for (const v of voiced) {
      expect(v).toBeGreaterThan(170)
      expect(v).toBeLessThan(190)
    }
  })

  it('returns empty for signal shorter than a frame', () => {
    expect(pitchContour(sine(200, 256), SR, 1024)).toEqual([])
  })

  it('marks silent frames as 0', () => {
    const contour = pitchContour(new Float32Array(4096), SR, 1024, 512)
    expect(contour.every(v => v === 0)).toBe(true)
  })
})

describe('normalizeContour', () => {
  it('scales voiced values to 0..1', () => {
    const norm = normalizeContour([100, 200, 300])
    expect(norm[0]).toBe(0)
    expect(norm[2]).toBe(1)
    expect(norm[1]).toBeCloseTo(0.5)
  })

  it('keeps unvoiced (0) frames as null (line break)', () => {
    const norm = normalizeContour([100, 0, 200])
    expect(norm[1]).toBeNull()
  })

  it('all-unvoiced → all null', () => {
    expect(normalizeContour([0, 0, 0])).toEqual([null, null, null])
  })

  it('handles a single voiced value (range 0)', () => {
    const norm = normalizeContour([200])
    expect(norm[0]).toBe(0)  // min==max → 0
  })
})
