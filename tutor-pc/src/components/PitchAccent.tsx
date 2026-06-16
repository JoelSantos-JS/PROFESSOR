import { useMemo } from 'react'
import { splitMora } from '../lib/kana'
import { pitchPattern, accentTypeLabel } from '../lib/pitchAccent'
import { useUiLang } from '../lib/uiLangContext'

// Visualização do acento tonal (japonês): contorno alto/baixo por mora, com um ponto
// extra (oco) para a partícula seguinte — é nele que heiban e odaka se distinguem.
// O ponto onde a linha CAI é o downstep (acento).
export default function PitchAccent({ kana, accent }: { kana: string; accent: number }) {
  const uiLang = useUiLang()
  const moras = useMemo(() => splitMora(kana), [kana])
  const pat = useMemo(() => pitchPattern(moras.length, accent), [moras.length, accent])
  if (moras.length === 0) return null

  const step = 24, padX = 10, padTop = 6, yHigh = padTop, yLow = padTop + 14, r = 3.5
  const cols = moras.length + 1 // + partícula
  const W = padX * 2 + step * cols
  const H = yLow + 22 // espaço para o texto da mora

  const xOf = (i: number) => padX + step * i + step / 2
  const yOf = (high: boolean) => (high ? yHigh : yLow)

  // Pontos: uma altura por mora + a partícula.
  const pts = pat.moras.map((p, i) => ({ x: xOf(i), y: yOf(p === 'H'), high: p === 'H' }))
  const particle = { x: xOf(moras.length), y: yOf(pat.particleHigh), high: pat.particleHigh }
  const all = [...pts, particle]
  const linePath = all.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ')

  return (
    <div className="inline-flex flex-col gap-0.5" title={accentTypeLabel(pat.type, uiLang)}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
        <path d={linePath} fill="none" stroke="var(--color-primary, #9A6A1E)" strokeWidth="1.5" strokeLinejoin="round" />
        {pts.map((pt, i) => (
          <circle key={i} cx={pt.x} cy={pt.y} r={r} fill="var(--color-primary, #9A6A1E)" />
        ))}
        {/* Partícula: ponto OCO — alto = não cai (heiban), baixo = cai (odaka/naka/atama) */}
        <circle cx={particle.x} cy={particle.y} r={r} fill="white" stroke="var(--color-primary, #9A6A1E)" strokeWidth="1.5" />
        {/* Rótulos das moras */}
        {moras.map((m, i) => (
          <text key={i} x={xOf(i)} y={H - 4} textAnchor="middle" className="fill-foreground" fontSize="11">{m}</text>
        ))}
        <text x={xOf(moras.length)} y={H - 4} textAnchor="middle" className="fill-muted" fontSize="10">が</text>
      </svg>
      <span className="text-[10px] text-muted leading-none">{accentTypeLabel(pat.type, uiLang)}</span>
    </div>
  )
}
