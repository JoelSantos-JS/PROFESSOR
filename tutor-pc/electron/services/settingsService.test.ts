import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs'

// userData isolado por teste (mesmo padrão do storeService.knownWords.test).
const ref = vi.hoisted(() => ({ dir: '' }))
vi.mock('electron', () => ({ app: { getPath: () => ref.dir } }))

async function freshSettings() {
  const { SettingsService } = await import('./settingsService.js')
  return new SettingsService()
}

describe('SettingsService — voz clonada', () => {
  beforeEach(() => { ref.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'professor-settings-')) })
  afterEach(() => { fs.rmSync(ref.dir, { recursive: true, force: true }) })

  it('começa sem provider nem voiceId', async () => {
    const s = await freshSettings()
    const all = s.getAll()
    expect(all.voiceCloneProvider).toBe('')
    expect(all.voiceCloneVoiceId).toBe('')
  })

  it('persiste provider e voiceId entre instâncias', async () => {
    const a = await freshSettings()
    a.set('voiceCloneProvider', 'elevenlabs')
    a.set('voiceCloneVoiceId', 'v_abc')
    const b = await freshSettings()
    expect(b.getAll().voiceCloneProvider).toBe('elevenlabs')
    expect(b.getAll().voiceCloneVoiceId).toBe('v_abc')
  })

  it('ignora chave desconhecida (não cria lixo)', async () => {
    const s = await freshSettings()
    s.set('naoExiste', 'x')
    expect((s.getAll() as Record<string, unknown>).naoExiste).toBeUndefined()
  })
})
