// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const api = vi.hoisted(() => ({
  set: vi.fn(async () => undefined),
  getAll: vi.fn(async () => ({} as Record<string, string>)),
  list: vi.fn(async () => [] as Array<{ id: string; configured: boolean }>),
  show: vi.fn(),
  close: vi.fn(),
  minimize: vi.fn(),
  onboardingComplete: vi.fn(),
}))

vi.mock('../services/electron', () => ({
  settingsAPI: { set: api.set, getAll: api.getAll },
  credentialsAPI: { list: api.list },
  windowAPI: { show: api.show, close: api.close, minimize: api.minimize, onboardingComplete: api.onboardingComplete },
}))

import Onboarding from './Onboarding'

beforeEach(() => {
  api.set.mockClear()
  api.list.mockClear()
  api.show.mockClear()
  api.list.mockResolvedValue([{ id: 'gemini', configured: true }])  // chave configurada por padrão
  cleanup()
})

const user = () => userEvent.setup()
// O nome do idioma aparece no botão da grade E na linha de nível — pega só o botão (aria-pressed).
const langBtn = (name: string) => {
  for (const el of screen.getAllByText(name)) {
    const btn = el.closest('button')
    if (btn && btn.hasAttribute('aria-pressed')) return btn as HTMLButtonElement
  }
  throw new Error(`Botão de idioma "${name}" não encontrado`)
}
const levelSel = (langName: string) => screen.getByLabelText(new RegExp(`Nível em ${langName}`, 'i')) as HTMLSelectElement

describe('Onboarding — seleção de idioma (multi)', () => {
  it('seletor de nível só aparece após escolher; Continuar começa bloqueado', async () => {
    const u = user()
    render(<Onboarding onDone={vi.fn()} />)
    expect(screen.getByText(/Qual idioma você quer aprender/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Nível em/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Continuar/i })).toBeDisabled()

    await u.click(langBtn('Coreano'))
    expect(levelSel('Coreano')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Continuar/i })).toBeEnabled()
  })

  it('marca o idioma selecionado (aria-pressed)', async () => {
    const u = user()
    render(<Onboarding onDone={vi.fn()} />)
    expect(langBtn('Japonês')).toHaveAttribute('aria-pressed', 'false')
    await u.click(langBtn('Japonês'))
    expect(langBtn('Japonês')).toHaveAttribute('aria-pressed', 'true')
  })

  it('um seletor de nível POR idioma; default beginner', async () => {
    const u = user()
    render(<Onboarding onDone={vi.fn()} />)
    await u.click(langBtn('Japonês'))
    await u.click(langBtn('Chinês'))
    expect(levelSel('Japonês')).toHaveValue('beginner')
    expect(levelSel('Chinês')).toHaveValue('beginner')
    expect(langBtn('Japonês')).toHaveAttribute('aria-pressed', 'true')
    expect(langBtn('Chinês')).toHaveAttribute('aria-pressed', 'true')
  })

  it('clicar de novo desmarca o idioma e some o seletor', async () => {
    const u = user()
    render(<Onboarding onDone={vi.fn()} />)
    await u.click(langBtn('Coreano'))
    expect(levelSel('Coreano')).toBeInTheDocument()
    await u.click(langBtn('Coreano'))
    expect(screen.queryByLabelText(/Nível em Coreano/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Continuar/i })).toBeDisabled()
  })

  it('níveis independentes: um idioma não afeta o outro', async () => {
    const u = user()
    render(<Onboarding onDone={vi.fn()} />)
    await u.click(langBtn('Chinês'))
    await u.click(langBtn('Inglês'))
    await u.selectOptions(levelSel('Inglês'), 'advanced')
    expect(levelSel('Inglês')).toHaveValue('advanced')
    expect(levelSel('Chinês')).toHaveValue('beginner')   // intocado
  })
})

describe('Onboarding — passo da chave de API (obrigatório)', () => {
  async function gotoApiKey(u: ReturnType<typeof user>, lang = 'Coreano') {
    await u.click(langBtn(lang))
    await u.click(screen.getByRole('button', { name: /Continuar/i }))
    await screen.findByText(/Conecte uma chave/i)
  }

  it('sem chave: oferece abrir Configurações e BLOQUEIA o Continuar', async () => {
    const u = user()
    api.list.mockResolvedValue([{ id: 'gemini', configured: false }])
    render(<Onboarding onDone={vi.fn()} />)
    await gotoApiKey(u)

    expect(await screen.findByText(/Nenhuma chave ainda/i)).toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: /Abrir Configurações/i }))
    expect(api.show).toHaveBeenCalledWith('settings')
    expect(screen.getByRole('button', { name: /^Continuar$/i })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /Pular/i })).not.toBeInTheDocument()
  })

  it('com chave configurada: LIBERA o Continuar', async () => {
    const u = user()
    render(<Onboarding onDone={vi.fn()} />)
    await gotoApiKey(u)
    expect(await screen.findByText(/Chave configurada/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Continuar$/i })).toBeEnabled()
  })
})

describe('Onboarding — recursos por nível (por idioma)', () => {
  async function gotoResources(u: ReturnType<typeof user>) {
    await u.click(screen.getByRole('button', { name: /Continuar/i }))      // welcome → apiKey
    await screen.findByText(/Conecte uma chave/i)
    await u.click(await screen.findByRole('button', { name: /^Continuar$/i })) // apiKey → resources
  }

  it('iniciante (coreano) mostra Hangul + canais', async () => {
    const u = user()
    render(<Onboarding onDone={vi.fn()} />)
    await u.click(langBtn('Coreano'))            // default beginner
    await gotoResources(u)
    expect(await screen.findByText(/Comece pela escrita/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Hangul/).length).toBeGreaterThan(0)
    expect(screen.getByText(/GO! Billy Korean/)).toBeInTheDocument()
  })

  it('"já leio a escrita": só imersão por canais', async () => {
    const u = user()
    render(<Onboarding onDone={vi.fn()} />)
    await u.click(langBtn('Coreano'))
    await u.selectOptions(levelSel('Coreano'), 'knows-script')
    await gotoResources(u)
    expect(await screen.findByText(/Imersão/i)).toBeInTheDocument()
    expect(screen.queryByText(/Comece pela escrita/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Treine a produção/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Canais para começar/i)).toBeInTheDocument()
  })

  it('avançado/conversação foca em produção (sem escrita nem canais)', async () => {
    const u = user()
    render(<Onboarding onDone={vi.fn()} />)
    await u.click(langBtn('Japonês'))
    await u.selectOptions(levelSel('Japonês'), 'advanced')
    await gotoResources(u)
    expect(await screen.findByText(/Foco em conversação/i)).toBeInTheDocument()
    expect(screen.getByText(/Treine a produção/i)).toBeInTheDocument()
    expect(screen.getByText(/shadowing/i)).toBeInTheDocument()
    expect(screen.queryByText(/Comece pela escrita/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Canais para começar/i)).not.toBeInTheDocument()
  })

  it('CASO DO USUÁRIO: Chinês iniciante + Inglês avançado → Pinyin E prática juntos', async () => {
    const u = user()
    render(<Onboarding onDone={vi.fn()} />)
    await u.click(langBtn('Chinês'))                       // beginner → primer de escrita
    await u.click(langBtn('Inglês'))
    await u.selectOptions(levelSel('Inglês'), 'advanced')  // advanced → prática
    await gotoResources(u)
    expect(await screen.findByText(/Comece pela escrita/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Pinyin/).length).toBeGreaterThan(0)   // escrita do chinês
    expect(screen.getByText(/Treine a produção/i)).toBeInTheDocument() // prática (inglês avançado)
  })
})

describe('Onboarding — conclusão persiste e chama onDone', () => {
  it('salva idiomas + níveis POR idioma + onboarded', async () => {
    const u = user()
    const onDone = vi.fn()
    render(<Onboarding onDone={onDone} />)

    await u.selectOptions(screen.getByLabelText(/Seu idioma/i), 'ja')            // idioma do usuário
    await u.click(langBtn('Chinês'))                          // primário
    await u.click(langBtn('Inglês'))
    await u.selectOptions(levelSel('Chinês'), 'knows-script')
    await u.selectOptions(levelSel('Inglês'), 'advanced')
    await u.click(screen.getByRole('button', { name: /Continuar/i }))           // → apiKey
    await screen.findByText(/Conecte uma chave/i)
    await u.click(await screen.findByRole('button', { name: /^Continuar$/i }))   // → resources
    await u.click(await screen.findByRole('button', { name: /Continuar/i }))     // → done
    await u.click(await screen.findByRole('button', { name: /Começar a aprender/i }))

    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(api.onboardingComplete).toHaveBeenCalled()   // libera barra/tutor board
    expect(api.set).toHaveBeenCalledWith('nativeLanguage', 'ja')                 // idioma do usuário
    expect(api.set).toHaveBeenCalledWith('targetLanguage', 'zh')                 // 1º selecionado
    expect(api.set).toHaveBeenCalledWith('learnLanguages', 'zh,en')
    expect(api.set).toHaveBeenCalledWith('languageLevels', 'zh:knows-script,en:advanced')
    expect(api.set).toHaveBeenCalledWith('level', 'knows-script')                // compat = nível do primário
    expect(api.set).toHaveBeenCalledWith('onboarded', '1')
  })

  it('detecta o idioma do sistema como padrão (locale en-US → English)', () => {
    Object.defineProperty(navigator, 'language', { value: 'en-US', configurable: true })
    try {
      render(<Onboarding onDone={vi.fn()} />)
      expect(screen.getByLabelText(/Seu idioma/i)).toHaveValue('en')
    } finally {
      Object.defineProperty(navigator, 'language', { value: 'pt-BR', configurable: true })  // restaura o default dos testes
    }
  })

  it('navega para trás preservando idioma e nível', async () => {
    const u = user()
    render(<Onboarding onDone={vi.fn()} />)
    await u.click(langBtn('Japonês'))
    await u.selectOptions(levelSel('Japonês'), 'intermediate')
    await u.click(screen.getByRole('button', { name: /Continuar/i }))     // → apiKey
    await screen.findByText(/Conecte uma chave/i)
    await u.click(screen.getByRole('button', { name: /Voltar/i }))        // → welcome
    expect(langBtn('Japonês')).toHaveAttribute('aria-pressed', 'true')
    expect(levelSel('Japonês')).toHaveValue('intermediate')
  })
})

describe('Onboarding — i18n (appLanguage = en)', () => {
  it('mostra a tela inicial em inglês quando o app está em inglês', async () => {
    api.getAll.mockResolvedValueOnce({ appLanguage: 'en' })
    render(<Onboarding onDone={vi.fn()} />)
    expect(await screen.findByText('Which language do you want to learn?')).toBeInTheDocument()
    expect(screen.getByText(/Explanations and translations appear in/i)).toBeInTheDocument()
    // nomes de idioma e botão também traduzidos
    expect(screen.getByText('Chinese')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Continue/i })).toBeInTheDocument()
  })
})
