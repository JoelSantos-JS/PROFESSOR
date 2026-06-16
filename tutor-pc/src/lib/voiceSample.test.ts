import { describe, it, expect } from 'vitest'
import {
  validateVoiceSample,
  voiceCalibrationPrompt,
  VOICE_SAMPLE_MIN_MS,
  VOICE_SAMPLE_MAX_MS,
} from './voiceSample'

describe('validateVoiceSample', () => {
  it('aceita uma amostra com duração ok', () => {
    expect(validateVoiceSample({ durationMs: 8000, mimeType: 'audio/webm' })).toEqual({ ok: true })
  })
  it('rejeita curta demais (com motivo)', () => {
    const r = validateVoiceSample({ durationMs: VOICE_SAMPLE_MIN_MS - 1 })
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/pelo menos/i)
  })
  it('rejeita longa demais', () => {
    const r = validateVoiceSample({ durationMs: VOICE_SAMPLE_MAX_MS + 1 })
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/longa/i)
  })
  it('rejeita mime que não é áudio', () => {
    const r = validateVoiceSample({ durationMs: 8000, mimeType: 'video/mp4' })
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/áudio/i)
  })
  it('duração inválida (NaN) é rejeitada', () => {
    expect(validateVoiceSample({ durationMs: NaN }).ok).toBe(false)
  })
  it('os limites são inclusivos nas bordas', () => {
    expect(validateVoiceSample({ durationMs: VOICE_SAMPLE_MIN_MS }).ok).toBe(true)
    expect(validateVoiceSample({ durationMs: VOICE_SAMPLE_MAX_MS }).ok).toBe(true)
  })
})

describe('voiceCalibrationPrompt', () => {
  it('retorna a frase no idioma da interface', () => {
    expect(voiceCalibrationPrompt('pt')).toMatch(/minha voz/i)
    expect(voiceCalibrationPrompt('en')).toMatch(/my voice/i)
  })
  it('normaliza variantes (en-US → en)', () => {
    expect(voiceCalibrationPrompt('en-US')).toBe(voiceCalibrationPrompt('en'))
  })
  it('idioma sem prompt cai no português', () => {
    expect(voiceCalibrationPrompt('xx')).toBe(voiceCalibrationPrompt('pt'))
    expect(voiceCalibrationPrompt(undefined)).toBe(voiceCalibrationPrompt('pt'))
  })
})
