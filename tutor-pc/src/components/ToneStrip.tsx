import { syllableTones, toneColor, toneGlyphPath } from '../lib/pinyinTone'
import { useT } from '../lib/uiLangContext'

// Visualização do tom (mandarim): cada sílaba do Pinyin com um glifo da FORMA do tom
// (1=plano alto, 2=sobe, 3=desce-sobe, 4=desce) e a cor padrão de tom (Pleco/Hanping),
// com o número do tom em subscrito. Cada sílaba é CLICÁVEL → consulta o caractere Hanzi
// correspondente (alinhado 1:1 com as sílabas, como é o normal em chinês).
export default function ToneStrip({ pinyin, hanzi, onWordClick }: {
  pinyin: string
  hanzi?: string
  onWordClick?: (word: string, index: number, approxStart: number, approxEnd: number) => void
}) {
  const t = useT()
  const syllables = pinyin.trim().split(/\s+/).filter(Boolean)
  if (syllables.length === 0) return null
  const tones = syllableTones(pinyin)

  // Alinha caractere Hanzi ↔ sílaba (só se a contagem bater).
  const han = hanzi ? Array.from(hanzi).filter(ch => /\p{Script=Han}/u.test(ch)) : []
  const aligned = han.length === syllables.length ? han : null

  const W = 16, H = 9

  return (
    <div className="flex flex-wrap items-end gap-x-2.5 gap-y-1 mt-0.5">
      {syllables.map((syl, i) => {
        const tone = tones[i] ?? 0
        const color = toneColor(tone)
        const char = aligned ? aligned[i] : undefined
        const clickable = !!(char && onWordClick)
        return (
          <button
            key={i}
            type="button"
            disabled={!clickable}
            onClick={clickable ? () => onWordClick!(char!, i, i / syllables.length, (i + 1) / syllables.length) : undefined}
            title={clickable ? `${t('see')} "${char}"` : undefined}
            className={[
              'inline-flex flex-col items-center leading-none rounded px-0.5 transition-colors',
              clickable ? 'cursor-pointer hover:bg-primary/10' : 'cursor-default',
            ].join(' ')}
          >
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible mb-0.5">
              <path
                d={toneGlyphPath(tone, W, H)}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-[13px] font-mono" style={{ color }}>
              {syl}
              {tone ? <sub className="text-[8px] opacity-60">{tone}</sub> : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}
