// Validação/normalização da amostra de voz da calibração — puro/testável, independente de provider.
// Garante qualidade (áudio suficiente) e serve de guarda ético: só clonamos a própria voz, gravada
// na hora lendo um prompt neutro (nunca um arquivo de terceiros).

export const VOICE_SAMPLE_MIN_MS = 6000   // < 6s: pouco sinal pra um clone decente
export const VOICE_SAMPLE_MAX_MS = 30000  // > 30s: desnecessário e pesado pra enviar

const ACCEPTED_MIME = /^audio\//

export interface VoiceSampleCheck {
  ok: boolean
  reason?: string  // mensagem pronta pra UI quando !ok
}

/** A amostra tem duração/formato adequados pra clonagem? */
export function validateVoiceSample(s: { durationMs: number; mimeType?: string }): VoiceSampleCheck {
  if (s.mimeType && !ACCEPTED_MIME.test(s.mimeType)) {
    return { ok: false, reason: 'O arquivo precisa ser de áudio.' }
  }
  if (!Number.isFinite(s.durationMs) || s.durationMs < VOICE_SAMPLE_MIN_MS) {
    return { ok: false, reason: `Grave pelo menos ${Math.round(VOICE_SAMPLE_MIN_MS / 1000)}s lendo a frase.` }
  }
  if (s.durationMs > VOICE_SAMPLE_MAX_MS) {
    return { ok: false, reason: `A amostra é longa demais (máx. ${Math.round(VOICE_SAMPLE_MAX_MS / 1000)}s).` }
  }
  return { ok: true }
}

const PROMPTS: Record<string, string> = {
  pt: 'Olá! Esta é a minha voz. Estou gravando esta frase para o Capta aprender o meu timbre e me ajudar a praticar pronúncia.',
  en: 'Hello! This is my voice. I am reading this sentence so Capta can learn how I sound and help me practice pronunciation.',
}

/** Frase neutra pra ler na calibração (na língua da interface), com fallback pro português. */
export function voiceCalibrationPrompt(appLang?: string): string {
  const base = (appLang || 'pt').slice(0, 2).toLowerCase()
  return PROMPTS[base] ?? PROMPTS.pt
}
