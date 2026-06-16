// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const h = vi.hoisted(() => ({
  converse: vi.fn(),
  speak: vi.fn(async () => ({ ok: false })),
  // controle do gravador mockado
  start: vi.fn(),
  stop: vi.fn(),
  cancel: vi.fn(),
  addAttempt: vi.fn(),
  recordMistakes: vi.fn(async () => ({ ok: true })),
  recordTokenUsage: vi.fn(async () => ({ ok: true })),
  tokenUsageSummary: vi.fn(async () => ({
    totalTokens: 0,
    todayTokens: 0,
    monthTokens: 0,
    callCount: 0,
    recent: [],
  })),
  practiceState: 'idle',
  remainingMs: 90_000,
}))

vi.mock('../services/electron', () => ({
  tutorAPI: { converse: h.converse },
  ttsAPI: { speak: h.speak },
  storeAPI: { recordMistakes: h.recordMistakes, recordTokenUsage: h.recordTokenUsage, tokenUsageSummary: h.tokenUsageSummary },
  sessionAPI: { addAttempt: h.addAttempt },
  listeningAPI: { pause: vi.fn(), resume: vi.fn() },
}))
vi.mock('../lib/playClip', () => ({ playClip: vi.fn() }))
vi.mock('../hooks/usePractice', () => ({
  usePractice: () => ({ state: h.practiceState, countdown: 3, remainingMs: h.remainingMs, start: h.start, stop: h.stop, cancel: h.cancel }),
  practiceMaxMs: () => 20_000,
}))

import ProfessorChat from './ProfessorChat'
import { UiLangProvider } from '../lib/uiLangContext'

const turn = (question: string, extra: Record<string, unknown> = {}) =>
  ({ ok: true, result: { question, ...extra } })

/** Simula o usuário falando: dispara o callback de resultado do gravador com o texto transcrito. */
function speakAnswer(text: string) {
  const onResult = h.start.mock.calls.at(-1)![1] as (r: { text: string; audioUrl: string }) => void
  onResult({ text, audioUrl: 'data:,' })
}

beforeEach(() => {
  cleanup()
  h.converse.mockReset()
  h.start.mockReset(); h.stop.mockReset(); h.cancel.mockReset()
  h.addAttempt.mockClear(); h.recordMistakes.mockClear()
  h.recordTokenUsage.mockClear(); h.tokenUsageSummary.mockClear()
  h.speak.mockResolvedValue({ ok: false })
  h.practiceState = 'idle'
  h.remainingMs = 90_000
})

const user = () => userEvent.setup()

describe('ProfessorChat — speaking (sem digitação)', () => {
  it('NÃO tem campo de digitação; tem botão de FALAR', async () => {
    h.converse.mockResolvedValueOnce(turn('Q1?'))
    render(<ProfessorChat lang="ko" context={['ctx']} onClose={vi.fn()} />)
    await screen.findByText('Q1?')
    expect(screen.queryByLabelText(/Sua resposta/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Falar/i })).toBeInTheDocument()
  })

  it('faz a 1ª pergunta ao abrir e o professor FALA (TTS)', async () => {
    h.converse.mockResolvedValueOnce(turn('오늘 뭐 봤어요?', { translation: 'O que assistiu?' }))
    render(<ProfessorChat lang="ko" context={['안녕']} onClose={vi.fn()} />)
    expect(await screen.findByText('오늘 뭐 봤어요?')).toBeInTheDocument()
    await waitFor(() => expect(h.speak).toHaveBeenCalledWith('오늘 뭐 봤어요?', 'ko'))
    expect(h.converse.mock.calls[0][0]).toMatchObject({ userMessage: '', context: ['안녕'] })
  })

  it('espera o contexto chegar e inicia com todas as frases da sessao', async () => {
    const fullContext = Array.from({ length: 11 }, (_, i) => `ctx ${i + 1}`)
    h.converse.mockResolvedValueOnce(turn('Q sobre tudo?'))
    const { rerender } = render(<ProfessorChat open lang="ko" context={[]} onClose={vi.fn()} />)
    expect(h.converse).not.toHaveBeenCalled()

    rerender(<ProfessorChat open lang="ko" context={fullContext} onClose={vi.fn()} />)

    await screen.findByText('Q sobre tudo?')
    expect(h.converse).toHaveBeenCalledTimes(1)
    expect(h.converse.mock.calls[0][0]).toMatchObject({ userMessage: '', context: fullContext })
  })

  it('mostra contexto usado, mensagens e frases da sessao', async () => {
    h.converse.mockResolvedValueOnce(turn('Q1?'))
    render(<ProfessorChat lang="ko" context={['ctx 1', 'ctx 2']} onClose={vi.fn()} />)
    await screen.findByText('Q1?')
    expect(screen.getByText(/Contexto usado/i)).toBeInTheDocument()
    expect(screen.getByText(/1 mensagens/i)).toBeInTheDocument()
    expect(screen.getAllByText(/2 frases/i).length).toBeGreaterThan(0)
  })

  it('registra o gasto estimado de tokens do professor', async () => {
    h.converse.mockResolvedValueOnce(turn('Q1?', { translation: 'Pergunta 1' }))
    render(<ProfessorChat lang="ko" context={['ctx']} onClose={vi.fn()} />)
    await screen.findByText('Q1?')
    await waitFor(() => expect(h.recordTokenUsage).toHaveBeenCalledTimes(1))
    const calls = h.recordTokenUsage.mock.calls as unknown as Array<[{ feature: string; lang: string; totalTokens: number }]>
    const usage = calls[0][0]
    expect(usage).toMatchObject({
      feature: 'professor',
      lang: 'ko',
    })
    expect(usage.totalTokens).toBeGreaterThan(0)
  })

  it('compacta contexto antigo antes das proximas chamadas', async () => {
    const u = user()
    const context = Array.from({ length: 20 }, (_, i) => `ctx ${i + 1}`)
    h.converse
      .mockResolvedValueOnce(turn('Q1?'))
      .mockResolvedValueOnce(turn('Q2?'))

    render(<ProfessorChat lang="ko" context={context} onClose={vi.fn()} />)
    await screen.findByText('Q1?')
    await u.click(screen.getByRole('button', { name: /Compactar/i }))
    expect(screen.getByText(/Compactado:/i)).toBeInTheDocument()

    await u.click(screen.getByRole('button', { name: /Falar/i }))
    speakAnswer('answer')
    await screen.findByText('Q2?')

    const second = h.converse.mock.calls[1][0]
    expect(second.context.length).toBeLessThan(context.length)
    expect(second.context[0]).toContain('Resumo compactado')
  })

  it('preserva a conversa ao esconder e reabrir sem chamar o professor de novo', async () => {
    h.converse.mockResolvedValueOnce(turn('Q1?'))
    const { rerender } = render(<ProfessorChat open lang="ko" context={['ctx']} onClose={vi.fn()} />)
    await screen.findByText('Q1?')

    rerender(<ProfessorChat open={false} lang="ko" context={['ctx']} onClose={vi.fn()} />)
    expect(screen.queryByText('Q1?')).not.toBeInTheDocument()

    rerender(<ProfessorChat open lang="ko" context={['ctx']} onClose={vi.fn()} />)
    expect(screen.getByText('Q1?')).toBeInTheDocument()
    expect(h.converse).toHaveBeenCalledTimes(1)
  })

  it('falar uma resposta vira bolha do aluno + feedback + próxima pergunta', async () => {
    const u = user()
    h.converse
      .mockResolvedValueOnce(turn('Q1?'))
      .mockResolvedValueOnce(turn('Q2?', { feedback: { better: '더 자연스럽게', models: ['모델 A'] } }))
    render(<ProfessorChat lang="ko" context={['ctx']} onClose={vi.fn()} />)
    await screen.findByText('Q1?')

    await u.click(screen.getByRole('button', { name: /Falar/i }))
    expect(h.start).toHaveBeenCalledTimes(1)               // iniciou a gravação
    speakAnswer('저는 영화 봤어요')                          // transcrição volta

    expect(await screen.findByText('저는 영화 봤어요')).toBeInTheDocument()  // bolha do aluno
    expect(await screen.findByText('더 자연스럽게')).toBeInTheDocument()       // feedback
    expect(screen.getByText('모델 A')).toBeInTheDocument()
    expect(screen.getByText('Q2?')).toBeInTheDocument()

    const second = h.converse.mock.calls[1][0]
    expect(second.userMessage).toBe('저는 영화 봤어요')
    expect(second.history).toEqual([{ role: 'assistant', text: 'Q1?' }])
  })

  it('permite praticar a melhor forma de responder do feedback', async () => {
    const u = user()
    h.converse.mockResolvedValueOnce(turn('Q1?', {
      feedback: { better: 'I think he wants to ask her on a date.', models: [] },
    }))
    render(<ProfessorChat lang="en" context={['ctx']} onClose={vi.fn()} />)
    await screen.findByText('I think he wants to ask her on a date.')

    await u.click(screen.getByRole('button', { name: /Praticar/i }))

    expect(h.start).toHaveBeenCalledTimes(1)
    expect(h.start.mock.calls[0][2]).toBe('I think he wants to ask her on a date.')
  })

  it('mostra tempo restante e deixa claro que parar envia a resposta', async () => {
    h.practiceState = 'recording'
    h.remainingMs = 87_000
    h.converse.mockResolvedValueOnce(turn('Q1?'))
    render(<ProfessorChat lang="en" context={['ctx']} onClose={vi.fn()} />)

    expect(await screen.findByRole('button', { name: /Parar e enviar/i })).toBeInTheDocument()
    expect(screen.getByText(/1:27 restantes/i)).toBeInTheDocument()
  })

  it('transcrição vazia não envia nada', async () => {
    const u = user()
    h.converse.mockResolvedValueOnce(turn('Q1?'))
    render(<ProfessorChat lang="ko" context={['ctx']} onClose={vi.fn()} />)
    await screen.findByText('Q1?')
    await u.click(screen.getByRole('button', { name: /Falar/i }))
    speakAnswer('   ')
    expect(h.converse).toHaveBeenCalledTimes(1)   // não chamou de novo
  })

  it('nao aplica limite de mensagens dentro do modal', async () => {
    // O gate de 50 frases fica na entrada do Tutor Board, nao dentro da conversa.
    h.converse.mockResolvedValueOnce(turn('Q1?'))
    render(<ProfessorChat lang="ko" context={['ctx']} onClose={vi.fn()} />)
    expect(await screen.findByText('Q1?')).toBeInTheDocument()
    expect(screen.queryByText(/limite de 1 mensagens atingido/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Falar/i })).toBeInTheDocument()
  })

  it('mostra o que ajustar quando o professor retorna issue', async () => {
    h.converse.mockResolvedValueOnce(turn('Q1?', {
      feedback: {
        issue: 'Use past tense here.',
        better: 'I watched a movie yesterday.',
        models: [],
      },
    }))
    render(<ProfessorChat lang="en" context={['ctx']} onClose={vi.fn()} />)

    expect(await screen.findByText(/O que ajustar/i)).toBeInTheDocument()
    expect(screen.getByText('Use past tense here.')).toBeInTheDocument()
    expect(screen.getByText('I watched a movie yesterday.')).toBeInTheDocument()
  })

  it('fechar chama onClose', async () => {
    const u = user()
    const onClose = vi.fn()
    h.converse.mockResolvedValueOnce(turn('Q1?'))
    render(<ProfessorChat lang="ko" context={['ctx']} onClose={onClose} />)
    await screen.findByText('Q1?')
    await u.click(screen.getByTitle('Fechar'))
    expect(onClose).toHaveBeenCalled()
  })

  it('i18n (uiLang="en"): rótulos do chat em inglês', async () => {
    h.converse.mockResolvedValueOnce(turn('Q1?', { feedback: { issue: 'Use past tense.', better: 'I watched a movie.', models: [] } }))
    render(
      <UiLangProvider value="en">
        <ProfessorChat lang="en" context={['ctx']} onClose={vi.fn()} />
      </UiLangProvider>,
    )
    await screen.findByText('Q1?')
    expect(screen.getByRole('button', { name: /Speak/i })).toBeInTheDocument()
    expect(screen.getByText(/Voice chat — based on/i)).toBeInTheDocument()
    expect(screen.getByText('Context used')).toBeInTheDocument()         // TokenBudgetMeter
    expect(screen.getByRole('button', { name: /Compact/i })).toBeInTheDocument()
    expect(screen.getByText('What to adjust')).toBeInTheDocument()
    expect(screen.getByTitle('Close')).toBeInTheDocument()
  })
})
