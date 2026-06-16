import { ipcMain } from 'electron'
import { synthesize } from '../services/ttsService.js'

export function setupTtsHandlers(): void {
  ipcMain.handle('tts:speak', async (_event, text: string, lang: string) => {
    try {
      const { audio, cues, mimeType, provider, cached } = await synthesize(text, lang)
      // base64 is more reliable than ArrayBuffer across Electron IPC
      return { ok: true, dataUrl: `data:${mimeType};base64,` + audio.toString('base64'), cues, provider, cached }
    } catch (err) {
      console.error('[tts] error:', (err as Error).message)
      return { ok: false, error: (err as Error).message }
    }
  })
}
