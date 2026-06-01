import { CredentialsService } from './credentialsService'
import { SettingsService } from './settingsService'
import { shouldRejectTranscript, type WhisperSegment } from '../lib/transcriptFilter.js'
import { normalizeLang } from '../lib/langNormalize.js'
import { wordsToCues, type WhisperWord, type Cue } from '../lib/whisperWords.js'

export interface TranscribeResult {
  text: string
  language: string  // ISO 639-1 code detected by the model (e.g. 'zh', 'ja', 'ko', 'en')
  cues?: Cue[]      // per-word timings of the original audio (for karaoke sync)
}

interface WhisperResponse {
  text: string
  language?: string
  segments?: WhisperSegment[]
  words?: WhisperWord[]
}

export class AudioService {
  constructor(
    private credentials: CredentialsService,
    private settings: SettingsService,
  ) {}

  // `hint` biases Whisper toward expected words (used for single-word practice
  // where short, context-free audio is otherwise easy to mis-transcribe).
  async transcribe(audioBuffer: ArrayBuffer | Buffer, hint?: string): Promise<TranscribeResult> {
    const { activeTranscriptionProvider } = this.settings.getAll()
    const apiKey = this.credentials.get(activeTranscriptionProvider)

    if (!apiKey) {
      throw new Error(`Nenhuma chave configurada para "${activeTranscriptionProvider}". Abra Configurações.`)
    }

    const buf = audioBuffer instanceof ArrayBuffer
      ? Buffer.from(new Uint8Array(audioBuffer))
      : audioBuffer

    switch (activeTranscriptionProvider) {
      case 'openai':  return this.whisperOpenAI(buf, apiKey, hint)
      case 'groq':    return this.whisperGroq(buf, apiKey, hint)
      case 'gemini':  return this.geminiAudio(buf, apiKey)
      default:
        throw new Error(`Provider "${activeTranscriptionProvider}" não suporta transcrição.`)
    }
  }

  // Whisper verbose_json returns detected language automatically
  private async whisperOpenAI(buf: Buffer, apiKey: string, hint?: string): Promise<TranscribeResult> {
    const form = new FormData()
    form.append('file', new Blob([buf], { type: 'audio/webm' }), 'audio.webm')
    form.append('model', 'whisper-1')
    form.append('response_format', 'verbose_json')
    form.append('timestamp_granularities[]', 'word')
    if (hint) form.append('prompt', hint)

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`)
    const json = await res.json() as WhisperResponse
    if (shouldRejectTranscript(json.text ?? '', json.segments ?? [])) {
      return { text: '', language: normalizeLang(json.language) || 'auto' }
    }
    return { text: json.text.trim(), language: normalizeLang(json.language) || 'auto', cues: wordsToCues(json.words) }
  }

  private async whisperGroq(buf: Buffer, apiKey: string, hint?: string): Promise<TranscribeResult> {
    const form = new FormData()
    form.append('file', new Blob([buf], { type: 'audio/webm' }), 'audio.webm')
    form.append('model', 'whisper-large-v3')
    form.append('response_format', 'verbose_json')
    form.append('timestamp_granularities[]', 'word')
    if (hint) form.append('prompt', hint)

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })
    if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`)
    const json = await res.json() as WhisperResponse
    if (shouldRejectTranscript(json.text ?? '', json.segments ?? [])) {
      return { text: '', language: normalizeLang(json.language) || 'auto' }
    }
    return { text: json.text.trim(), language: normalizeLang(json.language) || 'auto', cues: wordsToCues(json.words) }
  }

  // Gemini: return JSON with text + detected language
  private async geminiAudio(buf: Buffer, apiKey: string): Promise<TranscribeResult> {
    const base64 = buf.toString('base64')
    const res = await fetch(
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
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`)
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
