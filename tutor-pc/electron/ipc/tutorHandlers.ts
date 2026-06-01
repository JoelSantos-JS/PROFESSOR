import { ipcMain, BrowserWindow } from 'electron'
import { TutorService } from '../services/tutorService'
import { CredentialsService } from '../services/credentialsService'
import { SettingsService } from '../services/settingsService'
import type { WindowManager } from '../windows/windowManager'

export function setupTutorHandlers(windowManager: WindowManager): void {
  const tutor = new TutorService(new CredentialsService(), new SettingsService())

  const broadcast = (payload: unknown) => {
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) win.webContents.send('tutor:analysis', payload)
    })
  }

  // Called by FloatingBar after each successful transcription
  ipcMain.handle('tutor:analyze', async (_e, transcript: string, detectedLanguage: string, audioUrl?: string, cues?: unknown) => {
    if (!transcript?.trim()) return { ok: true }

    // Open the board immediately on ANY captured sentence — don't wait for (or
    // depend on) the AI analysis, which may be slow or fail.
    windowManager.showWindow('tutor-board')

    try {
      const analysis = await tutor.analyze(transcript, detectedLanguage)
      broadcast({ ...analysis, originalAudioUrl: audioUrl, originalCues: cues })
      return { ok: true }
    } catch (err) {
      const msg = (err as Error).message
      console.error('[tutor] analyze error:', msg)
      // Still show the transcript + the failure reason so it's diagnosable in-app
      broadcast({ transcript, vocab: [], tip: '', contentLanguage: detectedLanguage, originalAudioUrl: audioUrl, originalCues: cues, analysisError: msg })
      return { ok: false, error: msg }
    }
  })

  // On-demand single-word dictionary lookup (click a word)
  ipcMain.handle('tutor:lookup', async (_e, word: string, context: string, lang: string) => {
    if (!word?.trim()) return { ok: false, error: 'empty' }
    try {
      const result = await tutor.lookup(word, context, lang)
      return { ok: true, result }
    } catch (err) {
      console.error('[tutor] lookup error:', (err as Error).message)
      return { ok: false, error: (err as Error).message }
    }
  })
}
