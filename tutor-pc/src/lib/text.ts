/**
 * Word-by-word comparison of original vs spoken text.
 * Strips punctuation, lowercases, then aligns by position.
 * Returns each word of the original with ok=true if the user said it correctly.
 */
export function compareWords(
  original: string,
  spoken:   string,
): { word: string; ok: boolean }[] {
  const clean = (s: string) =>
    s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').trim()

  const origWords   = clean(original).split(/\s+/).filter(Boolean)
  const spokenWords = clean(spoken).split(/\s+/).filter(Boolean)

  return origWords.map((word, i) => ({
    word,
    ok: word === (spokenWords[i] ?? ''),
  }))
}

/**
 * Returns a 0–100 accuracy score for a practice attempt.
 */
export function scoreAttempt(original: string, spoken: string): number {
  const words = compareWords(original, spoken)
  if (words.length === 0) return 0
  return Math.round((words.filter(w => w.ok).length / words.length) * 100)
}

export type WordStatus = 'ok' | 'missing' | 'extra'
export interface DiffToken { word: string; status: WordStatus }

function tokenize(s: string): string[] {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').trim().split(/\s+/).filter(Boolean)
}

/**
 * Aligns the spoken words against the original using a Longest Common
 * Subsequence, so a single inserted/dropped word doesn't cascade into
 * everything being marked wrong (much more accurate than positional compare).
 *
 * Returns tokens in reading order:
 *  - 'ok'      : word matched (correct)
 *  - 'missing' : word in original but NOT spoken
 *  - 'extra'   : word spoken but NOT in original (so EVERYTHING said shows up)
 */
export function diffWords(original: string, spoken: string): DiffToken[] {
  const o = tokenize(original)
  const s = tokenize(spoken)
  const m = o.length, n = s.length

  // dp[i][j] = LCS length of o[i:] and s[j:]
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = o[i] === s[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const out: DiffToken[] = []
  let i = 0, j = 0
  while (i < m && j < n) {
    if (o[i] === s[j]) { out.push({ word: o[i], status: 'ok' }); i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ word: o[i], status: 'missing' }); i++ }
    else { out.push({ word: s[j], status: 'extra' }); j++ }
  }
  while (i < m) { out.push({ word: o[i], status: 'missing' }); i++ }
  while (j < n) { out.push({ word: s[j], status: 'extra' }); j++ }
  return out
}

/** Score 0–100 from a diff: correct words / total original words. */
export function scoreFromDiff(diff: DiffToken[]): number {
  const originalCount = diff.filter(d => d.status === 'ok' || d.status === 'missing').length
  if (originalCount === 0) return 0
  const ok = diff.filter(d => d.status === 'ok').length
  return Math.round((ok / originalCount) * 100)
}

/**
 * Words from the original the learner did NOT say correctly (status 'missing'),
 * de-duplicated, preserving order. These are the words to drill.
 */
export function missingWords(diff: DiffToken[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const d of diff) {
    if (d.status !== 'missing') continue
    const key = normalizeWord(d.word)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(d.word)
  }
  return out
}

export interface TextSegment {
  text: string
  isWord: boolean  // true = clickable word/character; false = space/punctuation
}

/**
 * Segments text into words for click-to-lookup. Uses Intl.Segmenter so it works
 * for languages without spaces (Chinese, Japanese, Thai), falling back to a
 * whitespace split if the runtime lacks Intl.Segmenter.
 */
export function segmentText(text: string, lang = 'und'): TextSegment[] {
  const Seg = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter
  if (Seg) {
    try {
      const seg = new Seg(lang || 'und', { granularity: 'word' })
      return Array.from(seg.segment(text), (s) => ({
        text: s.segment,
        isWord: !!s.isWordLike,
      }))
    } catch {
      // fall through
    }
  }
  return text
    .split(/(\s+)/)
    .filter(t => t.length > 0)
    .map(t => ({ text: t, isWord: /\S/.test(t) }))
}

// ── Single-word practice matching ─────────────────────────────────────────────

/** Normalize for comparison: lowercase, strip accents and non-alphanumerics. */
export function normalizeWord(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // strip diacritics
    .replace(/[^\p{L}\p{N}]/gu, '')
}

/** Levenshtein edit distance between two strings. */
export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  if (m === 0) return n
  if (n === 0) return m
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  let curr = new Array(n + 1).fill(0)
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    [prev, curr] = [curr, prev]
  }
  return prev[n]
}

/** Similarity ratio 0..1 (1 = identical) based on edit distance. */
export function similarity(a: string, b: string): number {
  const na = normalizeWord(a), nb = normalizeWord(b)
  if (!na && !nb) return 1
  if (!na || !nb) return 0
  const dist = levenshtein(na, nb)
  return 1 - dist / Math.max(na.length, nb.length)
}

/**
 * Does the spoken text contain the target word (for single-word practice)?
 * Robust to ASR quirks: dedupes repeated tokens, ignores filler, and accepts a
 * close phonetic/spelling match (>= threshold) rather than requiring an exact hit.
 */
export function wordMatches(target: string, spoken: string, threshold = 0.8): boolean {
  const t = normalizeWord(target)
  if (!t) return false

  // Whole-string check first (handles multi-syllable / multi-word targets)
  if (similarity(target, spoken) >= threshold) return true

  // Token-level: split spoken into words, dedupe consecutive repeats (ASR loops)
  const tokens = spoken.split(/\s+/).map(normalizeWord).filter(Boolean)
  const deduped = tokens.filter((w, i) => w !== tokens[i - 1])

  // Exact token hit
  if (deduped.includes(t)) return true

  // Best single-token fuzzy match
  for (const w of deduped) {
    if (1 - levenshtein(t, w) / Math.max(t.length, w.length) >= threshold) return true
  }

  // Sliding window for multi-word targets spoken across tokens (e.g. "still alive")
  const targetWordCount = normalizeWord(target).length > 0 ? target.trim().split(/\s+/).length : 0
  if (targetWordCount > 1) {
    for (let i = 0; i + targetWordCount <= deduped.length; i++) {
      const window = deduped.slice(i, i + targetWordCount).join('')
      if (1 - levenshtein(t, window) / Math.max(t.length, window.length) >= threshold) return true
    }
  }

  return false
}
