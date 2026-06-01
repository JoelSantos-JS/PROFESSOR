import { ipcMain } from 'electron'
import { pauseMedia, resumeMedia, toggleMedia, resetMediaState } from '../services/mediaControl.js'

export function setupMediaHandlers(): void {
  ipcMain.handle('media:pause',  async () => { await pauseMedia();  return { ok: true } })
  ipcMain.handle('media:resume', async () => { await resumeMedia(); return { ok: true } })
  ipcMain.handle('media:toggle', async () => { await toggleMedia(); return { ok: true } })
  ipcMain.on('media:reset', () => resetMediaState())
}
