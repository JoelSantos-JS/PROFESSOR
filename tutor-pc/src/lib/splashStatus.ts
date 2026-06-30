// Textos do splash de abertura, por idioma (segue o idioma do app/locale do PC). Puro/testável.
// pt tem PT; qualquer outro idioma do app (en/ko/zh) usa o inglês no splash.
const STEPS: Record<'pt' | 'en', string[]> = {
  pt: ['Iniciando…', 'Carregando seus idiomas…', 'Preparando o tutor…', 'Sincronizando revisões…', 'Quase lá…'],
  en: ['Starting…', 'Loading your languages…', 'Preparing the tutor…', 'Syncing reviews…', 'Almost there…'],
}

const TAGLINE: Record<'pt' | 'en', string> = {
  pt: 'Mergulhe no idioma',
  en: 'Dive into the language',
}

/** Passos cíclicos do status no idioma dado. */
export function splashSteps(lang: string): string[] {
  return STEPS[lang === 'pt' ? 'pt' : 'en']
}

export function splashTagline(lang: string): string {
  return TAGLINE[lang === 'pt' ? 'pt' : 'en']
}

/** Próximo índice da rotação (faz wrap). Lista vazia → 0. */
export function nextStatusIndex(length: number, current: number): number {
  if (length <= 0) return 0
  return (current + 1) % length
}
