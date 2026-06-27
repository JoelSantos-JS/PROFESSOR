// Textos do splash de abertura, por idioma (segue o idioma do app/locale do PC). Puro/testável.
import type { AppLanguage } from './uiLanguage'

const STEPS: Record<AppLanguage, string[]> = {
  pt: ['Iniciando…', 'Carregando seus idiomas…', 'Preparando o tutor…', 'Sincronizando revisões…', 'Quase lá…'],
  en: ['Starting…', 'Loading your languages…', 'Preparing the tutor…', 'Syncing reviews…', 'Almost there…'],
}

const TAGLINE: Record<AppLanguage, string> = {
  pt: 'Mergulhe no idioma',
  en: 'Dive into the language',
}

/** Passos cíclicos do status no idioma dado. */
export function splashSteps(lang: AppLanguage): string[] {
  return STEPS[lang] ?? STEPS.en
}

export function splashTagline(lang: AppLanguage): string {
  return TAGLINE[lang] ?? TAGLINE.en
}

/** Próximo índice da rotação (faz wrap). Lista vazia → 0. */
export function nextStatusIndex(length: number, current: number): number {
  if (length <= 0) return 0
  return (current + 1) % length
}
