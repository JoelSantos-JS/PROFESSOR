import { ipcMain } from 'electron'
import { StoreService } from '../services/storeService.js'

export function setupStoreHandlers(): void {
  const store = new StoreService()

  ipcMain.handle('store:stats', () => store.getStats())

  ipcMain.handle('store:record-session', (_e, lineCount: number) => {
    store.recordSession(lineCount)
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

  ipcMain.handle('store:due-vocab', () => store.getDueVocab())

  ipcMain.handle('store:grade-vocab', (_e, id, next) => {
    store.gradeVocab(id, next)
    return { ok: true }
  })
}
