import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Clock, Mic, MicOff, Loader2, Settings, X, Volume2, User, Zap } from 'lucide-react'
import { windowAPI, audioAPI, tutorAPI, onChannel, storeAPI, mediaAPI, ttsAPI, sessionAPI, floatingBarAPI, settingsAPI } from '../services/electron'
import { floatingBarMode } from '../lib/floatingBar'
import { uiText, appLanguage, type AppLanguage } from '../lib/uiLanguage'
import { UiLangProvider, useT } from '../lib/uiLangContext'
import { isVoiced, peakLevel } from '../lib/audio'
import { diffWords, scoreFromDiff } from '../lib/text'
import { onSentence, onPracticeDone, onAbort, INITIAL_MONITOR, type MonitorState } from '../lib/monitor'
import { usePractice, practiceMaxMs, blobToDataUrl } from '../hooks/usePractice'
import { decodeBufferToMono } from '../lib/decodeAudio'
import { encodeWav } from '../lib/wav'

/** Re-encode a recorded blob to clean WAV (for reliable word timestamps and slicing). */
async function toWavOrRaw(blob: Blob): Promise<{ buffer: ArrayBuffer; mimeType: string }> {
  const raw = await blob.arrayBuffer()
  const decoded = await decodeBufferToMono(raw)
  return decoded
    ? { buffer: encodeWav([decoded.samples], decoded.sampleRate), mimeType: 'audio/wav' }
    : { buffer: raw, mimeType: blob.type || 'audio/webm' }
}
import DiffView from '../components/DiffView'
import PronunciationCompare from '../components/PronunciationCompare'
import WordDrill from '../components/WordDrill'
import { playClip } from '../lib/playClip'
import type { SessionAttempt, DiffToken, WordCue } from '../types'

type State = 'idle' | 'listening' | 'processing'

function formatSessionTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':')
}

const VAD_TICK_MS    = 80    // how often the VAD samples the analyser
const SILENCE_END_MS = 1450  // wait for a real pause before closing a sentence
const MIN_SPEECH_MS  = 650
const MAX_SPEECH_MS  = 20_000
const IDLE_TRIM_MS   = 1600  // restart the recorder after this much idle silence (trim leading silence)
const MIN_PEAK       = 26    // utterance must peak above this to count as real speech
const VAD_THRESHOLD  = 16    // deviation from 128 to count a sample as voiced (lower = catches soft speech)
const VAD_MIN_RATIO  = 0.055 // fraction of samples that must be voiced

export default function FloatingBar() {
  const [state, setState]         = useState<State>('idle')
  const [transcript, setTranscript] = useState('')
  const [lines, setLines]         = useState<string[]>([])
  const [error, setError]         = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'transcricao' | 'sessao'>('transcricao')
  const [attempts, setAttempts]   = useState<SessionAttempt[]>([])
  const [level, setLevel]         = useState(0)  // live audio peak (0-128) for the meter
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null)
  const [sessionNow, setSessionNow] = useState(Date.now())
  const [uiLang, setUiLang] = useState<AppLanguage>('pt')
  const uiLangRef = useRef<AppLanguage>('pt')  // p/ usar dentro de callbacks (mensagens de erro)
  const t = (key: Parameters<typeof uiText>[1]) => uiText(uiLang, key)
  const tc = (key: Parameters<typeof uiText>[1]) => uiText(uiLangRef.current, key)  // tradução em callback
  const lastLineRef               = useRef<string>('')
  const sessionLinesRef           = useRef(0)     // lines captured this session
  const sessionPreviewRef         = useRef<string[]>([])
  const sessionLangRef            = useRef<string>('')
  const transcriptLangRef         = useRef<string>('')  // last detected language
  const lastAudioRef              = useRef<string>('')  // last captured original clip (data URL)
  const lastCuesRef               = useRef<WordCue[]>([])  // per-word timings of the last clip

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
      // Re-encode to WAV — MediaRecorder's streaming WebM has no container
      // duration, which makes Whisper drop word-level timestamps (no karaoke /
      // word slicing). A clean WAV restores them. Falls back to the raw blob.
      const { buffer, mimeType: playableMimeType } = await toWavOrRaw(blob)
      const result = await audioAPI.transcribe(buffer)
      if (result.error) {
        setError(result.error)
      } else if (result.text) {
        const text = result.text.trim()
        // Skip exact repeats (common hallucination signature)
        if (text && text !== lastLineRef.current) {
          lastLineRef.current = text
          transcriptLangRef.current = result.language ?? ''
          sessionLangRef.current = result.language ?? sessionLangRef.current
          sessionLinesRef.current += 1
          sessionPreviewRef.current = [...sessionPreviewRef.current, text].slice(-5)
          // Keep the ORIGINAL captured audio so it can be replayed (in-memory data URL)
          const originalAudioUrl = await blobToDataUrl(new Blob([buffer], { type: playableMimeType }))
          lastAudioRef.current = originalAudioUrl
          lastCuesRef.current = result.cues ?? []
          setTranscript(text)
          setLines(prev => [...prev, text].slice(-400))  // bound the transcript feed
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
      if (sysAudio.length === 0) throw new Error(tc('noSystemAudio'))

      const source = ctx.createMediaStreamSource(sysStream)

      // Light peak limiter only — tames harsh peaks but leaves normal dialogue
      // untouched (over-compression muffles consonants and hurts transcription).
      const comp = ctx.createDynamicsCompressor()
      comp.threshold.value = -10   // only act on loud peaks
      comp.knee.value      = 10
      comp.ratio.value     = 2.5
      comp.attack.value    = 0.004
      comp.release.value   = 0.25
      const makeup = ctx.createGain()
      makeup.gain.value    = 1.1   // slight, well below clipping

      source.connect(analyser)                 // VAD path — raw
      source.connect(comp)
      comp.connect(makeup)
      makeup.connect(dest)                      // recording path — lightly processed

      sysAudio[0]?.addEventListener('ended', () => {
        if (stateRef.current !== 'idle') {
          setStateSynced('idle'); stopAll()
          setError(tc('audioDisconnected'))
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
        rec.onerror = () => { setError(tc('recorderError')); setStateSynced('idle'); stopAll() }
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
      sessionPreviewRef.current = []
      sessionLangRef.current = ''
      setSessionStartedAt(Date.now())
      isSpeaking.current = false
      lastVoiceRef.current = Date.now()
      setStateSynced('listening')
      startSegment()
      vadTimerRef.current = setInterval(tick, VAD_TICK_MS)
    } catch (err) {
      setError((err as Error).message)
      setSessionStartedAt(null)
      setStateSynced('idle')
    }
  }, [setStateSynced, stopAll, transcribeChunks])

  const stopListening = useCallback(() => {
    setStateSynced('idle')
    setSessionStartedAt(null)
    stopAll()
    if (sessionLinesRef.current > 0) {
      storeAPI.recordSession({
        lineCount: sessionLinesRef.current,
        lang: sessionLangRef.current,
        preview: sessionPreviewRef.current,
        endedAt: Date.now(),
      }).catch(console.error)
      sessionLinesRef.current = 0
      sessionPreviewRef.current = []
      sessionLangRef.current = ''
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
    settingsAPI.getAll().then(s => {
      const lang = appLanguage(s.appLanguage)
      setUiLang(lang)
      uiLangRef.current = lang
    }).catch(() => {})
  }, [])

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

  useEffect(() => {
    if (!sessionStartedAt) return
    setSessionNow(Date.now())
    const timer = setInterval(() => setSessionNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [sessionStartedAt])

  // Practice attempts arrive here → "Sessão" tab.
  // Don't auto-switch tabs while an auto-practice overlay is open (it would hide
  // the result); the tab badge count signals new attempts instead.
  useEffect(() => {
    return onChannel('session:attempt', (raw) => {
      // Cap retained attempts — each holds audio data URLs (bounds memory)
      setAttempts(prev => [...prev, raw as SessionAttempt].slice(-60))
      if (!practiceSentenceRef.current) setActiveTab('sessao')
    })
  }, [])

  const isListening  = state === 'listening'
  const isProcessing = state === 'processing'
  const sessionTime = sessionStartedAt ? formatSessionTime(sessionNow - sessionStartedAt) : '00:00:00'

  // A janela abre COMPACTA (vazia/ociosa) e cresce para CHEIA só quando há conteúdo a mostrar
  // (escuta/processamento, treino, ou um feed com itens). Pede o tamanho ao processo main.
  useEffect(() => {
    floatingBarAPI.setMode(floatingBarMode({
      busy: state !== 'idle',
      practicing: !!practiceSentence,
      tab: activeTab,
      lineCount: lines.length,
      attemptCount: attempts.length,
    }))
  }, [state, practiceSentence, activeTab, lines.length, attempts.length])

  return (
    <UiLangProvider value={uiLang}>
    <div className="flex flex-col h-screen max-h-screen select-none overflow-hidden rounded-[20px] border border-white/15 text-[#EAF0EA] shadow-[var(--sh-bar)]"
      style={{
        background: 'linear-gradient(180deg, rgba(48,34,26,.94), rgba(38,27,21,.96))',
        backdropFilter: 'blur(26px) saturate(160%)',
      }}
    >

      {/* ── Drag strip ─────────────────────────────────────────── */}
      <div
        className="shrink-0 h-2.5 w-full"
        style={{ WebkitAppRegion: 'drag' }}
      />

      {/* ── Header ─────────────────────────────────────────────── */}
      <div
        className="shrink-0 flex items-center gap-1.5 px-3.5 pb-2 border-b border-white/[0.08]"
        style={{ WebkitAppRegion: 'drag' }}
      >
        {/* Tabs */}
        <div className="flex items-center gap-0.5 flex-1" style={{ WebkitAppRegion: 'no-drag' }}>
          <TabBtn
            active={activeTab === 'transcricao'}
            icon={<Mic size={11} />}
            label={t('tabTranscription')}
            onClick={() => setActiveTab('transcricao')}
          />
          <TabBtn
            active={activeTab === 'sessao'}
            icon={<User size={11} />}
            label={`${t('tabSession')}${attempts.length ? ` (${attempts.length})` : ''}`}
            onClick={() => setActiveTab('sessao')}
          />
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1.5 pb-2" style={{ WebkitAppRegion: 'no-drag' }}>
          <div
            className={[
              'flex items-center gap-1 px-1.5 py-1 rounded-full border text-[9.5px] font-mono tabular-nums',
              sessionStartedAt
                ? 'border-danger/35 bg-danger/10 text-[#ffb3ad]'
                : 'border-white/[0.08] bg-white/5 text-white/35',
            ].join(' ')}
            title={t('sessionTimeTitle')}
          >
            <Clock size={10} />
            {sessionTime}
          </div>
          <div className={[
            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wider transition-all',
            isListening ? 'bg-danger/20 text-[#ffb3ad]' : 'bg-white/5 text-white/45',
          ].join(' ')}>
            {isListening
              ? <><span className="live-dot" />{t('live')}</>
              : isProcessing
              ? <><Loader2 size={9} className="animate-spin" />PROC...</>
              : <><span className="w-1.5 h-1.5 rounded-full bg-white/30" />OFF</>}
          </div>
          <button
            onClick={() => windowAPI.show('settings')}
            className="w-7 h-7 flex items-center justify-center rounded-[9px] text-white/55 hover:text-white hover:bg-white/10 transition-colors"
            title={t('settings')}
          >
            <Settings size={12} />
          </button>
          <button
            onClick={() => windowAPI.hide()}
            className="w-7 h-7 flex items-center justify-center rounded-[9px] text-white/55 hover:text-[#ffb3ad] hover:bg-white/10 transition-colors"
            title={t('hide')}
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
          originalCues={lastCuesRef.current}
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
      <div
        className="shrink-0 border-t border-white/[0.08] px-3 py-3 grid grid-cols-[92px_minmax(162px,1fr)_92px] gap-2 bg-white/[0.03]"
        style={{ WebkitAppRegion: 'no-drag' }}
      >
        <button
          onClick={toggle}
          disabled={isProcessing}
          className={[
            'pill-button w-full min-w-0 px-2.5 py-2 text-[12px] transition-all overflow-hidden',
            isListening
              ? 'bg-danger text-white hover:bg-danger/90'
              : isProcessing
              ? 'bg-warning/20 text-[#f4cf93] cursor-default'
              : 'bg-white/10 text-white hover:bg-white/15',
          ].join(' ')}
        >
          {isProcessing
            ? <><Loader2 size={12} className="animate-spin shrink-0" /><span className="truncate">{t('processing')}</span></>
            : isListening
            ? <><MicOff size={12} className="shrink-0" /><span className="truncate">{t('stop')}</span></>
            : <><Mic size={12} className="shrink-0" /><span className="truncate">{t('listenStart')}</span></>}
        </button>

        {/* Auto-practice toggle */}
        <button
          onClick={toggleAuto}
          className={[
            'pill-button w-full min-w-0 px-2.5 py-2 text-[11.5px] transition-all border overflow-hidden',
            autoMode
              ? 'bg-warning/20 text-[#f4cf93] border-warning/40'
              : 'bg-white/5 text-white/65 border-white/[0.10] hover:text-white hover:bg-white/10',
          ].join(' ')}
          title={t('autoPracticeTitle')}
        >
          <Zap size={12} className={['shrink-0', autoMode ? 'fill-warning' : ''].join(' ')} />
          <span className="whitespace-nowrap">{t('autoPractice')} {autoMode ? 'ON' : 'OFF'}</span>
        </button>

        <button
          onClick={() => windowAPI.show('tutor-board')}
          className="pill-button w-full min-w-0 px-2.5 py-2 text-[12px] bg-white/10 text-white hover:bg-white/15 transition-all border border-white/[0.10] overflow-hidden"
        >
          <span className="truncate">{t('analyze')}</span>
        </button>
      </div>
    </div>
    </UiLangProvider>
  )
}

// ── Audio level meter (shows live peak vs the speech gate) ────────────────────
function AudioMeter({ level, gate }: { level: number; gate: number }) {
  const t = useT()
  const pct      = Math.min(100, (level / 80) * 100)   // 80 ≈ loud
  const gatePct  = Math.min(100, (gate / 80) * 100)
  const overGate = level >= gate
  return (
    <div className="shrink-0 px-3.5 py-2 border-t border-white/[0.05] flex items-center gap-2">
      <span className="text-[9px] text-white/35 uppercase tracking-wider w-8">{t('level')}</span>
      <div className="relative flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className={['h-full transition-all duration-75', overGate ? 'bg-success' : 'bg-white/35'].join(' ')}
          style={{ width: `${pct}%` }}
        />
        {/* gate marker */}
        <div className="absolute top-0 bottom-0 w-px bg-warning" style={{ left: `${gatePct}%` }} title={t('speechThreshold')} />
      </div>
      <span className="text-[9px] font-mono text-white/45 w-6 text-right">{level}</span>
    </div>
  )
}

// ── Auto-practice overlay (repeat the paused sentence) ────────────────────────
function AutoPractice({ sentence, lang, originalAudioUrl, originalCues, onDone }: {
  sentence: string
  lang: string
  originalAudioUrl?: string
  originalCues?: WordCue[]
  onDone: () => void
}) {
  const t = useT()
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
      sessionAPI.addAttempt({ original: sentence, spoken: text, score, diff, audioUrl, originalAudioUrl, originalCues, lang, at: Date.now() })
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
    <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col">
      <div className="flex items-center gap-1.5 mb-2 text-[#f4cf93]">
        <Zap size={12} className="fill-warning" />
        <span className="text-[10px] font-semibold uppercase tracking-wider">{t('repeatSentence')}</span>
      </div>

      {/* Target sentence */}
      <div className="rounded-xl bg-white/[0.05] border border-white/[0.08] px-3.5 py-3 mb-2.5">
        <p className="text-[18px] font-semibold text-white leading-relaxed break-words">{sentence}</p>
        <div className="mt-1.5 flex items-center gap-3">
          {originalAudioUrl && (
            <button
              onClick={() => playClip(originalAudioUrl)}
              className="flex items-center gap-1 text-[11px] text-white/65 hover:text-white transition-colors"
              title={t('listenOriginalScene')}
            >
              <Volume2 size={11} /> Original
            </button>
          )}
          <button
            onClick={() => speakViaTts(sentence, lang)}
            className="flex items-center gap-1 text-[11px] text-white/55 hover:text-white transition-colors"
            title={t('listenTtsClear')}
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
              result.score >= 80 ? 'text-success' : result.score >= 50 ? 'text-[#f4cf93]' : 'text-[#ffb3ad]',
            ].join(' ')}>{result.score}%</span>
            <span className="text-xs text-white/50">{t('accuracy')}</span>
            <button
              onClick={() => playClip(result.audioUrl)}
              className="ml-auto flex items-center gap-1 text-[11px] text-white/65 hover:text-white transition-colors"
              title={t('listenMyRecording')}
            >
              <Volume2 size={11} /> {t('myVoice')}
            </button>
          </div>
          <DiffView diff={result.diff} />
        </>
      ) : (
        <p className="text-xs text-white/55 italic mb-2">
          {counting ? `${t('recordingIn')} ${countdown}...` : recording ? t('recordingNow') : busy ? t('evaluating') : t('clickRecordWhenReady')}
        </p>
      )}

      {/* Controls */}
      <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
        {recording ? (
          <button onClick={stop} className="flex-1 bg-danger text-white py-2.5 rounded-xl text-xs font-semibold hover:bg-danger/90">
            {t('stop')}
          </button>
        ) : (
          <button onClick={run} disabled={counting || busy} className="flex-1 bg-warning/20 text-[#f4cf93] border border-warning/40 py-2.5 rounded-xl text-xs font-semibold hover:bg-warning/30 disabled:opacity-40">
            <Mic size={12} className="inline mr-1" />{result ? t('repeatAgain') : t('record')}
          </button>
        )}
        <button onClick={finish} className="flex-1 bg-white/10 text-white py-2.5 rounded-xl text-xs font-semibold hover:bg-white/15">
          {result ? t('continueWord') : t('skip')}
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
        'flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-[11px] transition-colors',
        active
          ? 'bg-white/12 text-white'
          : 'text-white/62 hover:text-white hover:bg-white/[0.06]',
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
  const t = useT()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines, currentTranscript])

  return (
    <div className="flex-1 min-h-0 overflow-y-auto py-3 px-3.5 space-y-2">
      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-[#ffb3ad]">
          {error}
        </div>
      )}

      {lines.length === 0 && !currentTranscript && !error && (
        <div className="flex flex-col items-center justify-center h-full gap-1.5 text-white/40 py-3">
          <Mic size={20} className="opacity-30" />
          <p className="text-xs">{t('pressListenHint')}</p>
        </div>
      )}

      {lines.map((line, i) => (
        <div
          key={i}
          className="fade-up rounded-xl bg-white/[0.05] border border-white/[0.06] px-3 py-2.5"
        >
          <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1 font-semibold">{t('audioLabel')}</p>
          <p className="text-sm text-white/90 leading-relaxed">{line}</p>
        </div>
      ))}

      {currentTranscript && (
        <div className="rounded-xl border border-primary/35 bg-primary/10 px-3 py-2.5">
          <p className="text-[10px] text-white/45 uppercase tracking-wider mb-1 font-semibold">{t('capturing')}</p>
          <p className="text-sm text-white/70 leading-relaxed">{currentTranscript}</p>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}

// ── Session feed (my practice attempts) ───────────────────────────────────────
function SessionList({ attempts }: { attempts: SessionAttempt[] }) {
  const t = useT()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [attempts])

  if (attempts.length === 0) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 text-white/40">
        <User size={24} className="opacity-30" />
        <p className="text-xs px-6 text-center">{t('practiceSpeechHere')}</p>
        <p className="text-[10px] opacity-60 px-6 text-center">{t('practiceHint')}</p>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto py-3 px-3.5 space-y-2">
      {attempts.map((a, i) => (
        <div key={i} className="rounded-xl bg-white/[0.05] border border-white/[0.06] px-3 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-white/45 uppercase tracking-wider font-semibold">{t('attempt')} #{i + 1}</span>
              {a.audioUrl && (
                <button
                  onClick={() => playClip(a.audioUrl)}
                  className="flex items-center gap-1 text-[11px] text-white/70 hover:text-white transition-colors"
                  title={t('listenMyRecording')}
                >
                  <Volume2 size={12} /> {t('listen')}
                </button>
              )}
            </div>
            <span className={[
              'text-sm font-bold',
              a.score >= 80 ? 'text-success' : a.score >= 50 ? 'text-[#f4cf93]' : 'text-[#ffb3ad]',
            ].join(' ')}>{a.score}%</span>
          </div>

          {/* Original */}
          <p className="text-[11px] text-white/40 mb-1 font-semibold">Original</p>
          <p className="text-[13px] text-white/75 mb-2 leading-[1.45]">{a.original}</p>

          {/* Full raw speech (nothing hidden) */}
          <p className="text-[11px] text-white/40 mb-1 font-semibold">{t('youSaid')}</p>
          <p className="text-[13px] text-white/92 mb-2 leading-[1.45]">{a.spoken}</p>

          {/* Word-by-word diff (ok / missing / extra) */}
          <DiffView diff={a.diff} />

          {/* Rigorous drill of the words you got wrong */}
          <WordDrill attempt={a} />

          {/* Intonation comparator: my voice vs original vs TTS */}
          <PronunciationCompare attempt={a} />
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
