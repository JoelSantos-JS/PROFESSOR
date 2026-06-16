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
  // O fundo inicial (1º frame, antes do React pintar) deve ser o creme base (--bg #F3EAE0),
  // não a cor do tema escuro antigo (#070D17), pra não "piscar preto" ao abrir a janela.
  it.each(['dashboard', 'settings', 'review'] as const)('%s nasce com o creme do projeto', name => {
    expect(windowConfigs[name].options.backgroundColor).toBe('#F3EAE0')
  })

  it('janelas transparentes (overlays) não recebem fundo sólido', () => {
    expect(windowConfigs['floating-bar'].options.transparent).toBe(true)
    expect(windowConfigs['tutor-board'].options.transparent).toBe(true)
    expect(windowConfigs['floating-bar'].options.backgroundColor).toBeUndefined()
  })
})
