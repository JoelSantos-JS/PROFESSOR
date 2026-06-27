import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    close: () => ipcRenderer.send('window:close'),
    hide: () => ipcRenderer.send('window:hide'),
    show: (name: string) => ipcRenderer.send('window:show', name),
    toggle: (name: string) => ipcRenderer.send('window:toggle', name),
    hideBars: () => ipcRenderer.send('app:hide-bars'),
    showBars: () => ipcRenderer.send('app:show-bars'),
    openReview: (lang?: string) => ipcRenderer.send('review:open', lang),
    pendingReviewLang: () => ipcRenderer.invoke('review:pending-lang'),
    onboardingComplete: () => ipcRenderer.send('app:onboarding-complete'),
    authComplete: () => ipcRenderer.send('app:auth-complete'),
    logout: () => ipcRenderer.send('app:logout'),
  },
  settings: {
    getAll: () => ipcRenderer.invoke('settings:get-all'),
    set: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
  },
  credentials: {
    list: () => ipcRenderer.invoke('credentials:list'),
    set: (id: string, key: string) => ipcRenderer.invoke('credentials:set', id, key),
    get: (id: string) => ipcRenderer.invoke('credentials:get', id),
    remove: (id: string) => ipcRenderer.invoke('credentials:remove', id),
    debug: () => ipcRenderer.invoke('credentials:debug'),
    test: (id: string) => ipcRenderer.invoke('credentials:test', id),
  },
  auth: {
    getSession: () => ipcRenderer.invoke('auth:get-session'),
    login: (credentials: unknown) => ipcRenderer.invoke('auth:login', credentials),
    signup: (credentials: unknown) => ipcRenderer.invoke('auth:signup', credentials),
    google: () => ipcRenderer.invoke('auth:google'),
    refresh: () => ipcRenderer.invoke('auth:refresh'),
    logout: () => ipcRenderer.invoke('auth:logout'),
  },
  audio: {
    getSources: () => ipcRenderer.invoke('audio:get-sources'),
    transcribe: (buffer: ArrayBuffer, hint?: string, langOverride?: string, allowRetry?: boolean) => ipcRenderer.invoke('audio:transcribe', buffer, hint, langOverride, allowRetry),
  },
  tutor: {
    analyze: (transcript: string, language: string, audioUrl?: string, cues?: unknown) => ipcRenderer.invoke('tutor:analyze', transcript, language, audioUrl, cues),
    lookup: (word: string, context: string, language: string) => ipcRenderer.invoke('tutor:lookup', word, context, language),
    variations: (sentence: string, language: string) => ipcRenderer.invoke('tutor:variations', sentence, language),
    decompose: (char: string, language: string) => ipcRenderer.invoke('tutor:decompose', char, language),
    converse: (opts: unknown) => ipcRenderer.invoke('tutor:converse', opts),
  },
  tts: {
    speak: (text: string, lang: string) => ipcRenderer.invoke('tts:speak', text, lang),
    speakVariant: (text: string, voice: string, lang?: string) => ipcRenderer.invoke('tts:speak-variant', text, voice, lang),
  },
  pronunciation: {
    native: (word: string, lang: string) => ipcRenderer.invoke('pronunciation:native', word, lang),
    audio: (url: string) => ipcRenderer.invoke('pronunciation:audio', url),
  },
  sync: {
    backup: () => ipcRenderer.send('sync:backup'),
  },
  forvo: {
    setKey: (key: string) => ipcRenderer.invoke('forvo:set-key', key),
    hasKey: () => ipcRenderer.invoke('forvo:has-key'),
  },
  listening: {
    pause:  () => ipcRenderer.send('listening:pause'),
    resume: () => ipcRenderer.send('listening:resume'),
  },
  floatingBar: {
    setMode: (mode: string) => ipcRenderer.send('floating-bar:mode', mode),
  },
  media: {
    pause:  () => ipcRenderer.invoke('media:pause'),
    resume: () => ipcRenderer.invoke('media:resume'),
    toggle: () => ipcRenderer.invoke('media:toggle'),
    reset:  () => ipcRenderer.send('media:reset'),
  },
  session: {
    addAttempt: (attempt: unknown) => ipcRenderer.send('session:attempt', attempt),
  },
  store: {
    stats:          (lang?: string) => ipcRenderer.invoke('store:stats', lang),
    languages:      () => ipcRenderer.invoke('store:languages'),
    recordSession:  (lineCount: number) => ipcRenderer.invoke('store:record-session', lineCount),
    addVocab:       (items: unknown) => ipcRenderer.invoke('store:add-vocab', items),
    recordMistakes: (words: unknown) => ipcRenderer.invoke('store:record-mistakes', words),
    dueVocab:       (lang?: string) => ipcRenderer.invoke('store:due-vocab', lang),
    gradeVocab:     (id: string, next: unknown) => ipcRenderer.invoke('store:grade-vocab', id, next),
    knownWords:     (lang: string) => ipcRenderer.invoke('store:known-words', lang),
    setWordStatus:  (lang: string, word: string, status: string) => ipcRenderer.invoke('store:set-word-status', lang, word, status),
    knownCount:     (lang: string) => ipcRenderer.invoke('store:known-count', lang),
    capturedToday:  () => ipcRenderer.invoke('store:captured-today'),
    mistakes:       (lang: string) => ipcRenderer.invoke('store:mistakes', lang),
    recordTokenUsage: (usage: unknown) => ipcRenderer.invoke('store:record-token-usage', usage),
    tokenUsageSummary: (feature?: string) => ipcRenderer.invoke('store:token-usage-summary', feature),
    usageEvents:    () => ipcRenderer.invoke('store:usage-events'),
  },
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const listener = (_: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
})
