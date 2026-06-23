import { describe, expect, it } from 'vitest'
import { shouldCloseSplash, splashCloseDelay } from './splashLifecycle'

describe('splashCloseDelay', () => {
  it('retorna o tempo restante quando ainda não passou o mínimo', () => {
    expect(splashCloseDelay(1000, 1300, 1200)).toBe(900)  // mostrou há 300ms, falta 900
  })

  it('0 quando já passou o mínimo', () => {
    expect(splashCloseDelay(1000, 3000, 1200)).toBe(0)
  })

  it('nunca negativo', () => {
    expect(splashCloseDelay(1000, 9999, 1200)).toBe(0)
  })
})

describe('shouldCloseSplash', () => {
  it('false antes do tempo mínimo', () => {
    expect(shouldCloseSplash(1000, 1100, 1200)).toBe(false)
  })

  it('true exatamente no limite', () => {
    expect(shouldCloseSplash(1000, 2200, 1200)).toBe(true)
  })

  it('true depois do limite', () => {
    expect(shouldCloseSplash(1000, 5000, 1200)).toBe(true)
  })
})
