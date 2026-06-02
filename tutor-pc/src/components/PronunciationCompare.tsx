import { useState, useCallback } from 'react'
import { Volume2, Loader2, Activity } from 'lucide-react'
import { ttsAPI } from '../services/electron'
import { playClip } from '../lib/playClip'
import { decodeToMono } from '../lib/decodeAudio'
import { pitchContour, normalizeContour } from '../lib/pitch'
import type { SessionAttempt } from '../types'

interface Series { label: string; color: string; contour: number[] }

async function contourOf(dataUrl?: string): Promise<number[]> {
  if (!dataUrl) return []
  const dec = await decodeToMono(dataUrl)
  if (!dec) return []
  // frame ~30ms, hop ~15ms scaled to the clip's sample rate
  const frame = Math.max(512, Math.round(dec.sampleRate * 0.03))
  const hop   = Math.round(frame / 2)
  return pitchContour(dec.samples, dec.sampleRate, frame, hop)
}

/** Build an SVG path from a normalized contour, breaking the line on unvoiced gaps. */
function contourPath(contour: number[], width: number, height: number): string {
  const norm = normalizeContour(contour)
  if (norm.length <= 1) return ''
  let d = ''
  let penDown = false
  norm.forEach((v, i) => {
    if (v == null) { penDown = false; return }
    const x = (i / (norm.length - 1)) * width
    const y = height - v * (height - 6) - 3   // padding so it doesn't touch edges
    d += `${penDown ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)} `
    penDown = true
  })
  return d.trim()
}

export default function PronunciationCompare({ attempt }: { attempt: SessionAttempt }) {
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [series, setSeries]   = useState<Series[] | null>(null)

  const analyze = useCallback(async () => {
    setLoading(true)
    try {
      // Generate TTS for the original sentence on demand
      const tts = await ttsAPI.speak(attempt.original, attempt.lang).catch(() => null)
      const ttsUrl = tts?.ok ? tts.dataUrl : undefined

      const [mine, orig, ttsC] = await Promise.all([
        contourOf(attempt.audioUrl),
        contourOf(attempt.originalAudioUrl),
        contourOf(ttsUrl),
      ])
      // Include any source that decoded with at least one voiced frame.
      const s: Series[] = []
      if (mine.some(v => v > 0)) s.push({ label: 'Você',     color: '#3B82F6', contour: mine })
      if (orig.some(v => v > 0)) s.push({ label: 'Original', color: '#10B981', contour: orig })
      if (ttsC.some(v => v > 0)) s.push({ label: 'TTS',      color: '#F59E0B', contour: ttsC })
      setSeries(s)
    } finally {
      setLoading(false)
    }
  }, [attempt])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && !series) analyze()
  }

  const W = 300, H = 70

  return (
    <div className="mt-1.5">
      <button
        onClick={toggle}
        className="flex items-center gap-1 text-[11px] text-primary/80 hover:text-primary transition-colors"
      >
        <Activity size={12} /> {open ? 'Ocultar comparação' : 'Comparar entonação'}
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-white/[0.06] bg-surface-2/40 p-2.5">
          {loading ? (
            <p className="flex items-center gap-1.5 text-xs text-muted/70"><Loader2 size={12} className="animate-spin" /> Analisando entonação...</p>
          ) : (
            <>
              {/* Pitch contour overlay — only when we have data */}
              {series && series.length > 0 ? (
                <>
                  <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16 mb-1.5">
                    <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="#ffffff10" strokeWidth="1" />
                    {series.map((s, i) => (
                      <path key={i} d={contourPath(s.contour, W, H)} fill="none" stroke={s.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
                    ))}
                  </svg>
                  <p className="text-[10px] text-muted/50 mb-1.5 leading-snug">
                    A linha mostra a <b>entonação</b> (subidas/descidas do tom). Compare o formato da sua linha (azul) com a Original (verde).
                  </p>
                </>
              ) : (
                <div className="flex items-center gap-2 mb-1.5">
                  <p className="text-[11px] text-muted/60">Gráfico indisponível para este áudio — mas você pode comparar de ouvido:</p>
                  <button onClick={analyze} className="text-[11px] text-primary/80 hover:text-primary shrink-0">Tentar de novo</button>
                </div>
              )}

              {/* Play buttons — always available so you can compare by ear */}
              <div className="flex flex-wrap items-center gap-2">
                {attempt.audioUrl && <PlayChip label="Você"     color="#3B82F6" onClick={() => playClip(attempt.audioUrl)} />}
                {attempt.originalAudioUrl && <PlayChip label="Original" color="#10B981" onClick={() => playClip(attempt.originalAudioUrl)} />}
                <PlayChip label="TTS" color="#F59E0B" onClick={() => speakTts(attempt.original, attempt.lang)} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

async function speakTts(text: string, lang: string) {
  const res = await ttsAPI.speak(text, lang).catch(() => null)
  if (res?.ok && res.dataUrl) playClip(res.dataUrl)
}

function PlayChip({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-surface border border-white/[0.06] hover:bg-surface-2 transition-colors"
    >
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      <Volume2 size={11} className="text-muted" />
      {label}
    </button>
  )
}
