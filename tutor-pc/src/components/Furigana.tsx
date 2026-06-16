import { useMemo } from 'react'
import { buildFurigana } from '../lib/furigana'
import { useT } from '../lib/uiLangContext'

// Furigana (japonês): mostra a frase com a leitura kana sobre os kanji (<ruby>).
// Cada segmento é CLICÁVEL → abre o dicionário daquele kanji/palavra. Só renderiza
// quando o alinhamento é confiável; caso contrário retorna null e a linha de Romaji
// abaixo serve de fallback — nunca exibe furigana errado.
export default function Furigana({ text, reading, onWordClick }: {
  text: string
  reading: string
  onWordClick?: (word: string, index: number, approxStart: number, approxEnd: number) => void
}) {
  const t = useT()
  const { segments, confident, hasKanji } = useMemo(() => buildFurigana(text, reading), [text, reading])

  // Razões aproximadas de posição (para o recorte de áudio por palavra), por nº de chars.
  const ranges = useMemo(() => {
    const lens = segments.map(s => Math.max(1, Array.from(s.text).length))
    const total = lens.reduce((a, b) => a + b, 0) || 1
    let acc = 0
    return lens.map(len => {
      const start = acc / total
      acc += len
      return { start, end: acc / total }
    })
  }, [segments])

  if (!confident || !hasKanji) return null

  return (
    <p className="flex flex-wrap items-end gap-x-0.5 gap-y-1 leading-none mt-0.5">
      {segments.map((seg, i) => {
        const clickable = !!onWordClick
        const range = ranges[i] ?? { start: 0, end: 1 }
        const body = seg.kanji
          ? (
            <ruby className="text-[18px]">
              {seg.text}
              <rt className="text-[10px] text-primary/70 font-mono">{seg.reading}</rt>
            </ruby>
          )
          : <span className="text-[18px]">{seg.text}</span>
        return (
          <button
            key={i}
            type="button"
            disabled={!clickable}
            onClick={clickable ? () => onWordClick!(seg.text, i, range.start, range.end) : undefined}
            title={clickable ? `${t('see')} "${seg.text}"` : undefined}
            className={[
              'inline-flex rounded px-0.5 transition-colors font-semibold',
              clickable ? 'cursor-pointer hover:bg-primary/10' : 'cursor-default',
              seg.kanji ? 'text-foreground' : 'text-foreground/80',
            ].join(' ')}
          >
            {body}
          </button>
        )
      })}
    </p>
  )
}
