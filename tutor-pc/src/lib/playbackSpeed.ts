// Velocidade de reprodução do listening (Original/TTS). 0.8× é o "sweet spot" para prática de
// escuta; oferecemos 1 / 0.9 / 0.8 / 0.7. Puro e testável.

export const PLAYBACK_SPEEDS = [1, 0.9, 0.8, 0.7] as const
export type PlaybackSpeed = typeof PLAYBACK_SPEEDS[number]
export const DEFAULT_SPEED: PlaybackSpeed = 1

/** Garante um valor válido (default 1 quando inválido/desconhecido). */
export function normalizeSpeed(v: number | string | undefined): PlaybackSpeed {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return (PLAYBACK_SPEEDS as readonly number[]).includes(n as number) ? (n as PlaybackSpeed) : DEFAULT_SPEED
}

/** Próxima velocidade no ciclo: 1 → 0.9 → 0.8 → 0.7 → 1. */
export function nextSpeed(v: number | string | undefined): PlaybackSpeed {
  const cur = normalizeSpeed(v)
  const i = PLAYBACK_SPEEDS.indexOf(cur)
  return PLAYBACK_SPEEDS[(i + 1) % PLAYBACK_SPEEDS.length]
}

/** Rótulo curto ("1×", "0.8×"). */
export function speedLabel(v: number | string | undefined): string {
  const n = normalizeSpeed(v)
  return `${n}×`
}
