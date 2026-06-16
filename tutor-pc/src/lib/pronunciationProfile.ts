// Perfil de pontos fracos de pronúncia: a partir das palavras que o usuário mais erra
// (já gravadas em store.mistakes), monta o "top" universal + agrupa por traço fonético do
// idioma quando dá pra derivar do próprio texto (batchim 🇰🇷, mora 🇯🇵, th/r 🇬🇧). Puro/testável.

import { baseLang } from './languages'

export interface MistakeWord { word: string; count: number }
export interface ProfileGroup { key: string; label: string; words: string[]; count: number }
export interface PronunciationProfile {
  total: number          // nº de palavras erradas distintas
  top: MistakeWord[]     // mais frequentes (universal)
  groups: ProfileGroup[] // categorias fonéticas (por idioma), maiores primeiro
}

// ── Coreano: som final representativo (대표음) do batchim ─────────────────────────
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
const REPR: Record<string, string> = {
  'ㄱ': 'ㄱ', 'ㄲ': 'ㄱ', 'ㅋ': 'ㄱ', 'ㄳ': 'ㄱ', 'ㄺ': 'ㄱ',
  'ㄴ': 'ㄴ', 'ㄵ': 'ㄴ', 'ㄶ': 'ㄴ',
  'ㄷ': 'ㄷ', 'ㅅ': 'ㄷ', 'ㅆ': 'ㄷ', 'ㅈ': 'ㄷ', 'ㅊ': 'ㄷ', 'ㅌ': 'ㄷ', 'ㅎ': 'ㄷ',
  'ㄹ': 'ㄹ', 'ㄼ': 'ㄹ', 'ㄽ': 'ㄹ', 'ㄾ': 'ㄹ', 'ㅀ': 'ㄹ',
  'ㅁ': 'ㅁ', 'ㄻ': 'ㅁ',
  'ㅂ': 'ㅂ', 'ㅍ': 'ㅂ', 'ㅄ': 'ㅂ', 'ㄿ': 'ㅂ',
  'ㅇ': 'ㅇ',
}

/** Som final representativo de uma sílaba hangul, ou null se não tiver batchim. */
function finalRepr(ch: string): string | null {
  const code = ch.codePointAt(0) ?? 0
  if (code < 0xac00 || code > 0xd7a3) return null
  const fi = (code - 0xac00) % 28
  if (fi === 0) return null
  return REPR[JONG[fi]] ?? null
}

type Bucket = { key: string; label: string }

/** Quais baldes fonéticos uma palavra ocupa, conforme o idioma. */
function classify(base: string, word: string): Bucket[] {
  if (base === 'ko') {
    const reprs = new Set<string>()
    for (const ch of word) { const r = finalRepr(ch); if (r) reprs.add(r) }
    return [...reprs].map(r => ({ key: `batchim-${r}`, label: `Batchim ${r}` }))
  }
  if (base === 'ja') {
    const out: Bucket[] = []
    if (word.includes('ー')) out.push({ key: 'long', label: 'Vogal longa (ー)' })
    if (/[っッ]/.test(word)) out.push({ key: 'sokuon', label: 'Sokuon (っ)' })
    if (/[ゃゅょャュョ]/.test(word)) out.push({ key: 'youon', label: 'Som contraído (ゃゅょ)' })
    return out
  }
  if (base === 'en') {
    const out: Bucket[] = []
    if (/th/i.test(word)) out.push({ key: 'th', label: 'Som “th”' })
    if (/r/i.test(word)) out.push({ key: 'r', label: 'Som “r”' })
    return out
  }
  return []   // zh (tons precisam de pinyin) e demais → só o top
}

/**
 * Converte as palavras fracas num conjunto de drill para o diagnóstico ("leia esta palavra → score").
 * `focus` = traço(s) fonético(s) que a palavra exercita (reusa `classify`), ou um padrão honesto.
 * Resultado estruturalmente compatível com `DiagnosticItem` (mas sem acoplar o import).
 */
export function wordDrillItems(lang: string, words: string[]): { text: string; focus: string }[] {
  const base = baseLang(lang)
  const seen = new Set<string>()
  const out: { text: string; focus: string }[] = []
  for (const raw of words ?? []) {
    const text = raw?.trim()
    if (!text || seen.has(text)) continue
    seen.add(text)
    const labels = classify(base, text).map(b => b.label)
    out.push({ text, focus: labels.length ? labels.join(' · ') : 'pronúncia da palavra' })
  }
  return out
}

export function pronunciationProfile(lang: string, mistakes: MistakeWord[], topN = 8): PronunciationProfile {
  const list = (mistakes ?? []).filter(m => m && m.word?.trim())
  const base = baseLang(lang)

  const top = [...list]
    .sort((a, b) => (b.count - a.count) || a.word.localeCompare(b.word))
    .slice(0, topN)

  const buckets = new Map<string, { label: string; words: string[]; count: number }>()
  for (const m of list) {
    for (const b of classify(base, m.word)) {
      const cur = buckets.get(b.key) ?? { label: b.label, words: [], count: 0 }
      if (!cur.words.includes(m.word)) cur.words.push(m.word)
      cur.count += m.count
      buckets.set(b.key, cur)
    }
  }

  const groups: ProfileGroup[] = [...buckets.entries()]
    .map(([key, b]) => ({ key, label: b.label, words: b.words, count: b.count }))
    .sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label))

  return { total: list.length, top, groups }
}
