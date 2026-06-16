import { useState } from 'react'
import { uniqueHanChars } from '../lib/cjk'
import { tutorAPI } from '../services/electron'
import { useT } from '../lib/uiLangContext'
import type { CharDecomposition } from '../types'

// Decomposição de caracteres Han (Hanzi/Kanji): mostra os caracteres da palavra como
// chips; ao clicar, busca radicais/componentes + mnemônico sob demanda (1 chamada por
// caractere). A técnica-chave para memorizar caracteres.
export default function CharBreakdown({ word, lang }: { word: string; lang: string }) {
  const t = useT()
  const chars = uniqueHanChars(word)
  const [active, setActive] = useState<string | null>(null)
  const [cache, setCache] = useState<Record<string, CharDecomposition | 'loading' | 'error'>>({})

  if (chars.length === 0) return null

  const select = async (ch: string) => {
    if (active === ch) { setActive(null); return }
    setActive(ch)
    if (cache[ch] && cache[ch] !== 'error') return
    setCache(prev => ({ ...prev, [ch]: 'loading' }))
    const res = await tutorAPI.decompose(ch, lang).catch(() => null)
    setCache(prev => ({ ...prev, [ch]: res?.ok && res.result ? res.result : 'error' }))
  }

  const current = active ? cache[active] : undefined

  return (
    <div className="mt-1.5 border-t border-border/50 pt-1.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider text-muted/50">{t('decompose')}</span>
        {chars.map(ch => (
          <button
            key={ch}
            onClick={() => select(ch)}
            className={[
              'text-[18px] leading-none px-1.5 py-1 rounded-md border transition-colors',
              active === ch
                ? 'bg-primary/15 border-primary/50 text-primary'
                : 'border-border/70 text-foreground hover:bg-primary/10',
            ].join(' ')}
            title={`${t('decompose')} "${ch}"`}
          >
            {ch}
          </button>
        ))}
      </div>

      {active && (
        <div className="mt-1.5 rounded-md bg-surface-2/60 px-2.5 py-2">
          {current === 'loading' || current === undefined ? (
            <p className="text-xs text-muted/60 italic">{t('analyzingWord')} {active}...</p>
          ) : current === 'error' ? (
            <p className="text-xs text-danger/70 italic">{t('cantDecompose')} {active}.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-2xl leading-none">{current.character}</span>
                {current.reading && <span className="text-xs text-primary/70 font-mono">{current.reading}</span>}
                {current.meaning && <span className="text-xs text-foreground/90">{current.meaning}</span>}
                {current.strokes ? <span className="text-[10px] text-muted/60">{current.strokes} {t('strokes')}</span> : null}
              </div>
              {current.components.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {current.components.map((c, i) => (
                    <span key={i} className="inline-flex items-baseline gap-1 rounded bg-surface px-1.5 py-0.5 border border-border/50">
                      <span className="text-base leading-none">{c.part}</span>
                      <span className="text-[11px] text-muted">{c.meaning}</span>
                      {c.reading && <span className="text-[10px] text-primary/60 font-mono">{c.reading}</span>}
                    </span>
                  ))}
                </div>
              )}
              {current.mnemonic && (
                <p className="text-[11px] text-muted/80 italic">🧠 {current.mnemonic}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
