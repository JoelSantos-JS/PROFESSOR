// Baixa o modelo de voz Kokoro para uma pasta de BUNDLE, pra ser embutido no instalador.
// Igual ao kokoroWorker (mesmo model id / dtype / device). Roda: node scripts/fetch-kokoro.mjs
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX'
const TARGET = join(process.cwd(), 'kokoro-bundle', 'models', 'huggingface')

await mkdir(TARGET, { recursive: true })

const transformers = await import('@huggingface/transformers')
transformers.env.cacheDir = TARGET
transformers.env.allowRemoteModels = true

const { KokoroTTS } = await import('kokoro-js')
console.log('Baixando Kokoro para', TARGET, '...')

const tts = await KokoroTTS.from_pretrained(MODEL_ID, {
  dtype: 'q8',
  device: 'cpu',
  progress_callback: (p) => {
    if (p?.total && p?.loaded != null) {
      const pct = Math.round((p.loaded / p.total) * 100)
      process.stdout.write(`\r${(p.file ?? p.name ?? '').padEnd(40)} ${pct}%   `)
    }
  },
})

// Gera uma vez pra garantir que TODO arquivo necessário (vozes etc.) foi baixado.
await tts.generate('Ready.', { voice: 'af_heart' })
console.log('\nOK — modelo embutível em', TARGET)
