import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import type { ProviderId } from './credentialsService'

export interface AppSettings {
  targetLanguage: string
  appLanguage: string       // UI language (pt/en). Separate from nativeLanguage.
  nativeLanguage: string
  contentLanguage: string   // language being spoken in the audio (zh, en, ko, ja, es, pt, auto)
  audioInputDevice: string
  activeAiProvider: ProviderId
  activeTranscriptionProvider: ProviderId
  activeTtsProvider: 'kokoro' | 'edge'
  ttsVoice: string
  onboarded: string          // '1' quando o onboarding foi concluído (vazio = 1º acesso)
  level: string              // nível do idioma primário (compat); ver languageLevels p/ por idioma
  learnLanguages: string     // idiomas escolhidos no onboarding, CSV (ex.: 'ko,ja')
  languageLevels: string     // nível POR idioma, CSV (ex.: 'zh:beginner,en:advanced')
  playbackSpeed: string      // velocidade do listening (Original/TTS): '1' | '0.9' | '0.8' | '0.7'
  voiceCloneProvider: string // '' | 'elevenlabs' | 'xtts' — motor de clonagem da voz própria
  voiceCloneVoiceId: string  // id da voz clonada (após calibrar); '' = ainda não calibrada
}

const DEFAULTS: AppSettings = {
  targetLanguage: 'en',
  appLanguage: 'pt',
  nativeLanguage: 'pt-BR',
  contentLanguage: 'auto',
  audioInputDevice: 'default',
  activeAiProvider: 'gemini',
  activeTranscriptionProvider: 'gemini',
  activeTtsProvider: 'kokoro',
  ttsVoice: 'af_heart',
  onboarded: '',
  level: 'beginner',
  learnLanguages: '',
  languageLevels: '',
  playbackSpeed: '1',
  voiceCloneProvider: '',
  voiceCloneVoiceId: '',
}

export class SettingsService {
  private filePath: string
  private data: AppSettings

  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'settings.json')
    this.data = this.load()
  }

  private load(): AppSettings {
    try {
      return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(this.filePath, 'utf-8')) }
    } catch {
      return { ...DEFAULTS }
    }
  }

  private save(): void {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8')
      console.log('[settings] saved to', this.filePath)
    } catch (err) {
      console.error('[settings] save failed:', (err as Error).message)
    }
  }

  // Always reads from disk so changes made by other service instances are visible
  getAll(): AppSettings { return this.load() }

  set(key: string, value: string): void {
    if (key in this.data) {
      (this.data as unknown as Record<string, string>)[key] = value
      this.save()
    }
  }
}
