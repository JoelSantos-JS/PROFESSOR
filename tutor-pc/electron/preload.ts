import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    close: () => ipcRenderer.send('window:close'),
    hide: () => ipcRenderer.send('window:hide'),
    show: (name: string) => ipcRenderer.send('window:show', name),
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
  },
  audio: {
    getSources: () => ipcRenderer.invoke('audio:get-sources'),
    transcribe: (buffer: ArrayBuffer, hint?: string) => ipcRenderer.invoke('audio:transcribe', buffer, hint),
  },
  tutor: {
    analyze: (transcript: string, language: string, audioUrl?: string, cues?: unknown) => ipcRenderer.invoke('tutor:analyze', transcript, language, audioUrl, cues),
    lookup: (word: string, context: string, language: string) => ipcRenderer.invoke('tutor:lookup', word, context, language),
  },
  tts: {
    speak: (text: string, lang: string) => ipcRenderer.invoke('tts:speak', text, lang),
  },
  listening: {
    pause:  () => ipcRenderer.send('listening:pause'),
    resume: () => ipcRenderer.send('listening:resume'),
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
    stats:          () => ipcRenderer.invoke('store:stats'),
    recordSession:  (lineCount: number) => ipcRenderer.invoke('store:record-session', lineCount),
    addVocab:       (items: unknown) => ipcRenderer.invoke('store:add-vocab', items),
    recordMistakes: (words: unknown) => ipcRenderer.invoke('store:record-mistakes', words),
    dueVocab:       () => ipcRenderer.invoke('store:due-vocab'),
    gradeVocab:     (id: string, next: unknown) => ipcRenderer.invoke('store:grade-vocab', id, next),
  },
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const listener = (_: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
})
