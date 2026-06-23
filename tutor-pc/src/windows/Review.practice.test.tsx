// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const h = vi.hoisted(() => ({
  recordMistakes: vi.fn(async () => ({ ok: true })),
  addAttempt: vi.fn(),
  start: vi.fn(), stop: vi.fn(), cancel: vi.fn(),
  practiceState: 'idle' as 'idle' | 'countdown' | 'recording' | 'transcribing',
}))

// Review importa vários APIs no nível do módulo — mocka todos (só usamos store/session).
vi.mock('../services/electron', () => ({
  storeAPI: { recordMistakes: h.recordMistakes },
  sessionAPI: { addAttempt: h.addAttempt },
  ttsAPI: { speak: vi.fn(async () => ({ ok: false })) },
  tutorAPI: { variations: vi.fn() },
  windowAPI: { pendingReviewLang: vi.fn(async () => null) },
  onChannel: vi.fn(() => () => {}),
  settingsAPI: { getAll: vi.fn(async () => ({})) },
}))
vi.mock('../lib/playClip', () => ({ playClip: vi.fn() }))
vi.mock('../hooks/usePractice', () => ({
  usePractice: () => ({ state: h.practiceState, countdown: 3, start: h.start, stop: h.stop, cancel: h.cancel }),
  practiceMaxMs: () => 8000,
}))

import { SpeakPractice } from './Review'
import type { VocabCard } from '../types'

const card = (word: string, lang = 'en'): VocabCard =>
  ({ id: 'c1', word, lang, translation: '', romanization: '', ease: 2.5, interval: 1, reps: 0, due: 0 } as unknown as VocabCard)

/** Dispara o callback de resultado do gravador (como se o usuário tivesse falado). */
function speak(text: string, audioUrl = 'data:,') {
  const onResult = h.start.mock.calls.at(-1)![1] as (r: { text: string; audioUrl: string }) => void
  onResult({ text, audioUrl })
}

beforeEach(() => {
  cleanup()
  h.recordMistakes.mockClear()
  h.addAttempt.mockClear()
  h.start.mockReset(); h.stop.mockReset(); h.cancel.mockReset()
  h.practiceState = 'idle'
})

const user = () => userEvent.setup()

describe('Review — SpeakPractice (prática de fala)', () => {
  it('estado inicial: botão Falar + dica', () => {
    render(<SpeakPractice card={card('hello world')} uiLang="pt" />)
    expect(screen.getByRole('button', { name: /Falar/i })).toBeInTheDocument()
    expect(screen.getByText(/Fale a frase em voz alta/i)).toBeInTheDocument()
  })

  it('clicar Falar inicia a gravação com o hint da frase', async () => {
    const u = user()
    render(<SpeakPractice card={card('hello world')} uiLang="pt" />)
    await u.click(screen.getByRole('button', { name: /Falar/i }))
    expect(h.start).toHaveBeenCalledTimes(1)
    expect(h.start.mock.calls[0][2]).toBe('hello world')   // hint enviesa o Whisper
  })

  it('fala perfeita → 100%, registra a tentativa e NÃO grava erro', async () => {
    const u = user()
    render(<SpeakPractice card={card('hello world')} uiLang="pt" />)
    await u.click(screen.getByRole('button', { name: /Falar/i }))
    speak('hello world')

    expect(await screen.findByText('100%')).toBeInTheDocument()
    expect(h.addAttempt).toHaveBeenCalledTimes(1)
    expect(h.addAttempt.mock.calls[0][0]).toMatchObject({ original: 'hello world', spoken: 'hello world', score: 100, lang: 'en' })
    expect(h.recordMistakes).not.toHaveBeenCalled()
  })

  it('fala parcial → score menor + grava as palavras erradas', async () => {
    const u = user()
    render(<SpeakPractice card={card('hello world')} uiLang="pt" />)
    await u.click(screen.getByRole('button', { name: /Falar/i }))
    speak('hello')   // faltou "world" → ok=1/2 = 50%

    expect(await screen.findByText('50%')).toBeInTheDocument()
    expect(h.recordMistakes).toHaveBeenCalledWith([{ word: 'world', lang: 'en' }])
    expect(h.addAttempt).toHaveBeenCalledTimes(1)
  })

  it('transcrição vazia não gera resultado nem tentativa', async () => {
    const u = user()
    render(<SpeakPractice card={card('hello world')} uiLang="pt" />)
    await u.click(screen.getByRole('button', { name: /Falar/i }))
    speak('   ')
    expect(screen.queryByText(/%$/)).not.toBeInTheDocument()
    expect(h.addAttempt).not.toHaveBeenCalled()
  })

  it('"Tentar de novo" após o resultado grava de novo', async () => {
    const u = user()
    render(<SpeakPractice card={card('hello world')} uiLang="pt" />)
    await u.click(screen.getByRole('button', { name: /Falar/i }))
    speak('hello')
    await screen.findByText('50%')
    await u.click(screen.getByRole('button', { name: /Tentar de novo/i }))
    expect(h.start).toHaveBeenCalledTimes(2)
  })

  it('gravando: mostra Parar e o clique para a gravação', async () => {
    const u = user()
    h.practiceState = 'recording'
    render(<SpeakPractice card={card('hello world')} uiLang="pt" />)
    const stopBtn = screen.getByRole('button', { name: /Parar/i })
    expect(stopBtn).toBeInTheDocument()
    await u.click(stopBtn)
    expect(h.stop).toHaveBeenCalledTimes(1)
  })

  it('i18n (uiLang="en"): textos em inglês', async () => {
    const u = user()
    render(<SpeakPractice card={card('hello world')} uiLang="en" />)
    expect(screen.getByRole('button', { name: /Speak/i })).toBeInTheDocument()
    expect(screen.getByText(/Say the sentence aloud/i)).toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: /Speak/i }))
    speak('hello world')
    expect(await screen.findByText('100%')).toBeInTheDocument()
    expect(screen.getByText(/accuracy/i)).toBeInTheDocument()
  })
})
