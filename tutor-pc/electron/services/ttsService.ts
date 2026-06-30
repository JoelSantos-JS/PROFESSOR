import { EdgeTTS } from 'node-edge-tts'
import { resolveVoice } from '../lib/ttsVoices.js'
import { aggregateDownload, emptyDownload } from '../lib/modelDownload.js'
import { tmpdir } from 'os'
import { join } from 'path'
import { mkdir, readFile, unlink, writeFile, cp } from 'fs/promises'
import { existsSync, readdirSync } from 'fs'
import { createHash, randomUUID } from 'crypto'
import { app } from 'electron'
import { SettingsService } from './settingsService.js'
import { Worker } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

export { resolveVoice, VOICE_MAP, DEFAULT_VOICE } from '../lib/ttsVoices.js'

const KOKORO_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX'
const KOKORO_DTYPE = 'q8'
const KOKORO_SPEED = 0.90   // voz-modelo um pouco mais devagar p/ aprendizado (entra na chave do cache)
const KOKORO_DEFAULT_VOICE = 'af_heart'
const KOKORO_ENGLISH_VOICES = new Set([
  'af_heart',
  'af_alloy',
  'af_aoede',
  'af_bella',
  'af_jessica',
  'af_kore',
  'af_nicole',
  'af_nova',
  'af_river',
  'af_sarah',
  'af_sky',
  'am_adam',
  'am_echo',
  'am_eric',
  'am_fenrir',
  'am_liam',
  'am_michael',
  'am_onyx',
  'am_puck',
  'am_santa',
  'bf_alice',
  'bf_emma',
  'bf_isabella',
  'bf_lily',
  'bm_daniel',
  'bm_fable',
  'bm_george',
  'bm_lewis',
])

export interface WordCue {
  part: string
  start: number  // ms
  end: number    // ms
}

export interface SynthesisResult {
  audio: Buffer
  cues: WordCue[]
  mimeType: 'audio/mpeg' | 'audio/wav'
  provider: 'edge' | 'kokoro'
  cached?: boolean
}

export async function synthesize(text: string, lang: string): Promise<SynthesisResult> {
  const settings = new SettingsService().getAll()
  const requestedProvider = settings.activeTtsProvider ?? 'kokoro'
  const kokoroVoice = normalizeKokoroVoice(settings.ttsVoice)

  if (requestedProvider === 'kokoro' && canUseKokoro(lang)) {
    try {
      return await synthesizeCached({
        provider: 'kokoro',
        lang,
        voice: kokoroVoice,
        text,
        create: () => synthesizeKokoro(text, kokoroVoice),
      })
    } catch (err) {
      console.warn('[tts] kokoro failed, falling back to edge:', (err as Error).message)
    }
  }

  const voice   = resolveVoice(lang)
  return synthesizeCached({
    provider: 'edge',
    lang,
    voice,
    text,
    create: () => synthesizeEdge(text, voice),
  })
}

/**
 * Sintetiza com uma VOZ específica (variante de sotaque) via Edge TTS. Cacheado por voz,
 * então cada sotaque é gerado uma vez. Usado pelas "variantes de pronúncia" no lookup da palavra.
 */
export async function synthesizeVoice(text: string, voice: string, lang = ''): Promise<SynthesisResult> {
  // Voz do Kokoro → worker LOCAL (aquecido, ~1s). Sem isto, uma voz Kokoro (ex.: af_sarah) ia pro
  // Edge (rede) com voz inválida → travava no timeout. Demais vozes = accents do Edge.
  if (KOKORO_ENGLISH_VOICES.has(voice)) {
    return synthesizeCached({
      provider: 'kokoro',
      lang: lang || 'en',
      voice,
      text,
      create: () => synthesizeKokoro(text, voice),
    })
  }
  return synthesizeCached({
    provider: 'edge',
    lang: lang || voice,
    voice,
    text,
    create: () => synthesizeEdge(text, voice),
  })
}

/** Diretório onde a voz local (Kokoro) é baixada. */
function localVoiceModelDir(): string {
  return join(app.getPath('userData'), 'models', 'huggingface')
}

/** True se a voz local JÁ está disponível em userData (modelo presente em disco). */
export function localVoiceModelExists(): boolean {
  try {
    const dir = localVoiceModelDir()
    return existsSync(dir) && readdirSync(dir).length > 0
  } catch {
    return false
  }
}

/**
 * 1º início do app instalado: copia o modelo EMBUTIDO (resources/models/huggingface) para userData,
 * evitando qualquer download. Em dev (sem bundle) é no-op → cai no download normal. Idempotente.
 */
export async function seedLocalVoiceModelFromBundle(): Promise<void> {
  try {
    if (localVoiceModelExists()) return  // já está em userData
    const bundled = join(process.resourcesPath, 'models', 'huggingface')
    if (!existsSync(bundled) || readdirSync(bundled).length === 0) return  // dev / sem bundle
    await cp(bundled, localVoiceModelDir(), { recursive: true })
    console.log('[tts] voz local instalada do pacote (sem download)')
  } catch (err) {
    console.warn('[tts] seed da voz falhou:', (err as Error).message)
  }
}

/**
 * Aquece a voz local: carrega o Kokoro (baixando o modelo se faltar). Retorna a Promise para o
 * processo principal poder ESPERAR o download no 1º início (e abrir o app já com a voz pronta).
 */
export function warmupLocalTts(): Promise<void> {
  const settings = new SettingsService().getAll()
  if ((settings.activeTtsProvider ?? 'kokoro') !== 'kokoro') return Promise.resolve()

  const voice = normalizeKokoroVoice(settings.ttsVoice)
  return generateKokoroInWorker('Ready.', voice)
    .then(() => { console.log('[tts] kokoro warmup complete') })
    .catch(err => { console.warn('[tts] kokoro warmup failed:', (err as Error).message) })
}

interface CacheRequest {
  provider: 'edge' | 'kokoro'
  lang: string
  voice: string
  text: string
  create: () => Promise<SynthesisResult>
}

async function synthesizeCached(req: CacheRequest): Promise<SynthesisResult> {
  const cacheDir = join(app.getPath('userData'), 'tts-cache')
  const key = createHash('sha256')
    .update(JSON.stringify({
      provider: req.provider,
      lang: req.lang,
      voice: req.voice,
      model: req.provider === 'kokoro' ? `${KOKORO_MODEL_ID}:${KOKORO_DTYPE}` : 'edge',
      speed: req.provider === 'kokoro' ? KOKORO_SPEED : undefined,   // muda a velocidade → regenera (não serve cache antigo)
      text: req.text.trim(),
    }))
    .digest('hex')
  const ext = req.provider === 'kokoro' ? 'wav' : 'mp3'
  const audioPath = join(cacheDir, `${key}.${ext}`)
  const metaPath = join(cacheDir, `${key}.json`)

  try {
    const [audio, metaRaw] = await Promise.all([
      readFile(audioPath),
      readFile(metaPath, 'utf-8'),
    ])
    const meta = JSON.parse(metaRaw) as Pick<SynthesisResult, 'cues' | 'mimeType' | 'provider'>
    return { audio, cues: meta.cues ?? [], mimeType: meta.mimeType, provider: meta.provider, cached: true }
  } catch {
    // Cache miss; generate below.
  }

  const result = await req.create()
  await mkdir(cacheDir, { recursive: true })
  await Promise.all([
    writeFile(audioPath, result.audio),
    writeFile(metaPath, JSON.stringify({
      cues: result.cues,
      mimeType: result.mimeType,
      provider: result.provider,
    }), 'utf-8'),
  ]).catch(err => {
    console.warn('[tts] cache write failed:', (err as Error).message)
  })
  return result
}

async function synthesizeEdge(text: string, voice: string): Promise<SynthesisResult> {
  const tmpPath = join(tmpdir(), `professor-tts-${randomUUID()}.mp3`)
  const subPath = tmpPath + '.json'

  // ⚠️ voice MUST be passed in the constructor — ttsPromise(text, audioPath)
  // only takes 2 args. saveSubtitles writes word-boundary timings to <audio>.json
  const tts = new EdgeTTS({ voice, saveSubtitles: true, timeout: 30000 })
  await (tts as { ttsPromise: (t: string, p: string) => Promise<void> }).ttsPromise(text, tmpPath)

  const audio = await readFile(tmpPath)

  let cues: WordCue[] = []
  try {
    const raw = await readFile(subPath, 'utf-8')
    cues = JSON.parse(raw) as WordCue[]
  } catch {
    // subtitle file may be absent for some voices — degrade gracefully
  }

  await unlink(tmpPath).catch(() => {})
  await unlink(subPath).catch(() => {})

  return { audio, cues, mimeType: 'audio/mpeg', provider: 'edge' }
}

async function synthesizeKokoro(text: string, voice: string): Promise<SynthesisResult> {
  const wav = await generateKokoroInWorker(text, voice)
  return { audio: wav, cues: [], mimeType: 'audio/wav', provider: 'kokoro' }
}

interface KokoroWorkerMessage {
  id: number
  ok: boolean
  audio?: ArrayBuffer
  error?: string
  type?: 'progress'
  file?: string
  loaded?: number
  total?: number
}

// Progresso do download do modelo (1ª vez). main.ts assina e repassa pro renderer ("Baixando voz X%").
let downloadState = emptyDownload
let kokoroProgressListener: ((p: { percent: number; active: boolean }) => void) | null = null
export function setKokoroProgressListener(cb: (p: { percent: number; active: boolean }) => void): void {
  kokoroProgressListener = cb
}

let kokoroWorker: Worker | null = null
let kokoroRequestId = 0
const kokoroPending = new Map<number, {
  resolve: (audio: Buffer) => void
  reject: (err: Error) => void
  timeout: NodeJS.Timeout
}>()

function getKokoroWorker(): Worker {
  if (kokoroWorker) return kokoroWorker

  const workerPath = join(dirname(fileURLToPath(import.meta.url)), 'kokoroWorker.mjs')
  kokoroWorker = new Worker(workerPath, {
    type: 'module',
  })
  console.log(`[tts] kokoro worker started model=${KOKORO_MODEL_ID} dtype=${KOKORO_DTYPE}`)

  kokoroWorker.on('message', (message: KokoroWorkerMessage) => {
    if (message.type === 'progress') {
      const r = aggregateDownload(downloadState, { file: message.file, loaded: message.loaded, total: message.total })
      downloadState = r.state
      kokoroProgressListener?.({ percent: r.percent, active: r.active })
      return
    }
    const pending = kokoroPending.get(message.id)
    if (!pending) return
    clearTimeout(pending.timeout)
    kokoroPending.delete(message.id)

    if (!message.ok || !message.audio) {
      pending.reject(new Error(message.error ?? 'Kokoro worker failed'))
      return
    }
    pending.resolve(Buffer.from(message.audio))
  })

  kokoroWorker.on('error', err => {
    rejectAllKokoroRequests(err instanceof Error ? err : new Error(String(err)))
    kokoroWorker = null
  })

  kokoroWorker.on('exit', code => {
    if (code !== 0) rejectAllKokoroRequests(new Error(`Kokoro worker exited with code ${code}`))
    kokoroWorker = null
  })

  return kokoroWorker
}

function rejectAllKokoroRequests(err: Error): void {
  for (const [id, pending] of kokoroPending) {
    clearTimeout(pending.timeout)
    pending.reject(err)
    kokoroPending.delete(id)
  }
}

function generateKokoroInWorker(text: string, voice: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const worker = getKokoroWorker()
    const id = ++kokoroRequestId
    const timeout = setTimeout(() => {
      kokoroPending.delete(id)
      reject(new Error('Kokoro generation timed out'))
    }, 120000)

    kokoroPending.set(id, { resolve, reject, timeout })
    worker.postMessage({
      id,
      text,
      voice,
      speed: KOKORO_SPEED,
      cacheDir: join(app.getPath('userData'), 'models', 'huggingface'),
    })
  })
}

function canUseKokoro(lang: string): boolean {
  const normalized = lang.toLowerCase()
  return normalized === 'en' || normalized.startsWith('en-')
}

function normalizeKokoroVoice(voice: string | undefined): string {
  if (voice && KOKORO_ENGLISH_VOICES.has(voice)) return voice
  return KOKORO_DEFAULT_VOICE
}
