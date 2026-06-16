import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { BookOpen, Lightbulb, Mic, Volume2, RefreshCw, XCircle, Repeat, GraduationCap, Gauge } from 'lucide-react'
import TitleBar from '../components/TitleBar'
import DiffView from '../components/DiffView'
import { audioAPI, onChannel, ttsAPI, listeningAPI, sessionAPI, tutorAPI, storeAPI, settingsAPI } from '../services/electron'
import { diffWords, scoreFromDiff, segmentText, wordMatches } from '../lib/text'
import { playbackProgress, tokenAtProgress, findWordCue } from '../lib/tts'
import { capAudioMemory } from '../lib/audioCache'
import { playClip, playRatioSlice, playSlice } from '../lib/playClip'
import { connectedSpeech, hasConnectedSpeech } from '../lib/connectedSpeech'
import { pinyinSandhi, hasPinyinSandhi } from '../lib/pinyinSandhi'
import { hangulSpoken, hasHangulSoundChange } from '../lib/hangulPhonology'
import { comprehensionPct, unknownCount, estimatedCoverage, nextMilestone, type WordStatus } from '../lib/comprehension'
import { KnownWordsProvider, useKnownWords, baseLang } from '../hooks/useKnownWords'
import { useLoopPlayer } from '../hooks/useLoopPlayer'
import ToneStrip from '../components/ToneStrip'
import ToneLegend from '../components/ToneLegend'
import Furigana from '../components/Furigana'
import ProfessorChat from '../components/ProfessorChat'
import PitchAccent from '../components/PitchAccent'
import CharBreakdown from '../components/CharBreakdown'
import { hasHan } from '../lib/cjk'
import { canStartProfessor, sentencesNeeded } from '../lib/professorChat'
import { normalizeSpeed, nextSpeed, speedLabel } from '../lib/playbackSpeed'
import { isReviewableSentence } from '../lib/reviewableSentence'
import { uiText, appLanguage, type AppLanguage } from '../lib/uiLanguage'
import { UiLangProvider, useT, useUiLang } from '../lib/uiLangContext'
import { languageNameFor } from '../lib/languages'

const isEnglishContent = (lang: string) => lang === 'en' || lang.startsWith('en-')
const isChineseContent = (lang: string) => lang === 'zh' || lang.startsWith('zh-')
const isKoreanContent  = (lang: string) => lang === 'ko' || lang.startsWith('ko-')
const isJapaneseContent = (lang: string) => lang === 'ja' || lang.startsWith('ja-')
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

// 'Pinyin'/'Romaji' são nomes próprios (iguais em qualquer idioma); os demais traduzem via uiText.
const ROMANIZATION_LABEL: Record<string, 'Pinyin' | 'Romaji' | 'romanization' | 'transliteration'> = {
  zh: 'Pinyin', 'zh-CN': 'Pinyin', 'zh-TW': 'Pinyin',
  ja: 'Romaji', ko: 'romanization',
  th: 'romanization', ar: 'transliteration', ru: 'transliteration', hi: 'transliteration',
}

// Lookup with base-language fallback (zh-Hans → zh)
function romanLabel(lang: string, t: (key: 'romanization' | 'transliteration') => string): string {
  const v = ROMANIZATION_LABEL[lang] ?? ROMANIZATION_LABEL[lang.split('-')[0]]
  if (!v) return 'Rom.'
  return v === 'Pinyin' || v === 'Romaji' ? v : t(v)
}

let currentAudio: HTMLAudioElement | null = null

interface SpeakOpts {
  onProgress?: (fraction: number) => void  // playback progress 0..1 for karaoke
  onEnd?: () => void
  rate?: number                            // velocidade do listening (1 = normal, 0.8 = devagar)
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
    if (opts?.rate && opts.rate > 0) audio.playbackRate = opts.rate
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
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMounted, setChatMounted] = useState(false)
  const [speed, setSpeed] = useState(1)   // velocidade do listening (Original/TTS)
  const [uiLang, setUiLang] = useState<AppLanguage>('pt')
  const t = (key: Parameters<typeof uiText>[1]) => uiText(uiLang, key)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    settingsAPI.getAll().then(s => {
      setSpeed(normalizeSpeed(s.playbackSpeed))
      setUiLang(appLanguage(s.appLanguage))
    }).catch(() => {})
  }, [])
  const cycleSpeed = () => {
    const n = nextSpeed(speed)
    setSpeed(n)
    settingsAPI.set('playbackSpeed', String(n)).catch(() => {})
  }

  // Idioma da conversa = o do conteúdo mais recente; contexto = todas as frases da sessão.
  const sessionLang = entries[entries.length - 1]?.contentLanguage || 'en'
  const sessionContext = entries.map(e => e.transcript)
  const professorReady = canStartProfessor(sessionContext.length)
  const professorMissing = sentencesNeeded(sessionContext.length)
  const professorMissingText = `${professorMissing} ${t(professorMissing === 1 ? 'phrase' : 'phrases')}`

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
      if (analysis.transcript.trim() && translation && isReviewableSentence(analysis.transcript)) {
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
    <UiLangProvider value={uiLang}>
    <KnownWordsProvider>
      <div className="flex flex-col h-screen app-paper text-foreground overflow-hidden">
        <TitleBar title="Tutor Board" />

        {entries.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted">
            <Mic size={36} className="opacity-30" />
            <p className="display-title text-xl text-foreground">{t('waitingAudio')}</p>
            <p className="text-sm opacity-70">{t('waitingAudioSub')}</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div className="max-w-[720px] mx-auto mb-1">
              <div className="flex items-start gap-3">
                <div className="min-w-0">
                  <h1 className="display-title text-2xl">Tutor Board</h1>
                  <p className="text-sm text-muted">{entries.length} {t(entries.length === 1 ? 'phrase' : 'phrases')} {t('capturedThisSession')}</p>
                </div>
                <button
                  onClick={cycleSpeed}
                  className="ml-auto shrink-0 pill-button pill-ghost px-3 py-2 text-sm tabular-nums"
                  title={t('speedTitle')}
                >
                  <Gauge size={15} /> {speedLabel(speed)}
                </button>
                <button
                  onClick={() => {
                    if (!professorReady) return
                    setChatMounted(true)
                    setChatOpen(true)
                  }}
                  disabled={!professorReady}
                  className={[
                    'ml-auto shrink-0 pill-button px-4 py-2 text-sm',
                    professorReady ? 'pill-primary' : 'pill-ghost opacity-60 cursor-default',
                  ].join(' ')}
                  title={professorReady
                    ? t('teacherReadyTitle')
                    : `${t('captureMore')} ${professorMissingText} ${t('toUnlockTeacher')}`}
                >
                  <GraduationCap size={15} />
                  {professorReady ? t('chatWithTeacher') : `${t('teacherIn')} ${professorMissingText}`}
                </button>
              </div>
              <KnownStat entries={entries} />
              {entries.some(e => isChineseContent(e.contentLanguage)) && <ToneLegend />}
            </div>
            {entries.map((entry, i) => (
              <EntryCard key={entry.id} entry={entry} index={i + 1} speed={speed} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}

        {chatMounted && (
          <ProfessorChat open={chatOpen} lang={sessionLang} context={sessionContext} onClose={() => setChatOpen(false)} />
        )}
      </div>
    </KnownWordsProvider>
    </UiLangProvider>
  )
}

// Contador de palavras conhecidas + cobertura estimada + próximo marco (por idioma).
function KnownStat({ entries }: { entries: Entry[] }) {
  const t = useT()
  const uiLang = useUiLang()
  const { ensureLang, knownCount } = useKnownWords()
  const langs = useMemo(() => {
    const seen: string[] = []
    for (const e of entries) {
      const b = baseLang(e.contentLanguage)
      if (b && !seen.includes(b)) seen.push(b)
    }
    return seen
  }, [entries])

  useEffect(() => { langs.forEach(ensureLang) }, [langs, ensureLang])

  const stats = langs
    .map(lang => ({ lang, count: knownCount(lang) }))
    .filter(s => s.count > 0)
  if (stats.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2 mt-2">
      {stats.map(({ lang, count }) => {
        const cover = estimatedCoverage(count)
        const next = nextMilestone(count)
        return (
          <span
            key={lang}
            className="inline-flex items-center gap-1.5 rounded-full bg-success/10 border border-success/30 px-2.5 py-1 text-[11px]"
            title={next ? `${t('milestoneRemaining')} ${next - count} ${t('milestoneForMark')} ${next} ${t('milestoneWords')}` : t('milestoneAllDone')}
          >
            <span className="font-semibold text-success">{count}</span>
            <span className="text-muted">{languageNameFor(lang, uiLang)} {t('knownWordsSuffix')}</span>
            <span className="text-success/70">· ~{cover}% {t('coverage')}</span>
            {next && <span className="text-muted/60">→ {next}</span>}
          </span>
        )
      })}
    </div>
  )
}

// Practice state per card
type PracticeState = 'idle' | 'countdown' | 'recording' | 'transcribing' | 'result'

function EntryCard({ entry, index, speed = 1 }: { entry: TutorAnalysis; index: number; speed?: number }) {
  const t = useT()
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

  // Palavras conhecidas / % de compreensão desta frase.
  const known = useKnownWords()
  useEffect(() => { known.ensureLang(entry.contentLanguage) }, [known, entry.contentLanguage])
  const sentenceWords = useMemo(
    () => segmentText(entry.transcript, entry.contentLanguage).filter(s => s.isWord).map(s => s.text),
    [entry.transcript, entry.contentLanguage],
  )
  const statusMap = known.statusMap(entry.contentLanguage)
  const comprehension = comprehensionPct(sentenceWords, statusMap)
  const newWords = unknownCount(sentenceWords, statusMap)

  // Modo Loop/Chorus (shadowing): repete o áudio original com velocidade graduada.
  const loop = useLoopPlayer(entry.originalAudioUrl)
  const toggleLoop = useCallback(() => {
    if (loop.running) loop.stop()
    else loop.start({ repeats: 3, gap: 'echo', speeds: [0.8, 0.9, 1] })
  }, [loop])
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
      rate:       speed,
    })
  }, [entry.transcript, entry.contentLanguage, emitProgress, resetSync, speed])

  // Play the ORIGINAL captured audio, underlining the text word-by-word.
  // Uses Whisper word cues when available, else falls back to elapsed/duration.
  const handleOriginal = useCallback(() => {
    if (!entry.originalAudioUrl) return
    const cues = entry.originalCues ?? []
    setPlayMode('original'); lastWordRef.current = -1; setProgress(0)
    playClip(entry.originalAudioUrl, {
      onTime: (ms, dur) => emitProgress(playbackProgress(cues, ms, dur)),
      onEnd:  resetSync,
      rate:   speed,
    })
  }, [entry.originalAudioUrl, entry.originalCues, emitProgress, resetSync, speed])

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
        <div className="flex flex-col items-center gap-1 mt-1 shrink-0 w-9">
          <span className="text-[12px] font-bold text-muted">#{index}</span>
          <ComprehensionBadge pct={comprehension} newWords={newWords} />
        </div>
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          {entry.romanization && (
            <p className="text-xs font-mono leading-relaxed break-words">
              <span className="label-eyebrow mr-2">{romanLabel(entry.contentLanguage, t)}</span>
              <SyncedTokens
                text={entry.romanization}
                progress={syncProgress}
                alignWords={sentenceWords}
                onWordClick={handleWordClick}
              />
            </p>
          )}
          {isChineseContent(entry.contentLanguage) && entry.romanization && (
            <ToneStrip pinyin={entry.romanization} hanzi={entry.transcript} onWordClick={handleWordClick} />
          )}
          {isJapaneseContent(entry.contentLanguage) && entry.reading && (
            <Furigana text={entry.transcript} reading={entry.reading} onWordClick={handleWordClick} />
          )}
          <SyncedTranscript
            text={entry.transcript}
            lang={entry.contentLanguage}
            progress={syncProgress}
            onWordClick={handleWordClick}
            statusOf={(word) => known.statusOf(entry.contentLanguage, word)}
          />
          {isEnglishContent(entry.contentLanguage) && hasConnectedSpeech(entry.transcript) && (
            <p className="text-xs text-warning/80 leading-relaxed mt-0.5 font-mono break-words">
              <span className="text-warning/40 mr-1.5 uppercase text-[10px] tracking-wider">{t('naturalSpeech')}</span>
              {connectedSpeech(entry.transcript)}
            </p>
          )}
          {isChineseContent(entry.contentLanguage) && entry.romanization && hasPinyinSandhi(entry.romanization, entry.transcript) && (
            <p className="text-xs text-warning/80 leading-relaxed mt-0.5 font-mono break-words">
              <span className="text-warning/40 mr-1.5 uppercase text-[10px] tracking-wider">{t('spokenPinyin')}</span>
              {pinyinSandhi(entry.romanization, entry.transcript)}
            </p>
          )}
          {isKoreanContent(entry.contentLanguage) && hasHangulSoundChange(entry.transcript) && (
            <p className="text-sm text-warning/90 leading-relaxed mt-0.5 break-words">
              <span className="text-warning/40 mr-1.5 uppercase text-[10px] tracking-wider">{t('realPronunciation')}</span>
              {hangulSpoken(entry.transcript)}
            </p>
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
              title={t('listenOriginalScene')}
            >
              <span className="dot" />
              <span>Original</span>
            </button>
          )}
          {entry.originalAudioUrl && (
            <button
              onClick={toggleLoop}
              className={[
                'pill-button px-3 py-1.5 text-xs border',
                loop.running
                  ? 'text-warning bg-warning/10 border-warning/30 hover:bg-warning/20'
                  : 'text-muted bg-surface-2 border-border/60 hover:bg-primary/10 hover:text-primary',
              ].join(' ')}
              title={t('loopTitle')}
            >
              <Repeat size={12} className={loop.phase === 'gap' ? 'animate-pulse' : ''} />
              <span>{loop.running ? `${loop.repeat + 1}/${loop.total}${loop.phase === 'gap' ? ' ·' : ''}` : 'Loop'}</span>
            </button>
          )}
          <button
            onClick={handleListen}
            disabled={speaking}
            className={[
              'audio-chip audio-tts',
              speaking ? 'brightness-95' : '',
            ].join(' ')}
            title={t('listenTtsTitle')}
          >
            <span className="dot" />
            <span>{speaking ? t('speaking') : 'TTS'}</span>
          </button>
          <button
            onClick={() => practice === 'idle' || practice === 'result' ? startPractice() : stopRecording()}
            className={[
              'pill-button px-3 py-1.5 text-xs border',
              practice === 'recording'
                ? 'text-danger bg-danger/10 border-danger/30 hover:bg-danger/20'
                : 'text-primary bg-primary/10 border-primary/20 hover:bg-primary/15',
            ].join(' ')}
            title={t('practicePronTitle')}
          >
            <RefreshCw size={12} className={practice === 'recording' ? 'animate-spin' : ''} />
            <span>
              {practice === 'countdown' ? `${countdown}...`
                : practice === 'recording'   ? t('stop')
                : practice === 'transcribing' ? '...'
                : t('practice')}
            </span>
          </button>
        </div>
      </div>

      {/* Word lookup popover — full-width abaixo do cabeçalho (responsivo) */}
      {lookup && (
        <div className="px-4 pb-3 pt-0.5 border-b border-border/70">
          <WordPopover
            lookup={lookup}
            lang={entry.contentLanguage}
            totalWords={wordCount}
            originalAudioUrl={entry.originalAudioUrl}
            originalCues={entry.originalCues}
            status={known.statusOf(entry.contentLanguage, lookup.word)}
            onSetStatus={(status) => known.setStatus(entry.contentLanguage, lookup.word, status)}
            onClose={() => setLookup(null)}
          />
        </div>
      )}

      {/* Analysis error (e.g. Gemini billing / rate limit) */}
      {entry.analysisError && (
        <div className="px-5 py-2 border-b border-border/60 bg-danger/5">
          <p className="text-xs text-danger/90">{t('analysisFailed')} {entry.analysisError}</p>
        </div>
      )}

      {/* Practice result */}
      {practice === 'result' && result && (
        <div className="px-5 py-3 border-b border-border/60 bg-surface-2">
          <div className="flex items-center gap-2 mb-2">
            <span className={`score-badge ${result.score >= 80 ? 'score-good' : result.score >= 50 ? 'score-ok' : 'score-bad'}`}>
              {result.score}%
            </span>
            <span className="text-xs text-muted">{t('accuracy')}</span>
          </div>
          <DiffView diff={result.diff} />
        </div>
      )}

      {/* Vocab */}
      {entry.vocab.length > 0 && (
        <div className="px-5 py-3 border-b border-border/60">
          <div className="flex items-center gap-1.5 mb-2.5">
            <BookOpen size={12} className="text-primary" />
            <span className="label-eyebrow text-primary">{t('vocabulary')}</span>
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

// Selo de % de compreensão por frase (verde = entende tudo, âmbar = "+1" ponto ideal).
export function ComprehensionBadge({ pct, newWords }: { pct: number; newWords: number }) {
  const t = useT()
  const plusOne = newWords === 1
  const tone = pct >= 100
    ? 'bg-success/15 text-success border-success/30'
    : plusOne
      ? 'bg-warning/15 text-warning border-warning/40'
      : pct >= 60
        ? 'bg-primary/10 text-primary border-primary/30'
        : 'bg-danger/10 text-danger border-danger/30'
  return (
    <span
      className={['inline-flex items-center justify-center rounded-md border px-1 py-0.5 text-[9px] font-bold leading-none', tone].join(' ')}
      title={
        pct >= 100 ? t('badgeAllKnown')
        : plusOne ? t('badgePlusOne')
        : `${newWords} ${t('badgeNewWords')}`
      }
    >
      {pct}%
      {plusOne && <span className="ml-0.5">+1</span>}
    </span>
  )
}

// Transcript: clickable words + karaoke highlight during TTS
function SyncedTranscript({ text, lang, progress, onWordClick, statusOf }: {
  text: string
  lang: string
  progress: number   // 0..1 while playing, -1 idle
  onWordClick: (word: string, wordIndex: number, approxStart: number, approxEnd: number) => void
  statusOf?: (word: string) => WordStatus | undefined
}) {
  const t = useT()
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
        const status = statusOf?.(seg.text)
        const statusClass = isActive
          ? 'bg-primary text-white underline decoration-2 underline-offset-2'
          : status === 'known' || status === 'ignore'
            ? 'text-muted/45 hover:bg-primary/15 hover:text-primary'
            : status === 'learning'
              ? 'text-warning underline decoration-dotted decoration-warning/60 underline-offset-2 hover:bg-warning/15'
              : 'text-foreground hover:bg-primary/15 hover:text-primary'
        return (
          <span
            key={i}
            onClick={() => onWordClick(seg.text, clickedIndex, approx.start, approx.end)}
            className={['cursor-pointer transition-all duration-100 px-0.5 rounded', statusClass].join(' ')}
            title={
              status === 'known' ? t('knownWordTitle')
              : status === 'learning' ? t('learningWordTitle')
              : status === 'ignore' ? t('ignoreWordTitle')
              : t('clickToHear')
            }
          >
            {seg.text}
          </span>
        )
      })}
    </p>
  )
}

// Word lookup popover (meaning + variants + listen + practice)
export function WordPopover({ lookup, lang, totalWords, originalAudioUrl, originalCues, status, onSetStatus, onClose }: {
  lookup: { word: string; wordIndex: number; approxStart: number; approxEnd: number; loading: boolean; data?: WordLookup }
  lang: string
  totalWords: number
  originalAudioUrl?: string
  originalCues?: WordCue[]
  status?: WordStatus
  onSetStatus: (status: WordStatus | '') => void
  onClose: () => void
}) {
  const t = useT()
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
    <div className="rounded-lg border border-primary/30 bg-surface-2 px-3 py-2.5 relative max-w-full overflow-hidden break-words">
      <button
        onClick={() => { cancel(); onClose() }}
        className="absolute top-1.5 right-1.5 text-muted/50 hover:text-danger transition-colors"
        title={t('close')}
      >
        <XCircle size={13} />
      </button>

      <div className="flex items-center gap-x-2 gap-y-1 mb-1.5 pr-5 flex-wrap">
        <span className="text-sm font-semibold text-foreground break-all">{lookup.word}</span>
        {lookup.data?.romanization && (
          <span className="text-xs text-primary/70 font-mono">{lookup.data.romanization}</span>
        )}
        {originalAudioUrl && (
          <button
            onClick={playOriginalWord}
            className="flex items-center gap-0.5 text-[11px] text-[#3E7BB6] hover:brightness-90 transition-all font-semibold"
            title={wordCue ? t('listenOriginalWord') : t('listenApproxWord')}
          >
            <Volume2 size={12} /> Original
          </button>
        )}
        <button
          onClick={() => speak(lookup.word, lang)}
          className="flex items-center gap-0.5 text-[11px] text-[#9A6A1E] hover:brightness-90 transition-all font-semibold"
          title={t('listenTtsTitle')}
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
          title={t('trainThisWord')}
        >
          <Mic size={11} className={recording ? 'animate-pulse' : ''} />
          {counting ? `${countdown}...` : recording ? t('stop') : busy ? '...' : t('practice')}
        </button>
      </div>

      {/* Marcar conhecimento da palavra (alimenta a % de compreensão) */}
      <div className="flex items-center gap-1 gap-y-1 mb-1.5 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider text-muted/50 mr-0.5">{t('mark')}</span>
        {([
          ['known', t('iKnow'), 'text-success', 'bg-success/15 border-success/40 text-success'],
          ['learning', t('learningWord'), 'text-warning', 'bg-warning/15 border-warning/40 text-warning'],
          ['ignore', t('ignoreWord'), 'text-muted', 'bg-surface-2 border-border text-foreground'],
        ] as const).map(([value, label, idle, activeCls]) => {
          const on = status === value
          return (
            <button
              key={value}
              onClick={() => onSetStatus(on ? '' : value)}
              className={[
                'text-[11px] px-2 py-0.5 rounded-md border transition-colors',
                on ? activeCls : `border-transparent ${idle} hover:bg-surface-2`,
              ].join(' ')}
              title={on ? t('clickToUnmark') : `${t('markAs')} "${label}"`}
            >
              {on ? '✓ ' : ''}{label}
            </button>
          )
        })}
      </div>

      {/* Practice feedback */}
      {attempt && (
        <div className={[
          'flex items-center gap-1.5 text-xs mb-1.5 px-2 py-1 rounded',
          attempt.ok ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger',
        ].join(' ')}>
          {attempt.ok ? `✓ ${t('goodPronunciation')}` : `✗ ${t('heard')} "${attempt.heard}"`}
        </div>
      )}

      {/* Acento tonal (japonês): contorno alto/baixo por mora */}
      {isJapaneseContent(lang) && lookup.data?.reading && lookup.data.pitchAccent !== undefined && (
        <div className="mb-1.5">
          <PitchAccent kana={lookup.data.reading} accent={lookup.data.pitchAccent} />
        </div>
      )}

      {lookup.loading ? (
        <p className="text-xs text-muted/60 italic">{t('searchingMeaning')}</p>
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
        <p className="text-xs text-muted/60 italic">{t('noMeaning')}</p>
      )}

      {/* Decomposição de caracteres Han (Hanzi/Kanji) */}
      {hasHan(lookup.word) && <CharBreakdown word={lookup.word} lang={lang} />}
    </div>
  )
}

// Parallel text (ex.: Pinyin/Romaji/Romanização) com destaque durante a fala e — quando
// alinhável 1:1 com as palavras da transcrição — CLICÁVEL para ouvir/ver a palavra original.
export function SyncedTokens({ text, progress, alignWords, onWordClick }: {
  text: string
  progress: number
  alignWords?: string[]   // palavras da transcrição, para alinhar o clique à palavra original
  onWordClick?: (word: string, index: number, approxStart: number, approxEnd: number) => void
}) {
  const t = useT()
  const tokens = useMemo(() => text.split(/(\s+)/), [text])  // keep whitespace to preserve spacing
  const words  = tokens.filter(t => t.trim())                // only non-space tokens are highlightable
  const active = tokenAtProgress(progress, words.length)

  // Só clicável quando há alinhamento 1:1 com a transcrição (evita procurar a forma romanizada).
  const aligned = alignWords && alignWords.length === words.length ? alignWords : null
  const clickable = !!(onWordClick && aligned)

  let wordIdx = -1
  return (
    <>
      {tokens.map((tok, i) => {
        if (!tok.trim()) return <span key={i}>{tok}</span>
        wordIdx++
        const idx = wordIdx
        const isActive = idx === active && progress >= 0
        const target = aligned ? aligned[idx] : tok
        return (
          <span
            key={i}
            onClick={clickable ? () => onWordClick!(target, idx, idx / words.length, (idx + 1) / words.length) : undefined}
            title={clickable ? `${t('listenSee')} "${target}"` : undefined}
            className={[
              'transition-all duration-100 rounded px-0.5',
              isActive ? 'bg-primary text-white font-semibold underline decoration-2 underline-offset-2' : 'text-primary/70',
              clickable && !isActive ? 'cursor-pointer hover:bg-primary/15 hover:text-primary' : '',
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
  const t = useT()
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
          title={t('listenWord')}
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
