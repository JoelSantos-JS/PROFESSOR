// Nome em inglês do idioma NATIVO do usuário, para instruir o modelo a traduzir/explicar
// nesse idioma. Espelha a lista do renderer (src/lib/nativeLang.ts). Puro e testável.

const ENGLISH_NAMES: Record<string, string> = {
  pt: 'Brazilian Portuguese',
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Mandarin Chinese',
  ru: 'Russian',
}

function base(code: string): string {
  return (code || '').toLowerCase().split(/[-_]/)[0]
}

/** Nome em inglês de um idioma, ou undefined se não estiver no mapa. */
export function languageEnglishName(code?: string): string | undefined {
  return ENGLISH_NAMES[base(code ?? '')]
}

/** Nome em inglês do idioma nativo (default: Brazilian Portuguese). */
export function nativeLanguageEnglishName(code?: string): string {
  return languageEnglishName(code) ?? 'Brazilian Portuguese'
}

/** Nome em inglês do idioma-ALVO, caindo para o próprio código em maiúsculas se desconhecido. */
export function targetLanguageEnglishName(code?: string): string {
  return languageEnglishName(code) ?? (base(code ?? '') || 'the target language').toUpperCase()
}
