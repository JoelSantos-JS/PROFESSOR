import { app, BrowserWindow, screen } from 'electron'
import type { BrowserWindow as BW } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { WindowName, windowConfigs } from './windowConfigs'
import { floatingBarSize } from '../lib/floatingBarSize.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export class WindowManager {
  private windows = new Map<WindowName, BW>()
  private isDev: boolean
  private preloadPath: string
  private floatingBarMode: 'compact' | 'full' = 'compact'   // começa compacta (abre vazia)

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

    if (name === 'floating-bar') {
      this.applyFloatingBarSize(win)
      win.on('resize', () => this.applyFloatingBarSize(win))
    }

    win.once('ready-to-show', () => {
      if (name === 'floating-bar') {
        this.applyFloatingBarSize(win)
        this.positionFloatingBar(win)
      }
      if (windowConfigs[name].startHidden) return  // stay hidden until explicitly shown
      win.show()
      if (name === 'floating-bar') this.settleFloatingBar(win)  // força o tamanho real após o show
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

    win.on('closed', () => {
      this.windows.delete(name)
      // Fechar a janela PRINCIPAL (Dashboard) encerra o app inteiro — as outras janelas
      // (barra flutuante, tutor board, etc.) fecham junto.
      if (name === 'dashboard') app.quit()
    })
    this.windows.set(name, win)
    return win
  }

  showWindow(name: WindowName): void {
    let win = this.windows.get(name)
    // (Re)create if it was never made or was closed. createWindow honours
    // `startHidden`, so we must still show() it explicitly below.
    if (!win || win.isDestroyed()) win = this.createWindow(name)
    if (name === 'floating-bar') this.applyFloatingBarSize(win)
    win.show()
    win.moveTop()
    win.focus()
    if (name === 'floating-bar') this.settleFloatingBar(win)
  }

  hideWindow(name: WindowName): void {
    this.windows.get(name)?.hide()
  }

  toggleWindow(name: WindowName): void {
    const win = this.windows.get(name)
    if (win && !win.isDestroyed()) {
      if (win.isVisible()) {
        win.hide()
      } else {
        if (name === 'floating-bar') this.applyFloatingBarSize(win)
        win.show()
        win.focus()
        if (name === 'floating-bar') this.settleFloatingBar(win)
      }
    } else {
      this.createWindow(name)
    }
  }

  getWindow(name: WindowName): BW | undefined {
    return this.windows.get(name)
  }

  getWindowName(win: BW): WindowName | undefined {
    for (const [name, current] of this.windows) {
      if (current.id === win.id && !current.isDestroyed()) return name
    }
    return undefined
  }

  closeWindow(name: WindowName): void {
    this.windows.get(name)?.close()
  }

  closeWorkspaceWindows(): void {
    ;(['floating-bar', 'tutor-board', 'settings', 'review', 'dashboard'] as WindowName[])
      .forEach(name => this.closeWindow(name))
  }

  private positionFloatingBar(win: BW): void {
    const { width: sw } = screen.getPrimaryDisplay().workAreaSize
    const [w] = win.getSize()
    win.setPosition(sw - w - 24, 24)
  }

  /** Alterna a barra flutuante entre compacta (vazia) e cheia (com transcrição). */
  setFloatingBarMode(mode: 'compact' | 'full'): void {
    if (mode === this.floatingBarMode) return
    this.floatingBarMode = mode
    const win = this.windows.get('floating-bar')
    if (win && !win.isDestroyed()) this.applyFloatingBarSize(win)
  }

  /** Fixa a barra na largura padrão e na altura do modo atual (cresce para baixo, ancorada no topo). */
  private applyFloatingBarSize(win: BW): void {
    const { width, height } = floatingBarSize(this.floatingBarMode)
    win.setResizable(false)
    win.setMinimumSize(width, height)
    win.setMaximumSize(width, height)
    const [curW, curH] = win.getSize()
    if (curW !== width || curH !== height) {
      const [x, y] = win.getPosition()
      win.setBounds({ x, y, width, height })
    }
  }

  // Janelas transparentes/frameless no Windows às vezes "abrem colapsadas" — a superfície
  // composta pelo DWM fica menor que a janela até um repaint. Após o show, re-aplicamos os
  // bounds e damos um nudge de 1px (no frame seguinte) para forçar o DWM a recompor.
  private settleFloatingBar(win: BW): void {
    const apply = () => {
      if (win.isDestroyed()) return
      const [x, y] = win.getPosition()
      const { width: w, height: h } = floatingBarSize(this.floatingBarMode)
      win.setMinimumSize(w, h - 1)
      win.setBounds({ x, y, width: w, height: h - 1 })
      win.setBounds({ x, y, width: w, height: h })
      win.setMinimumSize(w, h)
    }
    apply()
    setTimeout(apply, 0)
  }
}
