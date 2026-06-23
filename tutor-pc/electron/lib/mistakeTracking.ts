// Rastreamento de erros de pronúncia POR SESSÃO. A ideia: errar uma palavra UMA vez é ruído
// (o ASR derruba "a", "to"…); errar a MESMA palavra VÁRIAS vezes na MESMA sessão é dificuldade
// CONSTANTE — esse é o sinal que vale pro perfil. A "sessão" é detectada por intervalo de tempo
// (erros próximos = mesma sessão), então não precisa passar um id de sessão pelos callers.

export interface MistakeState {
  count: number             // total de erros (todas as sessões)
  lastAt: number
  sessionCount: number      // erros desta palavra na sessão ATUAL (contígua no tempo)
  struggleSessions: number  // nº de sessões em que houve dificuldade CONSTANTE (≥2 erros)
}

export const SESSION_GAP_MS = 30 * 60 * 1000  // intervalo maior que isto = nova sessão
export const STRUGGLE_THRESHOLD = 2           // erros na mesma sessão p/ contar como "dificuldade constante"

/** Aplica um erro novo ao estado de uma palavra (puro). */
export function applyMistake(prev: MistakeState | undefined, now: number, gapMs = SESSION_GAP_MS): MistakeState {
  if (!prev) return { count: 1, lastAt: now, sessionCount: 1, struggleSessions: 0 }
  const sameSession = now - prev.lastAt <= gapMs
  const sessionCount = sameSession ? prev.sessionCount + 1 : 1
  let struggleSessions = prev.struggleSessions
  // ao atingir o limiar NA MESMA sessão, esta sessão passa a contar como "dificuldade constante"
  if (sameSession && sessionCount === STRUGGLE_THRESHOLD) struggleSessions += 1
  return { count: prev.count + 1, lastAt: now, sessionCount, struggleSessions }
}
