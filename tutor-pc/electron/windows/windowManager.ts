import { app, BrowserWindow, screen } from 'electron'
import type { BrowserWindow as BW } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { WindowName, windowConfigs } from './windowConfigs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export class WindowManager {
  private windows = new Map<WindowName, BW>()
  private isDev: boolean
  private preloadPath: string

  constructor(isDev: boolean) {
    this.isDev = isDev
    // preload.js lives in the same dist-electron/ directory as main.mjs
    this.preloadPath = path.join(__dirname, 'preload.js')
  }

  createWindow(name: WindowName): BW {
    const existing = this.windows.get(name)
    if (existing && !existing.isDestroyed()) {
      existing.show()
      existing.focus()
      return existing
    }

    const { options, devTools } = windowConfigs[name]
    const win = new BrowserWindow({
      ...options,
      webPreferences: {
        ...options.webPreferences,
        preload: this.preloadPath,
      },
    })

    win.once('ready-to-show', () => {
      if (name === 'floating-bar') this.positionFloatingBar(win)
      if (windowConfigs[name].startHidden) return  // stay hidden until explicitly shown
      win.show()
      if (name !== 'floating-bar') win.focus()
    })

    if (this.isDev) {
      win.loadURL(`http://localhost:5173/?window=${name}`)
    } else {
      win.loadFile(
        path.join(app.getAppPath(), 'dist', 'renderer', 'index.html'),
        { query: { window: name } }
      )
    }

    if (devTools !== false && this.isDev) {
      // win.webContents.openDevTools({ mode: 'detach' })
    }

    win.on('closed', () => this.windows.delete(name))
    this.windows.set(name, win)
    return win
  }

  showWindow(name: WindowName): void {
    const win = this.windows.get(name)
    if (win && !win.isDestroyed()) { win.show(); win.focus() }
    else this.createWindow(name)
  }

  hideWindow(name: WindowName): void {
    this.windows.get(name)?.hide()
  }

  toggleWindow(name: WindowName): void {
    const win = this.windows.get(name)
    if (win && !win.isDestroyed()) {
      win.isVisible() ? win.hide() : (win.show(), win.focus())
    } else {
      this.createWindow(name)
    }
  }

  getWindow(name: WindowName): BW | undefined {
    return this.windows.get(name)
  }

  closeWindow(name: WindowName): void {
    this.windows.get(name)?.close()
  }

  private positionFloatingBar(win: BW): void {
    const { width: sw } = screen.getPrimaryDisplay().workAreaSize
    const [w] = win.getSize()
    win.setPosition(sw - w - 24, 24)
  }
}
