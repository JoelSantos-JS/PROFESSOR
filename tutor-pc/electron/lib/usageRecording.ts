// Helpers puros pra instrumentar custo de IA: qual modelo cada provider usa (precisa bater com a
// tabela de preços do renderer), estimativa de tokens por texto, e duração de áudio por buffer.

const CHAT_MODEL: Record<string, string> = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-haiku-4-5',
  groq: 'llama-3.3-70b-versatile',
}

const TRANSCRIPTION_MODEL: Record<string, string> = {
  openai: 'whisper-1',
  groq: 'whisper-large-v3',
  gemini: 'gemini-2.5-flash',
}

export function chatModelFor(provider: string): string {
  return CHAT_MODEL[(provider || '').toLowerCase()] ?? 'unknown'
}

export function transcriptionModelFor(provider: string): string {
  return TRANSCRIPTION_MODEL[(provider || '').toLowerCase()] ?? 'unknown'
}

/** ~4 chars por token (aproximação padrão pra estimar custo BYOK sem parsear cada resposta). */
export function estimateTokens(text: string): number {
  return Math.ceil((text || '').length / 4)
}

/**
 * Duração (segundos) estimada a partir do buffer de áudio.
 * - WAV (RIFF): lê o `byteRate` do header → exato.
 * - Caso contrário (WebM/Opus do MediaRecorder a ~256 kbps): bytes ÷ 32000.
 */
export function estimateAudioSeconds(buf: Uint8Array): number {
  if (!buf || buf.length < 64) return 0
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) {  // "RIFF"
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
    const byteRate = dv.getUint32(28, true)   // bytes por segundo (offset 28 do header WAV)
    const dataBytes = buf.length - 44
    if (byteRate > 0 && dataBytes > 0) return dataBytes / byteRate
  }
  return buf.length / (256_000 / 8)   // 256 kbps → 32000 bytes/s
}
