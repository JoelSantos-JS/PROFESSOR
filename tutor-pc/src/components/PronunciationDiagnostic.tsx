import { useState, useEffect, useMemo } from 'react'
import { X, Mic, Square, Loader2, Volume2, RefreshCw, ArrowRight, Activity } from 'lucide-react'
import { ttsAPI, settingsAPI } from '../services/electron'
import { playClip } from '../lib/playClip'
import { usePractice, practiceMaxMs } from '../hooks/usePractice'
import { decodeToMono } from '../lib/decodeAudio'
import { pitchContour } from '../lib/pitch'
import { diagnosticSet, hasDiagnosticSet, type DiagnosticItem } from '../lib/diagnosticSentences'
import { diagnoseReading, pronunciationTips, scoreLabel, type PronunciationDiagnosis } from '../lib/pronunciationDiagnosis'
import { languageNameFor, baseLang } from '../lib/languages'
import { uiText, type AppLanguage } from '../lib/uiLanguage'
import DiffView from './DiffView'

// Diagnóstico de pronúncia: "leia esta frase" → grava → score (palavra + entonação) + onde
// você desviou + dicas. Diferencial vs apps que só viram texto: a IA OUVE o seu som.

async function contourOf(dataUrl?: string): Promise<number[]> {
  if (!dataUrl) return []
  const dec = await decodeToMono(dataUrl)
  if (!dec) return []
  const frame = Math.max(512, Math.round(dec.sampleRate * 0.03))
  return pitchContour(dec.samples, dec.sampleRate, frame, Math.round(frame / 2))
}

export default function PronunciationDiagnostic({ lang, uiLang = 'pt', onClose, items, title }: {
  lang: string
  uiLang?: AppLanguage
  onClose: () => void
  items?: DiagnosticItem[]   // quando dado, treina ESTAS palavras/frases (ex.: pontos fracos) em vez do set genérico
  title?: string
}) {
  const t = (key: Parameters<typeof uiText>[1]) => uiText(uiLang, key)
  const drillMode = !!(items && items.length > 0)
  const heading = title ?? t('pronDiagTitle')
  const [idx, setIdx] = useState(0)
  const [result, setResult] = useState<PronunciationDiagnosis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const { state, countdown, start, stop, cancel } = usePractice()

  // Idioma do teste: começa no que abriu, mas o usuário pode TROCAR (chips). No modo "drill"
  // (treino de palavras fracas específicas) o idioma é fixo.
  const [selectedLang, setSelectedLang] = useState(baseLang(lang))
  const [learn, setLearn] = useState<string[]>([])
  useEffect(() => {
    settingsAPI.getAll()
      .then(s => setLearn((s.learnLanguages || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean)))
      .catch(() => {})
  }, [])
  // Opções = idiomas que ela aprende (+ o que abriu + inglês), só os que têm conjunto de frases.
  const langOptions = useMemo(
    () => Array.from(new Set([baseLang(lang), ...learn, 'en'].filter(Boolean))).filter(hasDiagnosticSet),
    [lang, learn],
  )
  const switchLang = (code: string) => { setSelectedLang(code); setIdx(0); setResult(null); cancel() }

  const set = items && items.length > 0 ? items : diagnosticSet(selectedLang)

  const current = set[idx]
  const recording    = state === 'recording'
  const counting     = state === 'countdown'
  const transcribing = state === 'transcribing'
  const busy = analyzing || transcribing

  const playModel = async () => {
    const res = await ttsAPI.speak(current.text, selectedLang).catch(() => null)
    if (res?.ok && res.dataUrl) playClip(res.dataUrl)
  }

  const record = () => {
    if (busy || !current) return
    setResult(null)
    start(practiceMaxMs(current.text), async ({ text, audioUrl }) => {
      const spoken = (text ?? '').trim()
      if (!spoken) return
      setAnalyzing(true)
      let userContour: number[] = [], refContour: number[] = []
      try {
        const tts = await ttsAPI.speak(current.text, selectedLang).catch(() => null)
        const [u, r] = await Promise.all([
          contourOf(audioUrl),
          tts?.ok ? contourOf(tts.dataUrl) : Promise.resolve([]),
        ])
        userContour = u; refContour = r
      } catch { /* segue só com palavras */ }
      setResult(diagnoseReading({ reference: current.text, spoken, userContour, refContour }))
      setAnalyzing(false)
    })
  }

  const nextSentence = () => {
    cancel()
    setResult(null)
    setIdx(i => (i + 1) % Math.max(1, set.length))
  }

  const scoreColor = (s: number) => s >= 85 ? 'text-success' : s >= 70 ? 'text-primary' : s >= 50 ? 'text-warning' : 'text-danger'

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={onClose}>
      <div className="paper-card w-full max-w-[560px] max-h-[88vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Cabeçalho */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border shrink-0">
          <span className="grid place-items-center w-8 h-8 rounded-xl bg-primary/15 text-primary"><Activity size={17} /></span>
          <div className="min-w-0">
            <h2 className="display-title text-lg leading-none">{heading}</h2>
            <p className="text-[11px] text-muted mt-0.5">
              {`${languageNameFor(selectedLang, uiLang)} — ${drillMode ? t('pronDiagSubDrill') : t('pronDiagSubAi')}`}
            </p>
          </div>
          <button onClick={onClose} className="ml-auto text-muted hover:text-danger transition-colors" title={t('close')}><X size={16} /></button>
        </div>

        {/* Seletor de idioma do teste (não aparece no modo "drill", que tem palavras fixas) */}
        {!drillMode && langOptions.length > 1 && (
          <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border shrink-0 flex-wrap">
            {langOptions.map(code => (
              <button
                key={code}
                onClick={() => switchLang(code)}
                className={[
                  'px-2.5 py-1 rounded-full text-xs font-semibold transition-colors',
                  selectedLang === code
                    ? 'bg-primary text-white'
                    : 'bg-surface-2 text-muted hover:bg-primary/10 hover:text-primary',
                ].join(' ')}
              >
                {languageNameFor(code, uiLang)}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3">
          {!current ? (
            <p className="text-sm text-muted">{t('pronUnavailable')} {languageNameFor(selectedLang, uiLang)}.</p>
          ) : (
            <>
              {/* Frase a ler */}
              <div className="paper-card px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider text-muted/60 mb-1">{t('readAloudFocus')} {current.focus}</p>
                <div className="flex items-start gap-2">
                  <p className="text-xl font-semibold text-foreground flex-1 break-words">{current.text}</p>
                  <button onClick={playModel} title={t('listenModel')} className="text-muted hover:text-primary shrink-0 mt-1"><Volume2 size={16} /></button>
                </div>
              </div>

              {/* Resultado */}
              {result && (
                <div className="paper-card px-4 py-3 space-y-2.5">
                  <div className="flex items-end gap-3">
                    <span className={['display-title text-4xl leading-none', scoreColor(result.overall)].join(' ')}>{result.overall}%</span>
                    <div className="pb-0.5">
                      <span className={['text-sm font-bold', scoreColor(result.overall)].join(' ')}>{scoreLabel(result.overall, uiLang)}</span>
                      <p className="text-[11px] text-muted">
                        {t('words')} {result.wordScore}%{result.intonationScore != null ? ` · ${t('intonation')} ${result.intonationScore}%` : ''}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted/60 mb-1">{t('wordByWord')}</p>
                    <DiffView diff={result.diff} />
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted/60 mb-1">{t('tips')}</p>
                    <ul className="list-disc list-inside text-[13px] text-foreground/90 space-y-0.5">
                      {pronunciationTips(selectedLang, result.weakWords, uiLang).map((tip, i) => <li key={i}>{tip}</li>)}
                    </ul>
                  </div>
                </div>
              )}

              {busy && (
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <Loader2 size={13} className="animate-spin" /> {transcribing ? t('transcribing') : t('analyzing')}
                </div>
              )}
            </>
          )}
        </div>

        {/* Controles */}
        {current && (
          <div className="flex items-center justify-center gap-2 px-3 py-3.5 border-t border-border shrink-0">
            <button
              onClick={recording ? stop : record}
              disabled={busy || counting}
              aria-label={recording ? t('stop') : t('speak')}
              className={[
                'flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors disabled:opacity-50',
                recording ? 'bg-danger text-white hover:bg-danger/90' : 'pill-primary',
              ].join(' ')}
            >
              {counting ? <>{countdown}…</>
                : recording ? <><Square size={14} /> {t('stop')}</>
                : busy ? <><Loader2 size={14} className="animate-spin" /> …</>
                : <><Mic size={15} /> {result ? t('tryAgain') : t('speak')}</>}
            </button>
            {result && (
              <button onClick={() => { setResult(null); record() }} className="pill-button pill-ghost px-3 py-2 text-sm" title={t('redo')}>
                <RefreshCw size={14} />
              </button>
            )}
            {set.length > 1 && (
              <button onClick={nextSentence} className="pill-button pill-ghost px-3.5 py-2 text-sm" title={t('nextSentence')}>
                {t('next')} <ArrowRight size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
