import { describe, it, expect } from 'vitest'
import {
  floatingBarSize, FLOATING_BAR_WIDTH, FLOATING_BAR_COMPACT_H, FLOATING_BAR_FULL_H,
} from './floatingBarSize'

describe('floatingBarSize', () => {
  it('compact = largura padrão + altura compacta', () => {
    expect(floatingBarSize('compact')).toEqual({ width: FLOATING_BAR_WIDTH, height: FLOATING_BAR_COMPACT_H })
  })
  it('full = largura padrão + altura cheia', () => {
    expect(floatingBarSize('full')).toEqual({ width: FLOATING_BAR_WIDTH, height: FLOATING_BAR_FULL_H })
  })
  it('a largura não muda entre os modos', () => {
    expect(floatingBarSize('compact').width).toBe(floatingBarSize('full').width)
  })
  it('cheia é mais alta que compacta', () => {
    expect(floatingBarSize('full').height).toBeGreaterThan(floatingBarSize('compact').height)
  })
  it('valores plausíveis (compacta pequena, cheia menor que a tela)', () => {
    expect(FLOATING_BAR_COMPACT_H).toBeLessThan(300)
    expect(FLOATING_BAR_FULL_H).toBeLessThanOrEqual(600)
  })
})
