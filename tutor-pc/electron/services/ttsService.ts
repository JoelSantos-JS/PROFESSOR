import { EdgeTTS } from 'node-edge-tts'
import { resolveVoice } from '../lib/ttsVoices.js'
import { tmpdir } from 'os'
import { join } from 'path'
import { readFile, unlink } from 'fs/promises'
import { randomUUID } from 'crypto'

export { resolveVoice, VOICE_MAP, DEFAULT_VOICE } from '../lib/ttsVoices.js'

export interface WordCue {
  part: string
  start: number  // ms
  end: number    // ms
}

export interface SynthesisResult {
  audio: Buffer
  cues: WordCue[]
}

export async function synthesize(text: string, lang: string): Promise<SynthesisResult> {
  const voice   = resolveVoice(lang)
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

  return { audio, cues }
}
