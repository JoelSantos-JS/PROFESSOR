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
  lineCount: number
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

interface StoreData {
  sessions: SessionRecord[]
  vocab: VocabCard[]
  mistakes: Record<string, MistakeRecord>  // keyed by `${lang}:${word}`
  streak: number
  lastActiveDate: string  // YYYY-MM-DD
}

const EMPTY: StoreData = { sessions: [], vocab: [], mistakes: {}, streak: 0, lastActiveDate: '' }

export class StoreService {
  private filePath: string

  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'store.json')
  }

  private load(): StoreData {
    try {
      const data: StoreData = { ...EMPTY, ...JSON.parse(fs.readFileSync(this.filePath, 'utf-8')) }
      // Migrate legacy/inconsistent language codes so decks don't split
      // (e.g. "korean"→"ko", "ko-KR"→"ko", "portuguese"→"pt").
      for (const v of data.vocab) v.lang = canonicalLang(v.lang)
      for (const m of Object.values(data.mistakes)) m.lang = canonicalLang(m.lang)
      return data
    } catch {
      return { ...EMPTY }
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
  recordSession(lineCount: number): void {
    const data = this.load()
    data.sessions.push({ id: `s_${Date.now()}`, startedAt: Date.now(), lineCount })
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

  getDueVocab(now = Date.now(), limit = 50, lang?: string): VocabCard[] {
    return this.load().vocab
      .filter(v => v.due <= now && (!lang || v.lang === lang))
      .slice(0, limit)
  }

  /** Per-language deck stats (for the language separator UI). */
  getLanguages(now = Date.now()): LangStat[] {
    return languageStats(this.load().vocab, now)
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
