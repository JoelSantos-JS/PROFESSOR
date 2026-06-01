// Rejects non-speech transcriptions. Whisper hallucinates short phrases
// ("Thank you", "you", "I") on music / ambient / silence. We use Whisper's own
// per-segment confidence signals (no_speech_prob, avg_logprob) plus a blocklist
// of phrases it commonly invents over non-speech audio.

export interface WhisperSegment {
  no_speech_prob?: number  // 0..1, higher = more likely NOT speech
  avg_logprob?: number     // log-probability, lower = less confident
}

export const NO_SPEECH_THRESHOLD = 0.6     // Whisper's own default cutoff
export const LOW_CONFIDENCE_LOGPROB = -1.0 // Whisper's "failed segment" cutoff

/** True when the segments look like music / ambient / silence rather than speech. */
export function isNonSpeech(segments: WhisperSegment[]): boolean {
  if (!segments || segments.length === 0) return false
  const n = segments.length
  const avgNoSpeech = segments.reduce((s, x) => s + (x.no_speech_prob ?? 0), 0) / n
  const avgLogprob  = segments.reduce((s, x) => s + (x.avg_logprob ?? 0), 0) / n
  return avgNoSpeech >= NO_SPEECH_THRESHOLD || avgLogprob <= LOW_CONFIDENCE_LOGPROB
}

// Phrases Whisper invents over non-speech audio that are never real dialogue.
const HALLUCINATIONS = new Set([
  'thanks for watching', 'thank you for watching', 'thanks for watching!',
  'please subscribe', 'subscribe to my channel', 'like and subscribe',
  'see you next time', 'see you in the next video', 'see you next video',
  'subtitles by the amara.org community', 'subtitles by',
  'transcription by', 'transcribed by', 'amara.org',
])

/** Normalize for blocklist comparison: lowercase, trim, strip trailing punctuation/music marks. */
function normalizePhrase(text: string): string {
  return text.trim().toLowerCase().replace(/[\s.!?♪♫\-]+$/g, '').replace(/^[♪♫\s]+/g, '')
}

/** True when the text is a known Whisper hallucination phrase or pure music marks. */
export function isHallucinationPhrase(text: string): boolean {
  const t = normalizePhrase(text)
  if (!t) return true                          // empty / only punctuation/music
  if (/^[♪♫]+$/.test(text.trim())) return true // pure music notes
  return HALLUCINATIONS.has(t)
}

/** Overall decision: should this Whisper result be discarded as non-speech? */
export function shouldRejectTranscript(text: string, segments: WhisperSegment[]): boolean {
  if (isHallucinationPhrase(text)) return true
  return isNonSpeech(segments)
}
