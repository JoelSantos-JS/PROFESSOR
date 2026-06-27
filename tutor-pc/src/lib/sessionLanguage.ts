// Mantém a língua da SESSÃO estável. O Whisper em "auto" detecta por clipe e às vezes FLIPA
// (coreano curto vira japonês, ruído vira "you"). A partir de votos confiantes, travamos a língua
// dominante e forçamos ela nos próximos clipes — para de flipar. Voto pesa pelo TAMANHO do texto:
// uma frase real (20+ chars) trava rápido; um "you" (3 chars) quase não conta.

export type LangVotes = Record<string, number>

/** Soma um voto de idioma, pesado pelo tamanho do texto transcrito. */
export function addLangVote(votes: LangVotes, lang: string | null | undefined, textLength: number): LangVotes {
  const base = (lang || '').toLowerCase().split('-')[0]
  if (!base || base === 'auto' || textLength <= 0) return votes
  return { ...votes, [base]: (votes[base] ?? 0) + textLength }
}

/** Língua travada da sessão (a dominante), ou '' se ainda não há confiança suficiente. */
export function lockedLanguage(votes: LangVotes, minScore = 15): string {
  let best = ''
  let bestN = 0
  for (const [lang, n] of Object.entries(votes)) {
    if (n > bestN) { best = lang; bestN = n }
  }
  return bestN >= minScore ? best : ''
}
