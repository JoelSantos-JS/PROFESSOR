// Idioma NATIVO do usuário (em que ele quer ver as traduções/explicações do tutor).
// Detecção pelo locale do sistema + lista para o seletor. Puro e testável.

export interface NativeLanguage {
  code: string    // 'pt', 'en', 'ja', ...
  name: string    // endônimo (como o próprio idioma se escreve)
}

// Idiomas oferecidos como "seu idioma" (no qual as explicações aparecem).
export const NATIVE_LANGUAGES: NativeLanguage[] = [
  { code: 'pt', name: 'Português' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'zh', name: '中文' },
  { code: 'ru', name: 'Русский' },
]

const SUPPORTED = new Set(NATIVE_LANGUAGES.map(l => l.code))
const DEFAULT_NATIVE = 'en'

/** Código base de um locale: 'pt-BR' → 'pt', 'EN-us' → 'en'. */
export function baseLocale(locale: string): string {
  return (locale || '').toLowerCase().split(/[-_]/)[0]
}

/**
 * Resolve o idioma nativo a partir do locale do sistema (navigator.language /
 * app.getLocale()). Cai para inglês quando o idioma não é oferecido.
 */
export function resolveNativeLanguage(locale: string): string {
  const base = baseLocale(locale)
  return SUPPORTED.has(base) ? base : DEFAULT_NATIVE
}

/** Endônimo para exibir no seletor (ou o próprio código se desconhecido). */
export function nativeLanguageName(code: string): string {
  const base = baseLocale(code)
  return NATIVE_LANGUAGES.find(l => l.code === base)?.name ?? (base || code).toUpperCase()
}

export function isSupportedNative(code: string): boolean {
  return SUPPORTED.has(baseLocale(code))
}
