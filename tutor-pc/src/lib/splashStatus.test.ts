import { describe, expect, it } from 'vitest'
import { splashSteps, splashTagline, nextStatusIndex } from './splashStatus'

const N = splashSteps('en').length

describe('nextStatusIndex', () => {
  it('avança um passo', () => {
    expect(nextStatusIndex(N, 0)).toBe(1)
    expect(nextStatusIndex(N, 2)).toBe(3)
  })
  it('faz wrap no fim da lista', () => {
    expect(nextStatusIndex(N, N - 1)).toBe(0)
  })
  it('lista vazia → 0', () => {
    expect(nextStatusIndex(0, 0)).toBe(0)
  })
  it('um único item fica sempre em 0', () => {
    expect(nextStatusIndex(1, 0)).toBe(0)
  })
})

describe('splashSteps / splashTagline — por idioma', () => {
  it('pt e en têm passos não vazios', () => {
    for (const lang of ['pt', 'en'] as const) {
      const steps = splashSteps(lang)
      expect(steps.length).toBeGreaterThan(0)
      steps.forEach(s => expect(s.length).toBeGreaterThan(0))
    }
  })
  it('idiomas dão textos diferentes (de fato traduzido)', () => {
    expect(splashSteps('pt')[0]).not.toBe(splashSteps('en')[0])
    expect(splashTagline('pt')).not.toBe(splashTagline('en'))
  })
})
