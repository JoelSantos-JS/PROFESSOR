import { toneColor, toneGlyphPath } from '../lib/pinyinTone'
import { useT } from '../lib/uiLangContext'
import type { UiKey } from '../lib/uiLanguage'

// Legenda: o que cada traço/cor de tom significa (mostrada no topo do Tutor Board
// quando o conteúdo é mandarim).
const TONES: Array<{ n: number; labelKey: UiKey }> = [
  { n: 1, labelKey: 'toneFlat' },
  { n: 2, labelKey: 'toneRise' },
  { n: 3, labelKey: 'toneFallRise' },
  { n: 4, labelKey: 'toneFall' },
  { n: 0, labelKey: 'toneNeutral' },
]

export default function ToneLegend() {
  const t = useT()
  const W = 16, H = 9
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg bg-surface-2/60 border border-border/60 px-3 py-2 mt-2">
      <span className="label-eyebrow">{t('tones')}</span>
      {TONES.map(tone => (
        <span key={tone.n} className="inline-flex items-center gap-1.5">
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible shrink-0">
            <path
              d={toneGlyphPath(tone.n, W, H)}
              fill="none"
              stroke={toneColor(tone.n)}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-[11px] font-medium" style={{ color: toneColor(tone.n) }}>
            {tone.n ? `${tone.n}º` : t('toneNeutral')}
          </span>
          <span className="text-[11px] text-muted">{t(tone.labelKey)}</span>
        </span>
      ))}
    </div>
  )
}
