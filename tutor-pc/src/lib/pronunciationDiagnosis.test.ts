import { describe, it, expect } from 'vitest'
import { diagnoseReading, pronunciationTips, scoreLabel } from './pronunciationDiagnosis'

describe('diagnoseReading — palavras', () => {
  it('leitura perfeita → 100 e sem palavras fracas', () => {
    const d = diagnoseReading({ reference: 'i really think so', spoken: 'i really think so' })
    expect(d.wordScore).toBe(100)
    expect(d.overall).toBe(100)
    expect(d.weakWords).toEqual([])
    expect(d.intonationScore).toBeNull()   // sem curvas
  })
  it('palavras erradas reduzem o score e viram weakWords', () => {
    const d = diagnoseReading({ reference: 'the red cat ran fast', spoken: 'the cat ran' })
    expect(d.wordScore).toBeLessThan(100)
    expect(d.weakWords).toContain('red')
    expect(d.weakWords).toContain('fast')
  })
  it('sem curva de pitch → overall = wordScore', () => {
    const d = diagnoseReading({ reference: 'a b c d', spoken: 'a b x d' })
    expect(d.overall).toBe(d.wordScore)
  })
})

describe('diagnoseReading — entonação (DTW)', () => {
  const flat = [200, 200, 200, 200]
  const rising = [150, 175, 200, 225]
  it('combina palavra + entonação quando há curvas', () => {
    const d = diagnoseReading({
      reference: 'hello there', spoken: 'hello there',
      userContour: rising, refContour: rising,
    })
    expect(d.intonationScore).not.toBeNull()
    expect(d.intonationScore!).toBeGreaterThan(80)   // mesma forma
    // overall pondera 0.65 palavra + 0.35 entonação
    expect(d.overall).toBe(Math.round(100 * 0.65 + d.intonationScore! * 0.35))
  })
  it('curva diferente baixa a entonação', () => {
    const same = diagnoseReading({ reference: 'x', spoken: 'x', userContour: rising, refContour: rising }).intonationScore!
    const diff = diagnoseReading({ reference: 'x', spoken: 'x', userContour: flat, refContour: rising }).intonationScore!
    expect(diff).toBeLessThan(same)
  })
  it('contorno sem frames vozeados → ignora entonação', () => {
    const d = diagnoseReading({ reference: 'x', spoken: 'x', userContour: [0, 0], refContour: rising })
    expect(d.intonationScore).toBeNull()
  })
})

describe('pronunciationTips', () => {
  it('dica específica do idioma', () => {
    expect(pronunciationTips('zh', [])[0]).toMatch(/TONS/i)
    expect(pronunciationTips('ko', [])[0]).toMatch(/batchim/i)
  })
  it('reforça com as palavras fracas (máx 4)', () => {
    const tips = pronunciationTips('en', ['red', 'fast', 'thin', 'three', 'extra'])
    const last = tips[tips.length - 1]
    expect(last).toMatch(/Treine principalmente/i)
    expect(last).toContain('red')
    expect(last).not.toContain('extra')   // só as 4 primeiras
  })
  it('idioma sem dica → fallback genérico; no máx 3 dicas', () => {
    const tips = pronunciationTips('th', ['a', 'b'])
    expect(tips[0]).toMatch(/Ouça o modelo/i)
    expect(tips.length).toBeLessThanOrEqual(3)
  })
})

describe('scoreLabel', () => {
  it('faixas (pt, default)', () => {
    expect(scoreLabel(90)).toBe('Excelente')
    expect(scoreLabel(75)).toBe('Bom')
    expect(scoreLabel(55)).toBe('Razoável')
    expect(scoreLabel(30)).toBe('A treinar')
  })
  it('faixas (en)', () => {
    expect(scoreLabel(90, 'en')).toBe('Excellent')
    expect(scoreLabel(75, 'en')).toBe('Good')
    expect(scoreLabel(55, 'en')).toBe('Fair')
    expect(scoreLabel(30, 'en')).toBe('Needs work')
  })
})

describe('pronunciationTips — inglês', () => {
  it('dica específica do idioma em EN', () => {
    expect(pronunciationTips('zh', [], 'en')[0]).toMatch(/TONES/i)
    expect(pronunciationTips('ko', [], 'en')[0]).toMatch(/batchim/i)
  })
  it('reforço das palavras fracas em EN', () => {
    const last = pronunciationTips('en', ['red', 'thin'], 'en').at(-1)!
    expect(last).toMatch(/Focus mostly on/i)
    expect(last).toMatch(/red, thin/)
  })
  it('fallback genérico em EN', () => {
    expect(pronunciationTips('th', [], 'en')[0]).toMatch(/Listen to the model/i)
  })
})
