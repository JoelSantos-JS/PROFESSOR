const FRAGMENT_STARTS = new Set([
  'and', 'but', 'or', 'because', 'cause', 'so', 'then', 'also', 'for',
])

const BAD_ENDINGS = new Set([
  'and', 'or', 'but', 'to', 'of', 'for', 'with', 'by', 'from', 'that', 'because',
  'can', 'could', 'would', 'should', 'will', 'gonna', 'wanna', 'generate', 'upload',
])

const FILLERS = new Set(['uh', 'um', 'erm', 'hmm', 'like', 'yeah', 'okay', 'ok'])

const FIXED_CONVERSATION = [
  /^(thank you|thanks|thank you so much)$/i,
  /^(you'?re welcome|no problem|my bad|sorry|excuse me)$/i,
  /^(good morning|good afternoon|good evening|good night)$/i,
]

const LATIN_SIGNAL = /\b(i|you|we|they|he|she|it|this|that|there|who|what|where|when|why|how|do|does|did|am|is|are|was|were|have|has|had|can|could|will|would|should|want|need|think|know|feel|mean|tell|please|let'?s)\b/i
const CJK_OR_HANGUL = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u

export interface ReviewableSentenceReason {
  ok: boolean
  reason?: string
}

/** Decides if a captured transcript is worth saving into SRS review as a real-world phrase. */
export function reviewableSentenceReason(text: string): ReviewableSentenceReason {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return { ok: false, reason: 'empty' }
  if (!/\p{L}/u.test(clean)) return { ok: false, reason: 'no-letters' }
  if (/https?:\/\/|www\.|@|#/.test(clean)) return { ok: false, reason: 'metadata' }

  if (CJK_OR_HANGUL.test(clean)) {
    const chars = Array.from(clean.replace(/[\s\p{P}\p{S}]/gu, ''))
    if (chars.length < 3) return { ok: false, reason: 'too-short' }
    if (chars.length > 90) return { ok: false, reason: 'too-long' }
    return { ok: true }
  }

  if (FIXED_CONVERSATION.some(pattern => pattern.test(clean))) return { ok: true }

  const words = clean.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? []
  if (words.length < 2) return { ok: false, reason: 'too-short' }
  if (words.length > 24 || clean.length > 180) return { ok: false, reason: 'too-long' }

  const first = words[0] ?? ''
  const last = words.at(-1) ?? ''
  if (FRAGMENT_STARTS.has(first)) return { ok: false, reason: 'fragment-start' }
  if (BAD_ENDINGS.has(last)) return { ok: false, reason: 'incomplete-ending' }
  if (/\b(and|or|to|for|with)$/i.test(clean)) return { ok: false, reason: 'dangling-ending' }
  if (/^(great|good|nice|important|useful)\s+for\s+this\b/i.test(clean)) return { ok: false, reason: 'caption-fragment' }

  const unique = new Set(words)
  if (words.length >= 5 && unique.size <= 2) return { ok: false, reason: 'repetition' }

  const fillerCount = words.filter(word => FILLERS.has(word)).length
  if (words.length >= 4 && fillerCount / words.length > 0.45) return { ok: false, reason: 'filler-heavy' }

  if (!LATIN_SIGNAL.test(clean)) return { ok: false, reason: 'no-conversation-signal' }
  return { ok: true }
}

export function isReviewableSentence(text: string): boolean {
  return reviewableSentenceReason(text).ok
}
