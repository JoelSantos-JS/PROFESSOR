// Meta diária (sensação de progresso do dia). Lógica pura e testável.

export const DEFAULT_DAILY_TARGET = 5   // frases capturadas por dia

export interface GoalProgress {
  done: number
  target: number
  pct: number        // 0–100 (limitado)
  reached: boolean
  remaining: number  // quantas faltam (0 se já bateu)
}

export function goalProgress(done: number, target: number = DEFAULT_DAILY_TARGET): GoalProgress {
  const t = Math.max(1, Math.floor(target))
  const d = Math.max(0, Math.floor(done))
  const pct = Math.min(100, Math.round((d / t) * 100))
  return { done: d, target: t, pct, reached: d >= t, remaining: Math.max(0, t - d) }
}
