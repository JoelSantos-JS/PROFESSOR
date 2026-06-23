import { beforeEach, describe, expect, it, vi } from 'vitest'

// --- Fakes de Electron (definidos dentro de vi.hoisted p/ ficarem disponíveis ao factory) ---
const ref = vi.hoisted(() => {
  class FakeWin {
    visible = false
    destroyed = false
    minimized = false
    size: [number, number] = [330, 80]
    pos: [number, number] = [0, 0]
    handlers: Record<string, () => void> = {}
    webContents = { send: () => {} }
    constructor(public options: Record<string, unknown>) {}
    show() { this.visible = true }
    hide() { this.visible = false }
    focus() {}
    moveTop() {}
    isVisible() { return this.visible }
    isDestroyed() { return this.destroyed }
    isMinimized() { return this.minimized }
    restore() { this.minimized = false }
    once() {}
    on(ev: string, cb: () => void) { this.handlers[ev] = cb }
    loadURL() {}
    loadFile() {}
    getSize() { return this.size }
    getPosition() { return this.pos }
    setSize(w: number, h: number) { this.size = [w, h] }
    setBounds(b: { x: number; y: number; width: number; height: number }) {
      this.pos = [b.x, b.y]; this.size = [b.width, b.height]
    }
    setPosition(x: number, y: number) { this.pos = [x, y] }
    setResizable() {}
    setMinimumSize() {}
    setMaximumSize() {}
  }

  const trays: FakeTray[] = []
  class FakeTray {
    tooltip = ''
    menu: unknown = null
    clickHandler: (() => void) | null = null
    destroyed = false
    constructor(public icon: unknown) { trays.push(this) }
    setToolTip(t: string) { this.tooltip = t }
    setContextMenu(m: unknown) { this.menu = m }
    on(ev: string, cb: () => void) { if (ev === 'click') this.clickHandler = cb }
    isDestroyed() { return this.destroyed }
  }

  return { FakeWin, FakeTray, trays }
})

type FakeWin = InstanceType<typeof ref.FakeWin>

vi.mock('electron', () => ({
  app: { quit: () => {}, getAppPath: () => '/app' },
  BrowserWindow: ref.FakeWin,
  Tray: ref.FakeTray,
  Menu: { buildFromTemplate: (tpl: unknown) => tpl },
  nativeImage: {
    createFromBitmap: () => ({}),
    createFromPath: () => ({ isEmpty: () => true }),  // força o fallback no teste
  },
  screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 1920, height: 1080 } }) },
}))

// importado depois do mock
import { WindowManager } from './windowManager'

function setup() {
  const wm = new WindowManager(true)
  wm.createWindow('floating-bar')
  wm.createWindow('dock')
  // ambos começam visíveis para os testes de hide
  ;(wm.getWindow('floating-bar') as unknown as FakeWin).visible = true
  ;(wm.getWindow('dock') as unknown as FakeWin).visible = true
  return wm
}

beforeEach(() => { ref.trays.length = 0 })

describe('WindowManager — barras (dock + floating)', () => {
  it('hideBars esconde o dock E a barra flutuante juntos', () => {
    const wm = setup()
    wm.hideBars()
    expect((wm.getWindow('dock') as unknown as FakeWin).visible).toBe(false)
    expect((wm.getWindow('floating-bar') as unknown as FakeWin).visible).toBe(false)
  })

  it('showBars mostra os dois de novo', () => {
    const wm = setup()
    wm.hideBars()
    wm.showBars()
    expect((wm.getWindow('dock') as unknown as FakeWin).visible).toBe(true)
    expect((wm.getWindow('floating-bar') as unknown as FakeWin).visible).toBe(true)
  })

  it('showBars restaura janela minimizada', () => {
    const wm = setup()
    const dock = wm.getWindow('dock') as unknown as FakeWin
    dock.minimized = true
    dock.visible = false
    wm.showBars()
    expect(dock.minimized).toBe(false)
    expect(dock.visible).toBe(true)
  })

  it('toggleBars: visível → esconde', () => {
    const wm = setup()
    wm.toggleBars()
    expect((wm.getWindow('dock') as unknown as FakeWin).visible).toBe(false)
    expect((wm.getWindow('floating-bar') as unknown as FakeWin).visible).toBe(false)
  })

  it('toggleBars: escondido → mostra', () => {
    const wm = setup()
    wm.hideBars()
    wm.toggleBars()
    expect((wm.getWindow('dock') as unknown as FakeWin).visible).toBe(true)
    expect((wm.getWindow('floating-bar') as unknown as FakeWin).visible).toBe(true)
  })
})

describe('WindowManager — splash', () => {
  it('closeSplash fecha a janela de splash', () => {
    const wm = new WindowManager(true)
    wm.createWindow('splash')
    const splash = wm.getWindow('splash') as unknown as FakeWin
    let closed = false
    splash.close = () => { closed = true; splash.destroyed = true }
    wm.closeSplash()
    expect(closed).toBe(true)
  })

  it('closeSplash é seguro quando não há splash (idempotente)', () => {
    const wm = new WindowManager(true)
    expect(() => wm.closeSplash()).not.toThrow()
  })

  it('abrir o splash não cria bandeja (só o dock cria)', () => {
    const wm = new WindowManager(true)
    wm.createWindow('splash')
    expect(ref.trays).toHaveLength(0)
  })
})

describe('WindowManager — bandeja (system tray)', () => {
  it('cria um ícone na bandeja ao abrir o dock', () => {
    setup()
    expect(ref.trays).toHaveLength(1)
    expect(ref.trays[0].tooltip).toBe('Soaken')
    expect(ref.trays[0].clickHandler).toBeTypeOf('function')
  })

  it('clicar na bandeja alterna as barras', () => {
    const wm = setup()
    ref.trays[0].clickHandler?.()  // visível → esconde
    expect((wm.getWindow('dock') as unknown as FakeWin).visible).toBe(false)
    ref.trays[0].clickHandler?.()  // escondido → mostra
    expect((wm.getWindow('dock') as unknown as FakeWin).visible).toBe(true)
  })

  it('não duplica a bandeja se já existe', () => {
    const wm = setup()
    wm.createWindow('dock')  // segundo pedido reaproveita a janela existente
    expect(ref.trays).toHaveLength(1)
  })
})
