import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, MicOff, Loader2, Settings, X, Volume2, User, Zap } from 'lucide-react'
import { windowAPI, audioAPI, tutorAPI, onChannel, storeAPI, mediaAPI, ttsAPI, sessionAPI } from '../services/electron'
import { isVoiced, peakLevel } from '../lib/audio'
import { diffWords, scoreFromDiff } from '../lib/text'
import { onSentence, onPracticeDone, onAbort, INITIAL_MONITOR, type MonitorState } from '../lib/monitor'
import { usePractice, practiceMaxMs, blobToDataUrl } from '../hooks/usePractice'
import DiffView from '../components/DiffView'
import PronunciationCompare from '../components/PronunciationCompare'
import { playClip } from '../lib/playClip'
import type { SessionAttempt, DiffToken } from '../types'

type State = 'idle' | 'listening' | 'processing'

const VAD_TICK_MS    = 80    // how often the VAD samples the analyser
const SILENCE_END_MS = 1000  // wait a full second of silence before closing a sentence
const MIN_SPEECH_MS  = 400
const MAX_SPEECH_MS  = 20_000
const IDLE_TRIM_MS   = 2000  // restart the recorder after this much idle silence (trim leading silence)
const MIN_PEAK       = 22    // utterance must peak above this to count as real speech
const VAD_THRESHOLD  = 14    // deviation from 128 to count a sample as voiced (lower = catches soft speech)
const VAD_MIN_RATIO  = 0.04  // fraction of samples that must be voiced

export default function FloatingBar() {
  const [state, setState]         = useState<State>('idle')
  const [transcript, setTranscript] = useState('')
  const [lines, setLines]         = useState<string[]>([])
  const [error, setError]         = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'transcricao' | 'sessao'>('transcricao')
  const [attempts, setAttempts]   = useState<SessionAttempt[]>([])
  const [level, setLevel]         = useState(0)  // live audio peak (0-128) for the meter
  const lastLineRef               = useRef<string>('')
  const sessionLinesRef           = useRef(0)     // lines captured this session
  const transcriptLangRef         = useRef<string>('')  // last detected language
  const lastAudioRef              = useRef<string>('')  // last captured original clip (data URL)

  // Auto-practice (monitoring) mode
  const [autoMode, setAutoMode]   = useState(false)
  const autoModeRef               = useRef(false)
  const monitorRef                = useRef<MonitorState>(INITIAL_MONITOR)
  const [practiceSentence, setPracticeSentence] = useState<string | null>(null)
  const practiceSentenceRef       = useRef<string | null>(null)
  const earlyPausedRef            = useRef(false)  // paused the video at sentence-end (pre-transcription)

  const stateRef        = useRef<State>('idle')
  const streamsRef      = useRef<MediaStream[]>([])
  const recorderRef     = useRef<MediaRecorder | null>(null)
  const ctxRef          = useRef<AudioContext | null>(null)
  const analyserRef     = useRef<AnalyserNode | null>(null)
  const timeDomainBuf   = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(0) as Uint8Array<ArrayBuffer>)

  // VAD state — fresh MediaRecorder per utterance produces COMPLETE, valid WebM
  // files (Whisper/ffmpeg rejects spliced timeslice chunks).
  const vadTimerRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const segChunksRef    = useRef<Blob[]>([])             // chunks of the current recorder segment
  const pendingActionRef = useRef<'transcribe' | 'discard' | null>(null)
  const isSpeaking      = useRef(false)
  const lastVoiceRef    = useRef(0)                       // last time speech was heard
  const speechStartRef  = useRef<number | null>(null)
  const segStartRef     = useRef(0)                       // when current segment started recording
  const utterPeakRef    = useRef(0)  // peak energy seen during current utterance
  const busyRef         = useRef(false)
  const pausedRef       = useRef(false) // true while practice recording is active

  const setStateSynced = useCallback((s: State) => {
    stateRef.current = s
    setState(s)
  }, [])

  const stopAll = useCallback(() => {
    // stateRef must already be 'idle' so onstop won't restart a segment
    if (vadTimerRef.current) { clearInterval(vadTimerRef.current); vadTimerRef.current = null }
    pendingActionRef.current = null
    try { recorderRef.current?.stop() } catch { /* ignore */ }
    recorderRef.current = null
    streamsRef.current.forEach(s => s.getTracks().forEach(t => t.stop()))
    streamsRef.current = []
    ctxRef.current?.close()
    ctxRef.current = null
    analyserRef.current = null
    segChunksRef.current = []
    isSpeaking.current = false
    speechStartRef.current = null
    utterPeakRef.current = 0
    busyRef.current = false
    if (earlyPausedRef.current) { mediaAPI.resume(); earlyPausedRef.current = false }
  }, [])

  const transcribeChunks = useCallback(async (chunks: Blob[], mimeType: string) => {
    if (busyRef.current || chunks.length === 0 || stateRef.current === 'idle') {
      // Dropped a flush we'd early-paused for → don't leave the video stuck
      if (earlyPausedRef.current) { mediaAPI.resume(); earlyPausedRef.current = false }
      return
    }
    busyRef.current = true
    setStateSynced('processing')

    const blob = new Blob(chunks, { type: mimeType })
    let startedPractice = false
    try {
      const buf = await blob.arrayBuffer()
      const result = await audioAPI.transcribe(buf)
      if (result.error) {
        setError(result.error)
      } else if (result.text) {
        const text = result.text.trim()
        // Skip exact repeats (common hallucination signature)
        if (text && text !== lastLineRef.current) {
          lastLineRef.current = text
          transcriptLangRef.current = result.language ?? ''
          sessionLinesRef.current += 1
          // Keep the ORIGINAL captured audio so it can be replayed (in-memory data URL)
          const originalAudioUrl = await blobToDataUrl(blob)
          lastAudioRef.current = originalAudioUrl
          setTranscript(text)
          setLines(prev => [...prev, text])
          setError(null)
          tutorAPI.analyze(text, result.language ?? '', originalAudioUrl, result.cues).catch(console.error)

          // Auto-practice: video was already paused at sentence-end; show overlay
          const { state, action } = onSentence(monitorRef.current, text, autoModeRef.current)
          monitorRef.current = state
          if (action === 'pause-and-practice') {
            await mediaAPI.pause()  // idempotent — already paused early
            setPracticeSentence(state.current)
            startedPractice = true
          }
        }
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      // If we paused the video early but no practice started (silent/repeat/empty),
      // resume it so playback isn't left stuck.
      if (earlyPausedRef.current && !startedPractice) mediaAPI.resume()
      earlyPausedRef.current = false
      busyRef.current = false
      if ((stateRef.current as State) !== 'idle') setStateSynced('listening')
    }
  }, [setStateSynced])

  const startListening = useCallback(async () => {
    setError(null)
    try {
      // ── System audio ONLY (WASAPI loopback) ──────────────────────────
      // The mic is intentionally NOT mixed in here: ambient room noise makes
      // the model hallucinate phrases on silence. Practice uses its own mic
      // recorder (TutorBoard) and goes to the "Sessão" tab instead.
      const sysStream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true })
      sysStream.getVideoTracks().forEach(t => t.stop())

      // ── Audio graph ──────────────────────────────────────────────────
      // source ─┬─► analyser            (raw signal → VAD, untouched thresholds)
      //         └─► compressor ─► dest  (evened-out levels → cleaner recording)
      const ctx     = new AudioContext()
      ctxRef.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      analyserRef.current = analyser
      timeDomainBuf.current = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>

      const dest = ctx.createMediaStreamDestination()
      const sysAudio = sysStream.getAudioTracks()
      if (sysAudio.length === 0) throw new Error('Sem áudio do sistema. Toque algo e tente de novo.')

      const source = ctx.createMediaStreamSource(sysStream)

      // Gentle compressor: lifts quiet dialogue so Whisper hears it better.
      const comp = ctx.createDynamicsCompressor()
      comp.threshold.value = -28   // start compressing fairly early
      comp.knee.value      = 24
      comp.ratio.value     = 3     // gentle
      comp.attack.value    = 0.003
      comp.release.value   = 0.25
      const makeup = ctx.createGain()
      makeup.gain.value    = 1.4   // modest makeup gain after compression

      source.connect(analyser)                 // VAD path — raw
      source.connect(comp)
      comp.connect(makeup)
      makeup.connect(dest)                      // recording path — processed

      sysAudio[0]?.addEventListener('ended', () => {
        if (stateRef.current !== 'idle') {
          setStateSynced('idle'); stopAll()
          setError('Áudio desconectado. Clique para reiniciar.')
        }
      })

      streamsRef.current = [sysStream]

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      // ── Segment recorder ─────────────────────────────────────────────
      // Records continuously into ONE segment; on utterance end we stop it
      // (flushing a COMPLETE valid WebM via onstop) then immediately restart.
      const startSegment = () => {
        if (stateRef.current === 'idle' || !ctxRef.current) return
        const rec = new MediaRecorder(dest.stream, { mimeType, audioBitsPerSecond: 256_000 })
        recorderRef.current = rec
        segChunksRef.current = []
        segStartRef.current = Date.now()
        rec.ondataavailable = e => { if (e.data.size > 0) segChunksRef.current.push(e.data) }
        rec.onstop = () => {
          const action = pendingActionRef.current
          pendingActionRef.current = null
          const blob = new Blob(segChunksRef.current, { type: mimeType })
          segChunksRef.current = []
          if (action === 'transcribe' && blob.size > 1000) {
            transcribeChunks([blob], mimeType)
          }
          if (stateRef.current !== 'idle') startSegment()  // ready for next utterance
        }
        rec.onerror = () => { setError('Erro no gravador.'); setStateSynced('idle'); stopAll() }
        rec.start()
      }

      // ── VAD loop (independent of the recorder) ───────────────────────
      const tick = () => {
        if (stateRef.current === 'idle' || pausedRef.current) return
        const rec = recorderRef.current
        if (!rec || rec.state !== 'recording') return

        analyser.getByteTimeDomainData(timeDomainBuf.current)
        const voiced = isVoiced(timeDomainBuf.current, VAD_THRESHOLD, VAD_MIN_RATIO)
        const peak   = peakLevel(timeDomainBuf.current)
        const now    = Date.now()
        setLevel(peak)

        if (voiced) {
          if (!isSpeaking.current) {
            isSpeaking.current = true
            speechStartRef.current = now
            utterPeakRef.current = 0
          }
          lastVoiceRef.current = now
          if (peak > utterPeakRef.current) utterPeakRef.current = peak

          // Force-flush very long utterances
          if (now - (speechStartRef.current ?? now) >= MAX_SPEECH_MS) {
            isSpeaking.current = false
            pendingActionRef.current = utterPeakRef.current >= MIN_PEAK ? 'transcribe' : 'discard'
            rec.stop()
          }
        } else if (isSpeaking.current) {
          const silenceDur = now - lastVoiceRef.current
          const speechDur  = now - (speechStartRef.current ?? now)
          if (silenceDur >= SILENCE_END_MS) {
            // Sentence complete → flush a full file (or discard if too short/quiet)
            isSpeaking.current = false
            const ok = speechDur >= MIN_SPEECH_MS && utterPeakRef.current >= MIN_PEAK
            pendingActionRef.current = ok ? 'transcribe' : 'discard'
            // Auto-treino: pause the video the instant the sentence ends (before
            // the ~1s transcription) so we stop exactly on the right line.
            if (ok && autoModeRef.current && monitorRef.current.phase === 'watching') {
              earlyPausedRef.current = true
              mediaAPI.pause()
            }
            rec.stop()
          }
        } else {
          // Idle silence — periodically restart to trim accumulated leading silence
          if (now - segStartRef.current >= IDLE_TRIM_MS) {
            pendingActionRef.current = 'discard'
            rec.stop()
          }
        }
      }

      sessionLinesRef.current = 0
      isSpeaking.current = false
      lastVoiceRef.current = Date.now()
      setStateSynced('listening')
      startSegment()
      vadTimerRef.current = setInterval(tick, VAD_TICK_MS)
    } catch (err) {
      setError((err as Error).message)
      setStateSynced('idle')
    }
  }, [setStateSynced, stopAll, transcribeChunks])

  const stopListening = useCallback(() => {
    setStateSynced('idle')
    stopAll()
    if (sessionLinesRef.current > 0) {
      storeAPI.recordSession(sessionLinesRef.current).catch(console.error)
      sessionLinesRef.current = 0
    }
  }, [setStateSynced, stopAll])

  // ── Auto-practice toggle + lifecycle ──────────────────────────────────────
  const toggleAuto = useCallback(() => {
    // Flip the ref SYNCHRONOUSLY so the very next transcribed sentence already
    // sees the new mode (setState updaters run async on the next render).
    const next = !autoModeRef.current
    autoModeRef.current = next
    setAutoMode(next)
    if (!next) {
      // turning OFF: abort any in-progress practice and resume the video
      const { action } = onAbort(monitorRef.current)
      monitorRef.current = INITIAL_MONITOR
      setPracticeSentence(null)
      if (action === 'resume') mediaAPI.resume()
      mediaAPI.reset()
    }
  }, [])

  const handlePracticeDone = useCallback(() => {
    const { state, action } = onPracticeDone(monitorRef.current)
    monitorRef.current = state
    if (action === 'resume') {
      mediaAPI.resume()
      setPracticeSentence(null)
    } else if (action === 'practice-next') {
      setPracticeSentence(state.current)
    } else {
      setPracticeSentence(null)
    }
  }, [])

  const toggle = useCallback(() => {
    if (stateRef.current === 'idle') startListening()
    else stopListening()
  }, [startListening, stopListening])

  useEffect(() => {
    return onChannel('shortcut:fired', (action) => {
      if (action === 'toggle-listening') toggle()
    })
  }, [toggle])

  useEffect(() => {
    const unPause  = onChannel('listening:pause',  () => { pausedRef.current = true })
    const unResume = onChannel('listening:resume', () => {
      pausedRef.current = false
      // discard whatever was captured while paused; start a fresh segment
      isSpeaking.current   = false
      speechStartRef.current  = null
      lastVoiceRef.current = Date.now()
      if (recorderRef.current?.state === 'recording') {
        pendingActionRef.current = 'discard'
        recorderRef.current.stop()
      }
    })
    return () => { unPause(); unResume() }
  }, [])

  useEffect(() => { practiceSentenceRef.current = practiceSentence }, [practiceSentence])

  // Practice attempts arrive here → "Sessão" tab.
  // Don't auto-switch tabs while an auto-practice overlay is open (it would hide
  // the result); the tab badge count signals new attempts instead.
  useEffect(() => {
    return onChannel('session:attempt', (raw) => {
      setAttempts(prev => [...prev, raw as SessionAttempt])
      if (!practiceSentenceRef.current) setActiveTab('sessao')
    })
  }, [])

  const isListening  = state === 'listening'
  const isProcessing = state === 'processing'

  return (
    <div className="flex flex-col h-screen bg-background text-foreground select-none overflow-hidden border border-white/10 rounded-lg">

      {/* ── Drag strip ─────────────────────────────────────────── */}
      <div
        className="shrink-0 h-5 w-full"
        style={{ WebkitAppRegion: 'drag' }}
      />

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-1 px-3 pb-0 border-b border-white/[0.06]">
        {/* Tabs */}
        <div className="flex items-center gap-0.5 flex-1">
          <TabBtn
            active={activeTab === 'transcricao'}
            icon={<Mic size={11} />}
            label="Transcrição"
            onClick={() => setActiveTab('transcricao')}
          />
          <TabBtn
            active={activeTab === 'sessao'}
            icon={<User size={11} />}
            label={`Sessão${attempts.length ? ` (${attempts.length})` : ''}`}
            onClick={() => setActiveTab('sessao')}
          />
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1.5 pb-2">
          <div className={[
            'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all',
            isListening ? 'bg-danger text-white' : 'bg-surface-2 text-muted',
          ].join(' ')}>
            {isListening
              ? <><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />AO VIVO</>
              : isProcessing
              ? <><Loader2 size={9} className="animate-spin" />PROC...</>
              : <><span className="w-1.5 h-1.5 rounded-full bg-muted/40" />OFF</>}
          </div>
          <button
            onClick={() => windowAPI.show('settings')}
            className="w-5 h-5 flex items-center justify-center rounded text-muted/50 hover:text-foreground hover:bg-surface-2 transition-colors"
            title="Configurações"
          >
            <Settings size={12} />
          </button>
          <button
            onClick={() => windowAPI.hide()}
            className="w-5 h-5 flex items-center justify-center rounded text-muted/50 hover:text-danger hover:bg-danger/10 transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* ── Feed / Auto-practice overlay ───────────────────────── */}
      {/* Sessão tab always shows attempts; the overlay only covers Transcrição */}
      {activeTab === 'sessao' ? (
        <SessionList attempts={attempts} />
      ) : practiceSentence ? (
        <AutoPractice
          sentence={practiceSentence}
          lang={transcriptLangRef.current}
          originalAudioUrl={lastAudioRef.current}
          onDone={handlePracticeDone}
        />
      ) : (
        <TranscriptList
          lines={lines}
          currentTranscript={isListening || isProcessing ? transcript : null}
          error={error}
        />
      )}

      {/* ── Audio level meter (diagnostic) ─────────────────────── */}
      {isListening && !practiceSentence && <AudioMeter level={level} gate={MIN_PEAK} />}

      {/* ── Bottom bar ─────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-white/[0.06] px-3 py-2 flex items-center gap-2 bg-surface/60">
        <button
          onClick={toggle}
          disabled={isProcessing}
          className={[
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
            isListening
              ? 'bg-danger text-white hover:bg-danger/80'
              : isProcessing
              ? 'bg-warning/20 text-warning cursor-default'
              : 'bg-primary text-white hover:bg-primary/80',
          ].join(' ')}
        >
          {isProcessing
            ? <><Loader2 size={12} className="animate-spin" />Processando</>
            : isListening
            ? <><MicOff size={12} />Parar</>
            : <><Mic size={12} />Escutar</>}
        </button>

        {/* Auto-practice toggle */}
        <button
          onClick={toggleAuto}
          className={[
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all border',
            autoMode
              ? 'bg-warning/20 text-warning border-warning/40'
              : 'bg-surface-2 text-muted border-white/[0.06] hover:text-foreground',
          ].join(' ')}
          title="Pausa o vídeo a cada frase para você treinar"
        >
          <Zap size={12} className={autoMode ? 'fill-warning' : ''} />
          Auto-treino {autoMode ? 'ON' : 'OFF'}
        </button>

        <button
          onClick={() => windowAPI.show('tutor-board')}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-surface-2 text-muted hover:text-foreground hover:bg-surface transition-all border border-white/[0.06]"
        >
          Analisar
        </button>
      </div>
    </div>
  )
}

// ── Audio level meter (shows live peak vs the speech gate) ────────────────────
function AudioMeter({ level, gate }: { level: number; gate: number }) {
  const pct      = Math.min(100, (level / 80) * 100)   // 80 ≈ loud
  const gatePct  = Math.min(100, (gate / 80) * 100)
  const overGate = level >= gate
  return (
    <div className="shrink-0 px-3 py-1.5 border-t border-white/[0.04] flex items-center gap-2">
      <span className="text-[9px] text-muted/40 uppercase tracking-wider w-8">Nível</span>
      <div className="relative flex-1 h-2 rounded-full bg-surface-2 overflow-hidden">
        <div
          className={['h-full transition-all duration-75', overGate ? 'bg-success' : 'bg-muted/40'].join(' ')}
          style={{ width: `${pct}%` }}
        />
        {/* gate marker */}
        <div className="absolute top-0 bottom-0 w-px bg-warning" style={{ left: `${gatePct}%` }} title="Limiar de fala" />
      </div>
      <span className="text-[9px] font-mono text-muted/50 w-6 text-right">{level}</span>
    </div>
  )
}

// ── Auto-practice overlay (repeat the paused sentence) ────────────────────────
function AutoPractice({ sentence, lang, originalAudioUrl, onDone }: {
  sentence: string
  lang: string
  originalAudioUrl?: string
  onDone: () => void
}) {
  const { state, countdown, start, stop, cancel } = usePractice()
  const [result, setResult] = useState<{ diff: DiffToken[]; score: number; audioUrl: string } | null>(null)

  const run = useCallback(() => {
    setResult(null)
    start(practiceMaxMs(sentence), ({ text, audioUrl }) => {
      const diff = diffWords(sentence, text)
      const score = scoreFromDiff(diff)
      setResult({ diff, score, audioUrl })
      const missed = diff.filter(d => d.status === 'missing').map(d => ({ word: d.word, lang }))
      if (missed.length) storeAPI.recordMistakes(missed).catch(console.error)
      // Save to the "Sessão" tab so it can be reviewed/replayed later
      sessionAPI.addAttempt({ original: sentence, spoken: text, score, diff, audioUrl, originalAudioUrl, lang, at: Date.now() })
    })
  }, [sentence, lang, start])

  // Always tear down (resume listener) when the overlay unmounts
  useEffect(() => () => cancel(), [cancel])

  // Reset result when a new queued sentence comes in
  useEffect(() => { setResult(null) }, [sentence])

  const finish = useCallback(() => { cancel(); onDone() }, [cancel, onDone])

  const recording = state === 'recording'
  const counting  = state === 'countdown'
  const busy      = state === 'transcribing'

  return (
    <div className="flex-1 overflow-y-auto p-3 flex flex-col">
      <div className="flex items-center gap-1.5 mb-2 text-warning">
        <Zap size={12} className="fill-warning" />
        <span className="text-[10px] font-semibold uppercase tracking-wider">Repita a frase</span>
      </div>

      {/* Target sentence */}
      <div className="rounded-lg bg-surface-2/60 border border-white/[0.06] px-3 py-2.5 mb-2">
        <p className="text-sm text-foreground leading-relaxed">{sentence}</p>
        <div className="mt-1.5 flex items-center gap-3">
          {originalAudioUrl && (
            <button
              onClick={() => playClip(originalAudioUrl)}
              className="flex items-center gap-1 text-[11px] text-primary/80 hover:text-primary transition-colors"
              title="Ouvir o áudio original da cena"
            >
              <Volume2 size={11} /> Original
            </button>
          )}
          <button
            onClick={() => speakViaTts(sentence, lang)}
            className="flex items-center gap-1 text-[11px] text-muted hover:text-primary transition-colors"
            title="Ouvir voz sintetizada (clara/lenta)"
          >
            <Volume2 size={11} /> TTS
          </button>
        </div>
      </div>

      {/* Status / result */}
      {result ? (
        <>
          <div className="flex items-center gap-2 mb-1.5">
            <span className={[
              'text-sm font-bold',
              result.score >= 80 ? 'text-success' : result.score >= 50 ? 'text-warning' : 'text-danger',
            ].join(' ')}>{result.score}%</span>
            <span className="text-xs text-muted">de precisão</span>
            <button
              onClick={() => playClip(result.audioUrl)}
              className="ml-auto flex items-center gap-1 text-[11px] text-primary/80 hover:text-primary transition-colors"
              title="Ouvir minha gravação"
            >
              <Volume2 size={11} /> Minha voz
            </button>
          </div>
          <DiffView diff={result.diff} />
        </>
      ) : (
        <p className="text-xs text-muted/70 italic">
          {counting ? `Gravando em ${countdown}...` : recording ? '🔴 Gravando — fale agora' : busy ? 'Avaliando...' : 'Clique em Gravar quando estiver pronto.'}
        </p>
      )}

      {/* Controls */}
      <div className="mt-auto flex items-center gap-2 pt-3">
        {recording ? (
          <button onClick={stop} className="flex-1 bg-danger text-white py-2 rounded-md text-xs font-semibold hover:bg-danger/80">
            Parar
          </button>
        ) : (
          <button onClick={run} disabled={counting || busy} className="flex-1 bg-warning/20 text-warning border border-warning/40 py-2 rounded-md text-xs font-semibold hover:bg-warning/30 disabled:opacity-40">
            <Mic size={12} className="inline mr-1" />{result ? 'Repetir' : 'Gravar'}
          </button>
        )}
        <button onClick={finish} className="flex-1 bg-primary text-white py-2 rounded-md text-xs font-semibold hover:bg-primary/80">
          {result ? 'Continuar ▶' : 'Pular ▶'}
        </button>
      </div>
    </div>
  )
}

async function speakViaTts(text: string, lang: string) {
  try {
    const res = await ttsAPI.speak(text, lang)
    if (res.ok && res.dataUrl) playClip(res.dataUrl)
  } catch { /* ignore */ }
}

// ── Tab button ────────────────────────────────────────────────────────────────
function TabBtn({ active, icon, label, onClick }: { active?: boolean; icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors',
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted hover:text-foreground',
      ].join(' ')}
    >
      {icon}{label}
    </button>
  )
}

// ── Transcript feed ───────────────────────────────────────────────────────────
function TranscriptList({ lines, currentTranscript, error }: {
  lines: string[]
  currentTranscript: string | null
  error: string | null
}) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines, currentTranscript])

  return (
    <div className="flex-1 overflow-y-auto py-2 px-3 space-y-1.5">
      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </div>
      )}

      {lines.length === 0 && !currentTranscript && !error && (
        <div className="flex flex-col items-center justify-center h-full gap-2 text-muted/40 pt-16">
          <Mic size={24} className="opacity-30" />
          <p className="text-xs">Nenhum texto capturado — continue falando...</p>
        </div>
      )}

      {lines.map((line, i) => (
        <div
          key={i}
          className="rounded-lg bg-surface-2/60 border border-white/[0.05] px-3 py-2.5"
        >
          <p className="text-[10px] text-muted/50 uppercase tracking-wider mb-1 font-medium">Áudio</p>
          <p className="text-sm text-foreground leading-relaxed">{line}</p>
        </div>
      ))}

      {currentTranscript && (
        <div className="rounded-lg border border-white/[0.04] px-3 py-2.5 opacity-50">
          <p className="text-[10px] text-muted/40 uppercase tracking-wider mb-1 font-medium">Capturando...</p>
          <p className="text-sm text-foreground/60 leading-relaxed">{currentTranscript}</p>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}

// ── Session feed (my practice attempts) ───────────────────────────────────────
function SessionList({ attempts }: { attempts: SessionAttempt[] }) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [attempts])

  if (attempts.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted/40">
        <User size={24} className="opacity-30" />
        <p className="text-xs px-6 text-center">Suas falas de prática aparecem aqui.</p>
        <p className="text-[10px] opacity-60 px-6 text-center">Use "Praticar" no Tutor Board para gravar e comparar.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto py-2 px-3 space-y-2">
      {attempts.map((a, i) => (
        <div key={i} className="rounded-lg bg-surface-2/60 border border-white/[0.05] px-3 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted/50 uppercase tracking-wider font-medium">Tentativa #{i + 1}</span>
              {a.audioUrl && (
                <button
                  onClick={() => playClip(a.audioUrl)}
                  className="flex items-center gap-1 text-[10px] text-primary/80 hover:text-primary transition-colors"
                  title="Ouvir minha gravação"
                >
                  <Volume2 size={11} /> Ouvir
                </button>
              )}
            </div>
            <span className={[
              'text-xs font-bold',
              a.score >= 80 ? 'text-success' : a.score >= 50 ? 'text-warning' : 'text-danger',
            ].join(' ')}>{a.score}%</span>
          </div>

          {/* Original */}
          <p className="text-[10px] text-muted/40 mb-0.5">Original</p>
          <p className="text-xs text-foreground/70 mb-1.5 leading-relaxed">{a.original}</p>

          {/* Full raw speech (nothing hidden) */}
          <p className="text-[10px] text-muted/40 mb-0.5">Você falou</p>
          <p className="text-xs text-foreground/90 mb-1.5 leading-relaxed">{a.spoken}</p>

          {/* Word-by-word diff (ok / missing / extra) */}
          <DiffView diff={a.diff} />

          {/* Intonation comparator: my voice vs original vs TTS */}
          <PronunciationCompare attempt={a} />
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
