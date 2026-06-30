import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Mic, MicOff, Loader2, Settings, X, Volume2, User, Zap, Globe, Target } from 'lucide-react'
import { windowAPI, audioAPI, tutorAPI, onChannel, storeAPI, mediaAPI, ttsAPI, sessionAPI, floatingBarAPI, settingsAPI, syncAPI } from '../services/electron'
import { floatingBarMode } from '../lib/floatingBar'
import { uiText, appLanguage, type AppLanguage } from '../lib/uiLanguage'
import { normalizeContentLanguage } from '../lib/contentLanguages'
import { openMicStream } from '../lib/audioDevices'
import { languageNameFor, languageFlagCountry } from '../lib/languages'
import { flagAssetForCountry } from '../lib/flagAssets'
import { UiLangProvider, useT, useUiLang } from '../lib/uiLangContext'
import { isVoiced, peakLevel } from '../lib/audio'
import { shouldRunInterim, resolveFinalText } from '../lib/interimTranscription'
import { addLangVote, lockedLanguage, type LangVotes } from '../lib/sessionLanguage'
import { createDrainController, type DrainController } from '../lib/utteranceQueue'
import { isLikelyDuplicate } from '../lib/transcriptDedup'
import { diffWords, scoreFromDiff } from '../lib/text'
import { onSentence, onPracticeDone, onAbort, INITIAL_MONITOR, type MonitorState, type PracticeItem } from '../lib/monitor'
import { usePractice, practiceMaxMs, blobToDataUrl } from '../hooks/usePractice'
import { decodeBufferToMono } from '../lib/decodeAudio'
import { encodeWav } from '../lib/wav'
import { normalizeSamples } from '../lib/audioNormalize'

/**
 * Re-encode a recorded blob to clean WAV (for reliable word timestamps and slicing) and
 * NORMALIZE quiet speech so Whisper reads it better (the gate before this already rejected
 * silence/noise, so amplifying here is safe and only helps accuracy).
 */
async function toWavOrRaw(blob: Blob): Promise<{ buffer: ArrayBuffer; mimeType: string }> {
  const raw = await blob.arrayBuffer()
  const decoded = await decodeBufferToMono(raw)
  return decoded
    ? { buffer: encodeWav([normalizeSamples(decoded.samples)], decoded.sampleRate), mimeType: 'audio/wav' }
    : { buffer: raw, mimeType: blob.type || 'audio/webm' }
}
import DiffView from '../components/DiffView'
import PronunciationCompare from '../components/PronunciationCompare'
import WordDrill from '../components/WordDrill'
import PronunciationDiagnostic from '../components/PronunciationDiagnostic'
import { wordDrillItems } from '../lib/pronunciationProfile'
import { sessionMistakes } from '../lib/sessionDrill'
import { playClip } from '../lib/playClip'
import type { SessionAttempt, DiffToken, WordCue } from '../types'

type State = 'idle' | 'listening'

interface QueuedUtterance { blob: Blob; mimeType: string; liveText: string; utterId: number }

function formatSessionTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':')
}

const VAD_TICK_MS    = 80    // how often the VAD samples the analyser
const SILENCE_END_MS = 1050  // pausa p/ fechar a frase — menor = texto aparece mais cedo (menos atraso)
const MIN_SPEECH_MS  = 250   // captura fala CURTA (ex.: exclamações coreanas) — o filtro no_speech_prob limpa o ruído
const MAX_SPEECH_MS  = 12_000  // fala longa/contínua é fechada antes (narração rápida não acumula atraso)
const IDLE_TRIM_MS   = 1600  // restart the recorder after this much idle silence (trim leading silence)
const MIN_PEAK       = 20    // gate cru baixo p/ NÃO perder fala quieta; o filtro do Whisper é a rede real anti-ruído
const VAD_THRESHOLD  = 16    // deviation from 128 to count a sample as voiced (lower = catches soft speech)
const VAD_MIN_RATIO  = 0.055 // fraction of samples that must be voiced
const TIMESLICE_MS   = 600   // recorder flushes chunks this often → enables live (interim) transcription
const INTERIM_MS     = 1400  // espaça a prévia ao vivo p/ aliviar o rate limit (20 req/min do Groq free)

// Bandeira como IMAGEM SVG (emoji de bandeira não renderiza no Windows → vira "KR"/"GB").
function FlagImg({ lang, className = '' }: { lang: string; className?: string }) {
  const src = flagAssetForCountry(languageFlagCountry(lang))
  if (!src) return null
  return <img src={src} alt="" aria-hidden className={`inline-block rounded-[2px] object-cover shrink-0 ${className}`} />
}

export default function FloatingBar() {
  const [state, setState]         = useState<State>('idle')
  const [lines, setLines]         = useState<{ text: string; lang: string }[]>([])  // cada linha guarda o idioma falado (p/ bandeira + nome)
  const [interim, setInterim]     = useState('')   // live (in-progress) transcription of the current utterance
  const [transcribing, setTranscribing] = useState(false)  // queue is draining (finalizing utterances)
  const [modelDl, setModelDl] = useState<{ percent: number; active: boolean } | null>(null)  // download da voz (1ª vez)
  const [error, setError]         = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'transcricao' | 'sessao'>('transcricao')
  const [attempts, setAttempts]   = useState<SessionAttempt[]>([])
  const [level, setLevel]         = useState(0)  // live audio peak (0-128) for the meter
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null)
  const [sessionNow, setSessionNow] = useState(Date.now())
  const [uiLang, setUiLang] = useState<AppLanguage>('pt')
  // Idioma do áudio: 'auto' deixa o Whisper detectar (arriscado); um código FORÇA a transcrição
  // naquele idioma desde o 1º clipe (sem flipar ko↔ja / ruído→"you"). Ciclo p/ não cortar na janela.
  const [contentLang, setContentLang] = useState('auto')
  const contentLangRef = useRef('auto')
  const langCycleRef   = useRef<string[]>(['auto', 'en', 'ko'])
  const [detectedLang, setDetectedLang] = useState('')  // idioma detectado na última fala (p/ mostrar bandeira no modo AUTO)
  const uiLangRef = useRef<AppLanguage>('pt')  // p/ usar dentro de callbacks (mensagens de erro)
  const t = (key: Parameters<typeof uiText>[1]) => uiText(uiLang, key)
  const tc = (key: Parameters<typeof uiText>[1]) => uiText(uiLangRef.current, key)  // tradução em callback
  const lastLineRef               = useRef<string>('')
  const sessionLinesRef           = useRef(0)     // lines captured this session
  const sessionPreviewRef         = useRef<string[]>([])
  const sessionLangRef            = useRef<string>('')
  const transcriptLangRef         = useRef<string>('')  // last detected language

  // Auto-practice (monitoring) mode
  const [autoMode, setAutoMode]   = useState(false)
  const autoModeRef               = useRef(false)
  const monitorRef                = useRef<MonitorState>(INITIAL_MONITOR)
  const [practiceSentence, setPracticeSentence] = useState<PracticeItem | null>(null)
  const practiceSentenceRef       = useRef<PracticeItem | null>(null)
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
  const startSegmentRef = useRef<(() => void) | null>(null)  // p/ reiniciar o gravador no resume
  // Encerra a fala atual com OVERLAP (inicia o próximo gravador antes de parar o atual → zero buraco).
  const endUtteranceRef = useRef<((action: 'transcribe' | 'discard', restart: boolean) => void) | null>(null)
  const isSpeaking      = useRef(false)
  const lastVoiceRef    = useRef(0)                       // last time speech was heard
  const speechStartRef  = useRef<number | null>(null)
  const segStartRef     = useRef(0)                       // when current segment started recording
  const utterPeakRef    = useRef(0)  // peak energy seen during current utterance
  const queueRef        = useRef<DrainController<QueuedUtterance> | null>(null)  // serializes finalization
  const pausedRef       = useRef(false) // true while practice recording is active

  // ── Live (interim) transcription ──────────────────────────────────────────
  const mimeTypeRef       = useRef<string>('audio/webm')
  const interimBusyRef    = useRef(false)   // an interim request is in flight
  const lastInterimAtRef  = useRef(0)       // when the last interim was fired
  const utterIdRef        = useRef(0)       // bumps each utterance → rejects stale interim results
  const liveTextRef       = useRef('')      // latest live text of the current utterance (fallback if final fails)
  const langVotesRef      = useRef<LangVotes>({})  // votos de idioma da sessão (peso = tamanho do texto)
  const lockedLangRef     = useRef('')      // idioma TRAVADO → forçado no Whisper p/ não flipar

  const setStateSynced = useCallback((s: State) => {
    stateRef.current = s
    setState(s)
  }, [])

  const stopAll = useCallback(() => {
    // stateRef must already be 'idle' so onstop won't restart a segment
    if (vadTimerRef.current) { clearInterval(vadTimerRef.current); vadTimerRef.current = null }
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
    interimBusyRef.current = false
    liveTextRef.current = ''
    langVotesRef.current = {}
    lockedLangRef.current = ''
    queueRef.current?.clear()
    setInterim('')
    setTranscribing(false)
    if (earlyPausedRef.current) { mediaAPI.resume(); earlyPausedRef.current = false }
  }, [])

  // Transcreve UMA fala finalizada e fixa a linha. Sem guarda de "ocupado" aqui — a serialização
  // é da fila (drainQueue), pra NUNCA descartar uma fala que terminou durante o processamento de outra.
  const processUtterance = useCallback(async (item: QueuedUtterance) => {
    let startedPractice = false
    try {
      // Re-encode to WAV — MediaRecorder's streaming WebM has no container
      // duration, which makes Whisper drop word-level timestamps (no karaoke /
      // word slicing). A clean WAV restores them. Falls back to the raw blob.
      const { buffer, mimeType: playableMimeType } = await toWavOrRaw(item.blob)
      // Dá a última linha como CONTEXTO (prompt) → Whisper acerta mais palavras/nomes recorrentes
      // e mantém continuidade. temperatura 0 + filtro anti-alucinação seguram o "eco" do prompt.
      // allowRetry=true: o FINAL reenviá quando levar 429 (rate limit) → não perde a frase.
      const result = await audioAPI.transcribe(buffer, lastLineRef.current || undefined, lockedLangRef.current || undefined, true)
      // Vota o idioma detectado (peso = tamanho do texto) e atualiza o "lock" da sessão → os próximos
      // clipes vão forçados nesse idioma (para de flipar coreano→japonês / ruído→"you").
      langVotesRef.current = addLangVote(langVotesRef.current, result.language, (result.text ?? '').trim().length)
      lockedLangRef.current = lockedLanguage(langVotesRef.current)
      // Se o final falhar/vier vazio, FIXA a prévia ao vivo (não perde o que apareceu, e ainda vai pro tutor).
      const text = resolveFinalText(result.text ?? '', item.liveText)
      // Se o usuário JÁ parou (OFF), não adiciona nada — nem uma transcrição que ficou em voo
      // (evita "ruído aparecendo com o Listen desligado").
      if (stateRef.current === 'idle') return
      if (!text) {
        if (result.error) setError(result.error)
      } else if (!isLikelyDuplicate(text, lastLineRef.current)) {  // só pula repetição CURTA (alucinação); mantém repetição longa real
        lastLineRef.current = text
        transcriptLangRef.current = result.language ?? transcriptLangRef.current
        sessionLangRef.current = result.language ?? sessionLangRef.current
        sessionLinesRef.current += 1
        sessionPreviewRef.current = [...sessionPreviewRef.current, text].slice(-5)
        // Keep the ORIGINAL captured audio so it can be replayed (in-memory data URL)
        const originalAudioUrl = await blobToDataUrl(new Blob([buffer], { type: playableMimeType }))
        const lineLang = result.language ?? transcriptLangRef.current
        if (lineLang) setDetectedLang(lineLang)
        setLines(prev => [...prev, { text, lang: lineLang }].slice(-400))  // bound the transcript feed
        setError(null)
        tutorAPI.analyze(text, result.language ?? transcriptLangRef.current, originalAudioUrl, result.cues).catch(console.error)

        // Auto-practice: video was already paused at sentence-end; show overlay.
        // O item carrega o áudio/cues/idioma DESTA frase (não o "último clipe" global) → no fim da
        // fila, cada frase treina com o seu próprio áudio (igual ao TutorBoard).
        const item: PracticeItem = { text, audioUrl: originalAudioUrl, cues: result.cues ?? [], lang: lineLang }
        const { state, action } = onSentence(monitorRef.current, item, autoModeRef.current)
        monitorRef.current = state
        if (action === 'pause-and-practice') {
          await mediaAPI.pause()  // idempotent — already paused early
          setPracticeSentence(state.current)
          startedPractice = true
        }
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      // If we paused the video early but no practice started (silent/repeat/empty),
      // resume it so playback isn't left stuck.
      if (earlyPausedRef.current && !startedPractice) mediaAPI.resume()
      earlyPausedRef.current = false
      // Limpa a prévia ao vivo só se NENHUMA fala nova começou desde esta (senão a nova é a dona dela).
      if (item.utterId === utterIdRef.current) setInterim('')
    }
  }, [])

  // Fila (criada uma vez): drena em ORDEM, uma por vez, e nunca descarta. `processRef` mantém o
  // processador atualizado sem recriar a fila a cada render.
  const processRef = useRef(processUtterance)
  useEffect(() => { processRef.current = processUtterance }, [processUtterance])
  if (!queueRef.current) {
    queueRef.current = createDrainController<QueuedUtterance>({
      process: item => processRef.current(item),
      active: () => stateRef.current !== 'idle',
      onBusyChange: setTranscribing,
    })
  }

  const enqueueUtterance = useCallback((blob: Blob, mimeType: string) => {
    queueRef.current?.enqueue({ blob, mimeType, liveText: liveTextRef.current, utterId: utterIdRef.current })
  }, [])

  // Transcrição "ao vivo": re-transcreve o trecho-em-curso (chunks acumulados desde o início da fala,
  // = WebM válido) e atualiza a prévia. Best-effort: erros são ignorados, e resultados obsoletos
  // (fala já trocou/terminou) são descartados pela checagem de utterId + isSpeaking.
  const transcribeInterim = useCallback(async (utterId: number) => {
    if (interimBusyRef.current) return
    const chunks = segChunksRef.current
    if (chunks.length === 0) return
    const blob = new Blob(chunks, { type: mimeTypeRef.current })
    if (blob.size < 1500) return   // áudio curto demais p/ valer a pena
    interimBusyRef.current = true
    try {
      const { buffer } = await toWavOrRaw(blob)
      const result = await audioAPI.transcribe(buffer, undefined, lockedLangRef.current || undefined)
      if (utterId === utterIdRef.current && isSpeaking.current && stateRef.current !== 'idle' && !result.error) {
        const text = (result.text ?? '').trim()
        if (text) { liveTextRef.current = text; setInterim(text) }
      }
    } catch { /* interim é best-effort */ } finally {
      interimBusyRef.current = false
    }
  }, [])

  const startListening = useCallback(async () => {
    setError(null)
    try {
      // ── Fonte da TRANSCRIÇÃO: som do PC (loopback) OU um microfone escolhido nas Configurações ──
      // (A prática de pronúncia usa o microfone próprio no TutorBoard; isto aqui é o que é transcrito.)
      const srcMode = (await settingsAPI.getAll().catch(() => null))?.transcriptionSource || 'system'
      const sysStream = srcMode === 'system'
        ? await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true })
        : await openMicStream(srcMode)
      sysStream.getVideoTracks().forEach(t => t.stop())
      // Som do sistema: desliga o "processamento" do navegador (ganho automático / supressão de ruído /
      // cancelamento de eco) — pensados p/ microfone, distorcem áudio de sistema limpo e pioram a
      // transcrição. No modo microfone deixamos o processamento padrão (ajuda em ambiente real).
      if (srcMode === 'system') {
        sysStream.getAudioTracks().forEach(t =>
          t.applyConstraints({ autoGainControl: false, echoCancellation: false, noiseSuppression: false } as MediaTrackConstraints).catch(() => {}))
      }

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
      mimeTypeRef.current = mimeType

      // ── Segment recorder (sem buraco) ────────────────────────────────
      // Cada gravador grava UMA fala (WebM completo/válido). Ao encerrar, `endUtterance` inicia o
      // PRÓXIMO gravador ANTES de parar o atual (overlap) → não depende do onstop (que atrasa sob
      // carga) e NÃO deixa buraco entre frases. Cada gravador tem seus próprios chunks + ação.
      const recAction = new WeakMap<MediaRecorder, 'transcribe' | 'discard'>()
      const startSegment = () => {
        if (stateRef.current === 'idle' || !ctxRef.current) return
        const rec = new MediaRecorder(dest.stream, { mimeType, audioBitsPerSecond: 256_000 })
        const chunks: Blob[] = []
        rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
        rec.onstop = () => {
          const action = recAction.get(rec) ?? 'discard'
          recAction.delete(rec)
          const blob = new Blob(chunks, { type: mimeType })
          if (action === 'transcribe' && blob.size > 1000) {
            enqueueUtterance(blob, mimeType)  // entra na fila — NUNCA descarta
          } else {
            setInterim('')  // descartado → tira a prévia ao vivo
          }
          // SEM restart aqui — o endUtterance já iniciou o próximo gravador (overlap).
        }
        rec.onerror = () => { setError(tc('recorderError')); setStateSynced('idle'); stopAll() }
        recorderRef.current = rec
        segChunksRef.current = chunks   // a transcrição ao vivo lê os chunks do gravador ATUAL
        segStartRef.current = Date.now()
        rec.start(TIMESLICE_MS)  // entrega chunks periodicamente → permite transcrição ao vivo
      }
      // Inicia o próximo gravador (overlap) e só então para o atual. restart=false na pausa.
      const endUtterance = (action: 'transcribe' | 'discard', restart: boolean) => {
        const old = recorderRef.current
        if (restart && stateRef.current !== 'idle' && !pausedRef.current) startSegment()
        if (old && old.state === 'recording') {
          recAction.set(old, action)
          try { old.stop() } catch { /* ignore */ }
        }
      }
      startSegmentRef.current = startSegment
      endUtteranceRef.current = endUtterance

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
            utterIdRef.current += 1          // nova fala → invalida interinas antigas
            lastInterimAtRef.current = now   // não dispara interim no 1º instante (pouco áudio)
            liveTextRef.current = ''         // prévia fresca p/ esta fala
            setInterim('')                   // limpa a prévia da fala anterior ao começar uma nova
          }
          lastVoiceRef.current = now
          if (peak > utterPeakRef.current) utterPeakRef.current = peak

          // Transcrição ao vivo: re-transcreve o trecho-em-curso a cada ~INTERIM_MS enquanto fala
          if (shouldRunInterim({ speaking: true, busy: interimBusyRef.current, now, lastRunAt: lastInterimAtRef.current, intervalMs: INTERIM_MS })) {
            lastInterimAtRef.current = now
            transcribeInterim(utterIdRef.current)
          }

          // Force-flush very long utterances
          if (now - (speechStartRef.current ?? now) >= MAX_SPEECH_MS) {
            isSpeaking.current = false
            endUtterance(utterPeakRef.current >= MIN_PEAK ? 'transcribe' : 'discard', true)
          }
        } else if (isSpeaking.current) {
          const silenceDur = now - lastVoiceRef.current
          const speechDur  = now - (speechStartRef.current ?? now)
          if (silenceDur >= SILENCE_END_MS) {
            // Sentence complete → flush a full file (or discard if too short/quiet)
            isSpeaking.current = false
            const ok = speechDur >= MIN_SPEECH_MS && utterPeakRef.current >= MIN_PEAK
            // Auto-treino: pause the video the instant the sentence ends (before
            // the ~1s transcription) so we stop exactly on the right line.
            if (ok && autoModeRef.current && monitorRef.current.phase === 'watching') {
              earlyPausedRef.current = true
              mediaAPI.pause()
            }
            endUtterance(ok ? 'transcribe' : 'discard', true)
          }
        } else {
          // Idle silence — periodically restart to trim accumulated leading silence
          if (now - segStartRef.current >= IDLE_TRIM_MS) {
            endUtterance('discard', true)
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
  }, [setStateSynced, stopAll, enqueueUtterance, transcribeInterim])

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
      }).then(() => syncAPI.backup()).catch(console.error)  // fim da sessão → backup na nuvem
      sessionLinesRef.current = 0
      sessionPreviewRef.current = []
      sessionLangRef.current = ''
    }
  }, [setStateSynced, stopAll])

  // Alterna o idioma do áudio (Auto → idiomas aprendidos). Persiste no settings; o audioService
  // lê de lá a cada clipe, então passa a forçar o Whisper já na próxima frase (sem reiniciar).
  const cycleContentLang = useCallback(() => {
    const cyc = langCycleRef.current
    const next = cyc[(cyc.indexOf(contentLangRef.current) + 1) % cyc.length]
    contentLangRef.current = next
    setContentLang(next)
    // 'auto' volta a deixar o lock por votação agir; código fixo zera o lock pra não brigar.
    if (next !== 'auto') lockedLangRef.current = next
    else { lockedLangRef.current = ''; langVotesRef.current = {} }
    settingsAPI.set('contentLanguage', next).catch(() => {})
  }, [])

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
    const load = () => settingsAPI.getAll().then(s => {
      const lang = appLanguage(s.appLanguage)
      setUiLang(lang)
      uiLangRef.current = lang

      // Idioma do áudio atual + ciclo do seletor = 'auto' + idiomas que o usuário aprende.
      const cl = normalizeContentLanguage(s.contentLanguage)
      setContentLang(cl)
      contentLangRef.current = cl
      const learn = (s.learnLanguages || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean)
      const cycle = Array.from(new Set(['auto', ...learn, cl]))
      langCycleRef.current = cycle.length > 1 ? cycle : ['auto', 'en', 'ko']
    }).catch(() => {})
    load()
    return onChannel('settings:changed', load)   // idioma/ajustes mudam na hora (sem reiniciar)
  }, [])

  useEffect(() => {
    return onChannel('shortcut:fired', (action) => {
      if (action === 'toggle-listening') toggle()
    })
  }, [toggle])

  // Progresso do download do modelo de voz (Kokoro) na 1ª vez → mostra a barra.
  useEffect(() => onChannel('tts:model-progress', (p) => setModelDl(p as { percent: number; active: boolean })), [])

  useEffect(() => {
    const unPause  = onChannel('listening:pause',  () => {
      if (pausedRef.current) return
      pausedRef.current = true   // tick para de rodar
      // FLUSH do trecho-até-aqui SEM reiniciar (restart=false): transcreve a frase em andamento
      // (não perde ao pausar/tocar um áudio) e NÃO grava durante a pausa (não capta o clipe tocado).
      const rec = recorderRef.current
      if (rec?.state === 'recording') {
        const speechDur = Date.now() - (speechStartRef.current ?? Date.now())
        const ok = isSpeaking.current && speechDur >= MIN_SPEECH_MS && utterPeakRef.current >= MIN_PEAK
        isSpeaking.current = false
        endUtteranceRef.current?.(ok ? 'transcribe' : 'discard', false)
      }
    })
    const unResume = onChannel('listening:resume', () => {
      if (!pausedRef.current) return
      pausedRef.current = false
      isSpeaking.current   = false
      speechStartRef.current  = null
      lastVoiceRef.current = Date.now()
      setInterim('')
      // Retoma a captura num segmento NOVO (o flush da pausa já parou o gravador anterior).
      if (stateRef.current !== 'idle' && recorderRef.current?.state !== 'recording') startSegmentRef.current?.()
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
  const sessionTime = sessionStartedAt ? formatSessionTime(sessionNow - sessionStartedAt) : '00:00:00'

  // A janela abre COMPACTA (vazia/ociosa) e cresce para CHEIA só quando há conteúdo a mostrar
  // (escuta/processamento, treino, ou um feed com itens). Pede o tamanho ao processo main.
  useEffect(() => {
    floatingBarAPI.setMode(floatingBarMode({
      busy: state !== 'idle' || transcribing,
      practicing: !!practiceSentence,
      tab: activeTab,
      lineCount: lines.length,
      attemptCount: attempts.length,
    }))
  }, [state, transcribing, practiceSentence, activeTab, lines.length, attempts.length])

  return (
    <UiLangProvider value={uiLang}>
    <div className="flex flex-col h-screen max-h-screen select-none overflow-hidden rounded-[20px] border border-white/15 text-[#EAF0EA] shadow-[var(--sh-bar)]"
      style={{
        background: 'linear-gradient(180deg, rgba(28,58,52,.94), rgba(20,44,40,.96))',
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
        <div className="flex items-center gap-0.5 flex-1 min-w-0" style={{ WebkitAppRegion: 'no-drag' }}>
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

        {/* Right controls (status/timer foi pra barra de baixo → topo só com idioma/ajustes) */}
        <div className="shrink-0 flex items-center gap-1 pb-2" style={{ WebkitAppRegion: 'no-drag' }}>
          {/* Seletor de idioma do áudio (trava o Whisper) */}
          <button
            onClick={cycleContentLang}
            className={[
              'shrink-0 flex items-center gap-1 h-[26px] px-1.5 rounded-full text-[10px] font-bold tracking-wide transition-colors',
              contentLang === 'auto'
                ? 'bg-white/5 text-white/55 hover:text-white hover:bg-white/10'
                : 'bg-[#7fe3cf]/15 text-[#7fe3cf] hover:bg-[#7fe3cf]/25',
            ].join(' ')}
            title={t('audioLangTitle')}
          >
            {contentLang === 'auto'
              ? (detectedLang
                  ? <FlagImg lang={detectedLang} className="w-[16px] h-[12px]" />
                  : <Globe size={12} className="shrink-0" />)
              : <><FlagImg lang={contentLang} className="w-[16px] h-[12px]" />{contentLang.toUpperCase()}</>}
          </button>
          <button
            onClick={() => windowAPI.show('settings')}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-[9px] text-white/55 hover:text-white hover:bg-white/10 transition-colors"
            title={t('settings')}
          >
            <Settings size={12} />
          </button>
          <button
            onClick={() => windowAPI.hide()}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-[9px] text-white/55 hover:text-[#ffb3ad] hover:bg-white/10 transition-colors"
            title={t('hide')}
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* ── Download da voz local (Kokoro) na 1ª vez ───────────── */}
      {modelDl?.active && (
        <div className="shrink-0 px-3.5 py-2 border-b border-white/[0.06] bg-white/[0.03]">
          <div className="flex items-center justify-between text-[10px] text-white/60 mb-1">
            <span>{t('downloadingVoice')}</span>
            <span className="font-mono">{modelDl.percent}%</span>
          </div>
          <div className="h-1 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-primary transition-all duration-200" style={{ width: `${modelDl.percent}%` }} />
          </div>
        </div>
      )}

      {/* ── Feed / Auto-practice overlay ───────────────────────── */}
      {/* Sessão tab always shows attempts; the overlay only covers Transcrição */}
      {activeTab === 'sessao' ? (
        <SessionList attempts={attempts} />
      ) : practiceSentence ? (
        <AutoPractice
          key={practiceSentence.audioUrl ?? practiceSentence.text}
          sentence={practiceSentence.text}
          lang={practiceSentence.lang}
          originalAudioUrl={practiceSentence.audioUrl}
          originalCues={practiceSentence.cues}
          onDone={handlePracticeDone}
        />
      ) : (
        <TranscriptList
          lines={lines}
          interim={interim}
          processing={transcribing}
          error={error}
        />
      )}

      {/* ── Audio level meter (diagnostic) ─────────────────────── */}
      {isListening && !practiceSentence && <AudioMeter level={level} gate={MIN_PEAK} />}

      {/* Status + tempo da sessão — movido do topo pra cá (libera espaço pras abas) */}
      <div
        className="shrink-0 flex items-center justify-center gap-2 px-3 pt-2 border-t border-white/[0.08] text-[10px] font-extrabold tracking-wider bg-white/[0.03]"
        style={{ WebkitAppRegion: 'no-drag' }}
        title={t('sessionTimeTitle')}
      >
        <span className={['flex items-center gap-1.5', isListening ? 'text-[#ffb3ad]' : 'text-white/45'].join(' ')}>
          {isListening
            ? <span className="live-dot" />
            : transcribing
            ? <Loader2 size={9} className="animate-spin" />
            : <span className="w-1.5 h-1.5 rounded-full bg-white/30" />}
          {isListening ? t('live') : transcribing ? 'PROC…' : 'OFF'}
        </span>
        {sessionStartedAt && (
          <span className="font-mono tabular-nums font-semibold text-white/65">{sessionTime}</span>
        )}
      </div>

      {/* ── Bottom bar ─────────────────────────────────────────── */}
      <div
        className="shrink-0 px-3 pt-2 pb-3 grid grid-cols-[92px_minmax(162px,1fr)_92px] gap-2 bg-white/[0.03]"
        style={{ WebkitAppRegion: 'no-drag' }}
      >
        <button
          onClick={toggle}
          className={[
            'pill-button w-full min-w-0 px-2.5 py-2 text-[12px] transition-all overflow-hidden',
            isListening
              ? 'bg-danger text-white hover:bg-danger/90'
              : 'bg-white/10 text-white hover:bg-white/15',
          ].join(' ')}
        >
          {isListening
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
      title={label}
      className={[
        'shrink-0 flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold rounded-[11px] transition-colors',
        active ? 'bg-white/12 text-white' : 'text-white/62 hover:text-white hover:bg-white/[0.06]',
      ].join(' ')}
    >
      {icon}<span className="truncate">{label}</span>
    </button>
  )
}

// ── Transcript feed ───────────────────────────────────────────────────────────
// `interim` é a transcrição AO VIVO da fala em curso — aparece numa linha destacada com cursor
// e vai sendo reescrita enquanto a pessoa fala; ao terminar, vira uma linha fixa em `lines`.
export function TranscriptList({ lines, interim, processing, error }: {
  lines: { text: string; lang: string }[]
  interim: string
  processing: boolean
  error: string | null
}) {
  const t = useT()
  const uiLang = useUiLang()
  const bottomRef = useRef<HTMLDivElement>(null)

  // Acompanha o final enquanto a prévia ao vivo cresce / chegam novas linhas.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines, interim, processing])

  const showDots = processing && !interim  // finalizando sem prévia (ex.: interim falhou)

  return (
    <div className="flex-1 min-h-0 overflow-y-auto py-3 px-3.5 space-y-2">
      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-[#ffb3ad]">
          {error}
        </div>
      )}

      {lines.length === 0 && !interim && !processing && !error && (
        <div className="flex flex-col items-center justify-center h-full gap-1.5 text-white/40 py-3">
          <Mic size={20} className="opacity-30" />
          <p className="text-xs">{t('pressListenHint')}</p>
        </div>
      )}

      {lines.map((line, i) => (
        <div
          key={i}
          className="fade-up rounded-xl bg-white/[0.05] border border-white/[0.06] px-3 py-2.5 min-w-0"
        >
          <p className="flex items-center gap-1.5 text-[10px] text-white/45 tracking-wider mb-1 font-semibold">
            <FlagImg lang={line.lang} className="w-[15px] h-[11px]" />
            <span className="uppercase truncate">{languageNameFor(line.lang, uiLang)}</span>
          </p>
          <p className="text-sm text-white/90 leading-relaxed break-words">{line.text}</p>
        </div>
      ))}

      {/* Linha ao vivo (transcrição em curso) */}
      {interim && (
        <div data-testid="interim-line" className="rounded-xl border border-primary/35 bg-primary/10 px-3 py-2.5 min-w-0">
          <p className="text-[10px] text-white/45 uppercase tracking-wider mb-1 font-semibold">{t('capturing')}</p>
          <p className="text-sm text-white/80 leading-relaxed break-words">
            {interim}
            <span className="inline-block w-[2px] h-[1em] align-text-bottom bg-primary/80 ml-0.5 animate-pulse" aria-hidden />
          </p>
        </div>
      )}

      {showDots && (
        <div data-testid="processing-dots" className="rounded-xl border border-primary/35 bg-primary/10 px-3 py-2.5 flex items-center gap-2">
          <span className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/80 animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-primary/80 animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-primary/80 animate-bounce" />
          </span>
          <p className="text-[10px] text-white/45 uppercase tracking-wider font-semibold">{t('capturing')}</p>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}

// ── Session feed (my practice attempts) ───────────────────────────────────────
function SessionList({ attempts }: { attempts: SessionAttempt[] }) {
  const t = useT()
  const uiLang = useUiLang()
  const bottomRef = useRef<HTMLDivElement>(null)
  const [drillOpen, setDrillOpen] = useState(false)

  // Erros (palavras 'missing') de TODA a sessão → drill de pronúncia em um clique.
  const mistakes = useMemo(() => sessionMistakes(attempts), [attempts])
  const drillItems = useMemo(() => wordDrillItems(mistakes.lang, mistakes.words), [mistakes])

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
    <div className="flex-1 min-h-0 flex flex-col">
      {drillItems.length > 0 && (
        <div className="px-3.5 pt-3 shrink-0">
          <button
            onClick={() => setDrillOpen(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary/90 hover:bg-primary text-white text-[13px] font-semibold py-2 transition-colors"
          >
            <Target size={14} /> {t('trainSessionMistakes')} ({mistakes.words.length})
          </button>
        </div>
      )}
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

      {drillOpen && (
        <PronunciationDiagnostic
          lang={mistakes.lang}
          uiLang={uiLang}
          items={drillItems}
          title={t('trainSessionMistakes')}
          onClose={() => setDrillOpen(false)}
        />
      )}
    </div>
  )
}
