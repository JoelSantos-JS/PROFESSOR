import { app, safeStorage } from 'electron'
import path from 'path'
import fs from 'fs'

export type ProviderId = 'openai' | 'gemini' | 'anthropic' | 'groq'

export interface ProviderMeta {
  id: ProviderId
  name: string
  placeholder: string
  models: { transcription?: string; chat: string }
  docsUrl: string
}

export const PROVIDERS: ProviderMeta[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    placeholder: 'sk-...',
    models: { transcription: 'whisper-1', chat: 'gpt-4o-mini' },
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    placeholder: 'AIzaSy...',
    models: { transcription: 'gemini-2.5-flash', chat: 'gemini-2.5-flash' },
    docsUrl: 'https://aistudio.google.com/app/apikey',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    placeholder: 'sk-ant-...',
    models: { chat: 'claude-haiku-4-5' },
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'groq',
    name: 'Groq',
    placeholder: 'gsk_...',
    models: { transcription: 'whisper-large-v3', chat: 'llama-3.1-8b-instant' },
    docsUrl: 'https://console.groq.com/keys',
  },
]

// Stored on disk as { providerId: encryptedBase64 }
type EncryptedStore = Record<string, string>

export class CredentialsService {
  private filePath: string
  private store: EncryptedStore

  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'credentials.json')
    this.store = this.load()
  }

  private load(): EncryptedStore {
    try {
      return JSON.parse(fs.readFileSync(this.filePath, 'utf-8'))
    } catch {
      return {}
    }
  }

  private persist(): void {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
      fs.writeFileSync(this.filePath, JSON.stringify(this.store, null, 2), 'utf-8')
      console.log('[credentials] persisted to', this.filePath)
    } catch (err) {
      console.error('[credentials] persist failed:', (err as Error).message)
      throw err
    }
  }

  private canEncrypt(): boolean {
    return safeStorage.isEncryptionAvailable()
  }

  set(providerId: ProviderId, apiKey: string): void {
    if (!apiKey.trim()) {
      this.remove(providerId)
      return
    }
    let encrypted: string
    try {
      encrypted = this.canEncrypt()
        ? safeStorage.encryptString(apiKey).toString('base64')
        : Buffer.from(apiKey).toString('base64')
    } catch (err) {
      console.warn('[credentials] safeStorage failed, falling back to base64:', (err as Error).message)
      encrypted = Buffer.from(apiKey).toString('base64')
    }
    this.store[providerId] = encrypted
    this.persist()
  }

  get(providerId: ProviderId): string | null {
    // Always reload from disk so changes from other instances are visible
    const store = this.load()
    const raw = store[providerId]
    if (!raw) return null
    try {
      return this.canEncrypt()
        ? safeStorage.decryptString(Buffer.from(raw, 'base64'))
        : Buffer.from(raw, 'base64').toString('utf-8')
    } catch {
      return null
    }
  }

  remove(providerId: ProviderId): void {
    delete this.store[providerId]
    this.persist()
  }

  // Returns which providers are configured — never returns actual keys
  list(): { id: ProviderId; configured: boolean }[] {
    const store = this.load() // always read from disk, not in-memory cache
    return PROVIDERS.map(p => ({
      id: p.id,
      configured: !!store[p.id],
    }))
  }

  debugInfo(): { filePath: string; fileExists: boolean; configuredIds: string[] } {
    const fileExists = fs.existsSync(this.filePath)
    const store = fileExists ? this.load() : {}
    return {
      filePath: this.filePath,
      fileExists,
      configuredIds: Object.keys(store),
    }
  }
}
