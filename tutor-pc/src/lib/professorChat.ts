// Regras puras da conversa com o professor. Testável.

// Mínimo de frases da sessão para liberar a conversa: só dá para conversar com o professor
// depois de capturar bastante contexto.
// TEMP (teste): 10 frases. VOLTAR PARA 50 depois.
export const MIN_SENTENCES_FOR_PROFESSOR = 10

/** Já dá para conversar? (sessão com frases suficientes) */
export function canStartProfessor(sentenceCount: number, min = MIN_SENTENCES_FOR_PROFESSOR): boolean {
  return sentenceCount >= min
}

/** Quantas frases ainda faltam para liberar a conversa (0 quando já liberou). */
export function sentencesNeeded(sentenceCount: number, min = MIN_SENTENCES_FOR_PROFESSOR): number {
  return Math.max(0, min - sentenceCount)
}
