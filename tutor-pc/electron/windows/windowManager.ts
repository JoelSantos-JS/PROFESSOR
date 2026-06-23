import { app, BrowserWindow, screen, Tray, Menu, nativeImage } from 'electron'
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
  private tray: Tray | null = null
  private floatingBarMode: 'compact' | 'full' = 'compact'   // começa compacta (abre vazia)

  constructor(isDev: boolean) {
    this.isDev = isDev
    // preload.js lives in the same dist-electron/ directory as main.mjs
    this.preloadPath = path.join(__dirname, 'preload.js')
  }

  /** Caminho de um ícone gerado (public/icon → copiado p/ dist/renderer/icon no build). */
  private iconPath(file: string): string {
    return this.isDev
      ? path.join(__dirname, '..', 'public', 'icon', file)               // dist-electron/.. → tutor-pc
      : path.join(app.getAppPath(), 'dist', 'renderer', 'icon', file)
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
      icon: this.iconPath('soaken-256.png'),   // ícone na barra de tarefas (runtime)
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
      if (name === 'dock') this.positionDock(win)
      if (windowConfigs[name].startHidden) return  // stay hidden until explicitly shown
      win.show()
      if (name === 'floating-bar') this.settleFloatingBar(win)  // força o tamanho real após o show
      if (name === 'dock' || name === 'splash') this.settleDock(win)  // transparente/frameless: evita abrir colapsada (DWM)
      if (name !== 'floating-bar' && name !== 'dock' && name !== 'splash') win.focus()
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
    if (name === 'dock') this.ensureTray()  // bandeja acompanha o workspace (ponto de restauração)
    return win
  }

  showWindow(name: WindowName): void {
    let win = this.windows.get(name)
    // (Re)create if it was never made or was closed. createWindow honours
    // `startHidden`, so we must still show() it explicitly below.
    if (!win || win.isDestroyed()) win = this.createWindow(name)
    if (name === 'floating-bar') this.applyFloatingBarSize(win)
    if (win.isMinimized()) win.restore()   // traz de volta da barra de tarefas
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
    // Visível → esconde. Caso contrário → mostra (showWindow cria se preciso e trata
    // startHidden/floating-bar/settle). Esconder preserva o estado (não fecha a janela).
    if (win && !win.isDestroyed() && win.isVisible()) {
      win.hide()
      return
    }
    this.showWindow(name)
  }

  /** Esconde o dock + a barra flutuante juntos (a bandeja/Ctrl+Alt+K traz de volta). */
  hideBars(): void {
    ;(['dock', 'floating-bar'] as WindowName[]).forEach(name => {
      const win = this.windows.get(name)
      if (win && !win.isDestroyed()) win.hide()
    })
  }

  /** Restaura o dock + a barra flutuante. */
  showBars(): void {
    this.showWindow('floating-bar')
    this.showWindow('dock')
  }

  /** Dock visível → esconde os dois; caso contrário → mostra os dois. */
  toggleBars(): void {
    const dock = this.windows.get('dock')
    if (dock && !dock.isDestroyed() && dock.isVisible()) this.hideBars()
    else this.showBars()
  }

  // Ícone na bandeja do sistema (system tray). Janela transparente não rende botão confiável
  // na barra de tarefas do Windows, então a bandeja é o ponto fixo p/ restaurar dock+barra.
  private ensureTray(): void {
    if (this.tray && !this.tray.isDestroyed()) return
    try {
      this.tray = new Tray(this.trayIcon())
      this.tray.setToolTip('Soaken')
      this.tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'Mostrar Soaken', click: () => this.showBars() },
        { label: 'Esconder',       click: () => this.hideBars() },
        { type: 'separator' },
        { label: 'Sair',           click: () => app.quit() },
      ]))
      this.tray.on('click', () => this.toggleBars())
    } catch (err) {
      console.warn('[tray] falhou ao criar:', (err as Error).message)
    }
  }

  /** Ícone da bandeja: o ícone real (gota Soaken); fallback p/ quadrado teal gerado se faltar. */
  private trayIcon(): Electron.NativeImage {
    const img = nativeImage.createFromPath(this.iconPath('soaken-32.png'))
    if (!img.isEmpty()) return img
    const s = 16
    const buf = Buffer.alloc(s * s * 4)
    for (let i = 0; i < s * s; i++) {
      buf[i * 4] = 0x8a       // B
      buf[i * 4 + 1] = 0x8a   // G
      buf[i * 4 + 2] = 0x1f   // R  → #1F8A8A (primary)
      buf[i * 4 + 3] = 0xff   // A
    }
    return nativeImage.createFromBitmap(buf, { width: s, height: s })
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

  /** Fecha o splash de abertura (idempotente). */
  closeSplash(): void {
    const win = this.windows.get('splash')
    if (win && !win.isDestroyed()) win.close()
  }

  closeWorkspaceWindows(): void {
    ;(['dock', 'floating-bar', 'tutor-board', 'settings', 'review', 'dashboard'] as WindowName[])
      .forEach(name => this.closeWindow(name))
  }

  private positionFloatingBar(win: BW): void {
    const { width: sw } = screen.getPrimaryDisplay().workAreaSize
    const [w] = win.getSize()
    win.setPosition(sw - w - 24, 24)
  }

  /** Dock ancorado no centro inferior da área de trabalho. */
  private positionDock(win: BW): void {
    const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize
    const [w, h] = win.getSize()
    win.setPosition(Math.round((sw - w) / 2), sh - h - 14)
  }

  // Mesmo problema da FloatingBar: janela transparente/frameless pode "abrir colapsada"
  // (a superfície do DWM fica menor que a janela) até um repaint. Re-aplica os bounds + nudge 1px.
  private settleDock(win: BW): void {
    const apply = () => {
      if (win.isDestroyed()) return
      const [x, y] = win.getPosition()
      const [w, h] = win.getSize()
      win.setBounds({ x, y, width: w, height: h - 1 })
      win.setBounds({ x, y, width: w, height: h })
    }
    apply()
    setTimeout(apply, 0)
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
