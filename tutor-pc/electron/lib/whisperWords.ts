// Converts Whisper word-level timestamps (seconds) into the {part,start,end}
// cue format (milliseconds) used by the karaoke highlighter, so the ORIGINAL
// captured audio can be synced to the transcript just like the TTS audio.

export interface WhisperWord {
  word: string
  start?: number  // seconds
  end?: number    // seconds
}

export interface WhisperTimedSegment {
  text?: string
  start?: number  // seconds
  end?: number    // seconds
  words?: WhisperWord[]
}

export interface WhisperTimingResponse {
  words?: WhisperWord[]
  segments?: WhisperTimedSegment[]
}

export interface Cue {
  part: string
  start: number   // ms
  end: number     // ms
}

export function wordsToCues(words?: WhisperWord[]): Cue[] {
  if (!Array.isArray(words)) return []
  return words
    .filter(w => w && typeof w.word === 'string' && w.word.length > 0)
    .map(w => ({
      part: w.word,
      start: Math.max(0, Math.round((w.start ?? 0) * 1000)),
      end:   Math.max(0, Math.round((w.end ?? w.start ?? 0) * 1000)),
    }))
}

export function extractWhisperWords(json: WhisperTimingResponse): WhisperWord[] {
  if (Array.isArray(json.words) && json.words.length > 0) return json.words
  if (!Array.isArray(json.segments)) return []

  return json.segments.flatMap(segment =>
    Array.isArray(segment.words) ? segment.words : [],
  )
}

function wordsInText(text: string): string[] {
  return text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)?/gu) ?? []
}

export function estimateWordsFromSegments(segments?: WhisperTimedSegment[]): WhisperWord[] {
  if (!Array.isArray(segments)) return []
  const out: WhisperWord[] = []

  for (const segment of segments) {
    const words = wordsInText(segment.text ?? '')
    const start = segment.start
    const end = segment.end
    if (!words.length || typeof start !== 'number' || typeof end !== 'number' || end <= start) continue

    const weights = words.map(word => Math.max(1.4, Array.from(word).length * 0.72 + 0.8))
    const total = weights.reduce((sum, weight) => sum + weight, 0) || 1
    let acc = 0
    for (let i = 0; i < words.length; i++) {
      const wordStart = start + ((end - start) * acc / total)
      acc += weights[i]
      const wordEnd = start + ((end - start) * acc / total)
      out.push({ word: words[i], start: wordStart, end: wordEnd })
    }
  }

  return out
}

export function cuesFromWhisperResponse(json: WhisperTimingResponse): Cue[] {
  const exact = wordsToCues(extractWhisperWords(json))
  if (exact.length > 0) return exact
  return wordsToCues(estimateWordsFromSegments(json.segments))
}
