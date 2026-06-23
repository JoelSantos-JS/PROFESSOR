// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const h = vi.hoisted(() => ({
  lookup: vi.fn(async (word: string) => ({ ok: true, result: { word, meanings: [`meaning of ${word}`] } })),
  knownWords: vi.fn(async () => ({} as Record<string, string>)),
}))

vi.mock('../services/electron', () => ({
  audioAPI: { transcribe: vi.fn() },
  onChannel: vi.fn(() => () => {}),
  ttsAPI: { speak: vi.fn(async () => ({ ok: false })), speakVariant: vi.fn(async () => ({ ok: false })) },
  pronunciationAPI: { native: vi.fn(async () => ({ ok: true, items: [] })), audio: vi.fn(async () => ({ ok: false })) },
  listeningAPI: { pause: vi.fn(), resume: vi.fn() },
  sessionAPI: { addAttempt: vi.fn() },
  tutorAPI: { lookup: h.lookup, decompose: vi.fn(async () => ({ ok: false })) },
  storeAPI: { recordMistakes: vi.fn(async () => ({ ok: true })), addVocab: vi.fn(async () => undefined), knownWords: h.knownWords },
  settingsAPI: { getAll: vi.fn(async () => ({})) },
}))
vi.mock('../lib/playClip', () => ({ playClip: vi.fn(), playSlice: vi.fn(), playRatioSlice: vi.fn() }))
vi.mock('../hooks/usePractice', () => ({
  usePractice: () => ({ state: 'idle', countdown: 3, start: vi.fn(), stop: vi.fn(), cancel: vi.fn() }),
  practiceMaxMs: () => 8000,
}))

import { EntryCard } from './TutorBoard'
import { KnownWordsProvider } from '../hooks/useKnownWords'
import type { TutorAnalysis } from '../types'

const entry = (over: Partial<TutorAnalysis> = {}): TutorAnalysis =>
  ({ transcript: 'alpha beta', contentLanguage: 'en', vocab: [], tip: '', ...over } as TutorAnalysis)

function renderCard(over: Partial<TutorAnalysis> = {}, nativeLang = 'pt') {
  return render(
    <KnownWordsProvider>
      <EntryCard entry={entry(over)} index={1} nativeLang={nativeLang} />
    </KnownWordsProvider>,
  )
}

// Spans clicáveis da transcrição (têm o title de "clique para ouvir/ver").
const transcriptWords = () => screen.getAllByTitle(/Clique para ouvir e ver/i)

beforeEach(() => {
  cleanup()
  h.lookup.mockClear()
  h.knownWords.mockClear()
})

const user = () => userEvent.setup()

describe('EntryCard — cache do lookup de palavra', () => {
  it('reclicar a mesma palavra usa o cache (não re-consulta a IA)', async () => {
    const u = user()
    renderCard()
    await u.click(transcriptWords()[0])                       // alpha → consulta
    expect(await screen.findByText('meaning of alpha')).toBeInTheDocument()
    await u.click(transcriptWords()[1])                       // beta → consulta
    expect(await screen.findByText('meaning of beta')).toBeInTheDocument()
    await u.click(transcriptWords()[0])                       // alpha de novo → CACHE
    expect(await screen.findByText('meaning of alpha')).toBeInTheDocument()

    expect(h.lookup).toHaveBeenCalledTimes(2)                 // só alpha + beta, não 3
    expect(h.lookup.mock.calls.map(c => c[0])).toEqual(['alpha', 'beta'])
  })

  it('palavras distintas consultam uma vez cada', async () => {
    const u = user()
    renderCard()
    await u.click(transcriptWords()[0])
    await screen.findByText('meaning of alpha')
    await u.click(transcriptWords()[1])
    await screen.findByText('meaning of beta')
    expect(h.lookup).toHaveBeenCalledTimes(2)
  })

  it('lookup que falha NÃO é cacheado (tenta de novo ao reclicar)', async () => {
    h.lookup.mockResolvedValueOnce({ ok: false } as never)
    const u = user()
    renderCard()
    await u.click(transcriptWords()[0])                       // alpha → falha (não cacheia)
    await u.click(transcriptWords()[1])                       // beta → ok
    await screen.findByText('meaning of beta')
    await u.click(transcriptWords()[0])                       // alpha de novo → consulta de novo
    expect(await screen.findByText('meaning of alpha')).toBeInTheDocument()
    expect(h.lookup.mock.calls.map(c => c[0])).toEqual(['alpha', 'beta', 'alpha'])
  })
})

describe('EntryCard — legenda na língua materna (translation)', () => {
  it('mostra a legenda nativa (label do idioma) junto com a de inglês', () => {
    renderCard({ contentLanguage: 'zh', transcript: '你好', englishText: 'hello', translation: 'olá' }, 'pt')
    expect(screen.getByText('hello')).toBeInTheDocument()     // EN (de sempre)
    expect(screen.getByText('olá')).toBeInTheDocument()       // legenda nativa
    expect(screen.getByText('PT')).toBeInTheDocument()        // label do idioma materno
  })

  it('usa o código do idioma materno como label (en → EN)', () => {
    renderCard({ contentLanguage: 'zh', transcript: '你好', translation: 'hello there' }, 'en')
    expect(screen.getByText('hello there')).toBeInTheDocument()
    expect(screen.getAllByText('EN').length).toBeGreaterThan(0)
  })

  it('omite a legenda nativa quando seria igual ao texto em inglês', () => {
    renderCard({ contentLanguage: 'zh', transcript: '你好', englishText: 'hello', translation: 'hello' }, 'pt')
    expect(screen.getByText('hello')).toBeInTheDocument()     // só a de EN
    expect(screen.queryByText('PT')).not.toBeInTheDocument()  // sem a nativa redundante
  })

  it('omite a legenda nativa quando seria igual ao próprio transcript', () => {
    renderCard({ contentLanguage: 'en', transcript: 'hello world', translation: 'hello world' }, 'pt')
    expect(screen.queryByText('PT')).not.toBeInTheDocument()
  })

  it('sem translation → sem legenda nativa', () => {
    renderCard({ contentLanguage: 'en', transcript: 'alpha beta' }, 'pt')
    expect(screen.queryByText('PT')).not.toBeInTheDocument()
  })
})
