// Monta as requisições de clonagem de voz por provider — puro/testável, separando a montagem
// de URL+headers+body da chamada de rede (mesmo padrão do `providerTestProbe`).
// Modo B: TTS com a voz do usuário (texto → áudio no timbre dele), NÃO conversão ao vivo.
// `elevenlabs` = nuvem (BYOK); `xtts` = local (worker, sem HTTP → specs `undefined` aqui).

export type VoiceCloneProvider = 'elevenlabs' | 'xtts'

/** Modelo multilíngue do ElevenLabs: o MESMO id serve qualquer idioma (a voz é cross-lingual). */
const ELEVENLABS_MODEL = 'eleven_multilingual_v2'

/** Requisição JSON (síntese). `body` já vem serializado. */
export interface CloneSynthesisSpec {
  url: string
  method: 'POST'
  headers: Record<string, string>
  body: string
}

/** Requisição multipart (cadastro da amostra). O serviço monta o corpo com o arquivo no `fileField`. */
export interface VoiceEnrollSpec {
  url: string
  method: 'POST'
  headers: Record<string, string>
  fields: Record<string, string>  // campos de texto do multipart
  fileField: string               // nome da parte que recebe o áudio da amostra
}

/** Cadastra a amostra da voz no provider → de onde sai o `voiceId`. `undefined` se faltar dado/for local. */
export function buildVoiceEnrollRequest(
  provider: VoiceCloneProvider,
  opts: { name: string; apiKey: string },
): VoiceEnrollSpec | undefined {
  if (provider === 'elevenlabs') {
    if (!opts.apiKey?.trim()) return undefined
    return {
      url: 'https://api.elevenlabs.io/v1/voices/add',
      method: 'POST',
      headers: { 'xi-api-key': opts.apiKey },
      fields: { name: opts.name?.trim() || 'Capta — minha voz' },
      fileField: 'files',
    }
  }
  return undefined  // xtts é local: a amostra fica em disco, sem cadastro remoto
}

/** Sintetiza `text` na voz clonada (`voiceId`). `undefined` se faltar dado/for local. */
export function buildCloneSynthesisRequest(
  provider: VoiceCloneProvider,
  opts: { text: string; lang: string; voiceId: string; apiKey: string; stability?: number; similarity?: number },
): CloneSynthesisSpec | undefined {
  if (provider === 'elevenlabs') {
    if (!opts.apiKey?.trim() || !opts.voiceId?.trim() || !opts.text?.trim()) return undefined
    return {
      url: `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(opts.voiceId)}`,
      method: 'POST',
      headers: {
        'xi-api-key': opts.apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: opts.text,
        model_id: ELEVENLABS_MODEL,
        voice_settings: {
          stability: clamp01(opts.stability ?? 0.5),
          similarity_boost: clamp01(opts.similarity ?? 0.85),
        },
      }),
    }
  }
  return undefined  // xtts: síntese vai por worker local, não HTTP
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}
