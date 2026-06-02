// Whisper returns the detected language as a full English NAME ("korean",
// "english"), while Gemini returns an ISO 639-1 code ("ko", "en"). Everything
// downstream (voice selection, romanization, prompts) expects ISO codes, so we
// normalize here.

const NAME_TO_ISO: Record<string, string> = {
  english: 'en',
  chinese: 'zh', mandarin: 'zh', cantonese: 'zh',
  korean: 'ko',
  japanese: 'ja',
  spanish: 'es', castilian: 'es',
  portuguese: 'pt',
  french: 'fr',
  german: 'de',
  italian: 'it',
  russian: 'ru',
  arabic: 'ar',
  hindi: 'hi',
  thai: 'th',
  dutch: 'nl',
  turkish: 'tr',
  polish: 'pl',
  vietnamese: 'vi',
  indonesian: 'id',
}

/**
 * Normalize a detected language to an ISO 639-1 code (or BCP-47 region tag).
 * - full English names ("korean") → ISO ("ko")
 * - existing ISO / BCP-47 codes ("ko", "ko-KR", "zh-CN") → returned unchanged
 * - "auto" / empty / unknown → returned as-is (callers handle fallback)
 */
export function normalizeLang(lang?: string): string {
  if (!lang) return ''
  const key = lang.trim().toLowerCase()
  return NAME_TO_ISO[key] ?? lang.trim()
}

/**
 * Canonical base language for grouping/dedup: maps names→ISO and drops the
 * region tag ("korean" → "ko", "ko-KR" → "ko", "zh-CN" → "zh"). Empty stays "".
 */
export function canonicalLang(lang?: string): string {
  return normalizeLang(lang).split('-')[0].toLowerCase()
}
