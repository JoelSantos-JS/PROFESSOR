import { ipcMain } from 'electron'
import { CredentialsService } from '../services/credentialsService.js'
import { nativePronunciations, fetchPronunciationAudio } from '../services/pronunciationService.js'

export function setupPronunciationHandlers(): void {
  const creds = new CredentialsService()

  // Vozes de nativos reais (Forvo se houver chave; senão Wikimedia/Lingua Libre).
  ipcMain.handle('pronunciation:native', async (_e, word: string, lang: string) => {
    try {
      return { ok: true, items: await nativePronunciations(word, lang) }
    } catch (err) {
      return { ok: false, error: (err as Error).message, items: [] }
    }
  })

  // Baixa o áudio de uma variante (sob demanda) → data URL p/ tocar sem esbarrar na CSP.
  ipcMain.handle('pronunciation:audio', async (_e, url: string) => {
    try {
      return { ok: true, dataUrl: await fetchPronunciationAudio(url) }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })

  // Chave Forvo (BYOK) — guardada cifrada junto das demais credenciais.
  ipcMain.handle('forvo:set-key', (_e, key: string) => { creds.setForvoKey(key); return { ok: true } })
  ipcMain.handle('forvo:has-key', () => creds.hasForvoKey())
}
