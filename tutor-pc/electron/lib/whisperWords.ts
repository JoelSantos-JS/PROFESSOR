// Converts Whisper word-level timestamps (seconds) into the {part,start,end}
// cue format (milliseconds) used by the karaoke highlighter, so the ORIGINAL
// captured audio can be synced to the transcript just like the TTS audio.

export interface WhisperWord {
  word: string
  start?: number  // seconds
  end?: number    // seconds
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
