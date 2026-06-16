import { describe, it, expect } from 'vitest'
import { dtwDistance, dtwPath, zNormalize, pitchShapeScore } from './dtw'

describe('dtwDistance', () => {
  it('is 0 for identical sequences', () => {
    expect(dtwDistance([1, 2, 3], [1, 2, 3])).toBe(0)
  })

  it('tolerates time-stretching (same shape, different speed)', () => {
    // same shape, one is "slower" (repeated samples) → DTW aligns them at cost 0
    expect(dtwDistance([1, 2, 3], [1, 1, 2, 2, 3, 3])).toBe(0)
    expect(dtwDistance([1, 2, 3, 4], [1, 2, 2, 2, 3, 4])).toBe(0)
  })

  it('grows with amplitude difference', () => {
    const small = dtwDistance([1, 2, 3], [1, 2, 4])   // last off by 1
    const big   = dtwDistance([1, 2, 3], [1, 2, 9])   // last off by 6
    expect(big).toBeGreaterThan(small)
  })

  it('is symmetric', () => {
    const a = [1, 3, 2, 4], b = [1, 2, 2, 5]
    expect(dtwDistance(a, b)).toBe(dtwDistance(b, a))
  })

  it('handles different lengths', () => {
    expect(dtwDistance([1, 2, 3, 4, 5], [1, 5])).toBeGreaterThan(0)
  })

  it('edge cases: empty sequences', () => {
    expect(dtwDistance([], [])).toBe(0)
    expect(dtwDistance([1], [])).toBe(Infinity)
    expect(dtwDistance([], [1])).toBe(Infinity)
  })

  it('single elements = absolute difference', () => {
    expect(dtwDistance([5], [2])).toBe(3)
  })
})

describe('dtwPath', () => {
  it('is monotonic and spans both endpoints', () => {
    const path = dtwPath([1, 2, 3], [1, 1, 2, 3])
    expect(path[0]).toEqual([0, 0])
    expect(path[path.length - 1]).toEqual([2, 3])
    // i and j never decrease
    for (let k = 1; k < path.length; k++) {
      expect(path[k][0]).toBeGreaterThanOrEqual(path[k - 1][0])
      expect(path[k][1]).toBeGreaterThanOrEqual(path[k - 1][1])
    }
  })

  it('identical sequences → diagonal path', () => {
    expect(dtwPath([1, 2, 3], [1, 2, 3])).toEqual([[0, 0], [1, 1], [2, 2]])
  })

  it('empty input → empty path', () => {
    expect(dtwPath([], [1, 2])).toEqual([])
  })
})

describe('zNormalize', () => {
  it('produces mean 0 and std 1', () => {
    const z = zNormalize([10, 20, 30, 40])
    const mean = z.reduce((s, x) => s + x, 0) / z.length
    expect(Math.abs(mean)).toBeLessThan(1e-9)
    const std = Math.sqrt(z.reduce((s, x) => s + x * x, 0) / z.length)
    expect(std).toBeCloseTo(1)
  })
  it('flat series → all zeros (no divide by zero)', () => {
    expect(zNormalize([5, 5, 5])).toEqual([0, 0, 0])
  })
  it('removes absolute offset/scale (shape preserved)', () => {
    // [1,2,3] and [101,102,103] have the same shape → same z-norm
    expect(zNormalize([1, 2, 3])).toEqual(zNormalize([101, 102, 103]))
  })
  it('empty → empty', () => {
    expect(zNormalize([])).toEqual([])
  })
})

describe('pitchShapeScore', () => {
  const rising = [100, 120, 150, 190, 240]   // sobe (ex.: 2º tom)
  const falling = [240, 190, 150, 120, 100]  // desce (ex.: 4º tom)

  it('100 for an identical contour', () => {
    expect(pitchShapeScore(rising, rising)).toBe(100)
  })

  it('high even when the user speaks in a different pitch RANGE (same shape)', () => {
    const risingHigher = rising.map(v => v + 80)  // mesma forma, voz mais aguda
    expect(pitchShapeScore(risingHigher, rising)).toBeGreaterThan(95)
  })

  it('good when the user is slower (time-stretched same shape) — clearly above a wrong shape', () => {
    const risingSlow = [100, 110, 120, 135, 150, 170, 190, 215, 240]
    expect(pitchShapeScore(risingSlow, rising)).toBeGreaterThan(80)
    // and clearly better than the opposite shape
    expect(pitchShapeScore(risingSlow, rising)).toBeGreaterThan(pitchShapeScore(falling, rising))
  })

  it('LOW when the shape is opposite (rising vs falling)', () => {
    expect(pitchShapeScore(falling, rising)).toBeLessThan(50)
  })

  it('ignores unvoiced (0) frames', () => {
    const withGaps = [0, 0, 100, 120, 150, 190, 240, 0]
    expect(pitchShapeScore(withGaps, rising)).toBe(100)
  })

  it('returns 0 when there is not enough voiced signal', () => {
    expect(pitchShapeScore([0, 0, 0], rising)).toBe(0)
    expect(pitchShapeScore([150], rising)).toBe(0)
  })
})
