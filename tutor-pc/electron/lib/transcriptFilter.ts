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
// Transcrições curtas (≤3 palavras) sobre transiente/ruído/música (batida de mesa → "E aí";
// jingle → "WATCH TV 2021") são o caso clássico de alucinação. Aí basta um sinal MODERADO de
// "não-fala" pra reprovar.
export const SHORT_TEXT_MAX_WORDS = 3
export const SHORT_TEXT_NO_SPEECH = 0.33
// Frase curta contendo um ANO solto ("TV 2021", "WATCH TV 2021", "2021") é padrão típico de
// alucinação de música/créditos — quase nunca aparece como fala curta real.
const YEAR_RE = /\b(?:19|20)\d{2}\b/
export const SHORT_YEAR_NO_SPEECH = 0.2

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

// "Atores" típicos das stage directions do Whisper (sujeito da anotação de som).
const STAGE_SUBJECTS = new Set([
  'he', 'she', 'it', 'they', 'we', 'i', 'you',
  'music', 'song', 'phone', 'door', 'crowd', 'audience', 'people', 'everyone', 'everybody',
  'man', 'woman', 'baby', 'child', 'dog', 'cat', 'bird', 'birds', 'engine', 'car',
  'wind', 'rain', 'thunder', 'bell', 'bells', 'alarm', 'siren', 'clock',
])

// Verbos de som/ação que o Whisper usa em stage directions ("music PLAYS", "phone RINGS").
const SOUND_VERBS = new Set([
  'plays', 'playing', 'rings', 'ringing', 'slams', 'slamming', 'creaks', 'creaking',
  'barks', 'barking', 'knocks', 'knocking', 'honks', 'beeps', 'beeping', 'buzzes', 'buzzing',
  'chimes', 'chirps', 'chirping', 'roars', 'roaring', 'ticks', 'ticking', 'rumbles',
  'sighs', 'sighing', 'laughs', 'laughing', 'giggles', 'chuckles', 'coughs', 'sneezes',
  'screams', 'screaming', 'cries', 'crying', 'sobs', 'gasps', 'groans', 'mutters', 'whispers',
  'cheers', 'cheering', 'applauds', 'claps', 'clapping', 'hums', 'humming', 'sings', 'singing',
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

  // Stage directions / SFX que o Whisper escreve em CAIXA ALTA p/ não-fala ("MUSIC PLAYS",
  // "HE SIGHS", "DOOR SLAMS"). Fala real vem em caixa normal → caixa alta multi-palavra curta
  // é anotação, não diálogo. (CJK não tem caixa, então não é afetado.)
  const rawWords = raw.split(/\s+/).filter(Boolean)
  const rawLetters = raw.replace(/[^A-Za-z]/g, '')
  if (rawWords.length >= 2 && rawWords.length <= 5 && rawLetters.length >= 4
      && raw === raw.toUpperCase() && raw !== raw.toLowerCase()) {
    return true
  }

  const t = normalizePhrase(raw)
  if (!t) return true
  if (HALLUCINATIONS.has(t)) return true

  const words = t.split(/\s+/)
  const last = words[words.length - 1]
  // Standalone sound word ("Music"), or "<modifier> <sound>" ("upbeat music").
  if (words.length === 1 && SOUND_WORDS.has(last)) return true
  if (words.length === 2 && SOUND_WORDS.has(last) && SOUND_MODIFIERS.has(words[0])) return true
  // "[sujeito] [som]" stage direction de 2 palavras: "music plays", "he sighs", "phone rings".
  if (words.length === 2 && STAGE_SUBJECTS.has(words[0]) && (SOUND_WORDS.has(last) || SOUND_VERBS.has(last))) return true

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
  const words = text.trim().split(/\s+/).filter(Boolean)
  const ns = avgNoSpeechProb(segments)
  // Texto curto + sinal moderado de "não-fala" → provável alucinação sobre ruído/música.
  if (words.length > 0 && words.length <= SHORT_TEXT_MAX_WORDS && ns >= SHORT_TEXT_NO_SPEECH) {
    return true
  }
  // Curto + ano solto ("WATCH TV 2021") → alucinação de música/créditos (gate de não-fala bem baixo).
  if (words.length > 0 && words.length <= SHORT_TEXT_MAX_WORDS && YEAR_RE.test(text) && ns >= SHORT_YEAR_NO_SPEECH) {
    return true
  }
  return false
}
