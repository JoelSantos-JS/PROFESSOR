import { ipcMain } from 'electron'
import { StoreService } from '../services/storeService.js'

export function setupStoreHandlers(): void {
  const store = new StoreService()

  ipcMain.handle('store:stats', (_e, lang?: string) => store.getStats(lang))

  ipcMain.handle('store:languages', () => store.getLanguages())

  ipcMain.handle('store:record-session', (_e, session: number | { lineCount: number; lang?: string; preview?: string[]; startedAt?: number; endedAt?: number }) => {
    store.recordSession(session)
    return { ok: true }
  })

  ipcMain.handle('store:add-vocab', (_e, items) => {
    store.addVocab(items)
    return { ok: true }
  })

  ipcMain.handle('store:record-mistakes', (_e, words) => {
    store.recordMistakes(words)
    return { ok: true }
  })

  ipcMain.handle('store:due-vocab', (_e, lang?: string) => store.getDueVocab(Date.now(), 50, lang))

  ipcMain.handle('store:grade-vocab', (_e, id, next) => {
    store.gradeVocab(id, next)
    return { ok: true }
  })

  ipcMain.handle('store:known-words', (_e, lang: string) => store.getKnownWords(lang))

  ipcMain.handle('store:set-word-status', (_e, lang: string, word: string, status: string) => {
    store.setWordStatus(lang, word, status as 'known' | 'learning' | 'ignore' | '')
    return { ok: true }
  })

  ipcMain.handle('store:known-count', (_e, lang: string) => store.knownCount(lang))

  ipcMain.handle('store:captured-today', () => store.capturedToday())

  ipcMain.handle('store:mistakes', (_e, lang: string) => store.getMistakes(lang))

  ipcMain.handle('store:record-token-usage', (_e, usage) => {
    store.recordTokenUsage(usage)
    return { ok: true }
  })

  ipcMain.handle('store:token-usage-summary', (_e, feature?: 'professor' | 'analysis' | 'lookup' | 'other') =>
    store.getTokenUsageSummary(Date.now(), feature))

  ipcMain.handle('store:usage-events', () => store.getUsageEvents())
}
