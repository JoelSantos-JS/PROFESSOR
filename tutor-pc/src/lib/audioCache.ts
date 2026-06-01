// In-memory cap for captured audio clips. Clips live only as data URLs on the
// React entries, so they vanish when the app closes. This bounds memory during
// a long session by dropping the OLDEST clips once a size budget is exceeded.

export const AUDIO_BUDGET_BYTES = 50 * 1024 * 1024  // 50 MB

/** Approximate decoded byte size of a base64 data URL. */
export function dataUrlBytes(dataUrl?: string): number {
  if (!dataUrl) return 0
  const comma = dataUrl.indexOf(',')
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  return Math.floor(b64.length * 0.75)  // base64 → bytes
}

/**
 * Trim `items` (oldest first, i.e. lowest index) until the total size of their
 * audio clips is within `maxBytes`. `getUrl` extracts the data URL from an item
 * (defaults to `item.audioUrl`). The most recent item is always kept.
 */
export function capAudioMemory<T>(
  items: T[],
  maxBytes = AUDIO_BUDGET_BYTES,
  getUrl: (item: T) => string | undefined = (it) => (it as { audioUrl?: string }).audioUrl,
): T[] {
  let total = items.reduce((sum, it) => sum + dataUrlBytes(getUrl(it)), 0)
  if (total <= maxBytes) return items

  // Never drop the most recent item, even if it alone exceeds the budget.
  let start = 0
  while (start < items.length - 1 && total > maxBytes) {
    total -= dataUrlBytes(getUrl(items[start]))
    start++
  }
  return items.slice(start)
}
