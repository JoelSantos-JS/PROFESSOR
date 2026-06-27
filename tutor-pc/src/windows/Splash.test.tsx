// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'

vi.mock('../services/electron', () => ({ settingsAPI: { getAll: vi.fn(async () => ({})) } }))

import Splash from './Splash'
import { splashSteps, splashTagline } from '../lib/splashStatus'
import { appLanguage } from '../lib/uiLanguage'

// Idioma esperado = o do LOCALE do jsdom (sem escolha salva → segue o PC).
const lang = appLanguage()
const steps = splashSteps(lang)
const tagline = splashTagline(lang)

function mockReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduce, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }))
}

afterEach(() => { cleanup(); vi.useRealTimers() })
beforeEach(() => mockReducedMotion(false))

describe('Splash', () => {
  it('mostra a marca, tagline e o primeiro status no idioma do PC', () => {
    const { getByText } = render(<Splash />)
    expect(getByText('Soaken')).toBeTruthy()
    expect(getByText(tagline)).toBeTruthy()
    expect(getByText(steps[0])).toBeTruthy()
  })

  it('exibe o ícone real do app', () => {
    const { getByAltText } = render(<Splash />)
    expect(getByAltText('Soaken').getAttribute('src')).toContain('soaken-512.png')
  })

  it('cicla o texto de status ao longo do tempo', () => {
    vi.useFakeTimers()
    const { getByText, queryByText } = render(<Splash />)
    expect(getByText(steps[0])).toBeTruthy()
    act(() => { vi.advanceTimersByTime(1400 + 200) })
    expect(queryByText(steps[0])).toBeNull()
    expect(getByText(steps[1])).toBeTruthy()
  })

  it('com prefers-reduced-motion NÃO cicla o status (sem timer)', () => {
    mockReducedMotion(true)
    vi.useFakeTimers()
    const { getByText } = render(<Splash />)
    act(() => { vi.advanceTimersByTime(5000) })
    expect(getByText(steps[0])).toBeTruthy()
  })

  it('idioma do PT (locale pt) mostra a tagline em português', () => {
    expect(splashTagline('pt')).toBe('Mergulhe no idioma')
    expect(splashTagline('en')).toBe('Dive into the language')
  })
})
