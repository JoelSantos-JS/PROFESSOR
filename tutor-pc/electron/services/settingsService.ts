import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import type { ProviderId } from './credentialsService'

export interface AppSettings {
  targetLanguage: string
  nativeLanguage: string
  contentLanguage: string   // language being spoken in the audio (zh, en, ko, ja, es, pt, auto)
  audioInputDevice: string
  activeAiProvider: ProviderId
  activeTranscriptionProvider: ProviderId
}

const DEFAULTS: AppSettings = {
  targetLanguage: 'en',
  nativeLanguage: 'pt-BR',
  contentLanguage: 'auto',
  audioInputDevice: 'default',
  activeAiProvider: 'gemini',
  activeTranscriptionProvider: 'gemini',
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
