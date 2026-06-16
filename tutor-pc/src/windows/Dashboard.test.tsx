// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import type { StoreStats } from '../types'

const STATS: StoreStats = {
  sessionCount: 0, phraseCount: 0, dueCount: 0, streak: 0,
  languages: [], topMistakes: [], recentSessions: [],
}

const h = vi.hoisted(() => ({
  stats: vi.fn(async () => STATS),
  capturedToday: vi.fn(async () => 0),
  getAll: vi.fn(async () => ({ onboarded: '1' } as Record<string, string>)),
  show: vi.fn(),
  authGetSession: vi.fn<() => Promise<{ ok: boolean; session: unknown }>>(async () => ({ ok: true, session: null })),
  authLogin: vi.fn(),
  authSignup: vi.fn(),
  authLogout: vi.fn(async () => ({ ok: true })),
}))

vi.mock('../services/electron', () => ({
  storeAPI: { stats: h.stats, capturedToday: h.capturedToday, mistakes: vi.fn(async () => []) },
  settingsAPI: { getAll: h.getAll, set: vi.fn(async () => undefined) },
  credentialsAPI: { list: vi.fn(async () => []) },
  ttsAPI: { speak: vi.fn(async () => ({ ok: false })) },
  listeningAPI: { pause: vi.fn(), resume: vi.fn() },
  authAPI: {
    getSession: h.authGetSession,
    login: h.authLogin,
    signup: h.authSignup,
    logout: h.authLogout,
  },
  windowAPI: { show: h.show, openReview: vi.fn(), close: vi.fn(), minimize: vi.fn(), onboardingComplete: vi.fn() },
}))

import Dashboard from './Dashboard'

beforeEach(() => {
  cleanup()
  h.stats.mockResolvedValue(STATS)
  h.capturedToday.mockResolvedValue(0)
  h.getAll.mockResolvedValue({ onboarded: '1' })
  h.authGetSession.mockResolvedValue({ ok: true, session: null })
})

describe('Dashboard — gate de onboarding', () => {
  it('1º acesso (onboarded != 1) renderiza o onboarding', async () => {
    h.getAll.mockResolvedValue({ onboarded: '' })
    render(<Dashboard />)
    expect(await screen.findByText(/Qual idioma você quer aprender/i)).toBeInTheDocument()
  })

  it('já onboardado mostra o dashboard normal', async () => {
    render(<Dashboard />)
    expect(await screen.findByText(/Bem-vindo de volta/i)).toBeInTheDocument()
    expect(screen.queryByText(/Qual idioma você quer aprender/i)).not.toBeInTheDocument()
  })

  it('mostra o nome do usuario autenticado no welcome', async () => {
    h.authGetSession.mockResolvedValue({
      ok: true,
      session: { user: { id: 'u1', email: 'joel@example.com', name: 'Joel' }, expiresAt: Date.now() + 3600_000, offline: false },
    })
    render(<Dashboard />)
    expect(await screen.findByText(/Bem-vindo de volta, Joel/i)).toBeInTheDocument()
  })
})

describe('Dashboard - idioma da interface', () => {
  it('renderiza textos principais em ingles quando appLanguage = en', async () => {
    h.getAll.mockResolvedValue({ onboarded: '1', appLanguage: 'en' })
    render(<Dashboard />)
    expect(await screen.findByText(/Welcome back/i)).toBeInTheDocument()
    expect(screen.getByText(/Today's goal/i)).toBeInTheDocument()
    expect(screen.queryByText(/Bem-vindo de volta/i)).not.toBeInTheDocument()
  })
})

describe('Dashboard — meta diária', () => {
  it('progresso parcial mostra X/5 e quanto falta', async () => {
    h.capturedToday.mockResolvedValue(2)
    render(<Dashboard />)
    expect(await screen.findByText(/2\/5 frases/)).toBeInTheDocument()
    expect(screen.getByText(/Faltam/)).toBeInTheDocument()
  })

  it('meta batida mostra a comemoração e some o "faltam"', async () => {
    h.capturedToday.mockResolvedValue(5)
    render(<Dashboard />)
    expect(await screen.findByText(/Meta batida/)).toBeInTheDocument()
    expect(screen.queryByText(/Faltam/)).not.toBeInTheDocument()
  })
})

describe('Dashboard - sessoes recentes', () => {
  it('mostra titulo, idioma, duracao e preview da sessao leve', async () => {
    h.stats.mockResolvedValue({
      ...STATS,
      recentSessions: [{
        id: 's1',
        startedAt: new Date('2026-06-10T12:00:00').getTime(),
        endedAt: new Date('2026-06-10T12:03:10').getTime(),
        lineCount: 3,
        lang: 'ko',
        title: 'First captured sentence',
        preview: ['First captured sentence', 'Second captured sentence', 'Third captured sentence'],
      }],
    })
    render(<Dashboard />)
    expect(await screen.findByText('First captured sentence')).toBeInTheDocument()
    expect(screen.getByText(/Coreano/i)).toBeInTheDocument()
    expect(screen.getByText(/3 min/i)).toBeInTheDocument()
    expect(screen.getByText(/Second captured sentence \/ Third captured sentence/i)).toBeInTheDocument()
  })
})
