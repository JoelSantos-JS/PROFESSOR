import { app, BrowserWindow, globalShortcut } from 'electron'
import { WindowManager } from './windows/windowManager'
import { setupIPC } from './ipc/index'

const isDev = !app.isPackaged
let windowManager: WindowManager

app.whenReady().then(() => {
  windowManager = new WindowManager(isDev)
  setupIPC(windowManager)
  windowManager.createWindow('dashboard')
  windowManager.createWindow('floating-bar')
  windowManager.createWindow('tutor-board')
  registerShortcuts()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) windowManager.createWindow('dashboard')
  })
})

function registerShortcuts(): void {
  globalShortcut.register('CommandOrControl+Alt+L', () => {
    windowManager.toggleWindow('floating-bar')
    broadcast('shortcut:fired', 'toggle-listening')
  })
  globalShortcut.register('CommandOrControl+Alt+D', () => windowManager.showWindow('dashboard'))
  globalShortcut.register('CommandOrControl+Alt+S', () => windowManager.showWindow('settings'))
  globalShortcut.register('CommandOrControl+Alt+B', () => windowManager.showWindow('tutor-board'))
  globalShortcut.register('CommandOrControl+Alt+Space', () => broadcast('shortcut:fired', 'toggle-player'))
}

function broadcast(channel: string, ...args: unknown[]): void {
  BrowserWindow.getAllWindows().forEach(win => {
    if (!win.isDestroyed()) win.webContents.send(channel, ...args)
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') { globalShortcut.unregisterAll(); app.quit() }
})

app.on('will-quit', () => globalShortcut.unregisterAll())
