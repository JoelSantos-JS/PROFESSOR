import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { BookOpen, Lightbulb, Mic, Volume2, RefreshCw, XCircle } from 'lucide-react'
import TitleBar from '../components/TitleBar'
import DiffView from '../components/DiffView'
import { audioAPI, onChannel, ttsAPI, listeningAPI, sessionAPI, tutorAPI, storeAPI } from '../services/electron'
import { diffWords, scoreFromDiff, segmentText, wordMatches } from '../lib/text'
import { playbackProgress, tokenAtProgress, findWordCue } from '../lib/tts'
import { capAudioMemory } from '../lib/audioCache'
import { playClip, playRatioSlice, playSlice } from '../lib/playClip'
import { connectedSpeech, hasConnectedSpeech } from '../lib/connectedSpeech'

const isEnglishContent = (lang: string) => lang === 'en' || lang.startsWith('en-')
import { usePractice } from '../hooks/usePractice'
import type { TutorAnalysis, WordCue, WordLookup, DiffToken } from '../types'

/** Read a Blob into a base64 data URL (for replaying the user's recording). */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

const ROMANIZATION_LABEL: Record<string, string> = {
  zh: 'Pinyin', 'zh-CN': 'Pinyin', 'zh-TW': 'Pinyin',
  ja: 'Romaji', ko: 'Romanização',
  th: 'Romanização', ar: 'Transliteração', ru: 'Transliteração', hi: 'Transliteração',
}

// Lookup with base-language fallback (zh-Hans → zh)
function romanLabel(lang: string): string {
  return ROMANIZATION_LABEL[lang] ?? ROMANIZATION_LABEL[lang.split('-')[0]] ?? 'Rom.'
}

let currentAudio: HTMLAudioElement | null = null

interface SpeakOpts {
  onProgress?: (fraction: number) => void  // playback progress 0..1 for karaoke
  onEnd?: () => void
}

/**
 * Synthesize + play `text`. Pauses the live listener during playback to avoid
 * the loopback re-capturing our own TTS. When word-boundary cues are available,
 * calls onActive(idx) as each word is spoken (karaoke-style sync).
 */
async function speak(text: string, lang: string, opts?: SpeakOpts): Promise<WordCue[]> {
  const finish = () => { listeningAPI.resume(); opts?.onEnd?.() }
  try {
    currentAudio?.pause()
    listeningAPI.pause()
    const res = await ttsAPI.speak(text, lang)
    if (!res.ok || !res.dataUrl) { finish(); return [] }

    const cues = res.cues ?? []
    const audio = new Audio(res.dataUrl)
    currentAudio = audio

    let raf = 0
    const stopRaf = () => cancelAnimationFrame(raf)
    if (opts?.onProgress) {
      const tick = () => {
        if (currentAudio !== audio) return
        const dur = Number.isFinite(audio.duration) ? audio.duration * 1000 : 0
        opts.onProgress!(playbackProgress(cues, audio.currentTime * 1000, dur))
        raf = requestAnimationFrame(tick)
      }
      audio.onplaying = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(tick) }
    }
    const end = () => { stopRaf(); finish() }
    audio.onended = end
    audio.onerror = end

    await audio.play().catch(err => { finish(); console.error('[tts] play() rejected:', err) })
    return cues
  } catch (err) {
    finish()
    console.error('[tts] speak error:', err)
    return []
  }
}

type Entry = TutorAnalysis & { id: string }

export default function TutorBoard() {
  const [entries, setEntries] = useState<Entry[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return onChannel('tutor:analysis', (raw) => {
      const analysis = raw as TutorAnalysis
      if (!analysis.transcript) return
      // Stable id so React keeps each card's local state with its entry even
      // when capAudioMemory drops older ones (index keys would misalign state).
      const entry: Entry = { ...analysis, id: crypto.randomUUID() }
      // Keep entries under the in-memory audio budget (drops oldest clips)
      setEntries(prev => capAudioMemory([...prev, entry], undefined, e => e.originalAudioUrl))
      // Persist the whole SENTENCE as a spaced-repetition card (not single words)
      const translation = analysis.translation ?? analysis.englishText ?? ''
      if (analysis.transcript.trim() && translation) {
        storeAPI.addVocab([{
          word: analysis.transcript,
          romanization: analysis.romanization,
          translation,
          lang: analysis.contentLanguage,
        }]).catch(console.error)
      }
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries])

  return (
    <div className="flex flex-col h-screen app-paper text-foreground overflow-hidden">
      <TitleBar title="Tutor Board" />

      {entries.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted">
          <Mic size={36} className="opacity-30" />
          <p className="display-title text-xl text-foreground">Aguardando áudio...</p>
          <p className="text-sm opacity-70">As análises aparecerão aqui automaticamente.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="max-w-[720px] mx-auto mb-1">
            <h1 className="display-title text-2xl">Tutor Board</h1>
            <p className="text-sm text-muted">{entries.length} frases capturadas desta sessão</p>
          </div>
          {entries.map((entry, i) => (
            <EntryCard key={entry.id} entry={entry} index={i + 1} />
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  )
}

// Practice state per card
type PracticeState = 'idle' | 'countdown' | 'recording' | 'transcribing' | 'result'

function EntryCard({ entry, index }: { entry: TutorAnalysis; index: number }) {
  const [practice, setPractice] = useState<PracticeState>('idle')
  const [countdown, setCountdown] = useState(3)
  const [result, setResult] = useState<{ diff: DiffToken[]; score: number } | null>(null)

  // Playback + karaoke sync state (shared by TTS and Original)
  const [playMode, setPlayMode] = useState<'idle' | 'tts' | 'original'>('idle')
  const [progress, setProgress] = useState(-1)  // 0..1 while playing, -1 idle

  const speaking    = playMode === 'tts'
  const syncProgress = playMode === 'idle' ? -1 : progress

  // Re-render (move the underline) ONLY when the highlighted word changes, not on
  // every animation frame — avoids 60fps re-renders of the whole card, which was
  // the main source of visible lag.
  const wordCount = useMemo(
    () => segmentText(entry.transcript, entry.contentLanguage).filter(s => s.isWord).length,
    [entry.transcript, entry.contentLanguage],
  )
  const lastWordRef = useRef(-1)
  const emitProgress = useCallback((p: number) => {
    const w = tokenAtProgress(p, wordCount)
    if (w !== lastWordRef.current) { lastWordRef.current = w; setProgress(p) }
  }, [wordCount])
  const resetSync = useCallback(() => { lastWordRef.current = -1; setPlayMode('idle'); setProgress(-1) }, [])

  // Word dictionary lookup
  const [lookup, setLookup] = useState<{ word: string; wordIndex: number; approxStart: number; approxEnd: number; loading: boolean; data?: WordLookup } | null>(null)

  const handleWordClick = useCallback(async (word: string, wordIndex: number, approxStart: number, approxEnd: number) => {
    const clean = word.trim()
    if (!clean) return
    setLookup({ word: clean, wordIndex, approxStart, approxEnd, loading: true })
    const res = await tutorAPI.lookup(clean, entry.transcript, entry.contentLanguage)
    setLookup({ word: clean, wordIndex, approxStart, approxEnd, loading: false, data: res.ok ? res.result : undefined })
  }, [entry.transcript, entry.contentLanguage])

  const recorderRef    = useRef<MediaRecorder | null>(null)
  const streamRef      = useRef<MediaStream | null>(null)
  const chunksRef      = useRef<Blob[]>([])
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const pausedByMeRef  = useRef(false)

  // Tear down practice on unmount (e.g. an old card dropped by the audio cache)
  // so timers/recorder/mic stream don't leak and listening isn't left paused.
  useEffect(() => () => {
    if (countdownTimer.current) clearInterval(countdownTimer.current)
    const rec = recorderRef.current
    if (rec) { rec.onstop = null; try { if (rec.state === 'recording') rec.stop() } catch { /* ignore */ } }
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    recorderRef.current = null
    if (pausedByMeRef.current) { listeningAPI.resume(); pausedByMeRef.current = false }
  }, [])

  const handleListen = useCallback(async () => {
    setPlayMode('tts'); lastWordRef.current = -1; setProgress(0)
    await speak(entry.transcript, entry.contentLanguage, {
      onProgress: emitProgress,
      onEnd:      resetSync,
    })
  }, [entry.transcript, entry.contentLanguage, emitProgress, resetSync])

  // Play the ORIGINAL captured audio, underlining the text word-by-word.
  // Uses Whisper word cues when available, else falls back to elapsed/duration.
  const handleOriginal = useCallback(() => {
    if (!entry.originalAudioUrl) return
    const cues = entry.originalCues ?? []
    setPlayMode('original'); lastWordRef.current = -1; setProgress(0)
    playClip(entry.originalAudioUrl, {
      onTime: (ms, dur) => emitProgress(playbackProgress(cues, ms, dur)),
      onEnd:  resetSync,
    })
  }, [entry.originalAudioUrl, entry.originalCues, emitProgress, resetSync])

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop()
    recorderRef.current = null
    listeningAPI.resume()
    pausedByMeRef.current = false
  }, [])

  const startPractice = useCallback(async () => {
    setResult(null)
    setPractice('countdown')
    setCountdown(3)

    let c = 3
    countdownTimer.current = setInterval(() => {
      c--
      setCountdown(c)
      if (c <= 0) {
        clearInterval(countdownTimer.current!)
        beginRecording()
      }
    }, 1000)
  }, []) // eslint-disable-line

  const beginRecording = useCallback(async () => {
    listeningAPI.pause()
    pausedByMeRef.current = true
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = micStream
      const mimeType  = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
      const recorder  = new MediaRecorder(micStream, { mimeType })
      recorderRef.current = recorder
      chunksRef.current   = []

      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }

      recorder.onstop = async () => {
        micStream.getTracks().forEach(t => t.stop())
        streamRef.current = null
        listeningAPI.resume()
        pausedByMeRef.current = false
        setPractice('transcribing')

        const blob = new Blob(chunksRef.current, { type: mimeType })
        if (blob.size < 500) { setPractice('idle'); return }

        try {
          const buf      = await blob.arrayBuffer()
          const audioUrl = await blobToDataUrl(blob)   // keep my own recording to replay
          const res      = await audioAPI.transcribe(buf)
          if (res.text) {
            const diff  = diffWords(entry.transcript, res.text)
            const score = scoreFromDiff(diff)
            setResult({ diff, score })
            setPractice('result')
            // Record mispronounced words (in original but not spoken correctly)
            const missed = diff.filter(d => d.status === 'missing').map(d => ({ word: d.word, lang: entry.contentLanguage }))
            if (missed.length) storeAPI.recordMistakes(missed).catch(console.error)
            // Send my speech (+ audio) to the FloatingBar "Sessão" tab
            sessionAPI.addAttempt({
              original: entry.transcript,
              spoken:   res.text,
              score,
              diff,
              audioUrl,
              originalAudioUrl: entry.originalAudioUrl,
              originalCues: entry.originalCues,
              lang:     entry.contentLanguage,
              at:       Date.now(),
            })
          } else {
            setPractice('idle')
          }
        } catch {
          setPractice('idle')
        }
      }

      recorder.start()
      setPractice('recording')

      // Auto-stop scaled to sentence length (~700ms/word + 6s buffer), so long
      // sentences aren't cut off. The "Parar" button still lets you stop early.
      const wordCount = entry.transcript.trim().split(/\s+/).filter(Boolean).length
      const maxMs = Math.min(90_000, Math.max(15_000, wordCount * 700 + 6_000))
      setTimeout(() => { if (recorder.state === 'recording') recorder.stop() }, maxMs)
    } catch {
      listeningAPI.resume()
      pausedByMeRef.current = false
      setPractice('idle')
    }
  }, [entry.transcript])

  return (
    <div className="paper-card fade-up overflow-hidden max-w-[720px] mx-auto">

      {/* Transcript + action buttons */}
      <div className="flex items-start gap-3 px-4 py-3.5 border-b border-border/70">
        <span className="text-[12px] font-bold text-muted mt-1 shrink-0">#{index}</span>
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          {entry.romanization && (
            <p className="text-xs font-mono leading-relaxed">
              <span className="label-eyebrow mr-2">{romanLabel(entry.contentLanguage)}</span>
              <SyncedTokens
                text={entry.romanization}
                progress={syncProgress}
              />
            </p>
          )}
          <SyncedTranscript
            text={entry.transcript}
            lang={entry.contentLanguage}
            progress={syncProgress}
            onWordClick={handleWordClick}
          />
          {isEnglishContent(entry.contentLanguage) && hasConnectedSpeech(entry.transcript) && (
            <p className="text-xs text-warning/80 leading-relaxed mt-0.5 font-mono">
              <span className="text-warning/40 mr-1.5 uppercase text-[10px] tracking-wider">Fala natural</span>
              {connectedSpeech(entry.transcript)}
            </p>
          )}
          {lookup && (
            <WordPopover
              lookup={lookup}
              lang={entry.contentLanguage}
              totalWords={wordCount}
              originalAudioUrl={entry.originalAudioUrl}
              originalCues={entry.originalCues}
              onClose={() => setLookup(null)}
            />
          )}
          {entry.englishText && (
            <p className="text-xs text-muted/80 leading-relaxed mt-1">
              <span className="text-muted/40 mr-1.5 uppercase text-[10px] tracking-wider">EN</span>
              {entry.englishText}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-1.5 shrink-0 mt-0.5 flex-wrap justify-end">
          {entry.originalAudioUrl && (
            <button
              onClick={handleOriginal}
              className="audio-chip audio-orig"
              title="Ouvir o áudio original da cena"
            >
              <span className="dot" />
              <span>Original</span>
            </button>
          )}
          <button
            onClick={handleListen}
            disabled={speaking}
            className={[
              'audio-chip audio-tts',
              speaking ? 'brightness-95' : '',
            ].join(' ')}
            title="Ouvir voz sintetizada (TTS)"
          >
            <span className="dot" />
            <span>{speaking ? 'Ouvindo' : 'TTS'}</span>
          </button>
          <button
            onClick={() => practice === 'idle' || practice === 'result' ? startPractice() : stopRecording()}
            className={[
              'pill-button px-3 py-1.5 text-xs border',
              practice === 'recording'
                ? 'text-danger bg-danger/10 border-danger/30 hover:bg-danger/20'
                : 'text-primary bg-primary/10 border-primary/20 hover:bg-primary/15',
            ].join(' ')}
            title="Praticar pronúncia"
          >
            <RefreshCw size={12} className={practice === 'recording' ? 'animate-spin' : ''} />
            <span>
              {practice === 'countdown' ? `${countdown}...`
                : practice === 'recording'   ? 'Parar'
                : practice === 'transcribing' ? '...'
                : 'Praticar'}
            </span>
          </button>
        </div>
      </div>

      {/* Analysis error (e.g. Gemini billing / rate limit) */}
      {entry.analysisError && (
        <div className="px-5 py-2 border-b border-border/60 bg-danger/5">
          <p className="text-xs text-danger/90">Análise falhou: {entry.analysisError}</p>
        </div>
      )}

      {/* Practice result */}
      {practice === 'result' && result && (
        <div className="px-5 py-3 border-b border-border/60 bg-surface-2">
          <div className="flex items-center gap-2 mb-2">
            <span className={`score-badge ${result.score >= 80 ? 'score-good' : result.score >= 50 ? 'score-ok' : 'score-bad'}`}>
              {result.score}%
            </span>
            <span className="text-xs text-muted">de precisão</span>
          </div>
          <DiffView diff={result.diff} />
        </div>
      )}

      {/* Vocab */}
      {entry.vocab.length > 0 && (
        <div className="px-5 py-3 border-b border-border/60">
          <div className="flex items-center gap-1.5 mb-2.5">
            <BookOpen size={12} className="text-primary" />
            <span className="label-eyebrow text-primary">Vocabulário</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {entry.vocab.map((v, j) => <VocabCard key={j} item={v} lang={entry.contentLanguage} />)}
          </div>
        </div>
      )}

      {/* Tip */}
      {entry.tip && (
        <div className="flex items-start gap-2.5 mx-5 my-3 rounded-xl bg-primary/10 px-3.5 py-3 text-primary">
          <Lightbulb size={15} className="shrink-0 mt-0.5" />
          <p className="text-[13px] leading-relaxed text-primary">{entry.tip}</p>
        </div>
      )}
    </div>
  )
}

// Transcript: clickable words + karaoke highlight during TTS
function SyncedTranscript({ text, lang, progress, onWordClick }: {
  text: string
  lang: string
  progress: number   // 0..1 while playing, -1 idle
  onWordClick: (word: string, wordIndex: number, approxStart: number, approxEnd: number) => void
}) {
  const segments = useMemo(() => segmentText(text, lang), [text, lang])
  const wordCount = segments.filter(s => s.isWord).length
  const active = tokenAtProgress(progress, wordCount)
  const dense = wordCount > 18 || text.length > 120
  const approxRatios = useMemo(() => {
    const weights = segments
      .filter(s => s.isWord)
      .map(s => Math.max(1.4, Array.from(s.text.replace(/[^\p{L}\p{N}]/gu, '')).length * 0.72 + 0.8))
    const total = weights.reduce((sum, weight) => sum + weight, 0) || 1
    let acc = 0
    return weights.map(weight => {
      const start = acc / total
      acc += weight
      return { start, end: acc / total }
    })
  }, [segments])

  let wordIdx = -1
  return (
    <p className={[
      dense
        ? 'text-[15px] leading-[1.7] font-semibold'
        : 'text-[18px] leading-[1.65] font-semibold',
      'text-foreground',
    ].join(' ')}>
      {segments.map((seg, i) => {
        if (!seg.isWord) return <span key={i}>{seg.text}</span>
        wordIdx++
        const clickedIndex = wordIdx
        const approx = approxRatios[clickedIndex] ?? { start: 0, end: 1 }
        const isActive = wordIdx === active
        return (
          <span
            key={i}
            onClick={() => onWordClick(seg.text, clickedIndex, approx.start, approx.end)}
            className={[
              'cursor-pointer transition-all duration-100 px-0.5 rounded',
              isActive
                ? 'bg-primary text-white underline decoration-2 underline-offset-2'
                : 'text-foreground hover:bg-primary/15 hover:text-primary',
            ].join(' ')}
            title="Clique para ouvir e ver o significado"
          >
            {seg.text}
          </span>
        )
      })}
    </p>
  )
}

// Word lookup popover (meaning + variants + listen + practice)
function WordPopover({ lookup, lang, totalWords, originalAudioUrl, originalCues, onClose }: {
  lookup: { word: string; wordIndex: number; approxStart: number; approxEnd: number; loading: boolean; data?: WordLookup }
  lang: string
  totalWords: number
  originalAudioUrl?: string
  originalCues?: WordCue[]
  onClose: () => void
}) {
  const { state, countdown, start, stop, cancel } = usePractice()
  const [attempt, setAttempt] = useState<{ ok: boolean; heard: string } | null>(null)

  // Slice of the original audio for this word. If word timestamps are missing,
  // use a short estimated slice instead of playing the whole sentence.
  const wordCue = originalCues ? findWordCue(originalCues, lookup.word, lookup.wordIndex) : undefined
  const playOriginalWord = () => {
    if (!originalAudioUrl) return
    if (wordCue && wordCue.end > wordCue.start) {
      playSlice(originalAudioUrl, Math.max(0, wordCue.start - 50), wordCue.end + 90)
      return
    }
    playRatioSlice(originalAudioUrl, lookup.approxStart, lookup.approxEnd)
  }

  const practice = () => {
    setAttempt(null)
    start(6_000, ({ text }) => {
      const ok = wordMatches(lookup.word, text)
      setAttempt({ ok, heard: text.trim() })
      if (!ok) storeAPI.recordMistakes([{ word: lookup.word, lang }]).catch(console.error)
    }, lookup.word)  // hint biases Whisper toward the expected word
  }

  // Always resume the listener when the popover unmounts
  useEffect(() => () => cancel(), [cancel])

  const recording = state === 'recording'
  const counting  = state === 'countdown'
  const busy      = state === 'transcribing'

  return (
    <div className="mt-2 rounded-lg border border-primary/30 bg-surface-2 px-3 py-2.5 relative">
      <button
        onClick={() => { cancel(); onClose() }}
        className="absolute top-1.5 right-1.5 text-muted/50 hover:text-danger transition-colors"
        title="Fechar"
      >
        <XCircle size={13} />
      </button>

      <div className="flex items-center gap-2 mb-1.5 pr-5 flex-wrap">
        <span className="text-sm font-semibold text-foreground">{lookup.word}</span>
        {lookup.data?.romanization && (
          <span className="text-xs text-primary/70 font-mono">{lookup.data.romanization}</span>
        )}
        {originalAudioUrl && (
          <button
            onClick={playOriginalWord}
            className="flex items-center gap-0.5 text-[11px] text-[#3E7BB6] hover:brightness-90 transition-all font-semibold"
            title={wordCue ? 'Ouvir a pronúncia original desta palavra' : 'Ouvir um recorte aproximado desta palavra'}
          >
            <Volume2 size={12} /> Original
          </button>
        )}
        <button
          onClick={() => speak(lookup.word, lang)}
          className="flex items-center gap-0.5 text-[11px] text-[#9A6A1E] hover:brightness-90 transition-all font-semibold"
          title="Ouvir voz sintetizada (TTS)"
        >
          <Volume2 size={12} /> TTS
        </button>
        <button
          onClick={() => recording ? stop() : practice()}
          disabled={counting || busy}
          className={[
            'flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md transition-colors',
            recording ? 'text-danger bg-danger/10' : 'text-muted hover:text-warning hover:bg-warning/10',
          ].join(' ')}
          title="Treinar esta palavra"
        >
          <Mic size={11} className={recording ? 'animate-pulse' : ''} />
          {counting ? `${countdown}...` : recording ? 'Parar' : busy ? '...' : 'Praticar'}
        </button>
      </div>

      {/* Practice feedback */}
      {attempt && (
        <div className={[
          'flex items-center gap-1.5 text-xs mb-1.5 px-2 py-1 rounded',
          attempt.ok ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger',
        ].join(' ')}>
          {attempt.ok ? '✓ Boa pronúncia!' : `✗ Ouvi: "${attempt.heard}"`}
        </div>
      )}

      {lookup.loading ? (
        <p className="text-xs text-muted/60 italic">Buscando significado...</p>
      ) : lookup.data && lookup.data.meanings.length > 0 ? (
        <>
          <ol className="text-xs text-foreground/90 space-y-0.5 list-decimal list-inside">
            {lookup.data.meanings.map((m, i) => <li key={i}>{m}</li>)}
          </ol>
          {lookup.data.note && (
            <p className="text-[11px] text-muted/70 mt-1.5 italic">💡 {lookup.data.note}</p>
          )}
        </>
      ) : (
        <p className="text-xs text-muted/60 italic">Sem significado disponível.</p>
      )}
    </div>
  )
}

// Parallel text (e.g. Pinyin) highlighted proportionally to the spoken audio
function SyncedTokens({ text, progress }: { text: string; progress: number }) {
  const tokens = useMemo(() => text.split(/(\s+)/), [text])  // keep whitespace to preserve spacing
  const words  = tokens.filter(t => t.trim())                // only non-space tokens are highlightable
  const active = tokenAtProgress(progress, words.length)

  // Not playing → plain
  if (progress < 0) {
    return <span className="text-primary/80">{text}</span>
  }

  let wordIdx = -1
  return (
    <>
      {tokens.map((tok, i) => {
        if (!tok.trim()) return <span key={i}>{tok}</span>
        wordIdx++
        const isActive = wordIdx === active
        return (
          <span
            key={i}
            className={[
              'transition-all duration-100 rounded px-0.5',
              isActive ? 'bg-primary text-white font-semibold underline decoration-2 underline-offset-2' : 'text-primary/70',
            ].join(' ')}
          >
            {tok}
          </span>
        )
      })}
    </>
  )
}

function VocabCard({ item, lang }: { item: { word: string; romanization?: string; translation: string; example: string }; lang: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setOpen(o => !o)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setOpen(o => !o) }}
      className="text-left rounded-full border border-border bg-surface-2 px-3 py-2 hover:border-primary/50 hover:bg-primary/10 transition-colors group cursor-pointer"
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-foreground">{item.word}</span>
        {item.romanization && <span className="text-xs text-primary/70 font-mono">{item.romanization}</span>}
        <span className="text-xs text-muted">{item.translation}</span>
        <button
          onClick={e => { e.stopPropagation(); speak(item.word, lang) }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-primary"
          title="Ouvir palavra"
        >
          <Volume2 size={10} />
        </button>
      </div>
      {open && item.example && (
        <p className="text-xs text-muted/70 mt-1 italic">{item.example}</p>
      )}
    </div>
  )
}
