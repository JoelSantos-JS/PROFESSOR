export type WindowName = 'dashboard' | 'floating-bar' | 'settings' | 'tutor-board' | 'review'

export interface VocabItem {
  word: string
  romanization?: string  // pinyin, romaji, etc. depending on language
  translation: string
  example: string
}

export interface TutorAnalysis {
  transcript: string
  romanization?: string  // full romanization of the transcript
  englishText?: string   // English translation (when content is not English)
  translation?: string   // Brazilian Portuguese translation of the whole sentence
  vocab: VocabItem[]
  tip: string
  contentLanguage: string
  originalAudioUrl?: string  // captured clip of the original audio (in-memory data URL)
  originalCues?: WordCue[]   // per-word timings of the original audio (karaoke sync)
  analysisError?: string     // set when the AI analysis failed (shown in the card)
}

export interface WordCue {
  part: string
  start: number  // ms
  end: number    // ms
}

export interface WordLookup {
  word: string
  romanization?: string
  meanings: string[]
  note?: string
}

export interface SentenceVariation {
  text: string
  translation: string
}

export type WordStatus = 'ok' | 'missing' | 'extra'
export interface DiffToken { word: string; status: WordStatus }

export interface VocabCard {
  id: string
  word: string
  romanization?: string
  translation: string
  example?: string
  lang: string
  ease: number
  interval: number
  reps: number
  due: number
  createdAt: number
  lapses: number
}

export interface MistakeRecord {
  word: string
  lang: string
  count: number
  lastAt: number
}

export interface LangStat {
  lang: string
  total: number
  due: number
}

export interface StoreStats {
  sessionCount: number
  phraseCount: number
  dueCount: number
  streak: number
  languages: LangStat[]
  recentSessions: { id: string; startedAt: number; lineCount: number }[]
  topMistakes: MistakeRecord[]
}

export interface SessionAttempt {
  original: string
  spoken: string
  score: number
  diff: DiffToken[]          // LCS-aligned word diff (ok/missing/extra)
  audioUrl?: string          // the user's own recording (data URL) to replay
  originalAudioUrl?: string  // the scene's clip for this sentence (for comparison)
  originalCues?: WordCue[]   // per-word timings of the original (to drill single words)
  lang: string
  at: number  // timestamp ms
}

export type ListeningState = 'idle' | 'listening' | 'processing'

export type ProviderId = 'openai' | 'gemini' | 'anthropic' | 'groq'

export interface ProviderStatus {
  id: ProviderId
  configured: boolean
}

export interface AppSettings {
  targetLanguage: string
  nativeLanguage: string
  contentLanguage: string
  audioInputDevice: string
  activeAiProvider: ProviderId
  activeTranscriptionProvider: ProviderId
}

export interface AudioSource {
  id: string
  name: string
}

export interface TranscribeResult {
  text: string | null
  language: string | null
  cues?: WordCue[]      // per-word timings of the original audio (karaoke sync)
  error: string | null
}

export interface IpcAPI {
  window: {
    minimize: () => void
    close: () => void
    hide: () => void
    show: (name: WindowName) => void
    openReview: (lang?: string) => void
    pendingReviewLang: () => Promise<string | null>
  }
  settings: {
    getAll: () => Promise<AppSettings>
    set: (key: keyof AppSettings, value: string) => Promise<void>
  }
  credentials: {
    list: () => Promise<ProviderStatus[]>
    set: (id: ProviderId, key: string) => Promise<{ ok: boolean; error?: string }>
    get: (id: ProviderId) => Promise<string | null>
    remove: (id: ProviderId) => Promise<void>
    debug: () => Promise<{ filePath: string; fileExists: boolean; configuredIds: string[] }>
    test: (id: ProviderId) => Promise<{ ok: boolean; message?: string; error?: string }>
  }
  audio: {
    getSources: () => Promise<AudioSource[]>
    transcribe: (buffer: ArrayBuffer, hint?: string) => Promise<TranscribeResult>
  }
  tutor: {
    analyze: (transcript: string, language: string, audioUrl?: string, cues?: WordCue[]) => Promise<{ ok: boolean; error?: string }>
    lookup: (word: string, context: string, language: string) => Promise<{ ok: boolean; result?: WordLookup; error?: string }>
    variations: (sentence: string, language: string) => Promise<{ ok: boolean; variations?: SentenceVariation[]; error?: string }>
  }
  tts: {
    speak: (text: string, lang: string) => Promise<{ ok: boolean; dataUrl?: string; cues?: WordCue[]; error?: string }>
  }
  listening: {
    pause:  () => void
    resume: () => void
  }
  session: {
    addAttempt: (attempt: SessionAttempt) => void
  }
  media: {
    pause:  () => Promise<{ ok: boolean }>
    resume: () => Promise<{ ok: boolean }>
    toggle: () => Promise<{ ok: boolean }>
    reset:  () => void
  }
  store: {
    stats:          (lang?: string) => Promise<StoreStats>
    languages:      () => Promise<LangStat[]>
    recordSession:  (lineCount: number) => Promise<{ ok: boolean }>
    addVocab:       (items: Array<{ word: string; romanization?: string; translation: string; example?: string; lang: string }>) => Promise<{ ok: boolean }>
    recordMistakes: (words: Array<{ word: string; lang: string }>) => Promise<{ ok: boolean }>
    dueVocab:       (lang?: string) => Promise<VocabCard[]>
    gradeVocab:     (id: string, next: { ease: number; interval: number; reps: number; due: number; lapsed: boolean }) => Promise<{ ok: boolean }>
  }
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void
}

declare global {
  interface Window {
    api: IpcAPI
  }
  namespace React {
    interface CSSProperties {
      WebkitAppRegion?: 'drag' | 'no-drag'
    }
  }
}
