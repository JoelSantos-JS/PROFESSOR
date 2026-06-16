import { app, BrowserWindow, globalShortcut } from 'electron'
import { WindowManager } from './windows/windowManager'
import { setupIPC } from './ipc/index'
import { warmupLocalTts } from './services/ttsService'
import { SettingsService } from './services/settingsService'
import { AuthService } from './services/authService'

const isDev = !app.isPackaged
let windowManager: WindowManager
let authenticated = false
const settings = new SettingsService()
const isOnboarded = () => settings.getAll().onboarded === '1'

app.whenReady().then(async () => {
  windowManager = new WindowManager(isDev)
  setupIPC(windowManager, () => { authenticated = true })
  authenticated = await hasValidSession()
  openInitialWindow()
  setTimeout(() => warmupLocalTts(), 2500)
  registerShortcuts()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) openInitialWindow()
  })
})

function registerShortcuts(): void {
  globalShortcut.register('CommandOrControl+Alt+L', () => {
    if (!requireAuthenticated()) return
    if (!isOnboarded()) { windowManager.showWindow('dashboard'); return }
    windowManager.toggleWindow('floating-bar')
    broadcast('shortcut:fired', 'toggle-listening')
  })
  globalShortcut.register('CommandOrControl+Alt+D', () => {
    if (!requireAuthenticated()) return
    windowManager.showWindow('dashboard')
  })
  globalShortcut.register('CommandOrControl+Alt+S', () => {
    if (!requireAuthenticated()) return
    windowManager.showWindow('settings')
  })
  globalShortcut.register('CommandOrControl+Alt+B', () => {
    if (!requireAuthenticated()) return
    if (!isOnboarded()) { windowManager.showWindow('dashboard'); return }
    windowManager.showWindow('tutor-board')
  })
  globalShortcut.register('CommandOrControl+Alt+Space', () => {
    if (!requireAuthenticated()) return
    broadcast('shortcut:fired', 'toggle-player')
  })
}

function openInitialWindow(): void {
  if (!authenticated) {
    windowManager.createWindow('auth')
    return
  }

  windowManager.createWindow('dashboard')
  // FloatingBar and TutorBoard only open after onboarding. Before that, the
  // authenticated user lands on Dashboard to finish language/key setup.
  if (isOnboarded()) {
    windowManager.createWindow('floating-bar')
    windowManager.createWindow('tutor-board')
  }
}

function requireAuthenticated(): boolean {
  if (authenticated) return true
  windowManager.showWindow('auth')
  return false
}

async function hasValidSession(): Promise<boolean> {
  try {
    const res = await new AuthService().getSession()
    return res.ok && !!res.session
  } catch {
    return false
  }
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
