// Decisão pura de quando disparar uma transcrição "interina" (ao vivo) do trecho-em-curso.
// Mantém o gatilho fora do loop de VAD para ficar testável.
export interface InterimGate {
  speaking: boolean    // a pessoa está falando agora
  busy: boolean        // já há uma transcrição interina em voo
  now: number
  lastRunAt: number    // quando a última interina foi disparada
  intervalMs: number   // intervalo mínimo entre interinas
}

export function shouldRunInterim(g: InterimGate): boolean {
  return g.speaking && !g.busy && (g.now - g.lastRunAt) >= g.intervalMs
}

/**
 * Texto a FIXAR ao fim da fala: o final (preferido, mais preciso) ou, se ele falhar/vier vazio,
 * a prévia ao vivo — assim nunca se perde o que já apareceu na tela (e ainda vai pro tutor).
 */
export function resolveFinalText(finalText: string, liveText: string): string {
  return finalText.trim() || liveText.trim()
}
