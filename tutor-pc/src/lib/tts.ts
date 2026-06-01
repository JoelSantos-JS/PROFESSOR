export interface WordCue {
  part: string
  start: number  // ms
  end: number    // ms
}

/**
 * Given word-boundary cues and the current playback time (ms), returns the
 * index of the cue being spoken right now, or -1 if none matches (gaps/silence).
 * A cue is active when start <= time < end.
 */
export function findActiveCue(cues: WordCue[], timeMs: number): number {
  return cues.findIndex(c => timeMs >= c.start && timeMs < c.end)
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]/gu, '')
}

/**
 * Finds the cue whose word matches `word` (normalized), so the original audio
 * can be sliced to just that word. With repeats, prefers the occurrence at or
 * after `fromIndex` (the clicked position) to disambiguate.
 */
export function findWordCue(cues: WordCue[], word: string, fromIndex = 0): WordCue | undefined {
  const w = normalize(word)
  if (!w) return undefined
  for (let i = Math.max(0, fromIndex); i < cues.length; i++) {
    if (normalize(cues[i].part) === w) return cues[i]
  }
  return cues.find(c => normalize(c.part) === w)
}

/**
 * Maps the active cue index (over `totalCues` audio word-boundaries) to a token
 * index in a PARALLEL text (e.g. Pinyin syllables) of length `totalTokens`.
 *
 * Endpoints align exactly (first cue → first token, last cue → last token) and
 * the middle is linearly proportional. Used to highlight a romanization line in
 * sync with the spoken original even when the two have different token counts.
 * Returns -1 when nothing is active.
 */
export function mapProgressIndex(activeCue: number, totalCues: number, totalTokens: number): number {
  if (activeCue < 0 || totalCues <= 0 || totalTokens <= 0) return -1
  if (totalTokens === 1) return 0
  if (totalCues === 1) return 0
  const ratio = activeCue / (totalCues - 1)         // 0..1
  return Math.round(ratio * (totalTokens - 1))
}
