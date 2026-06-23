// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { TranscriptList } from './FloatingBar'
import { UiLangProvider } from '../lib/uiLangContext'

// jsdom não implementa scrollIntoView (o feed chama no efeito de auto-scroll)
beforeEach(() => { Element.prototype.scrollIntoView = vi.fn() })
afterEach(cleanup)

function renderFeed(props: Parameters<typeof TranscriptList>[0]) {
  return render(
    <UiLangProvider value="en">
      <TranscriptList {...props} />
    </UiLangProvider>,
  )
}

describe('TranscriptList — transcrição ao vivo', () => {
  it('linhas finalizadas aparecem como texto fixo', () => {
    const { container } = renderFeed({ lines: ['primeira', 'segunda'], interim: '', processing: false, error: null })
    expect(container.textContent).toContain('primeira')
    expect(container.textContent).toContain('segunda')
    expect(container.querySelector('[data-testid="interim-line"]')).toBeNull()
  })

  it('mostra a linha AO VIVO (interim) com cursor enquanto fala', () => {
    const { getByTestId, container } = renderFeed({
      lines: ['linha anterior'],
      interim: 'Daqui a pouco a bola',
      processing: false,
      error: null,
    })
    const live = getByTestId('interim-line')
    expect(live.textContent).toContain('Daqui a pouco a bola')
    expect(container.querySelector('.animate-pulse')).not.toBeNull()  // cursor
  })

  it('a prévia ao vivo substitui as bolinhas de processamento', () => {
    const { queryByTestId } = renderFeed({ lines: [], interim: 'falando agora', processing: true, error: null })
    expect(queryByTestId('interim-line')).not.toBeNull()
    expect(queryByTestId('processing-dots')).toBeNull()  // tem prévia → sem bolinhas
  })

  it('mostra bolinhas só quando finaliza SEM prévia', () => {
    const { queryByTestId } = renderFeed({ lines: [], interim: '', processing: true, error: null })
    expect(queryByTestId('processing-dots')).not.toBeNull()
  })

  it('estado vazio mostra a dica', () => {
    const { getByText } = renderFeed({ lines: [], interim: '', processing: false, error: null })
    expect(getByText(/press listen/i)).toBeTruthy()
  })

  it('erro é renderizado', () => {
    const { getByText } = renderFeed({ lines: [], interim: '', processing: false, error: 'falha na captura' })
    expect(getByText('falha na captura')).toBeTruthy()
  })
})
