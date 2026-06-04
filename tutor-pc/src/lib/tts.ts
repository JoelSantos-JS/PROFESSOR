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

/**
 * Progressive karaoke index: the LAST cue whose word has already started by
 * `timeMs` (cues are time-ordered). Unlike findActiveCue it never drops to -1
 * in the gaps BETWEEN words, so the highlight advances smoothly without
 * flickering. `leadMs` looks slightly ahead to compensate for the ~250ms
 * granularity of the audio `timeupdate` event. -1 only before the first word.
 */
export function cueIndexAtTime(cues: WordCue[], timeMs: number, leadMs = 60): number {
  const t = timeMs + leadMs
  let idx = -1
  for (let i = 0; i < cues.length; i++) {
    if (cues[i].start <= t) idx = i
    else break
  }
  return idx
}

/**
 * Playback progress as a fraction 0..1, used to highlight (underline) the text
 * word-by-word in sync with the audio. Prefers precise word cues; falls back to
 * elapsed/duration when there are no cues (e.g. a transcription provider that
 * doesn't return word timestamps). Returns 0 when nothing is known yet.
 */
export function playbackProgress(cues: WordCue[], timeMs: number, durationMs: number, leadMs = 150): number {
  if (cues.length > 1) {
    const idx = cueIndexAtTime(cues, timeMs, leadMs)
    return Math.max(0, idx) / (cues.length - 1)
  }
  if (durationMs > 0) return Math.min(1, Math.max(0, (timeMs + leadMs) / durationMs))
  return 0
}

/** Active token index for a parallel text of `tokenCount` words, from progress (0..1). */
export function tokenAtProgress(progress: number, tokenCount: number): number {
  if (progress < 0 || tokenCount <= 0) return -1
  return Math.min(tokenCount - 1, Math.round(progress * (tokenCount - 1)))
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

  // 1. Exact normalized match — prefer an occurrence at/after the clicked index.
  for (let i = Math.max(0, fromIndex); i < cues.length; i++) {
    if (normalize(cues[i].part) === w) return cues[i]
  }
  const exact = cues.find(c => normalize(c.part) === w)
  if (exact) return exact

  // 2. Prefix match — handles contraction/tokenization mismatches, e.g. the UI
  //    splits "You're" into "You" while Whisper's cue is "you're" (or vice-versa).
  //    Guarded to length >= 2 so tiny words don't grab unrelated cues.
  if (w.length < 2) return undefined
  return cues.find(c => {
    const cp = normalize(c.part)
    return cp.length >= 2 && (cp.startsWith(w) || w.startsWith(cp))
  })
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
