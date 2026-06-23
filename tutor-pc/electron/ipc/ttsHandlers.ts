import { ipcMain } from 'electron'
import { synthesize, synthesizeVoice } from '../services/ttsService.js'

function toDataUrl(mimeType: string, audio: Buffer): string {
  // base64 is more reliable than ArrayBuffer across Electron IPC
  return `data:${mimeType};base64,` + audio.toString('base64')
}

export function setupTtsHandlers(): void {
  ipcMain.handle('tts:speak', async (_event, text: string, lang: string) => {
    try {
      const { audio, cues, mimeType, provider, cached } = await synthesize(text, lang)
      return { ok: true, dataUrl: toDataUrl(mimeType, audio), cues, provider, cached }
    } catch (err) {
      console.error('[tts] error:', (err as Error).message)
      return { ok: false, error: (err as Error).message }
    }
  })

  // Pronúncia em um SOTAQUE específico (voz Edge) — usado pelas variantes no lookup da palavra.
  ipcMain.handle('tts:speak-variant', async (_event, text: string, voice: string, lang?: string) => {
    try {
      const { audio, cues, mimeType, provider, cached } = await synthesizeVoice(text, voice, lang)
      return { ok: true, dataUrl: toDataUrl(mimeType, audio), cues, provider, cached }
    } catch (err) {
      console.error('[tts] variant error:', (err as Error).message)
      return { ok: false, error: (err as Error).message }
    }
  })
}
