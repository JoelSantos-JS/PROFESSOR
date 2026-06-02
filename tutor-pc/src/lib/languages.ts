// Display names (Brazilian Portuguese) + flags for detected language codes.

const NAMES: Record<string, string> = {
  en: 'Inglês', es: 'Espanhol', pt: 'Português', fr: 'Francês', de: 'Alemão',
  it: 'Italiano', ko: 'Coreano', ja: 'Japonês', zh: 'Chinês', ru: 'Russo',
  ar: 'Árabe', hi: 'Hindi', th: 'Tailandês', nl: 'Holandês', tr: 'Turco',
  pl: 'Polonês', vi: 'Vietnamita', id: 'Indonésio',
}

const FLAGS: Record<string, string> = {
  en: '🇬🇧', es: '🇪🇸', pt: '🇧🇷', fr: '🇫🇷', de: '🇩🇪', it: '🇮🇹',
  ko: '🇰🇷', ja: '🇯🇵', zh: '🇨🇳', ru: '🇷🇺', ar: '🇸🇦', hi: '🇮🇳',
  th: '🇹🇭', nl: '🇳🇱', tr: '🇹🇷', pl: '🇵🇱', vi: '🇻🇳', id: '🇮🇩',
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

/** Flag emoji for a language code, or a generic globe. */
export function languageFlag(lang: string): string {
  return FLAGS[baseLang(lang)] ?? '🌐'
}

/** "🇰🇷 Coreano" */
export function languageLabel(lang: string): string {
  return `${languageFlag(lang)} ${languageName(lang)}`
}
