import { describe, expect, it } from 'vitest'
import { SPLASH_STEPS, nextStatusIndex } from './splashStatus'

describe('nextStatusIndex', () => {
  it('avança um passo', () => {
    expect(nextStatusIndex(SPLASH_STEPS.length, 0)).toBe(1)
    expect(nextStatusIndex(SPLASH_STEPS.length, 2)).toBe(3)
  })

  it('faz wrap no fim da lista', () => {
    const last = SPLASH_STEPS.length - 1
    expect(nextStatusIndex(SPLASH_STEPS.length, last)).toBe(0)
  })

  it('lista vazia → 0', () => {
    expect(nextStatusIndex(0, 0)).toBe(0)
  })

  it('um único item fica sempre em 0', () => {
    expect(nextStatusIndex(1, 0)).toBe(0)
  })

  it('tem passos não vazios', () => {
    expect(SPLASH_STEPS.length).toBeGreaterThan(0)
    SPLASH_STEPS.forEach(s => expect(s.length).toBeGreaterThan(0))
  })
})
