// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const h = vi.hoisted(() => ({
  speak: vi.fn(async () => ({ ok: false })),
  start: vi.fn(), stop: vi.fn(), cancel: vi.fn(),
  decode: vi.fn(async () => null),
}))

vi.mock('../services/electron', () => ({
  ttsAPI: { speak: h.speak },
  listeningAPI: { pause: vi.fn(), resume: vi.fn() },
  settingsAPI: { getAll: vi.fn(async () => ({ learnLanguages: '' })) },
}))
vi.mock('../lib/playClip', () => ({ playClip: vi.fn() }))
vi.mock('../lib/decodeAudio', () => ({ decodeToMono: h.decode }))
vi.mock('../hooks/usePractice', () => ({
  usePractice: () => ({ state: 'idle', countdown: 3, start: h.start, stop: h.stop, cancel: h.cancel }),
  practiceMaxMs: () => 8000,
}))

import PronunciationDiagnostic from './PronunciationDiagnostic'
import { diagnosticSet } from '../lib/diagnosticSentences'

async function speakReading(text: string) {
  const onResult = h.start.mock.calls.at(-1)![1] as (r: { text: string; audioUrl: string }) => Promise<void>
  await onResult({ text, audioUrl: 'data:,' })
}

beforeEach(() => {
  cleanup()
  h.speak.mockReset().mockResolvedValue({ ok: false })
  h.start.mockReset(); h.stop.mockReset(); h.cancel.mockReset()
  h.decode.mockReset().mockResolvedValue(null)
})

const user = () => userEvent.setup()
const firstEn = diagnosticSet('en')[0].text

describe('PronunciationDiagnostic', () => {
  it('mostra a 1ª frase de diagnóstico + foco + botão Falar', () => {
    render(<PronunciationDiagnostic lang="en" onClose={vi.fn()} />)
    expect(screen.getByText(firstEn)).toBeInTheDocument()
    expect(screen.getByText(/foco:/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Falar/i })).toBeInTheDocument()
  })

  it('ler a frase certa → score alto + dicas', async () => {
    const u = user()
    render(<PronunciationDiagnostic lang="en" onClose={vi.fn()} />)
    await u.click(screen.getByRole('button', { name: /Falar/i }))
    expect(h.start).toHaveBeenCalledTimes(1)
    await speakReading(firstEn)                       // leitura perfeita

    expect(await screen.findByText('100%')).toBeInTheDocument()
    expect(screen.getByText(/Excelente/)).toBeInTheDocument()
    expect(screen.getByText(/Dicas/i)).toBeInTheDocument()
  })

  it('palavras erradas baixam o score', async () => {
    const u = user()
    render(<PronunciationDiagnostic lang="en" onClose={vi.fn()} />)
    await u.click(screen.getByRole('button', { name: /Falar/i }))
    await speakReading('i think answer')             // faltam palavras

    expect(await screen.findByText(/Dicas/i)).toBeInTheDocument()   // resultado apareceu
    expect(screen.queryByText('100%')).not.toBeInTheDocument()      // não foi perfeito
  })

  it('transcrição vazia não gera resultado', async () => {
    const u = user()
    render(<PronunciationDiagnostic lang="en" onClose={vi.fn()} />)
    await u.click(screen.getByRole('button', { name: /Falar/i }))
    await speakReading('   ')
    expect(screen.queryByText(/Dicas/i)).not.toBeInTheDocument()
  })

  it('ouvir o modelo chama o TTS', async () => {
    const u = user()
    render(<PronunciationDiagnostic lang="en" onClose={vi.fn()} />)
    await u.click(screen.getByTitle(/Ouvir o modelo/i))
    expect(h.speak).toHaveBeenCalledWith(firstEn, 'en')
  })

  it('próxima frase troca o texto', async () => {
    const u = user()
    render(<PronunciationDiagnostic lang="en" onClose={vi.fn()} />)
    expect(screen.getByText(firstEn)).toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: /Próxima/i }))
    expect(screen.queryByText(firstEn)).not.toBeInTheDocument()
    expect(screen.getByText(diagnosticSet('en')[1].text)).toBeInTheDocument()
  })

  it('idioma sem set mostra aviso', () => {
    render(<PronunciationDiagnostic lang="th" onClose={vi.fn()} />)
    expect(screen.getByText(/ainda não disponível/i)).toBeInTheDocument()
  })

  it('fechar chama onClose', async () => {
    const u = user()
    const onClose = vi.fn()
    render(<PronunciationDiagnostic lang="en" onClose={onClose} />)
    await u.click(screen.getByTitle('Fechar'))
    expect(onClose).toHaveBeenCalled()
  })
})

describe('PronunciationDiagnostic — modo treino (palavras fracas)', () => {
  const items = [
    { text: 'red', focus: 'Som “r”' },
    { text: 'think', focus: 'Som “th”' },
  ]

  it('usa as palavras dadas em vez do set genérico', () => {
    render(<PronunciationDiagnostic lang="en" onClose={vi.fn()} items={items} title="Treinar suas palavras fracas" />)
    expect(screen.getByText('red')).toBeInTheDocument()        // 1ª palavra fraca
    expect(screen.getByText('Treinar suas palavras fracas')).toBeInTheDocument()
    expect(screen.queryByText(firstEn)).not.toBeInTheDocument()  // não mostra a frase genérica
    expect(screen.getByText(/foco:.*Som “r”/)).toBeInTheDocument()
  })

  it('avança para a próxima palavra fraca', async () => {
    const u = user()
    render(<PronunciationDiagnostic lang="en" onClose={vi.fn()} items={items} />)
    await u.click(screen.getByRole('button', { name: /Próxima/i }))
    expect(screen.getByText('think')).toBeInTheDocument()
  })

  it('pontua a leitura da palavra fraca (lê certo → 100%)', async () => {
    const u = user()
    render(<PronunciationDiagnostic lang="en" onClose={vi.fn()} items={items} />)
    await u.click(screen.getByRole('button', { name: /Falar/i }))
    await speakReading('red')
    expect(await screen.findByText('100%')).toBeInTheDocument()
  })

  it('items vazio cai no set genérico', () => {
    render(<PronunciationDiagnostic lang="en" onClose={vi.fn()} items={[]} />)
    expect(screen.getByText(firstEn)).toBeInTheDocument()
  })
})

describe('PronunciationDiagnostic — i18n (uiLang="en")', () => {
  it('mostra os textos em inglês', () => {
    render(<PronunciationDiagnostic lang="en" uiLang="en" onClose={vi.fn()} />)
    expect(screen.getByText('Pronunciation diagnosis')).toBeInTheDocument()
    expect(screen.getByText(/Read aloud — focus:/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Speak/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Next/i })).toBeInTheDocument()
  })

  it('resultado em inglês: rótulo de score + Tips', async () => {
    const u = user()
    render(<PronunciationDiagnostic lang="en" uiLang="en" onClose={vi.fn()} />)
    await u.click(screen.getByRole('button', { name: /Speak/i }))
    await speakReading(firstEn)
    expect(await screen.findByText('Excellent')).toBeInTheDocument()
    expect(screen.getByText('Tips')).toBeInTheDocument()
    expect(screen.getByText('Word by word')).toBeInTheDocument()
  })
})
