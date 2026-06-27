import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs'

const ref = vi.hoisted(() => ({ dir: '' }))
vi.mock('electron', () => ({ app: { getPath: () => ref.dir } }))

async function freshStore() {
  const { StoreService } = await import('./storeService.js')
  return new StoreService()
}

describe('StoreService — backup/restore (nuvem)', () => {
  beforeEach(() => { ref.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'soaken-bkp-')) })
  afterEach(() => { fs.rmSync(ref.dir, { recursive: true, force: true }) })

  it('exportForBackup sobe o aprendizado mas NÃO a telemetria (tokenUsage)', async () => {
    const s = await freshStore()
    s.recordMistakes([{ word: 'apple', lang: 'en' }])
    s.recordTokenUsage({ feature: 'analysis', inputTokens: 10, outputTokens: 5, totalTokens: 15 })

    const payload = s.exportForBackup()
    expect((payload as Record<string, unknown>).tokenUsage).toBeUndefined()  // telemetria fica local
    expect(Object.keys(payload.mistakes).length).toBe(1)                     // aprendizado vai
  })

  it('importFromBackup aplica o backup e PRESERVA o tokenUsage local', async () => {
    const s = await freshStore()
    s.recordTokenUsage({ feature: 'analysis', inputTokens: 10, outputTokens: 5, totalTokens: 15 })

    s.importFromBackup({
      sessions: [], vocab: [], known: {}, streak: 7, lastActiveDate: '2026-06-25',
      mistakes: { 'en:hello': { word: 'hello', lang: 'en', count: 3, lastAt: 1 } },
    })

    expect(s.getMistakes('en').length).toBe(1)            // dado do backup aplicado
    expect(s.getStats().streak).toBe(7)
    expect(s.getUsageEvents().events.length).toBe(1)      // tokenUsage local NÃO foi apagado
  })

  it('hasLearningData: vazio=false; com sessão=true', async () => {
    const s = await freshStore()
    expect(s.hasLearningData()).toBe(false)
    s.recordSession({ lineCount: 3, lang: 'en' })
    expect(s.hasLearningData()).toBe(true)
  })
})
