import { describe, expect, it } from 'vitest'
import { windowConfigs } from './windowConfigs'

describe('auth window config', () => {
  it('usa tamanho fixo suficiente, sem scroll visual e com suporte a cantos arredondados', () => {
    const auth = windowConfigs.auth.options
    expect(auth.width).toBe(368)
    expect(auth.height).toBe(640)
    expect(auth.minHeight).toBe(640)
    expect(auth.maxHeight).toBe(640)
    expect(auth.resizable).toBe(false)
    expect(auth.frame).toBe(false)
    expect(auth.transparent).toBe(true)
    expect(auth.backgroundColor).toBe('#00000000')
    expect(auth.center).toBe(true)
  })
})

describe('janelas sólidas — sem flash escuro na criação', () => {
  // O fundo inicial (1º frame, antes do React pintar) deve ser o --bg do tema (Deep Soak #EDF3F2),
  // não a cor do tema escuro antigo (#070D17), pra não "piscar preto" ao abrir a janela.
  it.each(['dashboard', 'settings', 'review'] as const)('%s nasce com o fundo do tema', name => {
    expect(windowConfigs[name].options.backgroundColor).toBe('#EDF3F2')
  })

  it('janelas transparentes (overlays) não recebem fundo sólido', () => {
    expect(windowConfigs['floating-bar'].options.transparent).toBe(true)
    expect(windowConfigs['tutor-board'].options.transparent).toBe(true)
    expect(windowConfigs['floating-bar'].options.backgroundColor).toBeUndefined()
  })
})

describe('splash window config', () => {
  it('é frameless, transparente, centralizado, no topo e fora da taskbar', () => {
    const splash = windowConfigs.splash.options
    expect(splash.width).toBe(320)
    expect(splash.height).toBe(400)
    expect(splash.frame).toBe(false)
    expect(splash.transparent).toBe(true)
    expect(splash.backgroundColor).toBe('#00000000')  // sem isso a margem renderiza preta no Windows
    expect(splash.center).toBe(true)
    expect(splash.alwaysOnTop).toBe(true)
    expect(splash.skipTaskbar).toBe(true)
    expect(splash.resizable).toBe(false)
  })
})
