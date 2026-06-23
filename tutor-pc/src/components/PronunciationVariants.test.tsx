// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, fireEvent, waitFor } from '@testing-library/react'

const native = vi.fn()
const audio = vi.fn(async (_url: string) => ({ ok: true, dataUrl: 'data:audio/mpeg;base64,NAT' }))
const speakVariant = vi.fn(async () => ({ ok: true, dataUrl: 'data:audio/mpeg;base64,TTS' }))
const playClip = vi.fn()

vi.mock('../services/electron', () => ({
  pronunciationAPI: { native: (w: string, l: string) => native(w, l), audio: (u: string) => audio(u) },
  ttsAPI: { speakVariant: () => speakVariant() },
}))
vi.mock('../lib/playClip', () => ({ playClip: (...a: unknown[]) => playClip(...a) }))

import PronunciationVariants from './PronunciationVariants'
import { UiLangProvider } from '../lib/uiLangContext'

beforeEach(() => { native.mockReset(); audio.mockClear(); speakVariant.mockClear(); playClip.mockClear() })
afterEach(cleanup)

const renderWith = (props: { word: string; lang: string }) =>
  render(<UiLangProvider value="en"><PronunciationVariants {...props} /></UiLangProvider>)

describe('PronunciationVariants — nativos reais', () => {
  it('mostra os nativos retornados e toca o áudio ao clicar', async () => {
    native.mockResolvedValue({ ok: true, items: [
      { url: 'https://x/a.mp3', source: 'forvo', country: 'United States', attribution: 'Forvo · us1' },
      { url: 'https://x/b.wav', source: 'wikimedia', speaker: 'Wodencafe', attribution: 'Lingua Libre · CC' },
    ] })
    const { getByText } = renderWith({ word: 'water', lang: 'en' })
    await waitFor(() => expect(getByText('United States')).toBeTruthy())  // Forvo → país
    expect(getByText('Voice 2')).toBeTruthy()                            // Wikimedia → número (não o username)

    fireEvent.click(getByText('United States'))
    await waitFor(() => expect(audio).toHaveBeenCalledWith('https://x/a.mp3'))
    await waitFor(() => expect(playClip).toHaveBeenCalledWith('data:audio/mpeg;base64,NAT'))
    expect(speakVariant).not.toHaveBeenCalled()  // tinha nativo → não usa TTS
  })

  it('SEM nativos → cai nos sotaques por TTS (US/UK/AU) e toca via TTS', async () => {
    native.mockResolvedValue({ ok: true, items: [] })
    const { getByText } = renderWith({ word: 'water', lang: 'en' })
    await waitFor(() => expect(getByText(/US/)).toBeTruthy())
    expect(getByText(/UK/)).toBeTruthy()

    fireEvent.click(getByText(/UK/))
    await waitFor(() => expect(speakVariant).toHaveBeenCalled())
    await waitFor(() => expect(playClip).toHaveBeenCalledWith('data:audio/mpeg;base64,TTS'))
  })

  it('sem nativos e sem variação de sotaque (ja) → não renderiza nada', async () => {
    native.mockResolvedValue({ ok: true, items: [] })
    const { container } = renderWith({ word: 'こんにちは', lang: 'ja' })
    await waitFor(() => expect(container.querySelector('.animate-spin')).toBeNull())  // saiu do loading
    expect(container.textContent).toBe('')
  })

  it('palavra vazia não busca nem renderiza', () => {
    const { container } = renderWith({ word: '   ', lang: 'en' })
    expect(native).not.toHaveBeenCalled()
    expect(container.textContent).toBe('')
  })
})
