import type { AppSettings, ProviderId, WindowName, SessionAttempt, WordCue, TokenUsageRecord } from '../types'

export const windowAPI = {
  minimize: () => window.api.window.minimize(),
  close: () => window.api.window.close(),
  hide: () => window.api.window.hide(),
  show: (name: WindowName) => window.api.window.show(name),
  openReview: (lang?: string) => window.api.window.openReview(lang),
  pendingReviewLang: (): Promise<string | null> => window.api.window.pendingReviewLang(),
  onboardingComplete: () => window.api.window.onboardingComplete(),
  authComplete: () => window.api.window.authComplete(),
}

export const settingsAPI = {
  getAll: (): Promise<AppSettings> => window.api.settings.getAll(),
  set: (key: keyof AppSettings, value: string): Promise<void> =>
    window.api.settings.set(key, value),
}

export const credentialsAPI = {
  list: () => window.api.credentials.list(),
  set: (id: ProviderId, key: string): Promise<{ ok: boolean; error?: string }> =>
    window.api.credentials.set(id, key),
  get: (id: ProviderId) => window.api.credentials.get(id),
  remove: (id: ProviderId) => window.api.credentials.remove(id),
  debug: () => window.api.credentials.debug(),
  test: (id: ProviderId): Promise<{ ok: boolean; message?: string; error?: string }> =>
    window.api.credentials.test(id),
}

export const authAPI = {
  getSession: () => window.api.auth.getSession(),
  login: (credentials: { email: string; password: string }) => window.api.auth.login(credentials),
  signup: (credentials: { name: string; email: string; password: string }) => window.api.auth.signup(credentials),
  google: () => window.api.auth.google(),
  refresh: () => window.api.auth.refresh(),
  logout: () => window.api.auth.logout(),
}

export const audioAPI = {
  getSources: () => window.api.audio.getSources(),
  transcribe: (buffer: ArrayBuffer, hint?: string) => window.api.audio.transcribe(buffer, hint),
}

export const tutorAPI = {
  analyze: (transcript: string, language: string, audioUrl?: string, cues?: WordCue[]) => window.api.tutor.analyze(transcript, language, audioUrl, cues),
  lookup: (word: string, context: string, language: string) => window.api.tutor.lookup(word, context, language),
  variations: (sentence: string, language: string) => window.api.tutor.variations(sentence, language),
  decompose: (char: string, language: string) => window.api.tutor.decompose(char, language),
  converse: (opts: Parameters<typeof window.api.tutor.converse>[0]) => window.api.tutor.converse(opts),
}

export const ttsAPI = {
  speak: (text: string, lang: string) => window.api.tts.speak(text, lang),
}

export const listeningAPI = {
  pause:  () => window.api.listening.pause(),
  resume: () => window.api.listening.resume(),
}

export const floatingBarAPI = {
  setMode: (mode: 'compact' | 'full') => window.api.floatingBar.setMode(mode),
}

export const mediaAPI = {
  pause:  () => window.api.media.pause(),
  resume: () => window.api.media.resume(),
  toggle: () => window.api.media.toggle(),
  reset:  () => window.api.media.reset(),
}

export const sessionAPI = {
  addAttempt: (attempt: SessionAttempt) => window.api.session.addAttempt(attempt),
}

export const storeAPI = {
  stats:          (lang?: string) => window.api.store.stats(lang),
  languages:      () => window.api.store.languages(),
  recordSession:  (session: Parameters<typeof window.api.store.recordSession>[0]) => window.api.store.recordSession(session),
  addVocab:       (items: Parameters<typeof window.api.store.addVocab>[0]) => window.api.store.addVocab(items),
  recordMistakes: (words: Parameters<typeof window.api.store.recordMistakes>[0]) => window.api.store.recordMistakes(words),
  dueVocab:       (lang?: string) => window.api.store.dueVocab(lang),
  gradeVocab:     (id: string, next: Parameters<typeof window.api.store.gradeVocab>[1]) => window.api.store.gradeVocab(id, next),
  knownWords:     (lang: string) => window.api.store.knownWords(lang),
  setWordStatus:  (lang: string, word: string, status: 'known' | 'learning' | 'ignore' | '') => window.api.store.setWordStatus(lang, word, status),
  knownCount:     (lang: string) => window.api.store.knownCount(lang),
  capturedToday:  () => window.api.store.capturedToday(),
  mistakes:       (lang: string) => window.api.store.mistakes(lang),
  recordTokenUsage: (usage: Omit<TokenUsageRecord, 'id' | 'at'> & { at?: number }) => window.api.store.recordTokenUsage(usage),
  tokenUsageSummary: (feature?: TokenUsageRecord['feature']) => window.api.store.tokenUsageSummary(feature),
}

export const onChannel = (
  channel: string,
  cb: (...args: unknown[]) => void,
): (() => void) => window.api.on(channel, cb)
