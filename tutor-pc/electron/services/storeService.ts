import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { advanceStreak } from '../lib/streak.js'

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
      return { ...EMPTY, ...JSON.parse(fs.readFileSync(this.filePath, 'utf-8')) }
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
      // de-dupe by lang+word
      if (data.vocab.some(v => v.lang === it.lang && v.word === it.word)) continue
      data.vocab.push({
        id: `v_${now}_${Math.random().toString(36).slice(2, 8)}`,
        word: it.word, romanization: it.romanization, translation: it.translation,
        example: it.example, lang: it.lang,
        ease: 2.5, interval: 0, reps: 0, due: now, createdAt: now, lapses: 0,
      })
    }
    this.save(data)
  }

  getDueVocab(now = Date.now(), limit = 50): VocabCard[] {
    return this.load().vocab.filter(v => v.due <= now).slice(0, limit)
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
  getStats() {
    const data = this.load()
    const now = Date.now()
    return {
      sessionCount: data.sessions.length,
      phraseCount: data.vocab.length,
      dueCount: data.vocab.filter(v => v.due <= now).length,
      streak: data.streak,
      recentSessions: data.sessions.slice(-5).reverse(),
      topMistakes: Object.values(data.mistakes).sort((a, b) => b.count - a.count).slice(0, 10),
    }
  }
}
