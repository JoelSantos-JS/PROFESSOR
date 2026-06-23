import { ipcMain, BrowserWindow } from 'electron'
import { WindowManager } from '../windows/windowManager'
import type { WindowName } from '../windows/windowConfigs'
import { SettingsService } from '../services/settingsService'

export function setupWindowHandlers(windowManager: WindowManager, onAuthComplete?: () => void): void {
  const settings = new SettingsService()
  const isOnboarded = () => settings.getAll().onboarded === '1'

  ipcMain.on('window:minimize', (event) => BrowserWindow.fromWebContents(event.sender)?.minimize())
  ipcMain.on('window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    if (windowManager.getWindowName(win) === 'dashboard') {
      windowManager.closeWorkspaceWindows()
      return
    }
    win.close()
  })
  ipcMain.on('window:hide', (event) => BrowserWindow.fromWebContents(event.sender)?.hide())
  ipcMain.on('window:show', (_event, name: WindowName) => windowManager.showWindow(name))
  ipcMain.on('window:toggle', (_event, name: WindowName) => windowManager.toggleWindow(name))

  // Esconder a barra do dock esconde o dock + a barra flutuante juntos; a bandeja restaura.
  ipcMain.on('app:hide-bars', () => windowManager.hideBars())
  ipcMain.on('app:show-bars', () => windowManager.showBars())

  // Espaço de trabalho "dock-centric": ao abrir, mostra só o Dock + a barra de Transcrição
  // (FloatingBar). O TutorBoard nasce oculto (recebe as análises); o Dashboard abre via Dock.
  const openWorkspace = () => {
    windowManager.createWindow('floating-bar')
    windowManager.createWindow('tutor-board')   // startHidden — recebe eventos, aparece sob demanda
    windowManager.createWindow('dock')
  }

  ipcMain.on('app:onboarding-complete', openWorkspace)

  ipcMain.on('app:auth-complete', (event) => {
    onAuthComplete?.()
    if (isOnboarded()) openWorkspace()
    else windowManager.showWindow('dashboard')   // 1º acesso: faz o onboarding no Dashboard
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

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

  ipcMain.on('floating-bar:mode', (_e, mode: 'compact' | 'full') =>
    windowManager.setFloatingBarMode(mode === 'full' ? 'full' : 'compact'))

  ipcMain.on('listening:pause', () =>
    windowManager.getWindow('floating-bar')?.webContents.send('listening:pause'))
  ipcMain.on('listening:resume', () =>
    windowManager.getWindow('floating-bar')?.webContents.send('listening:resume'))

  ipcMain.on('session:attempt', (_e, attempt) =>
    windowManager.getWindow('floating-bar')?.webContents.send('session:attempt', attempt))
}
