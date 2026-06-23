// Rejects non-speech transcriptions. Whisper hallucinates short phrases
// ("Thank you", "you", "I") on music / ambient / silence. We use Whisper's own
// per-segment confidence signals (no_speech_prob, avg_logprob) plus a blocklist
// of phrases it commonly invents over non-speech audio.

export interface WhisperSegment {
  no_speech_prob?: number     // 0..1, higher = more likely NOT speech
  avg_logprob?: number        // log-probability, lower = less confident
  compression_ratio?: number  // higher = repetitive/hallucinated text
}

export const NO_SPEECH_THRESHOLD = 0.55      // strong "not speech" signal alone
export const LOW_CONFIDENCE_LOGPROB = -0.9   // very low confidence alone
export const HIGH_COMPRESSION = 2.4          // Whisper's repetition/hallucination cutoff
// Borderline on BOTH signals together → treat as non-speech (catches background
// audio that Whisper forces into garbled words, e.g. "Thank you deix toughest").
export const BORDERLINE_NO_SPEECH = 0.4
export const BORDERLINE_LOGPROB = -0.55
// Transcrições MUITO curtas (≤2 palavras) sobre transiente/ruído (batida de mesa → "E aí") são o
// caso clássico de alucinação. Aí basta um sinal MODERADO de "não-fala" pra reprovar.
export const SHORT_TEXT_MAX_WORDS = 2
export const SHORT_TEXT_NO_SPEECH = 0.33

/** True when the segments look like music / ambient / forced-garbage rather than speech. */
export function isNonSpeech(segments: WhisperSegment[]): boolean {
  if (!segments || segments.length === 0) return false
  const n = segments.length
  const avgNoSpeech    = segments.reduce((s, x) => s + (x.no_speech_prob ?? 0), 0) / n
  const avgLogprob     = segments.reduce((s, x) => s + (x.avg_logprob ?? 0), 0) / n
  const avgCompression = segments.reduce((s, x) => s + (x.compression_ratio ?? 0), 0) / n

  if (avgNoSpeech >= NO_SPEECH_THRESHOLD) return true
  if (avgLogprob <= LOW_CONFIDENCE_LOGPROB) return true
  if (avgCompression >= HIGH_COMPRESSION) return true
  // Neither signal alone is damning, but both together → not real dialogue.
  if (avgNoSpeech >= BORDERLINE_NO_SPEECH && avgLogprob <= BORDERLINE_LOGPROB) return true
  return false
}

// Phrases Whisper invents over non-speech audio that are never real dialogue.
const HALLUCINATIONS = new Set([
  'thanks for watching', 'thank you for watching', 'thanks for watching!',
  'please subscribe', 'subscribe to my channel', 'like and subscribe',
  'see you next time', 'see you in the next video', 'see you next video',
  'subtitles by the amara.org community', 'subtitles by',
  'transcription by', 'transcribed by', 'amara.org',
])

// Sound-event words Whisper emits for non-speech audio. As a STANDALONE
// transcription (e.g. "Music", "[Applause]", "soft music") these are noise, not
// dialogue. Inside a real sentence ("I love music") they are kept.
const SOUND_WORDS = new Set([
  'music', 'música', 'musique', 'instrumental', 'song', 'singing', 'humming', 'whistling',
  'applause', 'clapping', 'cheering', 'laughter', 'laughs', 'laughing', 'chuckles', 'chuckling',
  'sighs', 'sigh', 'coughs', 'coughing', 'gasps', 'groans', 'grunts', 'sniffs',
  'screaming', 'screams', 'shouting', 'crying', 'sobbing', 'breathing', 'panting',
  'footsteps', 'thunder', 'wind', 'rain', 'static', 'noise', 'beep', 'beeping', 'ringing',
  'silence', 'inaudible', 'indistinct', 'unintelligible',
])

// Adjectives Whisper pairs with sound words ("upbeat music", "dramatic music").
const SOUND_MODIFIERS = new Set([
  'soft', 'upbeat', 'dramatic', 'gentle', 'loud', 'quiet', 'tense', 'sad', 'happy',
  'slow', 'fast', 'background', 'soft', 'eerie', 'ominous', 'cheerful', 'somber', 'light',
])

/** Normalize for comparison: lowercase, trim, strip wrapping brackets/parens/notes + punctuation. */
function normalizePhrase(text: string): string {
  return text.trim().toLowerCase()
    .replace(/^[[(♪♫\s]+/g, '')
    .replace(/[\])♪♫\s.!?\-]+$/g, '')
}

/** True when the text is a known Whisper hallucination or a non-speech sound event. */
export function isHallucinationPhrase(text: string): boolean {
  const raw = text.trim()
  if (!raw) return true                          // empty
  if (/^[♪♫]+$/.test(raw)) return true           // pure music notes
  // A transcription fully wrapped in [..], (..) or ♪..♪ is a sound annotation,
  // not dialogue (e.g. "[Music]", "(door creaks)", "♪ upbeat music ♪").
  if (/^[[(♪].*[\])♪]$/.test(raw)) return true

  const t = normalizePhrase(raw)
  if (!t) return true
  if (HALLUCINATIONS.has(t)) return true

  const words = t.split(/\s+/)
  const last = words[words.length - 1]
  // Standalone sound word ("Music"), or "<modifier> <sound>" ("upbeat music").
  if (words.length === 1 && SOUND_WORDS.has(last)) return true
  if (words.length === 2 && SOUND_WORDS.has(last) && SOUND_MODIFIERS.has(words[0])) return true

  return false
}

/** Média de no_speech_prob dos segmentos (0 se não houver). */
function avgNoSpeechProb(segments: WhisperSegment[]): number {
  if (!segments || segments.length === 0) return 0
  return segments.reduce((s, x) => s + (x.no_speech_prob ?? 0), 0) / segments.length
}

/** Overall decision: should this Whisper result be discarded as non-speech? */
export function shouldRejectTranscript(text: string, segments: WhisperSegment[]): boolean {
  if (isHallucinationPhrase(text)) return true
  if (isNonSpeech(segments)) return true
  // Texto muito curto + qualquer sinal moderado de "não-fala" → provável alucinação sobre ruído.
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length > 0 && words.length <= SHORT_TEXT_MAX_WORDS && avgNoSpeechProb(segments) >= SHORT_TEXT_NO_SPEECH) {
    return true
  }
  return false
}
