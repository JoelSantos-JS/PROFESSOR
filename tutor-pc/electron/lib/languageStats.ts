// Groups SRS cards by detected language so a user studying multiple languages
// sees separate decks (counts) instead of one mixed pile.

export interface LangStat {
  lang: string
  total: number  // total cards in this language
  due: number    // cards due for review now
}

export function languageStats(
  cards: Array<{ lang: string; due: number }>,
  now: number,
): LangStat[] {
  const map = new Map<string, LangStat>()
  for (const c of cards) {
    const lang = c.lang || 'unknown'
    const s = map.get(lang) ?? { lang, total: 0, due: 0 }
    s.total++
    if (c.due <= now) s.due++
    map.set(lang, s)
  }
  // Most cards due first, then largest deck.
  return [...map.values()].sort((a, b) => b.due - a.due || b.total - a.total)
}
