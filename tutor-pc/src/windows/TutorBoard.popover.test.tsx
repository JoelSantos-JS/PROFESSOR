// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

// TutorBoard importa muitos APIs de IPC no nível do módulo — mocka todos.
vi.mock('../services/electron', () => ({
  audioAPI: { transcribe: vi.fn() },
  onChannel: vi.fn(() => () => {}),
  ttsAPI: { speak: vi.fn(async () => ({ ok: false })) },
  listeningAPI: { pause: vi.fn(), resume: vi.fn() },
  sessionAPI: { addAttempt: vi.fn() },
  tutorAPI: { decompose: vi.fn(async () => ({ ok: false })), lookup: vi.fn() },
  storeAPI: { recordMistakes: vi.fn(async () => ({ ok: true })) },
}))

import { WordPopover, ComprehensionBadge, SyncedTokens } from './TutorBoard'
import { UiLangProvider } from '../lib/uiLangContext'

beforeEach(() => cleanup())
const user = () => userEvent.setup()

const lookupZh = {
  word: '好', wordIndex: 0, approxStart: 0, approxEnd: 1, loading: false,
  data: { word: '好', romanization: 'hǎo', meanings: ['bom', 'gostar'], note: 'nota de uso' },
}

function renderPopover(props: Partial<Parameters<typeof WordPopover>[0]> = {}) {
  const onSetStatus = vi.fn()
  const onClose = vi.fn()
  const r = render(
    <WordPopover
      lookup={lookupZh as never}
      lang="zh"
      totalWords={3}
      onSetStatus={onSetStatus}
      onClose={onClose}
      {...props}
    />,
  )
  return { ...r, onSetStatus, onClose }
}

describe('ComprehensionBadge', () => {
  it('100% sem palavras novas', () => {
    render(<ComprehensionBadge pct={100} newWords={0} />)
    expect(screen.getByText(/100%/)).toBeInTheDocument()
    expect(screen.queryByText('+1')).not.toBeInTheDocument()
  })
  it('"+1" no ponto ideal (1 palavra nova)', () => {
    render(<ComprehensionBadge pct={50} newWords={1} />)
    expect(screen.getByText(/50%/)).toBeInTheDocument()
    expect(screen.getByText('+1')).toBeInTheDocument()
  })
})

describe('WordPopover — conteúdo', () => {
  it('mostra palavra, romanização, significados e nota', () => {
    renderPopover()
    expect(screen.getAllByText('好').length).toBeGreaterThan(0)
    expect(screen.getByText('hǎo')).toBeInTheDocument()
    expect(screen.getByText('bom')).toBeInTheDocument()
    expect(screen.getByText('gostar')).toBeInTheDocument()
    expect(screen.getByText(/nota de uso/)).toBeInTheDocument()
  })
  it('estado de carregamento', () => {
    renderPopover({ lookup: { ...lookupZh, loading: true, data: undefined } as never })
    expect(screen.getByText(/Buscando significado/i)).toBeInTheDocument()
  })
})

describe('WordPopover — marcar status (alimenta a % de compreensão)', () => {
  it('clicar "Conheço" marca known', async () => {
    const u = user()
    const { onSetStatus } = renderPopover()
    await u.click(screen.getByRole('button', { name: /Conheço/ }))
    expect(onSetStatus).toHaveBeenCalledWith('known')
  })
  it('clicar no status já ativo desmarca ("")', async () => {
    const u = user()
    const { onSetStatus } = renderPopover({ status: 'known' })
    await u.click(screen.getByRole('button', { name: /Conheço/ }))
    expect(onSetStatus).toHaveBeenCalledWith('')
  })
  it('Aprendendo e Ignorar', async () => {
    const u = user()
    const { onSetStatus } = renderPopover()
    await u.click(screen.getByRole('button', { name: /Aprendendo/ }))
    await u.click(screen.getByRole('button', { name: /Ignorar/ }))
    expect(onSetStatus).toHaveBeenCalledWith('learning')
    expect(onSetStatus).toHaveBeenCalledWith('ignore')
  })
  it('fechar chama onClose', async () => {
    const u = user()
    const { onClose } = renderPopover()
    await u.click(screen.getByTitle('Fechar'))
    expect(onClose).toHaveBeenCalled()
  })
})

describe('WordPopover — decomposição de Han', () => {
  it('palavra com Hanzi mostra os chips de decompor', () => {
    renderPopover()
    expect(screen.getByText(/Decompor/i)).toBeInTheDocument()
  })
})

describe('SyncedTokens — romanização clicável', () => {
  // "한 팀장 ... 알지?" ↔ romanização alinhada 1:1
  const trans = ['한', '팀장', '지켜보는', '눈들', '많은', '거', '알지']
  const roman = 'Han timjang jikyeoboneun nundeul manheun geo alji?'

  it('clicar num token romanizado abre a PALAVRA original alinhada', async () => {
    const u = user()
    const onWordClick = vi.fn()
    render(<p><SyncedTokens text={roman} progress={-1} alignWords={trans} onWordClick={onWordClick} /></p>)
    await u.click(screen.getByText('timjang'))
    expect(onWordClick).toHaveBeenCalledTimes(1)
    expect(onWordClick.mock.calls[0][0]).toBe('팀장')   // palavra original, não a romanização
    expect(onWordClick.mock.calls[0][1]).toBe(1)        // índice 1
  })

  it('o 1º token mapeia para a 1ª palavra; o último para a última', async () => {
    const u = user()
    const onWordClick = vi.fn()
    render(<p><SyncedTokens text={roman} progress={-1} alignWords={trans} onWordClick={onWordClick} /></p>)
    await u.click(screen.getByText('Han'))
    expect(onWordClick.mock.calls[0][0]).toBe('한')
    await u.click(screen.getByText('alji?'))
    expect(onWordClick.mock.calls[1][0]).toBe('알지')
  })

  it('sem alinhamento 1:1 → NÃO clicável (não chama onWordClick)', async () => {
    const u = user()
    const onWordClick = vi.fn()
    // 2 palavras de transcrição vs 3 tokens romanizados → não alinha
    render(<p><SyncedTokens text="aa bb cc" progress={-1} alignWords={['x', 'y']} onWordClick={onWordClick} /></p>)
    await u.click(screen.getByText('bb'))
    expect(onWordClick).not.toHaveBeenCalled()
  })

  it('sem onWordClick → renderiza os tokens mas não quebra', () => {
    render(<p><SyncedTokens text="Han timjang" progress={-1} /></p>)
    expect(screen.getByText('Han')).toBeInTheDocument()
    expect(screen.getByText('timjang')).toBeInTheDocument()
  })
})

describe('i18n (uiLang="en") — WordPopover e ComprehensionBadge em inglês', () => {
  it('WordPopover traduz rótulos e ações', async () => {
    const u = user()
    const onSetStatus = vi.fn()
    render(
      <UiLangProvider value="en">
        <WordPopover lookup={lookupZh as never} lang="zh" totalWords={3} onSetStatus={onSetStatus} onClose={vi.fn()} />
      </UiLangProvider>,
    )
    expect(screen.getByText('Mark')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /I know/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Learning/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ignore/ })).toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: /I know/ }))
    expect(onSetStatus).toHaveBeenCalledWith('known')
  })

  it('estado de carregamento em inglês', () => {
    render(
      <UiLangProvider value="en">
        <WordPopover lookup={{ ...lookupZh, loading: true, data: undefined } as never} lang="zh" totalWords={3} onSetStatus={vi.fn()} onClose={vi.fn()} />
      </UiLangProvider>,
    )
    expect(screen.getByText(/Looking up meaning/i)).toBeInTheDocument()
  })

  it('ComprehensionBadge: título "+1" em inglês', () => {
    render(<UiLangProvider value="en"><ComprehensionBadge pct={50} newWords={1} /></UiLangProvider>)
    const badge = screen.getByText('+1').parentElement as HTMLElement
    expect(badge.getAttribute('title')).toMatch(/Sweet spot/i)
  })
})

describe('WordPopover — responsividade (classes)', () => {
  it('o container não estoura: max-w-full + break-words + overflow-hidden', () => {
    const { container } = renderPopover()
    const root = container.firstChild as HTMLElement
    expect(root.className).toMatch(/max-w-full/)
    expect(root.className).toMatch(/break-words/)
    expect(root.className).toMatch(/overflow-hidden/)
  })
  it('a linha "Marcar" quebra (flex-wrap)', () => {
    renderPopover()
    const row = screen.getByText('Marcar').parentElement as HTMLElement
    expect(row.className).toMatch(/flex-wrap/)
  })
  it('o cabeçalho (palavra + ações) quebra (flex-wrap)', () => {
    renderPopover()
    const wordEl = screen.getAllByText('好').find(el => el.className.includes('break-all')) as HTMLElement
    expect(wordEl.parentElement?.className).toMatch(/flex-wrap/)
  })
})
