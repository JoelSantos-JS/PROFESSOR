// Textos cíclicos do splash de abertura (rotação pura → testável, sem timers).
export const SPLASH_STEPS = [
  'Iniciando…',
  'Carregando seus idiomas…',
  'Preparando o tutor…',
  'Sincronizando revisões…',
  'Quase lá…',
] as const

/** Próximo índice da rotação (faz wrap). Lista vazia → 0. */
export function nextStatusIndex(length: number, current: number): number {
  if (length <= 0) return 0
  return (current + 1) % length
}
