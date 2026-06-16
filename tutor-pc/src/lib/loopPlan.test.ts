import { describe, it, expect } from 'vitest'
import { buildLoopPlan, speedForRepeat, playDuration } from './loopPlan'

describe('speedForRepeat', () => {
  it('1 quando não há velocidades', () => {
    expect(speedForRepeat(undefined, 0)).toBe(1)
    expect(speedForRepeat([], 3)).toBe(1)
  })
  it('mapeia por índice', () => {
    expect(speedForRepeat([0.7, 0.85, 1], 0)).toBe(0.7)
    expect(speedForRepeat([0.7, 0.85, 1], 1)).toBe(0.85)
    expect(speedForRepeat([0.7, 0.85, 1], 2)).toBe(1)
  })
  it('a última velocidade se estende', () => {
    expect(speedForRepeat([0.7, 1], 5)).toBe(1)
  })
  it('ignora valores inválidos → 1', () => {
    expect(speedForRepeat([0], 0)).toBe(1)
    expect(speedForRepeat([NaN], 0)).toBe(1)
  })
})

describe('playDuration', () => {
  it('velocidade 1 mantém a duração', () => {
    expect(playDuration(1000, 1)).toBe(1000)
  })
  it('mais lento alonga, mais rápido encurta', () => {
    expect(playDuration(1000, 0.5)).toBe(2000)
    expect(playDuration(1000, 2)).toBe(500)
  })
  it('velocidade inválida vira 1', () => {
    expect(playDuration(1000, 0)).toBe(1000)
    expect(playDuration(1000, -1)).toBe(1000)
  })
})

describe('buildLoopPlan — estrutura', () => {
  it('0 repetições → vazio', () => {
    const p = buildLoopPlan({ clipMs: 1000, repeats: 0 })
    expect(p.steps).toEqual([])
    expect(p.totalMs).toBe(0)
  })

  it('1 repetição sem gap final → só um play', () => {
    const p = buildLoopPlan({ clipMs: 1000, repeats: 1 })
    expect(p.steps).toEqual([{ type: 'play', index: 0, startMs: 0, durationMs: 1000, speed: 1 }])
    expect(p.totalMs).toBe(1000)
  })

  it('emendado (gap none): plays consecutivos', () => {
    const p = buildLoopPlan({ clipMs: 1000, repeats: 3, gap: 'none' })
    expect(p.steps.map(s => s.type)).toEqual(['play', 'play', 'play'])
    expect(p.steps.map(s => s.startMs)).toEqual([0, 1000, 2000])
    expect(p.totalMs).toBe(3000)
  })

  it('gap echo: intervalo do tamanho da reprodução entre as repetições', () => {
    const p = buildLoopPlan({ clipMs: 1000, repeats: 2, gap: 'echo' })
    expect(p.steps).toEqual([
      { type: 'play', index: 0, startMs: 0, durationMs: 1000, speed: 1 },
      { type: 'gap', index: 0, startMs: 1000, durationMs: 1000, speed: 1 },
      { type: 'play', index: 1, startMs: 2000, durationMs: 1000, speed: 1 },
    ])
    expect(p.totalMs).toBe(3000)
  })

  it('gap fixo em ms', () => {
    const p = buildLoopPlan({ clipMs: 1000, repeats: 2, gap: 500 })
    expect(p.steps.map(s => s.durationMs)).toEqual([1000, 500, 1000])
    expect(p.totalMs).toBe(2500)
  })

  it('sem gap final por padrão (não há gap após a última)', () => {
    const p = buildLoopPlan({ clipMs: 1000, repeats: 2, gap: 'echo' })
    expect(p.steps[p.steps.length - 1].type).toBe('play')
  })

  it('trailingGap inclui gap após a última', () => {
    const p = buildLoopPlan({ clipMs: 1000, repeats: 1, gap: 'echo', trailingGap: true })
    expect(p.steps.map(s => s.type)).toEqual(['play', 'gap'])
    expect(p.totalMs).toBe(2000)
  })
})

describe('buildLoopPlan — velocidade graduada (shadowing progressivo)', () => {
  it('aplica velocidades por repetição e ajusta a duração', () => {
    const p = buildLoopPlan({ clipMs: 1000, repeats: 3, gap: 'none', speeds: [0.5, 0.75, 1] })
    const plays = p.steps.filter(s => s.type === 'play')
    expect(plays.map(s => s.speed)).toEqual([0.5, 0.75, 1])
    expect(plays.map(s => s.durationMs)).toEqual([2000, 1333, 1000])
  })

  it('gap echo acompanha a duração (alongada) da reprodução lenta', () => {
    const p = buildLoopPlan({ clipMs: 1000, repeats: 2, gap: 'echo', speeds: [0.5] })
    // velocidade 0.5 → play 2000; echo 2000; play seguinte usa última velocidade (0.5) → 2000
    expect(p.steps.map(s => s.durationMs)).toEqual([2000, 2000, 2000])
  })

  it('a soma das durações = totalMs', () => {
    const p = buildLoopPlan({ clipMs: 850, repeats: 4, gap: 300, speeds: [0.7, 0.85, 1] })
    const sum = p.steps.reduce((a, s) => a + s.durationMs, 0)
    expect(sum).toBe(p.totalMs)
  })

  it('cada startMs = soma das durações anteriores', () => {
    const p = buildLoopPlan({ clipMs: 600, repeats: 3, gap: 'echo', speeds: [0.6, 0.8, 1] })
    let acc = 0
    for (const s of p.steps) {
      expect(s.startMs).toBe(acc)
      acc += s.durationMs
    }
  })
})
