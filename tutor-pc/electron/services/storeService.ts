import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { advanceStreak } from '../lib/streak.js'
import { languageStats, type LangStat } from '../lib/languageStats.js'
import { canonicalLang } from '../lib/langNormalize.js'

// ── Persisted shapes ──────────────────────────────────────────────────────────

export interface SessionRecord {
  id: string
  startedAt: number
  endedAt?: number
  lineCount: number
  lang?: string
  title?: string
  preview?: string[]
}

export interface VocabCard {
  id: string
  word: string
  romanization?: string
  translation: string
  example?: string
  lang: string
  // SM-2 fields
  ease: number
  interval: number
  reps: number
  due: number       // timestamp ms
  createdAt: number
  lapses: number
}

export interface MistakeRecord {
  word: string
  lang: string
  count: number
  lastAt: number
}

export type WordStatus = 'known' | 'learning' | 'ignore'

export interface TokenUsageRecord {
  id: string
  at: number
  feature: 'professor' | 'analysis' | 'lookup' | 'other'
  lang?: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export interface TokenUsageSummary {
  totalTokens: number
  todayTokens: number
  monthTokens: number
  callCount: number
  lastAt?: number
  recent: TokenUsageRecord[]
}

interface StoreData {
  sessions: SessionRecord[]
  vocab: VocabCard[]
  mistakes: Record<string, MistakeRecord>  // keyed by `${lang}:${word}`
  known: Record<string, WordStatus>         // keyed by `${lang}:${normalizedWord}`
  tokenUsage: TokenUsageRecord[]
  streak: number
  lastActiveDate: string  // YYYY-MM-DD
}

const EMPTY: StoreData = { sessions: [], vocab: [], mistakes: {}, known: {}, tokenUsage: [], streak: 0, lastActiveDate: '' }

export class StoreService {
  private filePath: string

  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'store.json')
  }

  private load(): StoreData {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf-8')) as Partial<StoreData>
      // NÃO espalhar EMPTY: o spread aliasaria os objetos aninhados compartilhados
      // (known/mistakes), e uma escrita posterior poluiria o EMPTY do processo inteiro.
      const data: StoreData = {
        sessions:       parsed.sessions ?? [],
        vocab:          parsed.vocab ?? [],
        mistakes:       parsed.mistakes ?? {},
        known:          parsed.known ?? {},
        tokenUsage:     parsed.tokenUsage ?? [],
        streak:         parsed.streak ?? 0,
        lastActiveDate: parsed.lastActiveDate ?? '',
      }
      // Migrate legacy/inconsistent language codes so decks don't split
      // (e.g. "korean"→"ko", "ko-KR"→"ko", "portuguese"→"pt").
      for (const v of data.vocab) v.lang = canonicalLang(v.lang)
      for (const m of Object.values(data.mistakes)) m.lang = canonicalLang(m.lang)
      return data
    } catch {
      return { sessions: [], vocab: [], mistakes: {}, known: {}, tokenUsage: [], streak: 0, lastActiveDate: '' }
    }
  }

  private save(data: StoreData): void {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8')
    } catch (err) {
      console.error('[store] save failed:', (err as Error).message)
    }
  }

  // ── Streak ──────────────────────────────────────────────────────────────────
  private touchStreak(data: StoreData, now = Date.now()): void {
    const next = advanceStreak({ streak: data.streak, lastActiveDate: data.lastActiveDate }, now)
    data.streak = next.streak
    data.lastActiveDate = next.lastActiveDate
  }

  // ── Sessions ──────────────────────────────────────────────────────────────────
  recordSession(input: number | { lineCount: number; lang?: string; preview?: string[]; startedAt?: number; endedAt?: number }): void {
    const data = this.load()
    const now = Date.now()
    const session = typeof input === 'number'
      ? { lineCount: input, startedAt: now, endedAt: now }
      : {
          lineCount: input.lineCount,
          startedAt: input.startedAt && Number.isFinite(input.startedAt) ? input.startedAt : now,
          endedAt: input.endedAt && Number.isFinite(input.endedAt) ? input.endedAt : now,
          lang: input.lang ? canonicalLang(input.lang) : undefined,
          preview: compactPreview(input.preview),
        }
    if (session.lineCount <= 0) return
    data.sessions.push({
      id: `s_${now}_${Math.random().toString(36).slice(2, 8)}`,
      ...session,
      title: session.preview?.[0] ? sessionTitle(session.preview[0]) : undefined,
    })
    this.touchStreak(data)
    this.save(data)
  }

  // ── Vocab (SRS cards) ─────────────────────────────────────────────────────────
  addVocab(items: Array<{ word: string; romanization?: string; translation: string; example?: string; lang: string }>): void {
    if (!items.length) return
    const data = this.load()
    const now = Date.now()
    for (const it of items) {
      if (!it.word?.trim()) continue
      const lang = canonicalLang(it.lang)
      // de-dupe by lang+word
      if (data.vocab.some(v => v.lang === lang && v.word === it.word)) continue
      data.vocab.push({
        id: `v_${now}_${Math.random().toString(36).slice(2, 8)}`,
        word: it.word, romanization: it.romanization, translation: it.translation,
        example: it.example, lang,
        ease: 2.5, interval: 0, reps: 0, due: now, createdAt: now, lapses: 0,
      })
    }
    this.save(data)
  }

  /** Nº de frases capturadas HOJE (soma de lineCount das sessões iniciadas hoje). */
  capturedToday(now = Date.now()): number {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    const startMs = start.getTime()
    return this.load().sessions
      .filter(s => s.startedAt >= startMs)
      .reduce((sum, s) => sum + (s.lineCount || 0), 0)
  }

  recordTokenUsage(usage: Omit<TokenUsageRecord, 'id' | 'at'> & { at?: number }): TokenUsageRecord {
    const data = this.load()
    const now = usage.at && Number.isFinite(usage.at) ? Math.floor(usage.at) : Date.now()
    const inputTokens = Math.max(0, Math.round(usage.inputTokens || 0))
    const outputTokens = Math.max(0, Math.round(usage.outputTokens || 0))
    const totalTokens = Math.max(inputTokens + outputTokens, Math.round(usage.totalTokens || 0))
    const record: TokenUsageRecord = {
      id: `tu_${now}_${Math.random().toString(36).slice(2, 8)}`,
      at: now,
      feature: usage.feature || 'other',
      lang: usage.lang ? canonicalLang(usage.lang) : undefined,
      inputTokens,
      outputTokens,
      totalTokens,
    }
    data.tokenUsage.push(record)
    data.tokenUsage = data.tokenUsage.slice(-5000)
    this.save(data)
    return record
  }

  getTokenUsageSummary(now = Date.now(), feature?: TokenUsageRecord['feature']): TokenUsageSummary {
    const data = this.load()
    const usage = data.tokenUsage.filter(u => !feature || u.feature === feature)
    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)
    const startOfMonth = new Date(now)
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    return {
      totalTokens: usage.reduce((sum, u) => sum + (u.totalTokens || 0), 0),
      todayTokens: usage.filter(u => u.at >= startOfToday.getTime()).reduce((sum, u) => sum + (u.totalTokens || 0), 0),
      monthTokens: usage.filter(u => u.at >= startOfMonth.getTime()).reduce((sum, u) => sum + (u.totalTokens || 0), 0),
      callCount: usage.length,
      lastAt: usage.at(-1)?.at,
      recent: usage.slice(-10).reverse(),
    }
  }

  getDueVocab(now = Date.now(), limit = 50, lang?: string): VocabCard[] {
    return this.load().vocab
      .filter(v => v.due <= now && (!lang || v.lang === lang))
      .slice(0, limit)
  }

  /** Per-language deck stats (for the language separator UI). */
  getLanguages(now = Date.now()): LangStat[] {
    return languageStats(this.load().vocab, now)
  }

  // ── Palavras conhecidas (rastreio de progresso / % compreensão) ───────────────
  /** Status de todas as palavras de um idioma: { normalizedWord: status }. */
  getKnownWords(lang: string): Record<string, WordStatus> {
    const prefix = `${canonicalLang(lang)}:`
    const out: Record<string, WordStatus> = {}
    const known = this.load().known ?? {}
    for (const [key, status] of Object.entries(known)) {
      if (key.startsWith(prefix)) out[key.slice(prefix.length)] = status
    }
    return out
  }

  /** Define (ou remove, se status vazio) o status de uma palavra. `word` já vem normalizado. */
  setWordStatus(lang: string, word: string, status: WordStatus | ''): void {
    if (!word) return
    const data = this.load()
    if (!data.known) data.known = {}
    const key = `${canonicalLang(lang)}:${word}`
    if (status) data.known[key] = status
    else delete data.known[key]
    this.save(data)
  }

  /** Nº de palavras marcadas como `known` num idioma (para marcos/cobertura). */
  knownCount(lang: string): number {
    const prefix = `${canonicalLang(lang)}:`
    return Object.entries(this.load().known ?? {})
      .filter(([k, s]) => k.startsWith(prefix) && s === 'known').length
  }

  gradeVocab(id: string, next: { ease: number; interval: number; reps: number; due: number; lapsed: boolean }): void {
    const data = this.load()
    const card = data.vocab.find(v => v.id === id)
    if (!card) return
    card.ease = next.ease
    card.interval = next.interval
    card.reps = next.reps
    card.due = next.due
    if (next.lapsed) card.lapses += 1
    this.save(data)
  }

  // ── Mistakes ──────────────────────────────────────────────────────────────────
  recordMistakes(words: Array<{ word: string; lang: string }>): void {
    if (!words.length) return
    const data = this.load()
    const now = Date.now()
    for (const { word, lang } of words) {
      const key = `${lang}:${word.toLowerCase()}`
      const ex = data.mistakes[key]
      if (ex) { ex.count += 1; ex.lastAt = now }
      else data.mistakes[key] = { word, lang, count: 1, lastAt: now }
    }
    this.save(data)
  }

  /** Todos os erros (mistakes) de um idioma, ordenados por frequência — para o perfil de pronúncia. */
  getMistakes(lang: string): MistakeRecord[] {
    const canon = canonicalLang(lang)
    return Object.values(this.load().mistakes)
      .filter(m => m.lang === canon)
      .sort((a, b) => b.count - a.count)
  }

  // ── Aggregates for the dashboard ───────────────────────────────────────────────
  getStats(lang?: string) {
    const data = this.load()
    const now = Date.now()
    const vocab    = lang ? data.vocab.filter(v => v.lang === lang) : data.vocab
    const mistakes = Object.values(data.mistakes).filter(m => !lang || m.lang === lang)
    return {
      sessionCount: data.sessions.length,
      phraseCount: vocab.length,
      dueCount: vocab.filter(v => v.due <= now).length,
      streak: data.streak,
      languages: languageStats(data.vocab, now),
      recentSessions: data.sessions.slice(-5).reverse(),
      topMistakes: mistakes.sort((a, b) => b.count - a.count).slice(0, 10),
    }
  }
}

function compactPreview(lines: string[] | undefined): string[] | undefined {
  const preview = (lines ?? [])
    .map(line => line.trim())
    .filter(Boolean)
    .slice(-5)
  return preview.length ? preview : undefined
}

function sessionTitle(line: string): string {
  const clean = line.replace(/\s+/g, ' ').trim()
  return clean.length > 72 ? `${clean.slice(0, 69)}...` : clean
}
