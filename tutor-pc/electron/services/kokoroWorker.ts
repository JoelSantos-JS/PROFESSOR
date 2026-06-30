import { parentPort } from 'node:worker_threads'
import { mkdir } from 'node:fs/promises'

const KOKORO_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX'
const KOKORO_DTYPE = 'q8'
const KOKORO_DEVICE = 'cpu'

interface RequestMessage {
  id: number
  text: string
  voice: string
  speed?: number
  cacheDir: string
}

interface KokoroInstance {
  generate: (text: string, options?: { voice?: string; speed?: number }) => Promise<{
    toWav: () => ArrayBuffer
  }>
}

let ttsPromise: Promise<KokoroInstance> | null = null
let queue = Promise.resolve()

async function getTts(cacheDir: string): Promise<KokoroInstance> {
  if (!ttsPromise) {
    ttsPromise = (async () => {
      await mkdir(cacheDir, { recursive: true })
      const transformers = await import('@huggingface/transformers')
      transformers.env.cacheDir = cacheDir
      transformers.env.allowRemoteModels = true

      const { KokoroTTS } = await import('kokoro-js')
      return await KokoroTTS.from_pretrained(KOKORO_MODEL_ID, {
        dtype: KOKORO_DTYPE,
        device: KOKORO_DEVICE,
        // Reporta o progresso do download (1ª vez) → barra "Baixando voz local X%" no app.
        progress_callback: (p: { file?: string; name?: string; loaded?: number; total?: number; status?: string }) => {
          parentPort?.postMessage({ type: 'progress', file: p.file ?? p.name, loaded: p.loaded, total: p.total, status: p.status })
        },
      } as unknown as Parameters<typeof KokoroTTS.from_pretrained>[1]) as KokoroInstance
    })()
  }
  return ttsPromise
}

async function handle(message: RequestMessage): Promise<void> {
  try {
    const tts = await getTts(message.cacheDir)
    // velocidade vem do ttsService (KOKORO_SPEED) — time-stretch do Kokoro, sem mudar o tom
    const rawAudio = await tts.generate(message.text, { voice: message.voice, speed: message.speed ?? 0.90 })
    const wav = rawAudio.toWav()
    parentPort?.postMessage({ id: message.id, ok: true, audio: wav }, [wav])
  } catch (err) {
    parentPort?.postMessage({
      id: message.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

parentPort?.on('message', (message: RequestMessage) => {
  queue = queue.then(() => handle(message), () => handle(message))
})
