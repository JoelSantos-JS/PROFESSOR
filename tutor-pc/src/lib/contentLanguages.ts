// Opções de "idioma do conteúdo" para a transcrição. 'auto' deixa o Whisper detectar por clipe;
// um código fixo FORÇA aquele idioma (útil quando a auto-detecção erra ou o conteúdo é constante).
// Puro e testável.

import { languageName, languageNameFor, languageFlag } from './languages'

// Idiomas suportados como conteúdo (alvos comuns de transcrição).
export const CONTENT_LANGUAGE_CODES = ['en', 'zh', 'ja', 'ko', 'es', 'pt', 'fr', 'de', 'it', 'ru'] as const

export interface ContentLanguageOption { code: string; label: string }

/** Lista para o seletor: 'auto' + idiomas suportados (bandeira + nome), no idioma da interface. */
export function contentLanguageOptions(uiLang: 'pt' | 'en' = 'pt'): ContentLanguageOption[] {
  const auto = uiLang === 'en' ? '🌐 Detect automatically' : '🌐 Detectar automaticamente'
  return [
    { code: 'auto', label: auto },
    ...CONTENT_LANGUAGE_CODES.map(code => ({ code, label: `${languageFlag(code)} ${languageNameFor(code, uiLang)}` })),
  ]
}

/** Rótulo curto do idioma de conteúdo atual (para chips/indicadores). */
export function contentLanguageLabel(code: string): string {
  return !code || code === 'auto' ? 'Auto' : languageName(code)
}

/** Normaliza um valor vindo das settings para um código válido (default 'auto'). */
export function normalizeContentLanguage(code: string | undefined): string {
  const c = (code ?? '').toLowerCase().split('-')[0]
  if (!c || c === 'auto') return 'auto'
  return (CONTENT_LANGUAGE_CODES as readonly string[]).includes(c) ? c : 'auto'
}
