// Display names (Brazilian Portuguese) + flags for detected language codes.

const NAMES: Record<string, string> = {
  en: 'Inglês', es: 'Espanhol', pt: 'Português', fr: 'Francês', de: 'Alemão',
  it: 'Italiano', ko: 'Coreano', ja: 'Japonês', zh: 'Chinês', ru: 'Russo',
  ar: 'Árabe', hi: 'Hindi', th: 'Tailandês', nl: 'Holandês', tr: 'Turco',
  pl: 'Polonês', vi: 'Vietnamita', id: 'Indonésio',
}

const NAMES_EN: Record<string, string> = {
  en: 'English', es: 'Spanish', pt: 'Portuguese', fr: 'French', de: 'German',
  it: 'Italian', ko: 'Korean', ja: 'Japanese', zh: 'Chinese', ru: 'Russian',
  ar: 'Arabic', hi: 'Hindi', th: 'Thai', nl: 'Dutch', tr: 'Turkish',
  pl: 'Polish', vi: 'Vietnamese', id: 'Indonesian',
}

const FLAGS: Record<string, string> = {
  en: '🇬🇧', es: '🇪🇸', pt: '🇧🇷', fr: '🇫🇷', de: '🇩🇪', it: '🇮🇹',
  ko: '🇰🇷', ja: '🇯🇵', zh: '🇨🇳', ru: '🇷🇺', ar: '🇸🇦', hi: '🇮🇳',
  th: '🇹🇭', nl: '🇳🇱', tr: '🇹🇷', pl: '🇵🇱', vi: '🇻🇳', id: '🇮🇩',
}

const FLAG_COUNTRIES: Record<string, string> = {
  en: 'gb', es: 'es', pt: 'br', fr: 'fr', de: 'de', it: 'it',
  ko: 'kr', ja: 'jp', zh: 'cn', ru: 'ru', ar: 'sa', hi: 'in',
  th: 'th', nl: 'nl', tr: 'tr', pl: 'pl', vi: 'vn', id: 'id',
}

/** Base language code (zh-CN → zh, en-US → en). */
export function baseLang(lang: string): string {
  return (lang || '').split('-')[0].toLowerCase()
}

/** Human name for a language code, falling back to the code itself. */
export function languageName(lang: string): string {
  if (!lang || lang === 'unknown') return 'Outro'
  return NAMES[baseLang(lang)] ?? lang.toUpperCase()
}

/** Human name localized for the app UI language (só pt tem PT; ko/zh/en caem no inglês). */
export function languageNameFor(lang: string, uiLang: string): string {
  const pt = uiLang === 'pt'
  if (!lang || lang === 'unknown') return pt ? 'Outro' : 'Other'
  const base = baseLang(lang)
  return (pt ? NAMES[base] : NAMES_EN[base]) ?? lang.toUpperCase()
}

/** Flag emoji for a language code, or a generic globe. */
export function languageFlag(lang: string): string {
  return FLAGS[baseLang(lang)] ?? '🌐'
}

/** Lowercase ISO 3166-1 alpha-2 country code for CSS flag images (e.g. "gb", "br"). */
export function languageFlagCountry(lang: string): string | null {
  return FLAG_COUNTRIES[baseLang(lang)] ?? null
}

/** "🇰🇷 Coreano" */
export function languageLabel(lang: string): string {
  return `${languageFlag(lang)} ${languageName(lang)}`
}
