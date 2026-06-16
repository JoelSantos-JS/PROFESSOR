import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Loader2, Volume2, GraduationCap, Mic, Square, Activity } from 'lucide-react'
import { sessionAPI, storeAPI, tutorAPI, ttsAPI } from '../services/electron'
import { playClip } from '../lib/playClip'
import { practiceMaxMs, usePractice } from '../hooks/usePractice'
import TokenBudgetMeter from './TokenBudgetMeter'
import { estimateProfessorTurnUsage, summarizeProfessorTokenBudget } from '../lib/tokenBudget'
import { compactProfessorSession } from '../lib/sessionCompaction'
import { diffWords, scoreFromDiff } from '../lib/text'
import { useT } from '../lib/uiLangContext'
import DiffView from './DiffView'
import PronunciationCompare from './PronunciationCompare'
import type { DiffToken, ProfessorMessage, SessionAttempt, TokenUsageSummary } from '../types'

// Professor-IA de conversa ("language parent") — SPEAKING: o professor FALA (TTS) e o aluno
// responde FALANDO (grava → Whisper). Sem digitação. Spec: PROFESSOR_IA_CONVERSA.md

type Item =
  | { kind: 'question'; text: string; translation?: string }
  | { kind: 'answer'; text: string }
  | { kind: 'feedback'; issue?: string; better: string; models: string[] }

const PROFESSOR_RESPONSE_MAX_MS = 90_000

export default function ProfessorChat({ lang, context, open, onClose }: {
  lang: string
  context: string[]
  open?: boolean
  onClose: () => void
}) {
  const t = useT()
  const [items, setItems]     = useState<Item[]>([])
  const [history, setHistory] = useState<ProfessorMessage[]>([])
  const [sessionContext, setSessionContext] = useState<string[]>(() => context)
  const [compactNotice, setCompactNotice] = useState<string | null>(null)
  const [usageSummary, setUsageSummary] = useState<TokenUsageSummary | null>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const startedRef = useRef(false)
  const lastContextLengthRef = useRef(context.length)
  const dragRef = useRef<{ pointerId: number; dx: number; dy: number } | null>(null)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const isOpen = open ?? true

  const { state: recState, countdown, remainingMs, start, stop, cancel } = usePractice()
  const recording    = recState === 'recording'
  const counting     = recState === 'countdown'
  const transcribing = recState === 'transcribing'
  const recordingRemainingMs = remainingMs || PROFESSOR_RESPONSE_MAX_MS
  const recordingPct = Math.max(0, Math.min(100, (recordingRemainingMs / PROFESSOR_RESPONSE_MAX_MS) * 100))
  const tokenBudget = useMemo(
    () => summarizeProfessorTokenBudget({ context: sessionContext, history, lang }),
    [sessionContext, history, lang],
  )

  const speak = async (text: string) => {
    const res = await ttsAPI.speak(text, lang).catch(() => null)
    if (res?.ok && res.dataUrl) playClip(res.dataUrl)
  }

  const refreshUsageSummary = async () => {
    const tokenStore = storeAPI as unknown as { tokenUsageSummary?: typeof storeAPI.tokenUsageSummary }
    const summary = await tokenStore.tokenUsageSummary?.('professor').catch(() => null)
    if (summary) setUsageSummary(summary)
  }

  const recordTurnUsage = async (usage: ReturnType<typeof estimateProfessorTurnUsage>) => {
    const tokenStore = storeAPI as unknown as {
      recordTokenUsage?: typeof storeAPI.recordTokenUsage
    }
    await tokenStore.recordTokenUsage?.({ feature: 'professor', lang, ...usage })
    await refreshUsageSummary()
  }

  const ask = async (userMessage: string) => {
    setLoading(true); setError(null)
    const res = await tutorAPI.converse({ lang, context: sessionContext, history, userMessage }).catch(() => null)
    setLoading(false)
    if (!res?.ok || !res.result?.question) {
      if (!userMessage.trim()) startedRef.current = false
      setError((res && 'error' in res && res.error) || t('teacherUnavailable'))
      return
    }
    const turn = res.result
    const usage = estimateProfessorTurnUsage({
      context: sessionContext,
      history,
      userMessage,
      outputText: [
        turn.question,
        turn.translation,
        turn.feedback?.issue,
        turn.feedback?.better,
        ...(turn.feedback?.models ?? []),
      ].filter(Boolean).join('\n'),
      lang,
    })
    setItems(prev => [
      ...prev,
      ...(turn.feedback ? [{ kind: 'feedback', issue: turn.feedback.issue, better: turn.feedback.better, models: turn.feedback.models } as Item] : []),
      { kind: 'question', text: turn.question, translation: turn.translation },
    ])
    setHistory(prev => [
      ...prev,
      ...(userMessage.trim() ? [{ role: 'user', text: userMessage.trim() } as ProfessorMessage] : []),
      { role: 'assistant', text: turn.question },
    ])
    void speak(turn.question)   // o professor FALA a pergunta
    void recordTurnUsage(usage).catch(() => undefined)
  }

  const compactNow = () => {
    const before = summarizeProfessorTokenBudget({ context: sessionContext, history, lang })
    const result = compactProfessorSession(sessionContext, history)
    if (!result.summary) {
      setCompactNotice(t('notEnoughOldContext'))
      return
    }
    const after = summarizeProfessorTokenBudget({ context: result.context, history: result.history, lang })
    setSessionContext(result.context)
    setHistory(result.history)
    setCompactNotice(`${t('compacted')} ~${before.usedTokens} -> ~${after.usedTokens} tokens.`)
  }

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('button')) return
    const panel = event.currentTarget.closest('[data-professor-panel]') as HTMLElement | null
    if (!panel) return
    const rect = panel.getBoundingClientRect()
    dragRef.current = { pointerId: event.pointerId, dx: event.clientX - rect.left, dy: event.clientY - rect.top }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const drag = (event: React.PointerEvent<HTMLDivElement>) => {
    const info = dragRef.current
    if (!info || info.pointerId !== event.pointerId) return
    const maxX = Math.max(8, window.innerWidth - 320)
    const maxY = Math.max(8, window.innerHeight - 160)
    setPosition({
      x: Math.min(Math.max(8, event.clientX - info.dx), maxX),
      y: Math.min(Math.max(8, event.clientY - info.dy), maxY),
    })
  }

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
  }

  // 1ª pergunta ao abrir (guard contra StrictMode/double-mount).
  useEffect(() => {
    if (!isOpen || startedRef.current || sessionContext.length === 0) return
    startedRef.current = true
    void ask('')
  }, [isOpen, sessionContext.length]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void refreshUsageSummary()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (context.length <= lastContextLengthRef.current) return
    const fresh = context.slice(lastContextLengthRef.current)
    lastContextLengthRef.current = context.length
    setSessionContext(prev => [...prev, ...fresh])
  }, [context])

  useEffect(() => { bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' }) }, [items, loading])

  // Sempre retoma o listener / encerra o gravador ao fechar.
  useEffect(() => () => cancel(), [cancel])

  // Grava a resposta falada → transcreve → vira a fala do aluno → próxima pergunta.
  const record = () => {
    if (loading) return
    start(PROFESSOR_RESPONSE_MAX_MS, ({ text }) => {
      const answer = text.trim()
      if (!answer) return
      setItems(prev => [...prev, { kind: 'answer', text: answer }])
      void ask(answer)
    })
  }

  const close = () => {
    cancel()
    onClose()
  }

  const micDisabled = loading || counting || transcribing

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        data-professor-panel
        className="paper-card pointer-events-auto fixed w-[min(640px,calc(100vw-24px))] h-[min(85vh,calc(100vh-24px))] flex flex-col overflow-hidden"
        style={position.x || position.y
          ? { left: position.x, top: position.y }
          : { right: 16, top: 16 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div
          className="flex items-center gap-2.5 px-4 py-3 border-b border-border shrink-0 cursor-move"
          onPointerDown={beginDrag}
          onPointerMove={drag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <span className="grid place-items-center w-8 h-8 rounded-xl bg-primary/15 text-primary"><GraduationCap size={18} /></span>
          <div className="min-w-0">
            <h2 className="display-title text-lg leading-none">Professor</h2>
            <p className="text-[11px] text-muted mt-0.5">
              {t('voiceChatBasedOn')} {sessionContext.length} {t(sessionContext.length === 1 ? 'phrase' : 'phrases')} {t('fromThisSession')}
            </p>
          </div>
          <button onClick={close} className="ml-auto text-muted hover:text-danger transition-colors" title={t('close')}>
            <X size={16} />
          </button>
        </div>

        <div className="px-4 py-2 border-b border-border/70 bg-surface-2/45 shrink-0">
          <TokenBudgetMeter summary={tokenBudget} usage={usageSummary} onCompact={compactNow} />
          {compactNotice && (
            <p className="mt-1.5 text-[11px] text-muted">{compactNotice}</p>
          )}
        </div>

        {/* Mensagens */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2.5">
          {items.map((it, i) => <Bubble key={i} item={it} lang={lang} onSpeak={speak} />)}
          {loading && (
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <Loader2 size={13} className="animate-spin" /> {t('teacherThinking')}
            </div>
          )}
          {error && (
            <p className="text-xs text-danger">
              {error}{' '}
              <button onClick={() => ask('')} className="underline hover:text-danger/80">{t('tryAgain')}</button>
            </p>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Resposta por VOZ (sem digitação) */}
          <div className="flex flex-col items-center gap-1.5 px-3 py-4 border-t border-border shrink-0">
            <button
              onClick={recording ? stop : record}
              disabled={micDisabled}
              aria-label={recording ? t('stopAndSend') : t('speak')}
              className={[
                'flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors disabled:opacity-50',
                recording ? 'bg-danger text-white hover:bg-danger/90' : 'pill-primary',
              ].join(' ')}
            >
              {counting ? <>{countdown}…</>
                : recording ? <><Square size={14} /> {t('stopAndSend')}</>
                : transcribing ? <><Loader2 size={14} className="animate-spin" /> {t('transcribing')}</>
                : <><Mic size={15} /> {t('speak')}</>}
            </button>
            {recording && (
              <div className="w-full max-w-[280px]">
                <div className="h-1.5 rounded-full bg-border overflow-hidden">
                  <div className="h-full rounded-full bg-danger transition-all" style={{ width: `${recordingPct}%` }} />
                </div>
              </div>
            )}
            <p className="text-[11px] text-muted text-center">
              {recording
                ? `${formatDuration(recordingRemainingMs)} ${t('timeLeftHint')}`
                : counting
                  ? `${t('getReady')} ${countdown}`
                  : transcribing
                    ? t('sendingForTranscription')
                    : t('tapToAnswer')}
            </p>
          </div>
      </div>
    </div>
  )
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function Bubble({ item, lang, onSpeak }: { item: Item; lang: string; onSpeak: (t: string) => void }) {
  const t = useT()
  if (item.kind === 'answer') {
    return (
      <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary/15 border border-primary/25 px-3 py-2 text-sm text-foreground break-words">
        {item.text}
      </div>
    )
  }

  if (item.kind === 'feedback') {
    return (
      <div className="max-w-[92%] rounded-2xl bg-warning/10 border border-warning/30 px-3 py-2 break-words">
        {item.issue && (
          <div className="mb-2 rounded-lg border border-warning/25 bg-white/45 px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wider text-warning/80 font-bold mb-0.5">{t('whatToAdjust')}</p>
            <p className="text-[13px] leading-snug text-foreground/90">{item.issue}</p>
          </div>
        )}
        {item.better && <FeedbackPractice text={item.better} lang={lang} onSpeak={onSpeak} />}
        {item.models.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted/70 font-bold mb-0.5">{t('inSimilarSituations')}</p>
            <ul className="list-disc list-inside text-[13px] text-foreground/90 space-y-0.5">
              {item.models.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          </div>
        )}
      </div>
    )
  }

  // pergunta (o professor fala automaticamente; botão para reouvir)
  return (
    <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-surface-2 border border-border px-3 py-2 break-words">
      <div className="flex items-start gap-2">
        <p className="text-sm text-foreground flex-1">{item.text}</p>
        <button onClick={() => onSpeak(item.text)} title={t('listenAgain')} className="text-muted hover:text-primary shrink-0 mt-0.5"><Volume2 size={13} /></button>
      </div>
      {item.translation && <p className="text-[11px] text-muted/70 mt-1">{item.translation}</p>}
    </div>
  )
}

function FeedbackPractice({ text, lang, onSpeak }: { text: string; lang: string; onSpeak: (t: string) => void }) {
  const tr = useT()
  const { state, countdown, start, stop, cancel } = usePractice()
  const [attempt, setAttempt] = useState<SessionAttempt | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => () => cancel(), [cancel])

  const recording = state === 'recording'
  const counting = state === 'countdown'
  const transcribing = state === 'transcribing'

  const run = () => {
    setOpen(true)
    setAttempt(null)
    start(practiceMaxMs(text), ({ text: spoken, audioUrl }) => {
      const diff = diffWords(text, spoken)
      const score = scoreFromDiff(diff)
      const next: SessionAttempt = {
        original: text,
        spoken,
        score,
        diff: diff as DiffToken[],
        audioUrl,
        lang,
        at: Date.now(),
      }
      setAttempt(next)
      const missed = diff.filter(d => d.status === 'missing').map(d => ({ word: d.word, lang }))
      if (missed.length) storeAPI.recordMistakes(missed).catch(() => undefined)
      sessionAPI.addAttempt(next)
    }, text)
  }

  const busy = counting || transcribing

  return (
    <div className="mb-1.5">
      <p className="text-[10px] uppercase tracking-wider text-warning/80 font-bold mb-0.5">{tr('betterWay')}</p>
      <p className="text-sm text-foreground flex items-start gap-1.5">
        <button onClick={() => onSpeak(text)} title={tr('listen')} className="text-warning/70 hover:text-warning shrink-0 mt-0.5"><Volume2 size={13} /></button>
        <span>{text}</span>
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {recording ? (
          <button onClick={stop} className="inline-flex items-center gap-1 rounded-full bg-danger px-2.5 py-1 text-[11px] font-bold text-white hover:bg-danger/90">
            <Square size={11} /> {tr('stop')}
          </button>
        ) : (
          <button
            onClick={run}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/12 px-2.5 py-1 text-[11px] font-bold text-warning hover:bg-warning/20 disabled:opacity-50"
          >
            {transcribing ? <Loader2 size={11} className="animate-spin" /> : counting ? <Mic size={11} /> : <Activity size={11} />}
            {counting ? `${countdown}...` : transcribing ? tr('evaluating') : attempt ? tr('practiceAgain') : tr('practice')}
          </button>
        )}
        {attempt && (
          <span className={[
            'text-xs font-bold',
            attempt.score >= 80 ? 'text-success' : attempt.score >= 50 ? 'text-warning' : 'text-danger',
          ].join(' ')}>{attempt.score}%</span>
        )}
        {attempt?.audioUrl && (
          <button onClick={() => playClip(attempt.audioUrl)} className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-foreground">
            <Volume2 size={11} /> {tr('myVoice')}
          </button>
        )}
      </div>

      {open && attempt && (
        <div className="mt-2 rounded-lg border border-warning/20 bg-surface/55 p-2">
          <p className="text-[10px] uppercase tracking-wider text-muted/70 font-bold mb-1">{tr('youSaid')}</p>
          <p className="text-[12px] text-foreground/85 mb-2 leading-snug">{attempt.spoken}</p>
          <DiffView diff={attempt.diff} />
          <PronunciationCompare attempt={attempt} />
        </div>
      )}
    </div>
  )
}
