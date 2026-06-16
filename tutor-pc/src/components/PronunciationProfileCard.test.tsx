// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const h = vi.hoisted(() => ({
  mistakes: vi.fn(async () => [] as Array<{ word: string; lang: string; count: number; lastAt: number }>),
  speak: vi.fn(async () => ({ ok: false })),
}))

vi.mock('../services/electron', () => ({
  storeAPI: { mistakes: h.mistakes },
  ttsAPI: { speak: h.speak },
  listeningAPI: { pause: vi.fn(), resume: vi.fn() },
}))
vi.mock('../lib/playClip', () => ({ playClip: vi.fn() }))

import PronunciationProfileCard from './PronunciationProfileCard'

const rec = (word: string, count: number, lang = 'ko') => ({ word, lang, count, lastAt: 0 })

beforeEach(() => {
  cleanup()
  h.mistakes.mockReset().mockResolvedValue([])
  h.speak.mockReset().mockResolvedValue({ ok: false })
})

const user = () => userEvent.setup()

describe('PronunciationProfileCard', () => {
  it('estado vazio quando não há erros', async () => {
    render(<PronunciationProfileCard lang="ko" />)
    expect(await screen.findByText(/Pratique algumas frases/i)).toBeInTheDocument()
  })

  it('coreano: mostra grupos de batchim + palavras a treinar', async () => {
    h.mistakes.mockResolvedValue([rec('한국어', 3), rec('발', 2)])
    render(<PronunciationProfileCard lang="ko" />)
    expect(await screen.findByText(/Sons que você mais erra/i)).toBeInTheDocument()
    // 한국어 → batchim ㄴ e ㄱ; 발 → ㄹ
    expect(screen.getByText(/Batchim ㄴ/)).toBeInTheDocument()
    expect(screen.getByText(/Batchim ㄱ/)).toBeInTheDocument()
    expect(screen.getByText(/Batchim ㄹ/)).toBeInTheDocument()
    // palavras a treinar (mais frequente primeiro)
    expect(screen.getByText('한국어')).toBeInTheDocument()
    expect(screen.getByText('발')).toBeInTheDocument()
  })

  it('clicar numa palavra toca o TTS', async () => {
    const u = user()
    h.mistakes.mockResolvedValue([rec('물', 1)])
    render(<PronunciationProfileCard lang="ko" />)
    await u.click(await screen.findByRole('button', { name: /물/ }))
    expect(h.speak).toHaveBeenCalledWith('물', 'ko')
  })

  it('botão Treinar dispara onTrain', async () => {
    const u = user()
    const onTrain = vi.fn()
    h.mistakes.mockResolvedValue([rec('red', 2, 'en')])
    render(<PronunciationProfileCard lang="en" onTrain={onTrain} />)
    await u.click(await screen.findByRole('button', { name: /Treinar pronúncia/i }))
    expect(onTrain).toHaveBeenCalledWith(['red'])   // passa as palavras do top pra treinar
  })

  it('chinês: sem grupos, mas mostra as palavras', async () => {
    h.mistakes.mockResolvedValue([rec('你好', 3, 'zh')])
    render(<PronunciationProfileCard lang="zh" />)
    expect(await screen.findByText('你好')).toBeInTheDocument()
    expect(screen.queryByText(/Sons que você mais erra/i)).not.toBeInTheDocument()
  })

  it('em inglês (uiLang="en") mostra os textos traduzidos', async () => {
    h.mistakes.mockResolvedValue([rec('한국어', 3)])
    render(<PronunciationProfileCard lang="ko" uiLang="en" onTrain={() => {}} />)
    expect(await screen.findByText('Your pronunciation profile')).toBeInTheDocument()
    expect(screen.getByText('Sounds you miss most')).toBeInTheDocument()
    expect(screen.getByText('Words to train')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Train pronunciation/i })).toBeInTheDocument()
  })

  it('estado vazio em inglês', async () => {
    render(<PronunciationProfileCard lang="ko" uiLang="en" />)
    expect(await screen.findByText(/Practice a few sentences/i)).toBeInTheDocument()
  })

  it('recarrega ao trocar de idioma', async () => {
    const { rerender } = render(<PronunciationProfileCard lang="ko" />)
    await screen.findByText(/Pratique algumas frases/i)
    h.mistakes.mockClear()
    rerender(<PronunciationProfileCard lang="en" />)
    expect(h.mistakes).toHaveBeenCalledWith('en')
  })
})
