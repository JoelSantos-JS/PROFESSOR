import { describe, expect, it } from 'vitest'
import { normalizeSamples } from './audioNormalize'

const peakOf = (s: Float32Array) => s.reduce((m, v) => Math.max(m, Math.abs(v)), 0)

describe('normalizeSamples', () => {
  it('amplifica fala quieta até perto do alvo', () => {
    const quiet = new Float32Array([0.1, -0.2, 0.15, -0.1])  // peak 0.2
    const out = normalizeSamples(quiet, { targetPeak: 0.9, maxGain: 10 })
    expect(peakOf(out)).toBeCloseTo(0.9, 5)
  })

  it('NÃO mexe em áudio já alto', () => {
    const loud = new Float32Array([0.9, -0.95, 0.8])  // peak 0.95
    const out = normalizeSamples(loud, { targetPeak: 0.95 })
    expect(out).toBe(loud)  // mesma referência (sem cópia)
  })

  it('NÃO amplifica silêncio/ruído abaixo do floor', () => {
    const noise = new Float32Array([0.005, -0.008, 0.003])  // peak 0.008 < floor 0.02
    const out = normalizeSamples(noise, { floor: 0.02 })
    expect(out).toBe(noise)  // intacto → não sobe ruído (anti-alucinação)
  })

  it('respeita o ganho máximo (não estoura)', () => {
    const veryQuiet = new Float32Array([0.05, -0.05])  // peak 0.05
    const out = normalizeSamples(veryQuiet, { targetPeak: 0.95, maxGain: 4 })
    expect(peakOf(out)).toBeCloseTo(0.2, 5)  // 0.05 * 4 = 0.2 (limitado, não vai a 0.95)
  })

  it('lida com array vazio sem quebrar', () => {
    const out = normalizeSamples(new Float32Array([]))
    expect(out.length).toBe(0)
  })

  it('não altera o sinal além do ganho (preserva forma)', () => {
    const s = new Float32Array([0.1, -0.05, 0.2, -0.15])  // peak 0.2
    const out = normalizeSamples(s, { targetPeak: 0.8, maxGain: 10 })  // gain = 4
    expect(out[0]).toBeCloseTo(0.4, 5)
    expect(out[2]).toBeCloseTo(0.8, 5)
    expect(Math.sign(out[1])).toBe(-1)  // mantém polaridade
  })
})
