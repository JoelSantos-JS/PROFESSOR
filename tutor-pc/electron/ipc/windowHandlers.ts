import { ipcMain, BrowserWindow } from 'electron'
import { WindowManager } from '../windows/windowManager'
import type { WindowName } from '../windows/windowConfigs'

export function setupWindowHandlers(windowManager: WindowManager): void {
  ipcMain.on('window:minimize', (event) => BrowserWindow.fromWebContents(event.sender)?.minimize())
  ipcMain.on('window:close', (event) => BrowserWindow.fromWebContents(event.sender)?.close())
  ipcMain.on('window:hide', (event) => BrowserWindow.fromWebContents(event.sender)?.hide())
  ipcMain.on('window:show', (_event, name: WindowName) => windowManager.showWindow(name))

  // Open the Review window focused on a specific language deck. `pendingReviewLang`
  // covers a freshly-created window (queried on mount); the channel covers a
  // window that's already open (switches deck live).
  let pendingReviewLang: string | null = null
  ipcMain.on('review:open', (_e, lang: string) => {
    pendingReviewLang = lang || null
    windowManager.showWindow('review')
    windowManager.getWindow('review')?.webContents.send('review:language', lang)
  })
  ipcMain.handle('review:pending-lang', () => {
    const l = pendingReviewLang
    pendingReviewLang = null
    return l
  })

  // Pause/resume the FloatingBar VAD while practice recording is active
  ipcMain.on('listening:pause',  () => windowManager.getWindow('floating-bar')?.webContents.send('listening:pause'))
  ipcMain.on('listening:resume', () => windowManager.getWindow('floating-bar')?.webContents.send('listening:resume'))

  // Practice attempt → FloatingBar's "Sessão" tab
  ipcMain.on('session:attempt', (_e, attempt) =>
    windowManager.getWindow('floating-bar')?.webContents.send('session:attempt', attempt))
}
