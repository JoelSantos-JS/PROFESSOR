import { ipcMain, desktopCapturer, session } from 'electron'
import { AudioService } from '../services/audioService'
import { CredentialsService } from '../services/credentialsService'
import { SettingsService } from '../services/settingsService'

export function setupAudioHandlers(): void {
  const credentials = new CredentialsService()
  const settings = new SettingsService()
  const audioService = new AudioService(credentials, settings)

  // Electron 28+: intercept getDisplayMedia() from the renderer and
  // automatically select the first screen source with loopback audio.
  // This avoids the system screen-picker dialog and captures system audio.
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then(sources => {
      if (sources.length > 0) {
        // 'loopback' = WASAPI loopback on Windows (captures all system audio)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        callback({ video: sources[0], audio: 'loopback' as any })
      } else {
        callback({})
      }
    }).catch(() => callback({}))
  })

  // Kept for diagnostics / future source selection
  ipcMain.handle('audio:get-sources', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 0, height: 0 },
    })
    return sources.map(s => ({ id: s.id, name: s.name }))
  })

  // Renderer sends a recorded audio chunk; main process transcribes it
  ipcMain.handle('audio:transcribe', async (_e, buffer: ArrayBuffer, hint?: string) => {
    try {
      const result = await audioService.transcribe(buffer, hint)
      console.log(`[audio] transcribed (${result.language}) cues=${result.cues?.length ?? 0}:`, result.text?.slice(0, 60))
      return { text: result.text, language: result.language, cues: result.cues ?? [], error: null }
    } catch (err) {
      console.error('[audio] transcribe error:', (err as Error).message)
      return { text: null, language: null, error: (err as Error).message }
    }
  })
}
