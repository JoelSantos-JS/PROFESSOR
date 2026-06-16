import { app, safeStorage } from 'electron'
import fs from 'fs'
import path from 'path'
import type { Session } from '@supabase/supabase-js'

export interface StoredAuthSession {
  session: Session
  savedAt: number
  lastValidatedAt: number
}

export class SecureSessionStore {
  private filePath: string

  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'auth-session.json')
  }

  get debugPath(): string {
    return this.filePath
  }

  private assertEncryption(): void {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Storage seguro indisponivel para salvar sessao.')
    }
  }

  load(): StoredAuthSession | null {
    try {
      this.assertEncryption()
      const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf-8')) as { encrypted?: string }
      if (!raw.encrypted) return null
      const json = safeStorage.decryptString(Buffer.from(raw.encrypted, 'base64'))
      return JSON.parse(json) as StoredAuthSession
    } catch {
      return null
    }
  }

  save(value: StoredAuthSession): void {
    this.assertEncryption()
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
    const encrypted = safeStorage.encryptString(JSON.stringify(value)).toString('base64')
    fs.writeFileSync(this.filePath, JSON.stringify({ encrypted }, null, 2), 'utf-8')
  }

  clear(): void {
    try {
      fs.rmSync(this.filePath, { force: true })
    } catch {
      // ignore
    }
  }
}
