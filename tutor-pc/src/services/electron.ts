import type { AppSettings, ProviderId, WindowName, SessionAttempt, WordCue } from '../types'

export const windowAPI = {
  minimize: () => window.api.window.minimize(),
  close: () => window.api.window.close(),
  hide: () => window.api.window.hide(),
  show: (name: WindowName) => window.api.window.show(name),
  openReview: (lang?: string) => window.api.window.openReview(lang),
  pendingReviewLang: (): Promise<string | null> => window.api.window.pendingReviewLang(),
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
}

export const audioAPI = {
  getSources: () => window.api.audio.getSources(),
  transcribe: (buffer: ArrayBuffer, hint?: string) => window.api.audio.transcribe(buffer, hint),
}

export const tutorAPI = {
  analyze: (transcript: string, language: string, audioUrl?: string, cues?: WordCue[]) => window.api.tutor.analyze(transcript, language, audioUrl, cues),
  lookup: (word: string, context: string, language: string) => window.api.tutor.lookup(word, context, language),
  variations: (sentence: string, language: string) => window.api.tutor.variations(sentence, language),
}

export const ttsAPI = {
  speak: (text: string, lang: string) => window.api.tts.speak(text, lang),
}

export const listeningAPI = {
  pause:  () => window.api.listening.pause(),
  resume: () => window.api.listening.resume(),
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
  recordSession:  (lineCount: number) => window.api.store.recordSession(lineCount),
  addVocab:       (items: Parameters<typeof window.api.store.addVocab>[0]) => window.api.store.addVocab(items),
  recordMistakes: (words: Parameters<typeof window.api.store.recordMistakes>[0]) => window.api.store.recordMistakes(words),
  dueVocab:       (lang?: string) => window.api.store.dueVocab(lang),
  gradeVocab:     (id: string, next: Parameters<typeof window.api.store.gradeVocab>[1]) => window.api.store.gradeVocab(id, next),
}

export const onChannel = (
  channel: string,
  cb: (...args: unknown[]) => void,
): (() => void) => window.api.on(channel, cb)
