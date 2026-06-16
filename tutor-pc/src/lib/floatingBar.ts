// Decisão pura do tamanho da barra flutuante: ela fica COMPACTA quando está vazia/ociosa
// e CHEIA quando há conteúdo a mostrar (escuta/processamento, treino, ou feed com itens).
// Testável; o componente só envia o modo resultante ao processo main.

export type FloatingBarMode = 'compact' | 'full'

export interface FloatingBarInput {
  busy: boolean        // escutando ou processando (state !== 'idle')
  practicing: boolean  // overlay de auto-treino aberto
  tab: 'transcricao' | 'sessao'
  lineCount: number    // transcrições capturadas (aba Transcrição)
  attemptCount: number // tentativas de prática (aba Sessão)
}

/** 'full' quando há algo a mostrar; 'compact' quando vazia/ociosa. */
export function floatingBarMode(s: FloatingBarInput): FloatingBarMode {
  const feedHasItems = s.tab === 'transcricao' ? s.lineCount > 0 : s.attemptCount > 0
  const hasContent = s.busy || s.practicing || feedHasItems
  return hasContent ? 'full' : 'compact'
}
