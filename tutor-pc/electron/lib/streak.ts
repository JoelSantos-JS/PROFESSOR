// Pure day-streak logic (no electron / fs), so it can be unit-tested.

const DAY_MS = 86_400_000

/** UTC date as YYYY-MM-DD. */
export function dayStr(now: number): string {
  return new Date(now).toISOString().slice(0, 10)
}

export interface StreakState {
  streak: number
  lastActiveDate: string  // YYYY-MM-DD, '' if never active
}

/**
 * Advance the streak for activity at `now`.
 * - same day as last activity → unchanged.
 * - exactly the next day        → streak + 1.
 * - any larger gap (or first ever) → reset to 1.
 */
export function advanceStreak(state: StreakState, now: number): StreakState {
  const today = dayStr(now)
  if (state.lastActiveDate === today) return state

  const yesterday = dayStr(now - DAY_MS)
  const streak = state.lastActiveDate === yesterday ? state.streak + 1 : 1
  return { streak, lastActiveDate: today }
}
