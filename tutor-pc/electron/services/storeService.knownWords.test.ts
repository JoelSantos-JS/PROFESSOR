import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs'

// Cada teste usa um diretório userData isolado para não tocar dados reais.
// `vi.hoisted` garante que o mock (içado para o topo) leia o MESMO ref que o beforeEach atualiza.
const ref = vi.hoisted(() => ({ dir: '' }))

vi.mock('electron', () => ({
  app: { getPath: () => ref.dir },
}))

// Import dinâmico depois do mock estar registrado.
async function freshStore() {
  const { StoreService } = await import('./storeService.js')
  return new StoreService()
}

describe('StoreService — palavras conhecidas', () => {
  beforeEach(() => {
    ref.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'professor-store-'))
  })
  afterEach(() => {
    fs.rmSync(ref.dir, { recursive: true, force: true })
  })

  it('começa sem palavras conhecidas', async () => {
    const store = await freshStore()
    expect(store.getKnownWords('zh')).toEqual({})
    expect(store.knownCount('zh')).toBe(0)
  })

  it('define e lê o status de uma palavra', async () => {
    const store = await freshStore()
    store.setWordStatus('zh', '你好', 'known')
    expect(store.getKnownWords('zh')).toEqual({ '你好': 'known' })
    expect(store.knownCount('zh')).toBe(1)
  })

  it('persiste entre instâncias (recarrega do disco)', async () => {
    const a = await freshStore()
    a.setWordStatus('ko', '안녕', 'learning')
    const b = await freshStore()
    expect(b.getKnownWords('ko')).toEqual({ '안녕': 'learning' })
  })

  it('canonicaliza o idioma (zh-CN e zh compartilham o balde)', async () => {
    const store = await freshStore()
    store.setWordStatus('zh-CN', '谢谢', 'known')
    expect(store.getKnownWords('zh')).toEqual({ '谢谢': 'known' })
    expect(store.getKnownWords('zh-TW')).toEqual({ '谢谢': 'known' })
  })

  it('isola idiomas diferentes', async () => {
    const store = await freshStore()
    store.setWordStatus('zh', 'word', 'known')
    store.setWordStatus('ko', 'word', 'learning')
    expect(store.getKnownWords('zh')).toEqual({ word: 'known' })
    expect(store.getKnownWords('ko')).toEqual({ word: 'learning' })
  })

  it('status vazio remove a palavra', async () => {
    const store = await freshStore()
    store.setWordStatus('zh', '词', 'known')
    expect(store.knownCount('zh')).toBe(1)
    store.setWordStatus('zh', '词', '')
    expect(store.getKnownWords('zh')).toEqual({})
    expect(store.knownCount('zh')).toBe(0)
  })

  it('knownCount conta só "known" (não "learning"/"ignore")', async () => {
    const store = await freshStore()
    store.setWordStatus('zh', 'a', 'known')
    store.setWordStatus('zh', 'b', 'learning')
    store.setWordStatus('zh', 'c', 'ignore')
    expect(store.knownCount('zh')).toBe(1)
    expect(Object.keys(store.getKnownWords('zh'))).toHaveLength(3)
  })

  it('atualiza o status de uma palavra existente', async () => {
    const store = await freshStore()
    store.setWordStatus('zh', 'x', 'learning')
    store.setWordStatus('zh', 'x', 'known')
    expect(store.getKnownWords('zh')).toEqual({ x: 'known' })
    expect(store.knownCount('zh')).toBe(1)
  })

  it('ignora palavra vazia', async () => {
    const store = await freshStore()
    store.setWordStatus('zh', '', 'known')
    expect(store.getKnownWords('zh')).toEqual({})
  })
})

describe('StoreService - session records', () => {
  beforeEach(() => { ref.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'professor-store-')) })
  afterEach(() => { fs.rmSync(ref.dir, { recursive: true, force: true }) })

  it('mantem compatibilidade com recordSession numerico', async () => {
    const store = await freshStore()
    store.recordSession(3)
    const stats = store.getStats()
    expect(stats.sessionCount).toBe(1)
    expect(stats.recentSessions[0].lineCount).toBe(3)
  })

  it('salva sessao leve com idioma, titulo e preview sem duplicar dados pesados', async () => {
    const store = await freshStore()
    store.recordSession({
      lineCount: 7,
      lang: 'ko-KR',
      startedAt: 1_000,
      endedAt: 91_000,
      preview: [
        'first phrase that gets dropped from compact preview',
        'second phrase that becomes the visible title',
        'third phrase',
        'fourth phrase',
        'fifth phrase',
        'sixth phrase',
      ],
    })

    const session = store.getStats().recentSessions[0]
    expect(session).toMatchObject({
      lineCount: 7,
      lang: 'ko',
      startedAt: 1_000,
      endedAt: 91_000,
      title: 'second phrase that becomes the visible title',
      preview: ['second phrase that becomes the visible title', 'third phrase', 'fourth phrase', 'fifth phrase', 'sixth phrase'],
    })
  })

  it('ignora sessoes vazias', async () => {
    const store = await freshStore()
    store.recordSession({ lineCount: 0, preview: ['ignored'] })
    expect(store.getStats().sessionCount).toBe(0)
  })
})

describe('StoreService - getMistakes', () => {
  beforeEach(() => { ref.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'professor-store-')) })
  afterEach(() => { fs.rmSync(ref.dir, { recursive: true, force: true }) })

  it('retorna os erros de um idioma ordenados por frequência', async () => {
    const store = await freshStore()
    store.recordMistakes([{ word: '발', lang: 'ko' }, { word: '발', lang: 'ko' }])  // count 2
    store.recordMistakes([{ word: '물', lang: 'ko' }])                               // count 1
    store.recordMistakes([{ word: 'red', lang: 'en' }])                             // outro idioma

    const ko = store.getMistakes('ko')
    expect(ko.map(m => m.word)).toEqual(['발', '물'])   // mais frequente primeiro
    expect(ko[0].count).toBe(2)
    expect(ko.every(m => m.lang === 'ko')).toBe(true)   // não vaza o 'en'
  })

  it('canonicaliza o idioma (ko-KR ↔ ko)', async () => {
    const store = await freshStore()
    store.recordMistakes([{ word: '한', lang: 'ko' }])
    expect(store.getMistakes('ko-KR').map(m => m.word)).toEqual(['한'])
  })

  it('idioma sem erros → vazio', async () => {
    const store = await freshStore()
    expect(store.getMistakes('ja')).toEqual([])
  })
})

describe('StoreService - token usage', () => {
  beforeEach(() => { ref.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'professor-store-')) })
  afterEach(() => { fs.rmSync(ref.dir, { recursive: true, force: true }) })

  it('persiste e soma gastos de token entre instancias', async () => {
    const store = await freshStore()
    store.recordTokenUsage({ feature: 'professor', lang: 'ko-KR', inputTokens: 900, outputTokens: 100, totalTokens: 1000 })
    store.recordTokenUsage({ feature: 'professor', lang: 'ko', inputTokens: 450, outputTokens: 50, totalTokens: 500 })

    const reloaded = await freshStore()
    const summary = reloaded.getTokenUsageSummary(Date.now(), 'professor')
    expect(summary.totalTokens).toBe(1500)
    expect(summary.callCount).toBe(2)
    expect(summary.recent[0].lang).toBe('ko')
  })

  it('calcula hoje e mes sem apagar o total historico', async () => {
    const store = await freshStore()
    const now = new Date('2026-06-09T12:00:00').getTime()
    const yesterday = new Date('2026-06-08T12:00:00').getTime()
    const previousMonth = new Date('2026-05-31T12:00:00').getTime()

    store.recordTokenUsage({ feature: 'professor', at: previousMonth, inputTokens: 100, outputTokens: 0, totalTokens: 100 })
    store.recordTokenUsage({ feature: 'professor', at: yesterday, inputTokens: 200, outputTokens: 0, totalTokens: 200 })
    store.recordTokenUsage({ feature: 'professor', at: now, inputTokens: 300, outputTokens: 0, totalTokens: 300 })

    const summary = store.getTokenUsageSummary(now, 'professor')
    expect(summary.totalTokens).toBe(600)
    expect(summary.monthTokens).toBe(500)
    expect(summary.todayTokens).toBe(300)
  })
})

describe('StoreService — capturedToday', () => {
  beforeEach(() => { ref.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'professor-store-')) })
  afterEach(() => { fs.rmSync(ref.dir, { recursive: true, force: true }) })

  it('zero sem sessões', async () => {
    const store = await freshStore()
    expect(store.capturedToday()).toBe(0)
  })

  it('soma só as sessões iniciadas hoje', async () => {
    const now = Date.now()
    const todayNoon = new Date(now); todayNoon.setHours(12, 0, 0, 0)
    const yesterday = todayNoon.getTime() - 24 * 3600_000
    // injeta sessões direto no arquivo (recordSession usa Date.now)
    const file = path.join(ref.dir, 'store.json')
    fs.writeFileSync(file, JSON.stringify({
      sessions: [
        { id: 'a', startedAt: todayNoon.getTime(), lineCount: 3 },
        { id: 'b', startedAt: todayNoon.getTime(), lineCount: 2 },
        { id: 'c', startedAt: yesterday, lineCount: 10 },
      ],
      vocab: [], mistakes: {}, known: {}, streak: 0, lastActiveDate: '',
    }))
    const store2 = await freshStore()
    expect(store2.capturedToday(todayNoon.getTime())).toBe(5)   // 3 + 2 (ignora ontem)
  })
})
