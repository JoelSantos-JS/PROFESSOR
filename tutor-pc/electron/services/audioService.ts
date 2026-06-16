import { CredentialsService, type ProviderId } from './credentialsService'
import { SettingsService } from './settingsService'
import { shouldRejectTranscript, type WhisperSegment } from '../lib/transcriptFilter.js'
import { normalizeLang } from '../lib/langNormalize.js'
import { cuesFromWhisperResponse, extractWhisperWords, type WhisperWord, type Cue, type WhisperTimedSegment } from '../lib/whisperWords.js'
import { providerFetch } from '../lib/providerFetch.js'

export interface TranscribeResult {
  text: string
  language: string  // ISO 639-1 code detected by the model (e.g. 'zh', 'ja', 'ko', 'en')
  cues?: Cue[]      // per-word timings of the original audio (for karaoke sync)
}

interface WhisperResponse {
  text: string
  language?: string
  segments?: Array<WhisperSegment & WhisperTimedSegment>
  words?: WhisperWord[]
}

function whisperShape(json: WhisperResponse): string {
  const segments = Array.isArray(json.segments) ? json.segments : []
  const segmentWords = segments.reduce((sum, segment) => sum + (Array.isArray(segment.words) ? segment.words.length : 0), 0)
  const firstSegmentKeys = segments[0] ? Object.keys(segments[0]).sort().join(',') : ''
  return [
    `keys=${Object.keys(json).sort().join(',')}`,
    `topWords=${Array.isArray(json.words) ? json.words.length : 0}`,
    `segments=${segments.length}`,
    `segmentWords=${segmentWords}`,
    firstSegmentKeys ? `firstSegmentKeys=${firstSegmentKeys}` : '',
  ].filter(Boolean).join(' ')
}

function formatProviderError(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string; status?: string } }
    const status = parsed.error?.status
    const message = parsed.error?.message
    return [status, message].filter(Boolean).join(': ') || body
  } catch {
    return body
  }
}

export class AudioService {
  constructor(
    private credentials: CredentialsService,
    private settings: SettingsService,
  ) {}

  // `hint` biases Whisper toward expected words (used for single-word practice
  // where short, context-free audio is otherwise easy to mis-transcribe).
  async transcribe(audioBuffer: ArrayBuffer | Buffer, hint?: string): Promise<TranscribeResult> {
    const settings = this.settings.getAll()
    let activeTranscriptionProvider = settings.activeTranscriptionProvider
    let apiKey = this.credentials.get(activeTranscriptionProvider)

    if (activeTranscriptionProvider === 'gemini') {
      const groqKey = this.credentials.get('groq')
      if (groqKey) {
        activeTranscriptionProvider = 'groq' as ProviderId
        apiKey = groqKey
        console.log('[audio] transcription override: gemini -> groq for word timestamps')
      }
    }

    if (!apiKey) {
      throw new Error(`Nenhuma chave configurada para "${activeTranscriptionProvider}". Abra Configurações.`)
    }

    const buf = audioBuffer instanceof ArrayBuffer
      ? Buffer.from(new Uint8Array(audioBuffer))
      : audioBuffer

    console.log(`[audio] provider=${activeTranscriptionProvider} received format=${this.blobMeta(buf).name} bytes=${buf.length}`)
    // Só FORÇA o idioma quando o usuário definiu o idioma do conteúdo explicitamente.
    // Em 'auto', deixa o Whisper detectar — NÃO cair no targetLanguage (que é o idioma
    // que o usuário quer APRENDER, não o do conteúdo), senão um doroma em mandarim seria
    // transcrito à força como inglês.
    const spokenLanguage = settings.contentLanguage && settings.contentLanguage !== 'auto'
      ? normalizeLang(settings.contentLanguage)
      : ''

    switch (activeTranscriptionProvider) {
      case 'openai':  return this.whisperOpenAI(buf, apiKey, hint, spokenLanguage)
      case 'groq':    return this.whisperGroq(buf, apiKey, hint, spokenLanguage)
      case 'gemini':  return this.geminiAudio(buf, apiKey)
      default:
        throw new Error(`Provider "${activeTranscriptionProvider}" não suporta transcrição.`)
    }
  }

  /** Pick the right filename/mime from the buffer's magic bytes (WAV vs WebM). */
  private blobMeta(buf: Buffer): { type: string; name: string } {
    // "RIFF" → WAV
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) {
      return { type: 'audio/wav', name: 'audio.wav' }
    }
    return { type: 'audio/webm', name: 'audio.webm' }
  }

  // Whisper verbose_json returns detected language automatically
  private async whisperOpenAI(buf: Buffer, apiKey: string, hint?: string, spokenLanguage?: string): Promise<TranscribeResult> {
    const form = new FormData()
    const meta = this.blobMeta(buf)
    form.append('file', new Blob([buf], { type: meta.type }), meta.name)
    form.append('model', 'whisper-1')
    form.append('response_format', 'verbose_json')
    form.append('timestamp_granularities[]', 'segment')
    form.append('timestamp_granularities[]', 'word')
    form.append('temperature', '0')
    if (spokenLanguage && spokenLanguage !== 'auto') form.append('language', spokenLanguage)
    if (hint) form.append('prompt', hint)

    const res = await providerFetch('OpenAI transcription', 'https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`)
    const json = await res.json() as WhisperResponse
    if (shouldRejectTranscript(json.text ?? '', json.segments ?? [])) {
      return { text: '', language: normalizeLang(json.language) || 'auto' }
    }
    return { text: json.text.trim(), language: normalizeLang(json.language) || 'auto', cues: cuesFromWhisperResponse(json) }
  }

  private async whisperGroq(buf: Buffer, apiKey: string, hint?: string, spokenLanguage?: string): Promise<TranscribeResult> {
    const form = new FormData()
    const meta = this.blobMeta(buf)
    form.append('file', new Blob([buf], { type: meta.type }), meta.name)
    form.append('model', 'whisper-large-v3')
    form.append('response_format', 'verbose_json')
    form.append('timestamp_granularities[]', 'segment')
    form.append('timestamp_granularities[]', 'word')
    form.append('temperature', '0')
    if (spokenLanguage && spokenLanguage !== 'auto') form.append('language', spokenLanguage)
    if (hint) form.append('prompt', hint)
    console.log(`[audio] groq request model=whisper-large-v3 file=${meta.name} language=${spokenLanguage || 'auto'} timestamps=segment,word hint=${Boolean(hint)}`)

    const res = await providerFetch('Groq transcription', 'https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })
    if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`)
    const json = await res.json() as WhisperResponse
    console.log(`[audio] groq response ${whisperShape(json)}`)
    if (shouldRejectTranscript(json.text ?? '', json.segments ?? [])) {
      return { text: '', language: normalizeLang(json.language) || 'auto' }
    }
    const cues = cuesFromWhisperResponse(json)
    console.log(`[audio] groq timings exactWords=${extractWhisperWords(json).length} cues=${cues.length}`)
    return { text: json.text.trim(), language: normalizeLang(json.language) || 'auto', cues }
  }

  // Gemini: return JSON with text + detected language
  private async geminiAudio(buf: Buffer, apiKey: string): Promise<TranscribeResult> {
    const base64 = buf.toString('base64')
    const res = await providerFetch(
      'Gemini transcription',
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: `You are a speech-to-text transcription engine.
When given an audio clip, respond ONLY with a JSON object:
{"text":"<transcribed speech>","language":"<ISO 639-1 code>"}
If the audio contains only silence, noise, or no intelligible speech, respond with:
{"text":"","language":""}
Never include explanation, markdown, or any text outside the JSON object.`,
            }],
          },
          contents: [{
            parts: [
              { inline_data: { mime_type: 'audio/webm', data: base64 } },
              { text: 'Transcribe the audio.' },
            ],
          }],
          generationConfig: {
            thinkingConfig: { thinkingBudget: 0 },
            responseMimeType: 'application/json',
          },
        }),
      },
    )
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${formatProviderError(await res.text())}`)
    const json = await res.json() as { candidates: { content: { parts: { text: string }[] } }[] }
    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''

    try {
      const parsed = JSON.parse(raw) as { text?: string; language?: string }
      const text = (parsed.text ?? '').trim()
      // Reject if model echoed the instruction or returned meta-text
      if (!text) return { text: '', language: '' }
      const lower = text.toLowerCase()
      if (
        lower.includes('transcri') ||
        lower.includes('speech-to-text') ||
        lower.includes('iso 639') ||
        lower.includes('audio clip') ||
        lower.includes('intelligible')
      ) return { text: '', language: '' }
      return { text, language: normalizeLang(parsed.language) || 'auto' }
    } catch {
      return { text: '', language: '' }
    }
  }
}
