// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import Splash from './Splash'
import { SPLASH_STEPS } from '../lib/splashStatus'

function mockReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduce,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

afterEach(() => { cleanup(); vi.useRealTimers() })
beforeEach(() => mockReducedMotion(false))

describe('Splash', () => {
  it('mostra a marca, tagline e o primeiro status', () => {
    const { getByText } = render(<Splash />)
    expect(getByText('Soaken')).toBeTruthy()
    expect(getByText('Mergulhe no idioma')).toBeTruthy()
    expect(getByText(SPLASH_STEPS[0])).toBeTruthy()
  })

  it('exibe o ícone real do app', () => {
    const { getByAltText } = render(<Splash />)
    expect(getByAltText('Soaken').getAttribute('src')).toContain('soaken-512.png')
  })

  it('cicla o texto de status ao longo do tempo', () => {
    vi.useFakeTimers()
    const { getByText, queryByText } = render(<Splash />)
    expect(getByText(SPLASH_STEPS[0])).toBeTruthy()

    act(() => { vi.advanceTimersByTime(1400 + 200) })  // 1 ciclo (1400) + fade (200)
    expect(queryByText(SPLASH_STEPS[0])).toBeNull()
    expect(getByText(SPLASH_STEPS[1])).toBeTruthy()
  })

  it('com prefers-reduced-motion NÃO cicla o status (sem timer)', () => {
    mockReducedMotion(true)
    vi.useFakeTimers()
    const { getByText } = render(<Splash />)
    act(() => { vi.advanceTimersByTime(5000) })
    expect(getByText(SPLASH_STEPS[0])).toBeTruthy()  // permanece no primeiro
  })
})
