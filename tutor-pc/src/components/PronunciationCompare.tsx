import { useState, useCallback, useRef } from 'react'
import { Volume2, Loader2, Activity } from 'lucide-react'
import { ttsAPI } from '../services/electron'
import { playClip } from '../lib/playClip'
import { decodeToMono } from '../lib/decodeAudio'
import { pitchContour, normalizeContour } from '../lib/pitch'
import { pitchComparisonScores, voicedCount, type PitchScore } from '../lib/pitchCompare'
import { useT, useUiLang } from '../lib/uiLangContext'
import type { SessionAttempt } from '../types'

interface Series { label: string; color: string; contour: number[] }
type Unavailable = 'decode' | 'no-pitch' | null
type TtsState = 'idle' | 'loading' | 'ready' | 'failed'

async function contourOf(dataUrl?: string): Promise<{ contour: number[]; decoded: boolean }> {
  if (!dataUrl) return { contour: [], decoded: false }
  const dec = await decodeToMono(dataUrl)
  if (!dec) return { contour: [], decoded: false }
  const frame = Math.max(512, Math.round(dec.sampleRate * 0.03))
  const hop = Math.round(frame / 2)
  return { contour: pitchContour(dec.samples, dec.sampleRate, frame, hop), decoded: true }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise(resolve => {
    const timer = window.setTimeout(() => resolve(null), ms)
    promise
      .then(value => { window.clearTimeout(timer); resolve(value) })
      .catch(() => { window.clearTimeout(timer); resolve(null) })
  })
}

function contourPath(contour: number[], width: number, height: number): string {
  const norm = normalizeContour(contour)
  if (norm.length <= 1) return ''
  let d = ''
  let penDown = false
  norm.forEach((v, i) => {
    if (v == null) { penDown = false; return }
    const x = (i / (norm.length - 1)) * width
    const y = height - v * (height - 6) - 3
    d += `${penDown ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)} `
    penDown = true
  })
  return d.trim()
}

export default function PronunciationCompare({ attempt }: { attempt: SessionAttempt }) {
  const t = useT()
  const uiLang = useUiLang()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [series, setSeries] = useState<Series[] | null>(null)
  const [scores, setScores] = useState<PitchScore[]>([])
  const [reason, setReason] = useState<Unavailable>(null)
  const [ttsState, setTtsState] = useState<TtsState>('idle')
  const runRef = useRef(0)

  const analyze = useCallback(async () => {
    const runId = ++runRef.current
    setLoading(true)
    setSeries(null)
    setScores([])
    setReason(null)
    setTtsState('idle')

    try {
      const [mine, orig] = await Promise.all([
        contourOf(attempt.audioUrl),
        contourOf(attempt.originalAudioUrl),
      ])
      if (runId !== runRef.current) return

      const baseSeries: Series[] = []
      if (voicedCount(mine.contour) > 0) baseSeries.push({ label: t('you'), color: '#3B82F6', contour: mine.contour })
      if (voicedCount(orig.contour) > 0) baseSeries.push({ label: 'Original', color: '#10B981', contour: orig.contour })

      setSeries(baseSeries)
      setScores(pitchComparisonScores({ user: mine.contour, original: orig.contour }, uiLang))
      setReason(baseSeries.length > 0 ? null : ((mine.decoded || orig.decoded) ? 'no-pitch' : 'decode'))
      setLoading(false)

      setTtsState('loading')
      const tts = await withTimeout(ttsAPI.speak(attempt.original, attempt.lang), 8000)
      const ttsUrl = tts?.ok ? tts.dataUrl : undefined
      const ttsContour = await contourOf(ttsUrl)
      if (runId !== runRef.current) return

      if (voicedCount(ttsContour.contour) > 0) {
        setSeries(prev => {
          const current = prev ?? []
          return [
            ...current.filter(item => item.label !== 'TTS'),
            { label: 'TTS', color: '#F59E0B', contour: ttsContour.contour },
          ]
        })
        setScores(pitchComparisonScores({ user: mine.contour, original: orig.contour, tts: ttsContour.contour }, uiLang))
        setReason(null)
        setTtsState('ready')
      } else {
        setTtsState('failed')
      }
    } finally {
      if (runId === runRef.current) setLoading(false)
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
        className="flex items-center gap-1 text-[11px] text-[#7fe3cf]/90 hover:text-[#7fe3cf] transition-colors"
      >
        <Activity size={12} /> {open ? t('hideComparison') : t('compareIntonation')}
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.04] p-2.5">
          {loading ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-xs text-[#f4cf93] font-medium">
                <Loader2 size={13} className="animate-spin shrink-0" />
                {t('analyzingRecording')}
              </div>
              <PitchSkeleton width={W} height={H} />
            </div>
          ) : (
            <>
              {series && series.length > 0 ? (
                <>
                  {scores.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-1.5">
                      {scores.map(item => (
                        <ScorePill key={item.id} score={item.score} label={item.label} />
                      ))}
                    </div>
                  )}
                  <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16 mb-1.5">
                    <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="#ffffff10" strokeWidth="1" />
                    {series.map((s, i) => (
                      <path key={i} d={contourPath(s.contour, W, H)} fill="none" stroke={s.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
                    ))}
                  </svg>
                  <p className="text-[10px] text-white/45 mb-1.5 leading-snug">{t('intonationLineHint')}</p>
                  {ttsState === 'loading' && (
                    <p className="flex items-center gap-1 text-[10px] text-white/45 mb-1.5">
                      <Loader2 size={10} className="animate-spin" /> {t('generatingTtsBg')}
                    </p>
                  )}
                  {ttsState === 'failed' && (
                    <p className="text-[10px] text-white/40 mb-1.5">{t('ttsUnavailableNow')}</p>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 mb-1.5">
                  <p className="text-[11px] text-white/60">
                    {reason === 'no-pitch'
                      ? t('noPitchDetected')
                      : reason === 'decode'
                        ? t('cantReadAudio')
                        : t('chartUnavailable')}
                  </p>
                  <button onClick={analyze} className="text-[11px] text-[#7fe3cf]/90 hover:text-[#7fe3cf] shrink-0">{t('tryAgain')}</button>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {attempt.audioUrl && <PlayChip label={t('you')} color="#3B82F6" onClick={() => playClip(attempt.audioUrl)} />}
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

function PitchSkeleton({ width, height }: { width: number; height: number }) {
  return (
    <div className="h-16 rounded-md bg-white/[0.05] overflow-hidden grid place-items-center">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full animate-pulse">
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="#ffffff12" strokeWidth="1" />
        <path
          d={`M0,46 C45,18 75,52 115,34 S195,16 235,42 ${width - 8},30 ${width},30`}
          fill="none" stroke="#F59E0B" strokeWidth="1.6"
          strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 6" opacity="0.55"
        />
      </svg>
    </div>
  )
}

function ScorePill({ score, label }: { score: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] border border-white/[0.08] px-2 py-0.5">
      <span className={[
        'text-[11px] font-bold',
        score >= 80 ? 'text-success' : score >= 55 ? 'text-warning' : 'text-danger',
      ].join(' ')}>{score}%</span>
      <span className="text-[10px] text-white/70">{label}</span>
    </span>
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
      <Volume2 size={11} className="text-white/50" />
      {label}
    </button>
  )
}
