import { describe, it, expect } from 'vitest'
import { goalProgress, DEFAULT_DAILY_TARGET } from './dailyGoal'

describe('goalProgress', () => {
  it('progresso parcial', () => {
    const g = goalProgress(2, 5)
    expect(g).toEqual({ done: 2, target: 5, pct: 40, reached: false, remaining: 3 })
  })
  it('meta batida', () => {
    const g = goalProgress(5, 5)
    expect(g.reached).toBe(true)
    expect(g.pct).toBe(100)
    expect(g.remaining).toBe(0)
  })
  it('passou da meta: pct limitado a 100, remaining 0', () => {
    const g = goalProgress(9, 5)
    expect(g.pct).toBe(100)
    expect(g.reached).toBe(true)
    expect(g.remaining).toBe(0)
  })
  it('zero feito', () => {
    expect(goalProgress(0, 5)).toMatchObject({ pct: 0, reached: false, remaining: 5 })
  })
  it('usa o alvo padrão', () => {
    expect(goalProgress(DEFAULT_DAILY_TARGET).reached).toBe(true)
  })
  it('sanitiza entradas inválidas', () => {
    expect(goalProgress(-3, 5).done).toBe(0)
    expect(goalProgress(2, 0).target).toBe(1)   // alvo mínimo 1 (evita /0)
    expect(goalProgress(2.7, 5).done).toBe(2)   // floor
  })
  it('alvo negativo vira 1', () => {
    expect(goalProgress(0, -5).target).toBe(1)
  })
  it('arredonda o pct (3/7 ≈ 43%)', () => {
    expect(goalProgress(3, 7).pct).toBe(43)
  })
  it('1/3 arredonda para 33', () => {
    expect(goalProgress(1, 3).pct).toBe(33)
  })
  it('valores enormes não estouram', () => {
    const g = goalProgress(1_000_000, 5)
    expect(g.pct).toBe(100)
    expect(g.remaining).toBe(0)
    expect(g.reached).toBe(true)
  })
})
