// "Connected speech" hints for English: shows how words blend in natural speech
// (linking + common reductions), e.g. "in a hat" → "in‿a hat", "want to" → "wanna".
// Pure + deterministic so it is fully unit-testable (no AI / API needed).

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u'])

// Common reductions (word groups that natives blend). Order matters: longer
// phrases first so they win over shorter overlaps.
const REDUCTIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bwhat do you\b/gi, 'whaddya'],
  [/\bdon't you\b/gi,   "don'tcha"],
  [/\bgoing to\b/gi,    'gonna'],
  [/\bwant to\b/gi,     'wanna'],
  [/\bgot to\b/gi,      'gotta'],
  [/\bhave to\b/gi,     'hafta'],
  [/\bhas to\b/gi,      'hasta'],
  [/\bought to\b/gi,    'oughta'],
  [/\bkind of\b/gi,     'kinda'],
  [/\bsort of\b/gi,     'sorta'],
  [/\bout of\b/gi,      'outta'],
  [/\blot of\b/gi,      'lotta'],
  [/\blet me\b/gi,      'lemme'],
  [/\bgive me\b/gi,     'gimme'],
  [/\bdon't know\b/gi,  'dunno'],
  [/\bdid you\b/gi,     'didja'],
  [/\bwould you\b/gi,   'wouldja'],
  [/\bcould you\b/gi,   'couldja'],
]

function isVowel(ch: string): boolean {
  return VOWELS.has(ch.toLowerCase())
}
function isConsonantLetter(ch: string): boolean {
  return /[a-z]/i.test(ch) && !isVowel(ch)
}

/**
 * Returns a natural-speech rendering of `text`:
 *  - applies common reductions (wanna, gonna, gotta…)
 *  - marks consonant→vowel linking across a single space with a tie "‿"
 *    (e.g. "in a" → "in‿a"); punctuation between words blocks linking.
 */
export function connectedSpeech(text: string): string {
  let s = text
  for (const [re, rep] of REDUCTIONS) s = s.replace(re, rep)

  // Link: <consonant><spaces><vowel> → <consonant>‿<vowel>
  s = s.replace(/(\w)(\s+)(\w)/g, (m, a: string, _sp: string, b: string) =>
    isConsonantLetter(a) && isVowel(b) ? `${a}‿${b}` : m,
  )
  return s
}

/** True when the connected-speech form actually differs from the original. */
export function hasConnectedSpeech(text: string): boolean {
  return connectedSpeech(text) !== text
}
