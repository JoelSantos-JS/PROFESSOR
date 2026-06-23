import { describe, expect, it } from 'vitest'
import { shouldRunInterim, resolveFinalText } from './interimTranscription'

const base = { speaking: true, busy: false, now: 2000, lastRunAt: 800, intervalMs: 1100 }

describe('shouldRunInterim', () => {
  it('dispara quando falando, livre e o intervalo passou', () => {
    expect(shouldRunInterim(base)).toBe(true)
  })

  it('não dispara se não está falando', () => {
    expect(shouldRunInterim({ ...base, speaking: false })).toBe(false)
  })

  it('não dispara se já há uma interina em voo', () => {
    expect(shouldRunInterim({ ...base, busy: true })).toBe(false)
  })

  it('não dispara antes do intervalo', () => {
    expect(shouldRunInterim({ ...base, now: 1500 })).toBe(false)  // só 700ms desde a última
  })

  it('dispara exatamente no limite do intervalo', () => {
    expect(shouldRunInterim({ ...base, now: 1900 })).toBe(true)  // 1100ms exatos
  })
})

describe('resolveFinalText', () => {
  it('prefere o texto final quando existe', () => {
    expect(resolveFinalText('frase final', 'previa ao vivo')).toBe('frase final')
  })

  it('cai pra prévia ao vivo quando o final vem vazio', () => {
    expect(resolveFinalText('', 'previa ao vivo')).toBe('previa ao vivo')
    expect(resolveFinalText('   ', 'previa ao vivo')).toBe('previa ao vivo')
  })

  it('vazio quando ambos faltam', () => {
    expect(resolveFinalText('', '')).toBe('')
  })

  it('apara espaços', () => {
    expect(resolveFinalText('  oi  ', '')).toBe('oi')
  })
})
