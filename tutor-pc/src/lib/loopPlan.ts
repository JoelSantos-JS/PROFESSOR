// Plano puro do modo Loop/Chorus (shadowing): a partir da duração do clipe e das
// configurações, monta a linha do tempo de reproduções e intervalos. Determinístico
// e testável — a UI apenas executa os passos.

export type LoopStepType = 'play' | 'gap'

export interface LoopStep {
  type: LoopStepType
  index: number        // nº da repetição (0-based); no 'gap', a repetição que ele segue
  startMs: number      // início acumulado no plano
  durationMs: number
  speed: number        // velocidade de reprodução ('play'); 1 nos intervalos
}

export interface LoopPlan {
  steps: LoopStep[]
  totalMs: number
  repeats: number
}

// gap: 'none' = emendado; 'echo' = intervalo do tamanho da reprodução (tempo de repetir);
//      número = intervalo fixo em ms.
export interface LoopConfig {
  clipMs: number
  repeats: number
  gap?: 'none' | 'echo' | number
  speeds?: number[]    // velocidade por repetição; a última se repete se faltar
  trailingGap?: boolean // inclui intervalo após a última reprodução (padrão: não)
}

/** Velocidade da repetição `i` (a última velocidade informada se estende). */
export function speedForRepeat(speeds: number[] | undefined, i: number): number {
  if (!speeds || speeds.length === 0) return 1
  const idx = Math.min(Math.max(0, i), speeds.length - 1)
  const s = speeds[idx]
  return Number.isFinite(s) && s > 0 ? s : 1
}

/** Duração da reprodução de um clipe em dada velocidade (mais lento = mais longo). */
export function playDuration(clipMs: number, speed: number): number {
  const c = Math.max(0, clipMs)
  const s = Number.isFinite(speed) && speed > 0 ? speed : 1
  return Math.round(c / s)
}

export function buildLoopPlan(cfg: LoopConfig): LoopPlan {
  const repeats = Math.max(0, Math.floor(cfg.repeats))
  const gap = cfg.gap ?? 'none'
  const steps: LoopStep[] = []
  let cursor = 0

  for (let i = 0; i < repeats; i++) {
    const speed = speedForRepeat(cfg.speeds, i)
    const playDur = playDuration(cfg.clipMs, speed)
    steps.push({ type: 'play', index: i, startMs: cursor, durationMs: playDur, speed })
    cursor += playDur

    const isLast = i === repeats - 1
    if (!isLast || cfg.trailingGap) {
      const gapDur = gap === 'none' ? 0 : gap === 'echo' ? playDur : Math.max(0, Math.round(gap))
      if (gapDur > 0) {
        steps.push({ type: 'gap', index: i, startMs: cursor, durationMs: gapDur, speed: 1 })
        cursor += gapDur
      }
    }
  }

  return { steps, totalMs: cursor, repeats }
}
