// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const h = vi.hoisted(() => ({
  getSession: vi.fn<() => Promise<{ ok: boolean; session: unknown }>>(async () => ({ ok: true, session: null })),
  login: vi.fn(async () => ({
    ok: true,
    session: { user: { id: 'u1', email: 'a@example.com' }, expiresAt: Date.now() + 3600_000, offline: false },
  })),
  signup: vi.fn<() => Promise<{ ok: boolean; session: unknown; needsEmailConfirmation?: boolean; error?: string }>>(
    async () => ({ ok: true, session: null, needsEmailConfirmation: true }),
  ),
  google: vi.fn(async () => ({
    ok: true,
    session: { user: { id: 'u1', email: 'google@example.com' }, expiresAt: Date.now() + 3600_000, offline: false },
  })),
  authComplete: vi.fn(),
  close: vi.fn(),
  minimize: vi.fn(),
  getAll: vi.fn(async () => ({} as Record<string, string>)),
}))

vi.mock('../services/electron', () => ({
  authAPI: {
    getSession: h.getSession,
    login: h.login,
    signup: h.signup,
    google: h.google,
  },
  windowAPI: {
    authComplete: h.authComplete,
    close: h.close,
    minimize: h.minimize,
  },
  settingsAPI: { getAll: h.getAll },
}))

import Auth from './Auth'

beforeEach(() => {
  cleanup()
  h.getSession.mockClear()
  h.login.mockClear()
  h.signup.mockClear()
  h.google.mockClear()
  h.authComplete.mockClear()
  h.getSession.mockResolvedValue({ ok: true, session: null })
  h.getAll.mockResolvedValue({})
})

const user = () => userEvent.setup()

describe('Auth window', () => {
  it('i18n (appLanguage = en): tela de login em inglês', async () => {
    h.getAll.mockResolvedValueOnce({ appLanguage: 'en' })
    render(<Auth />)
    expect(await screen.findByText(/Welcome back/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Your password')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Remember me/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Continue with Google/i })).toBeInTheDocument()
  })

  it('mostra apenas a tela de login quando nao ha sessao', async () => {
    const { container } = render(<Auth />)
    expect(await screen.findByText(/Bem-vindo de volta/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('voce@email.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Sua senha')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Lembrar de mim/i })).toBeChecked()
    expect(screen.queryByRole('checkbox', { name: /Li e aceito/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Continuar com Google/i })).toBeEnabled()
    expect(container.firstElementChild).toHaveClass('rounded-[18px]')
    expect(screen.getByRole('main')).toHaveClass('overflow-hidden')
    expect(screen.getByRole('main')).not.toHaveClass('overflow-y-auto')
  })

  it('abre termos e politica no cadastro e exige aceite antes de criar', async () => {
    const u = user()
    render(<Auth />)
    await u.click((await screen.findAllByRole('button', { name: /^Criar conta$/i }))[0])
    const submit = screen.getAllByRole('button', { name: /^Criar conta$/i }).at(-1)
    expect(submit).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: /Li e aceito/i })).not.toBeChecked()
    await u.click(screen.getByRole('button', { name: /Termos de Uso/i }))
    expect(screen.getByRole('heading', { name: /Termos de Uso/i })).toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: /Fechar Termos de Uso/i }))
    await u.click(screen.getByRole('button', { name: /Pol[ií]tica de Privacidade/i }))
    expect(screen.getByRole('heading', { name: /Pol[ií]tica de Privacidade/i })).toBeInTheDocument()
  })

  it('mantem cadastro bloqueado ate preencher nome, email, senha e aceitar termos', async () => {
    const u = user()
    render(<Auth />)
    await u.click((await screen.findAllByRole('button', { name: /^Criar conta$/i }))[0])
    const submit = screen.getAllByRole('button', { name: /^Criar conta$/i }).at(-1)!

    expect(submit).toBeDisabled()
    await u.type(screen.getByPlaceholderText('Como devemos te chamar?'), 'Joel')
    await u.type(screen.getByPlaceholderText('voce@email.com'), 'new@example.com')
    await u.type(screen.getByPlaceholderText('Crie uma senha (min. 6)'), '12345')
    expect(submit).toBeDisabled()
    await u.type(screen.getByPlaceholderText('Crie uma senha (min. 6)'), '6')
    expect(submit).toBeDisabled()
    await u.click(screen.getByRole('checkbox', { name: /Li e aceito/i }))
    expect(submit).toBeEnabled()
  })

  it('bloqueia Google no cadastro ate aceitar os termos', async () => {
    const u = user()
    render(<Auth />)
    await u.click((await screen.findAllByRole('button', { name: /^Criar conta$/i }))[0])
    const google = screen.getByRole('button', { name: /Continuar com Google/i })

    expect(google).toBeDisabled()
    await u.click(screen.getByRole('checkbox', { name: /Li e aceito/i }))
    expect(google).toBeEnabled()
  })

  it('faz login e libera a abertura do app sem expor token no renderer', async () => {
    const u = user()
    render(<Auth />)
    await u.type(await screen.findByPlaceholderText('voce@email.com'), 'A@EXAMPLE.COM')
    await u.type(screen.getByPlaceholderText('Sua senha'), 'password123')
    await u.click(screen.getAllByRole('button', { name: /^Entrar$/i }).at(-1)!)

    await waitFor(() => expect(h.login).toHaveBeenCalledWith({ email: 'a@example.com', password: 'password123' }))
    await waitFor(() => expect(h.authComplete).toHaveBeenCalled())
    expect(JSON.stringify(h.login.mock.results)).not.toMatch(/refresh_token|access_token/i)
  })

  it('cadastro com confirmacao de email nao abre o app antes da confirmacao', async () => {
    const u = user()
    render(<Auth />)
    await u.click((await screen.findAllByRole('button', { name: /^Criar conta$/i }))[0])
    await u.type(screen.getByPlaceholderText('Como devemos te chamar?'), '  Joel  ')
    await u.type(screen.getByPlaceholderText('voce@email.com'), 'NEW@EXAMPLE.COM ')
    await u.type(screen.getByPlaceholderText('Crie uma senha (min. 6)'), 'password123')
    await u.click(screen.getByRole('checkbox', { name: /Li e aceito/i }))
    await u.click(screen.getAllByRole('button', { name: /^Criar conta$/i }).at(-1)!)

    await waitFor(() => expect(h.signup).toHaveBeenCalledWith({ name: 'Joel', email: 'new@example.com', password: 'password123' }))
    expect(screen.getByText(/Confirme seu email/i)).toBeInTheDocument()
    expect(h.authComplete).not.toHaveBeenCalled()
  })

  it('cadastro mostra erro retornado pelo provider em vez de falhar em silencio', async () => {
    h.signup.mockResolvedValueOnce({ ok: false, session: null, error: 'Email ja cadastrado.' })
    const u = user()
    render(<Auth />)
    await u.click((await screen.findAllByRole('button', { name: /^Criar conta$/i }))[0])
    await u.type(screen.getByPlaceholderText('Como devemos te chamar?'), 'Joel')
    await u.type(screen.getByPlaceholderText('voce@email.com'), 'new@example.com')
    await u.type(screen.getByPlaceholderText('Crie uma senha (min. 6)'), 'password123')
    await u.click(screen.getByRole('checkbox', { name: /Li e aceito/i }))
    await u.click(screen.getAllByRole('button', { name: /^Criar conta$/i }).at(-1)!)

    expect(await screen.findByText(/Email ja cadastrado/i)).toBeInTheDocument()
    expect(h.authComplete).not.toHaveBeenCalled()
  })

  it('cadastro mostra erro quando IPC/Supabase lança excecao', async () => {
    h.signup.mockRejectedValueOnce(new Error('Falha ao conectar no Supabase.'))
    const u = user()
    render(<Auth />)
    await u.click((await screen.findAllByRole('button', { name: /^Criar conta$/i }))[0])
    await u.type(screen.getByPlaceholderText('Como devemos te chamar?'), 'Joel')
    await u.type(screen.getByPlaceholderText('voce@email.com'), 'new@example.com')
    await u.type(screen.getByPlaceholderText('Crie uma senha (min. 6)'), 'password123')
    await u.click(screen.getByRole('checkbox', { name: /Li e aceito/i }))
    await u.click(screen.getAllByRole('button', { name: /^Criar conta$/i }).at(-1)!)

    expect(await screen.findByText(/Falha ao conectar no Supabase/i)).toBeInTheDocument()
    expect(h.authComplete).not.toHaveBeenCalled()
  })

  it('cadastro sem confirmacao mostra sucesso e libera o app', async () => {
    h.signup.mockResolvedValueOnce({
      ok: true,
      session: { user: { id: 'u2', email: 'new@example.com' }, expiresAt: Date.now() + 3600_000, offline: false },
      needsEmailConfirmation: false,
    })
    const u = user()
    render(<Auth />)
    await u.click((await screen.findAllByRole('button', { name: /^Criar conta$/i }))[0])
    await u.type(screen.getByPlaceholderText('Como devemos te chamar?'), 'Joel')
    await u.type(screen.getByPlaceholderText('voce@email.com'), 'new@example.com')
    await u.type(screen.getByPlaceholderText('Crie uma senha (min. 6)'), 'password123')
    await u.click(screen.getByRole('checkbox', { name: /Li e aceito/i }))
    await u.click(screen.getAllByRole('button', { name: /^Criar conta$/i }).at(-1)!)

    expect(await screen.findByText(/Conta criada com sucesso/i)).toBeInTheDocument()
    await waitFor(() => expect(h.authComplete).toHaveBeenCalled())
  })

  it('faz login com Google e libera a abertura do app', async () => {
    const u = user()
    render(<Auth />)
    await u.click(await screen.findByRole('button', { name: /Continuar com Google/i }))

    await waitFor(() => expect(h.google).toHaveBeenCalled())
    await waitFor(() => expect(h.authComplete).toHaveBeenCalled())
    expect(JSON.stringify(h.google.mock.results)).not.toMatch(/refresh_token|access_token/i)
  })

  it('sessao existente pula direto para o app', async () => {
    h.getSession.mockResolvedValue({
      ok: true,
      session: { user: { id: 'u1', email: 'a@example.com' }, expiresAt: Date.now() + 3600_000, offline: false },
    })
    render(<Auth />)
    await waitFor(() => expect(h.authComplete).toHaveBeenCalled())
  })
})
