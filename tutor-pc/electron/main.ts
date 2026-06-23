import { app, BrowserWindow, globalShortcut } from 'electron'
import { WindowManager } from './windows/windowManager'
import type { WindowName } from './windows/windowConfigs'
import { setupIPC } from './ipc/index'
import { warmupLocalTts } from './services/ttsService'
import { SettingsService } from './services/settingsService'
import { AuthService } from './services/authService'
import { splashCloseDelay } from './lib/splashLifecycle'

const isDev = !app.isPackaged
let windowManager: WindowManager
let authenticated = false
const settings = new SettingsService()
const isOnboarded = () => settings.getAll().onboarded === '1'

const MIN_SPLASH_MS = 5000   // splash carrega sozinho por este tempo ANTES de abrir as janelas
const MAX_SPLASH_MS = 11000  // rede de segurança: fecha mesmo se a janela nunca disparar ready-to-show

app.whenReady().then(async () => {
  windowManager = new WindowManager(isDev)
  setupIPC(windowManager, () => { authenticated = true })
  const splashAt = Date.now()
  windowManager.createWindow('splash')      // aparece sozinho primeiro
  authenticated = await hasValidSession()   // trabalho real acontece "por baixo" do splash
  // Segura as outras janelas até o splash cumprir o tempo de carregamento.
  await delay(splashCloseDelay(splashAt, Date.now(), MIN_SPLASH_MS))
  const primary = openInitialWindow()
  closeSplashWhenReady(primary)             // só fecha quando a janela real estiver pronta (handoff suave)
  setTimeout(() => warmupLocalTts(), 2500)
  registerShortcuts()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) openInitialWindow()
  })
})

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

/** Fecha o splash assim que a janela principal termina de carregar (já esperamos o tempo mínimo). */
function closeSplashWhenReady(primary: ReturnType<typeof openInitialWindow>): void {
  const close = () => windowManager.closeSplash()
  const win = windowManager.getWindow(primary)
  if (win && !win.isDestroyed()) win.once('ready-to-show', close)
  setTimeout(close, MAX_SPLASH_MS)  // fallback (closeSplash é idempotente)
}

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
  // Mostra/esconde o dock + a barra de transcrição juntos (traz de volta quando escondidos).
  globalShortcut.register('CommandOrControl+Alt+K', () => {
    if (!requireAuthenticated()) return
    if (!isOnboarded()) { windowManager.showWindow('dashboard'); return }
    windowManager.toggleBars()
  })
}

function openInitialWindow(): WindowName {
  if (!authenticated) {
    windowManager.createWindow('auth')
    return 'auth'
  }

  if (!isOnboarded()) {
    // 1º acesso: o onboarding acontece no Dashboard.
    windowManager.createWindow('dashboard')
    return 'dashboard'
  }
  // Onboarded → "dock-centric": só o Dock + a barra de Transcrição (FloatingBar). O TutorBoard
  // nasce oculto (recebe as análises) e o Dashboard abre sob demanda pelo Dock.
  windowManager.createWindow('floating-bar')
  windowManager.createWindow('tutor-board')
  windowManager.createWindow('dock')
  return 'floating-bar'
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
