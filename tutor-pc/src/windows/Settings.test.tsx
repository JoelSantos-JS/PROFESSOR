// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const ALL_PROVIDERS = ['openai', 'gemini', 'anthropic', 'groq'] as const

// Mock IPC com estado mutável (chaves configuradas + settings persistidas).
const h = vi.hoisted(() => {
  const configured = new Set<string>()
  const settings: Record<string, string> = {
    targetLanguage: 'en', nativeLanguage: 'pt-BR', contentLanguage: 'auto',
    audioInputDevice: 'default', activeAiProvider: 'gemini',
    activeTranscriptionProvider: 'gemini', activeTtsProvider: 'kokoro',
    ttsVoice: 'af_heart', onboarded: '1', level: 'beginner',
  }
  return {
    configured,
    settings,
    settingsGet: vi.fn(async () => ({ ...settings })),
    settingsSet: vi.fn(async (k: string, v: string) => { settings[k] = v }),
    credList: vi.fn(async () => ['openai', 'gemini', 'anthropic', 'groq'].map(id => ({ id, configured: configured.has(id) }))),
    credGet: vi.fn(async () => null),
    credSet: vi.fn(async (id: string, _key: string) => { configured.add(id); return { ok: true } }),
    credRemove: vi.fn(async (id: string) => { configured.delete(id) }),
    credTest: vi.fn(async (id: string) => ({ ok: true, message: `OK-${id}` })),
  }
})

vi.mock('../services/electron', () => ({
  settingsAPI: { getAll: h.settingsGet, set: h.settingsSet },
  credentialsAPI: { list: h.credList, get: h.credGet, set: h.credSet, remove: h.credRemove, test: h.credTest },
  forvoAPI: { hasKey: vi.fn(async () => false), setKey: vi.fn(async () => ({ ok: true })) },
  storeAPI: { usageEvents: vi.fn(async () => ({ events: [], sessions: [] })) },
}))

import Settings from './Settings'

beforeEach(() => {
  cleanup()
  h.configured.clear()
  Object.assign(h.settings, { activeAiProvider: 'gemini', activeTranscriptionProvider: 'gemini', appLanguage: 'pt' })
  h.settingsGet.mockClear(); h.settingsSet.mockClear()
  h.credList.mockClear(); h.credGet.mockClear(); h.credSet.mockClear()
  h.credRemove.mockClear(); h.credTest.mockClear()
})

const user = () => userEvent.setup()

async function openEditorFor(u: ReturnType<typeof user>, index: number) {
  const adds = await screen.findAllByRole('button', { name: /Adicionar/i })
  await u.click(adds[index])  // 0=openai 1=gemini 2=anthropic 3=groq
}

describe('Settings — validação de formato da chave', () => {
  it('URL bloqueia o salvar e mostra erro', async () => {
    const u = user()
    render(<Settings />)
    await openEditorFor(u, 0)  // openai
    const input = screen.getByPlaceholderText('sk-...')
    await u.type(input, 'https://platform.openai.com/api-keys')
    expect(screen.getByText(/parece uma URL/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Salvar/i })).toBeDisabled()
  })

  it('prefixo errado AVISA mas permite salvar', async () => {
    const u = user()
    render(<Settings />)
    await openEditorFor(u, 0)
    await u.type(screen.getByPlaceholderText('sk-...'), 'xx-' + 'a'.repeat(25))
    expect(screen.getByText(/começam com "sk-"/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Salvar/i })).toBeEnabled()
  })

  it('chave vazia mantém o salvar desabilitado', async () => {
    const u = user()
    render(<Settings />)
    await openEditorFor(u, 0)
    expect(screen.getByRole('button', { name: /Salvar/i })).toBeDisabled()
  })
})

describe('Settings — salvar normaliza, auto-ativa e auto-testa', () => {
  it('salva a chave já com trim, ativa o provider e mostra o teste', async () => {
    const u = user()
    render(<Settings />)
    await openEditorFor(u, 0)  // openai
    await u.type(screen.getByPlaceholderText('sk-...'), '  sk-' + 'a'.repeat(40) + '  ')
    await u.click(screen.getByRole('button', { name: /Salvar/i }))

    // salvou normalizada (sem espaços nas bordas)
    await waitFor(() => expect(h.credSet).toHaveBeenCalled())
    const [, savedKey] = h.credSet.mock.calls[0]
    expect(savedKey).toBe('sk-' + 'a'.repeat(40))

    // auto-seleciona openai como provider ativo (de IA e transcrição)
    await waitFor(() => expect(h.settingsSet).toHaveBeenCalledWith('activeAiProvider', 'openai'))
    expect(h.settingsSet).toHaveBeenCalledWith('activeTranscriptionProvider', 'openai')

    // auto-testa e mostra o resultado inline
    await waitFor(() => expect(h.credTest).toHaveBeenCalledWith('openai'))
    expect(await screen.findByText(/OK-openai/)).toBeInTheDocument()
  })

  it('anthropic (sem transcrição) NÃO vira o provider de transcrição', async () => {
    const u = user()
    render(<Settings />)
    await openEditorFor(u, 2)  // anthropic
    await u.type(screen.getByPlaceholderText('sk-ant-...'), 'sk-ant-' + 'b'.repeat(30))
    await u.click(screen.getByRole('button', { name: /Salvar/i }))

    await waitFor(() => expect(h.settingsSet).toHaveBeenCalledWith('activeAiProvider', 'anthropic'))
    const txCalls = h.settingsSet.mock.calls.filter(c => c[0] === 'activeTranscriptionProvider')
    expect(txCalls).toHaveLength(0)  // anthropic não suporta transcrição
  })
})

describe('Settings — testar provider já configurado', () => {
  it('botão Testar chama o teste e mostra ✓', async () => {
    h.configured.add('groq')
    const u = user()
    render(<Settings />)
    const testBtn = await screen.findByRole('button', { name: /^Testar$/i })
    await u.click(testBtn)
    await waitFor(() => expect(h.credTest).toHaveBeenCalledWith('groq'))
    expect(await screen.findByText(/OK-groq/)).toBeInTheDocument()
  })

  it('lista todos os 4 providers', async () => {
    render(<Settings />)
    expect(await screen.findByText('OpenAI')).toBeInTheDocument()
    expect(screen.getByText('Google Gemini')).toBeInTheDocument()
    expect(screen.getByText('Anthropic')).toBeInTheDocument()
    expect(screen.getByText('Groq')).toBeInTheDocument()
    expect(ALL_PROVIDERS.length).toBe(4)
  })
})

describe('Settings - idioma da interface', () => {
  it('salva appLanguage e atualiza os rotulos para ingles', async () => {
    const u = user()
    render(<Settings />)

    const select = await screen.findByRole('combobox', { name: /Idioma do app/i })
    await u.selectOptions(select, 'en')

    await waitFor(() => expect(h.settingsSet).toHaveBeenCalledWith('appLanguage', 'en'))
    expect(await screen.findByText('Active Provider')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /App language/i })).toHaveValue('en')
  })
})
