// Spaced-repetition scheduling (SM-2 algorithm, Anki-style).

export interface SrsState {
  ease: number      // easiness factor, >= 1.3
  interval: number  // days until next review
  reps: number      // number of successful reps in a row
}

export type Grade = 0 | 1 | 2 | 3 | 4 | 5  // 0-2 = fail, 3-5 = pass

export const INITIAL_SRS: SrsState = { ease: 2.5, interval: 0, reps: 0 }

/**
 * Apply one review of `quality` (0-5) to an SM-2 card and return the new state.
 * - quality < 3 → lapse: reps reset, interval back to 1 day.
 * - quality >= 3 → graduate: 1d, then 6d, then interval*ease.
 * Ease is adjusted per the SM-2 formula and floored at 1.3.
 */
export function reviewCard(state: SrsState, quality: Grade): SrsState {
  const passed = quality >= 3

  let { ease, interval, reps } = state

  if (!passed) {
    return { ease: Math.max(1.3, ease - 0.2), interval: 1, reps: 0 }
  }

  reps += 1
  if (reps === 1)       interval = 1
  else if (reps === 2)  interval = 6
  else                  interval = Math.round(interval * ease)

  ease = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  if (ease < 1.3) ease = 1.3

  return { ease: Math.round(ease * 100) / 100, interval, reps }
}

/** Due timestamp (ms) for a card after a review at `now`, given its interval (days). */
export function nextDue(intervalDays: number, now = Date.now()): number {
  return now + intervalDays * 24 * 60 * 60 * 1000
}

/** Is the card due for review at `now`? */
export function isDue(due: number, now = Date.now()): boolean {
  return due <= now
}
