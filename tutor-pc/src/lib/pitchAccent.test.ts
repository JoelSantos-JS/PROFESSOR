import { describe, it, expect } from 'vitest'
import { pitchPattern, accentType, pitchForKana, accentTypeLabel } from './pitchAccent'

describe('accentType', () => {
  it('heiban quando accent = 0', () => {
    expect(accentType(3, 0)).toBe('heiban')
  })
  it('atamadaka quando accent = 1', () => {
    expect(accentType(3, 1)).toBe('atamadaka')
  })
  it('odaka quando accent = nº de moras', () => {
    expect(accentType(3, 3)).toBe('odaka')
  })
  it('nakadaka quando o downstep é interno', () => {
    expect(accentType(3, 2)).toBe('nakadaka')
    expect(accentType(4, 2)).toBe('nakadaka')
    expect(accentType(4, 3)).toBe('nakadaka')
  })
  it('palavra de 1 mora com accent 1 → atamadaka', () => {
    expect(accentType(1, 1)).toBe('atamadaka')
  })
})

describe('pitchPattern — os 4 tipos clássicos (はし)', () => {
  it('atamadaka 箸 (a=1): H L', () => {
    const p = pitchPattern(2, 1)
    expect(p.moras).toEqual(['H', 'L'])
    expect(p.particleHigh).toBe(false)
    expect(p.type).toBe('atamadaka')
  })
  it('odaka 橋 (a=2): L H, partícula cai', () => {
    const p = pitchPattern(2, 2)
    expect(p.moras).toEqual(['L', 'H'])
    expect(p.particleHigh).toBe(false)
    expect(p.type).toBe('odaka')
  })
  it('heiban 端 (a=0): L H, partícula alta', () => {
    const p = pitchPattern(2, 0)
    expect(p.moras).toEqual(['L', 'H'])
    expect(p.particleHigh).toBe(true)
    expect(p.type).toBe('heiban')
  })
  it('odaka e heiban têm o MESMO padrão de moras (só a partícula difere)', () => {
    expect(pitchPattern(2, 2).moras).toEqual(pitchPattern(2, 0).moras)
    expect(pitchPattern(2, 2).particleHigh).not.toBe(pitchPattern(2, 0).particleHigh)
  })
})

describe('pitchPattern — palavras de 3 moras', () => {
  it('heiban さくら (a=0): L H H', () => {
    expect(pitchPattern(3, 0).moras).toEqual(['L', 'H', 'H'])
  })
  it('atamadaka いのち (a=1): H L L', () => {
    expect(pitchPattern(3, 1).moras).toEqual(['H', 'L', 'L'])
  })
  it('nakadaka こころ (a=2): L H L', () => {
    expect(pitchPattern(3, 2).moras).toEqual(['L', 'H', 'L'])
  })
  it('odaka おとこ (a=3): L H H, partícula cai', () => {
    const p = pitchPattern(3, 3)
    expect(p.moras).toEqual(['L', 'H', 'H'])
    expect(p.particleHigh).toBe(false)
  })
})

describe('pitchPattern — invariantes', () => {
  it('mora 1 e mora 2 sempre têm alturas opostas', () => {
    for (let a = 0; a <= 4; a++) {
      const m = pitchPattern(4, a).moras
      expect(m[0]).not.toBe(m[1])
    }
  })
  it('só o heiban mantém a partícula alta', () => {
    for (let a = 0; a <= 4; a++) {
      expect(pitchPattern(4, a).particleHigh).toBe(a === 0)
    }
  })
  it('clampa accent fora do intervalo', () => {
    expect(pitchPattern(2, 9).accent).toBe(2)   // > moraCount → moraCount
    expect(pitchPattern(2, -3).accent).toBe(0)  // negativo → 0
    expect(pitchPattern(2, 1.7).accent).toBe(1) // fracionário → floor
  })
  it('moraCount 0 → sem moras', () => {
    expect(pitchPattern(0, 0).moras).toEqual([])
  })
  it('1 mora: atamadaka H, heiban L', () => {
    expect(pitchPattern(1, 1).moras).toEqual(['H'])
    expect(pitchPattern(1, 0).moras).toEqual(['L'])
  })
})

describe('pitchForKana', () => {
  it('conta moras (dígrafo = 1) e aplica o acento', () => {
    // きょう = 2 moras (きょ, う). heiban → L H
    expect(pitchForKana('きょう', 0).moras).toEqual(['L', 'H'])
    // とうきょう = 4 moras
    expect(pitchForKana('とうきょう', 0).moraCount).toBe(4)
  })
  it('conta sokuon e ー como moras', () => {
    expect(pitchForKana('コーヒー', 0).moraCount).toBe(4)
  })
})

describe('accentTypeLabel', () => {
  it('descreve cada tipo em português', () => {
    expect(accentTypeLabel('heiban')).toContain('平板')
    expect(accentTypeLabel('atamadaka')).toContain('頭高')
    expect(accentTypeLabel('nakadaka')).toContain('中高')
    expect(accentTypeLabel('odaka')).toContain('尾高')
  })
})
