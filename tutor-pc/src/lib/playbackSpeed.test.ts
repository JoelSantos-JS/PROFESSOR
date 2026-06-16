import { describe, it, expect } from 'vitest'
import { normalizeSpeed, nextSpeed, speedLabel, PLAYBACK_SPEEDS, DEFAULT_SPEED } from './playbackSpeed'

describe('normalizeSpeed', () => {
  it('mantém valores válidos', () => {
    expect(normalizeSpeed(1)).toBe(1)
    expect(normalizeSpeed(0.8)).toBe(0.8)
    expect(normalizeSpeed('0.7')).toBe(0.7)   // string das settings
  })
  it('inválido/desconhecido → default', () => {
    expect(normalizeSpeed(0.5)).toBe(DEFAULT_SPEED)
    expect(normalizeSpeed('abc')).toBe(DEFAULT_SPEED)
    expect(normalizeSpeed(undefined)).toBe(DEFAULT_SPEED)
    expect(normalizeSpeed(2)).toBe(DEFAULT_SPEED)
  })
})

describe('nextSpeed', () => {
  it('cicla 1 → 0.9 → 0.8 → 0.7 → 1', () => {
    expect(nextSpeed(1)).toBe(0.9)
    expect(nextSpeed(0.9)).toBe(0.8)
    expect(nextSpeed(0.8)).toBe(0.7)
    expect(nextSpeed(0.7)).toBe(1)
  })
  it('parte do default quando inválido', () => {
    expect(nextSpeed('xyz')).toBe(0.9)   // default 1 → próximo 0.9
  })
  it('volta à 1ª depois de percorrer todas', () => {
    let s: number | string = 1
    for (let i = 0; i < PLAYBACK_SPEEDS.length; i++) s = nextSpeed(s)
    expect(s).toBe(1)
  })
})

describe('speedLabel', () => {
  it('formata com ×', () => {
    expect(speedLabel(1)).toBe('1×')
    expect(speedLabel(0.8)).toBe('0.8×')
    expect(speedLabel('0.9')).toBe('0.9×')
  })
  it('inválido → 1×', () => {
    expect(speedLabel('foo')).toBe('1×')
  })
})
