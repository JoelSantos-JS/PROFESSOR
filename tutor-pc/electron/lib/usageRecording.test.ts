import { describe, it, expect } from 'vitest'
import { chatModelFor, transcriptionModelFor, estimateTokens, estimateAudioSeconds } from './usageRecording'

describe('chatModelFor / transcriptionModelFor', () => {
  it('mapeia provider → modelo de chat (case-insensitive)', () => {
    expect(chatModelFor('groq')).toBe('llama-3.3-70b-versatile')
    expect(chatModelFor('OpenAI')).toBe('gpt-4o-mini')
    expect(chatModelFor('gemini')).toBe('gemini-2.5-flash')
    expect(chatModelFor('anthropic')).toBe('claude-haiku-4-5')
    expect(chatModelFor('x')).toBe('unknown')
  })
  it('mapeia provider → modelo de transcrição', () => {
    expect(transcriptionModelFor('openai')).toBe('whisper-1')
    expect(transcriptionModelFor('groq')).toBe('whisper-large-v3')
    expect(transcriptionModelFor('gemini')).toBe('gemini-2.5-flash')
    expect(transcriptionModelFor('x')).toBe('unknown')
  })
})

describe('estimateTokens', () => {
  it('~4 chars por token (arredonda pra cima)', () => {
    expect(estimateTokens('abcd')).toBe(1)
    expect(estimateTokens('abcde')).toBe(2)
    expect(estimateTokens('')).toBe(0)
  })
})

describe('estimateAudioSeconds', () => {
  it('WAV: usa o byteRate do header (offset 28)', () => {
    const wav = new Uint8Array(44 + 32000)
    wav[0] = 0x52; wav[1] = 0x49; wav[2] = 0x46; wav[3] = 0x46   // "RIFF"
    new DataView(wav.buffer).setUint32(28, 32000, true)          // 32000 bytes/s → 1s de dados
    expect(estimateAudioSeconds(wav)).toBeCloseTo(1, 6)
  })
  it('não-WAV (WebM ~256kbps): bytes ÷ 32000', () => {
    const webm = new Uint8Array(320_000)  // sem cabeçalho RIFF
    expect(estimateAudioSeconds(webm)).toBeCloseTo(10, 6)
  })
  it('buffer minúsculo → 0', () => {
    expect(estimateAudioSeconds(new Uint8Array(10))).toBe(0)
  })
})
