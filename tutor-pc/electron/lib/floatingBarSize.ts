// Dimensões da barra flutuante por modo. Puro/testável — o windowManager só aplica os bounds.
// COMPACTA (vazia/ociosa) vs CHEIA (com transcrição/escuta).

export type FloatingBarMode = 'compact' | 'full'

export const FLOATING_BAR_WIDTH = 400
export const FLOATING_BAR_COMPACT_H = 228
export const FLOATING_BAR_FULL_H = 560

export function floatingBarSize(mode: FloatingBarMode): { width: number; height: number } {
  return {
    width: FLOATING_BAR_WIDTH,
    height: mode === 'full' ? FLOATING_BAR_FULL_H : FLOATING_BAR_COMPACT_H,
  }
}
