export type WindowName = 'auth' | 'dashboard' | 'floating-bar' | 'settings' | 'tutor-board' | 'review' | 'dock'

export interface VocabItem {
  word: string
  romanization?: string  // pinyin, romaji, etc. depending on language
  translation: string
  example: string
}

export interface TutorAnalysis {
  transcript: string
  romanization?: string  // full romanization of the transcript
  reading?: string       // full hiragana reading (only for Japanese — for furigana)
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
  reading?: string       // leitura kana (japonês — para o acento tonal)
  pitchAccent?: number   // posição do downstep (0 = heiban) — japonês
  meanings: string[]
  note?: string
}

export interface SentenceVariation {
  text: string
  translation: string
}

// Pronúncia por nativo real (Forvo ou Wikimedia/Lingua Libre)
export interface NativePronunciation {
  url: string
  source: 'forvo' | 'wikimedia'
  country?: string
  speaker?: string
  attribution?: string
}

// Professor-IA de conversa
export type ProfessorRole = 'assistant' | 'user'
export interface ProfessorMessage { role: ProfessorRole; text: string }
export interface ProfessorFeedback { issue?: string; better: string; models: string[] }
export interface ProfessorTurn {
  question: string
  translation?: string
  feedback?: ProfessorFeedback
}

export interface CharComponent {
  part: string
  meaning: string
  reading?: string
}

export interface CharDecomposition {
  character: string
  meaning: string
  reading?: string
  strokes?: number
  components: CharComponent[]
  mnemonic?: string
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
  sessionCount?: number
  struggleSessions?: number
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
  recentSessions: { id: string; startedAt: number; endedAt?: number; lineCount: number; lang?: string; title?: string; preview?: string[] }[]
  topMistakes: MistakeRecord[]
}

export type TokenUsageFeature = 'professor' | 'analysis' | 'lookup' | 'transcription' | 'variations' | 'decompose' | 'other'

export interface TokenUsageRecord {
  id: string
  at: number
  feature: TokenUsageFeature
  lang?: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  provider?: string
  model?: string
  audioSeconds?: number
}

export interface UsageEvents {
  events: TokenUsageRecord[]
  sessions: Array<{ startedAt: number; endedAt?: number }>
}

export interface TokenUsageSummary {
  totalTokens: number
  todayTokens: number
  monthTokens: number
  callCount: number
  lastAt?: number
  recent: TokenUsageRecord[]
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
export type TtsProviderId = 'kokoro' | 'edge'

export interface ProviderStatus {
  id: ProviderId
  configured: boolean
}

export interface AuthUser {
  id: string
  email: string
  name?: string
}

export interface AuthSession {
  user: AuthUser
  expiresAt: number
  offline: boolean
}

export interface AuthResponse {
  ok: boolean
  session?: AuthSession | null
  needsEmailConfirmation?: boolean
  error?: string
}

export interface AppSettings {
  targetLanguage: string
  appLanguage: string       // idioma da interface do app (pt/en)
  nativeLanguage: string
  contentLanguage: string
  audioInputDevice: string
  activeAiProvider: ProviderId
  activeTranscriptionProvider: ProviderId
  activeTtsProvider: TtsProviderId
  ttsVoice: string
  onboarded: string          // '1' quando o onboarding foi concluído
  level: string              // nível do idioma primário (compat); ver languageLevels p/ por idioma
  learnLanguages: string     // idiomas escolhidos no onboarding, CSV (ex.: 'ko,ja')
  languageLevels: string     // nível POR idioma, CSV (ex.: 'zh:beginner,en:advanced')
  playbackSpeed: string      // velocidade do listening (Original/TTS): '1' | '0.9' | '0.8' | '0.7'
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
    toggle: (name: WindowName) => void
    hideBars: () => void
    showBars: () => void
    openReview: (lang?: string) => void
    pendingReviewLang: () => Promise<string | null>
    onboardingComplete: () => void
    authComplete: () => void
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
  auth: {
    getSession: () => Promise<AuthResponse>
    login: (credentials: { email: string; password: string }) => Promise<AuthResponse>
    signup: (credentials: { name: string; email: string; password: string }) => Promise<AuthResponse>
    google: () => Promise<AuthResponse>
    refresh: () => Promise<AuthResponse>
    logout: () => Promise<{ ok: boolean; error?: string }>
  }
  audio: {
    getSources: () => Promise<AudioSource[]>
    transcribe: (buffer: ArrayBuffer, hint?: string) => Promise<TranscribeResult>
  }
  tutor: {
    analyze: (transcript: string, language: string, audioUrl?: string, cues?: WordCue[]) => Promise<{ ok: boolean; error?: string }>
    lookup: (word: string, context: string, language: string) => Promise<{ ok: boolean; result?: WordLookup; error?: string }>
    variations: (sentence: string, language: string) => Promise<{ ok: boolean; variations?: SentenceVariation[]; error?: string }>
    decompose: (char: string, language: string) => Promise<{ ok: boolean; result?: CharDecomposition; error?: string }>
    converse: (opts: { lang: string; level?: string; context: string[]; history: ProfessorMessage[]; userMessage: string }) => Promise<{ ok: boolean; result?: ProfessorTurn; error?: string }>
  }
  tts: {
    speak: (text: string, lang: string) => Promise<{ ok: boolean; dataUrl?: string; cues?: WordCue[]; provider?: TtsProviderId; cached?: boolean; error?: string }>
    speakVariant: (text: string, voice: string, lang?: string) => Promise<{ ok: boolean; dataUrl?: string; cues?: WordCue[]; provider?: TtsProviderId; cached?: boolean; error?: string }>
  }
  pronunciation: {
    native: (word: string, lang: string) => Promise<{ ok: boolean; items: NativePronunciation[]; error?: string }>
    audio: (url: string) => Promise<{ ok: boolean; dataUrl?: string; error?: string }>
  }
  forvo: {
    setKey: (key: string) => Promise<{ ok: boolean }>
    hasKey: () => Promise<boolean>
  }
  listening: {
    pause:  () => void
    resume: () => void
  }
  floatingBar: {
    setMode: (mode: 'compact' | 'full') => void
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
    recordSession:  (session: number | { lineCount: number; lang?: string; preview?: string[]; startedAt?: number; endedAt?: number }) => Promise<{ ok: boolean }>
    addVocab:       (items: Array<{ word: string; romanization?: string; translation: string; example?: string; lang: string }>) => Promise<{ ok: boolean }>
    recordMistakes: (words: Array<{ word: string; lang: string }>) => Promise<{ ok: boolean }>
    dueVocab:       (lang?: string) => Promise<VocabCard[]>
    gradeVocab:     (id: string, next: { ease: number; interval: number; reps: number; due: number; lapsed: boolean }) => Promise<{ ok: boolean }>
    knownWords:     (lang: string) => Promise<Record<string, 'known' | 'learning' | 'ignore'>>
    setWordStatus:  (lang: string, word: string, status: 'known' | 'learning' | 'ignore' | '') => Promise<{ ok: boolean }>
    knownCount:     (lang: string) => Promise<number>
    capturedToday:  () => Promise<number>
    mistakes:       (lang: string) => Promise<MistakeRecord[]>
    recordTokenUsage: (usage: Omit<TokenUsageRecord, 'id' | 'at'> & { at?: number }) => Promise<{ ok: boolean }>
    tokenUsageSummary: (feature?: TokenUsageRecord['feature']) => Promise<TokenUsageSummary>
    usageEvents: () => Promise<UsageEvents>
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
