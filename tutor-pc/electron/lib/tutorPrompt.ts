// Pure prompt-building logic (no electron imports) so it can be unit-tested.

export interface RomanizationSpec {
  fieldName: string
  instruction: string
  label: string
}

// Romanization system per language family
export const ROMANIZATION_SYSTEM: Record<string, RomanizationSpec> = {
  zh:      { fieldName: 'romanization', instruction: 'Pinyin with tone marks (e.g. nǐ hǎo, wǒ ài nǐ)', label: 'Pinyin' },
  'zh-CN': { fieldName: 'romanization', instruction: 'Pinyin with tone marks', label: 'Pinyin' },
  'zh-TW': { fieldName: 'romanization', instruction: 'Pinyin with tone marks (Traditional Chinese)', label: 'Pinyin' },
  ja:      { fieldName: 'romanization', instruction: 'Hepburn Romaji (e.g. konnichiwa, arigatou)', label: 'Romaji' },
  ko:      { fieldName: 'romanization', instruction: 'Revised Romanization of Korean (e.g. annyeonghaseyo)', label: 'Romanização' },
  th:      { fieldName: 'romanization', instruction: 'RTGS romanization of Thai', label: 'Romanização' },
  ar:      { fieldName: 'romanization', instruction: 'ALA-LC transliteration of Arabic', label: 'Transliteração' },
  ru:      { fieldName: 'romanization', instruction: 'BGN/PCGN romanization of Russian', label: 'Transliteração' },
  hi:      { fieldName: 'romanization', instruction: 'IAST transliteration of Hindi/Devanagari', label: 'Transliteração' },
}

export function isEnglishLang(lang: string): boolean {
  return lang === 'en' || lang.startsWith('en-')
}

/**
 * Prompt for an on-demand single-word/character dictionary lookup.
 * `context` is the full sentence so the model can disambiguate the right sense.
 */
export function buildLookupPrompt(word: string, context: string, lang: string): string {
  const roma = resolveRomanization(lang)
  const romaField = roma
    ? `  "romanization": "${roma.instruction} for "${word}"",`
    : ''

  return `You are a bilingual dictionary. The user is studying language code "${lang}" and tapped the word/character "${word}".
Full sentence for context: "${context}"

Respond with raw JSON only (no markdown):
{
${romaField}
  "meanings": ["primary English meaning in this context", "other common English meaning", "..."],
  "note": "short usage/nuance note in Portuguese (Brazilian), or empty string"
}

Rules:
- meanings: 1-4 short English glosses. Put the meaning that fits THIS sentence first. Include other common senses/variants if the word has them.
${roma ? '- romanization: REQUIRED, never empty.\n' : ''}- note: only if there is a useful nuance (tone, register, false friend); otherwise "".
- Respond ONLY with raw JSON.`
}

/** Resolve the romanization spec, falling back to the base language (zh-Hans → zh). */
export function resolveRomanization(lang: string): RomanizationSpec | undefined {
  return ROMANIZATION_SYSTEM[lang] ?? ROMANIZATION_SYSTEM[lang.split('-')[0]]
}

export function buildSystemPrompt(detectedLanguage: string): string {
  const roma = resolveRomanization(detectedLanguage)
  const isEnglish = isEnglishLang(detectedLanguage)

  const romanizationField = roma
    ? `  "romanization": "REQUIRED — full ${roma.instruction} for the ENTIRE transcript, never leave empty",`
    : ''

  const englishField = isEnglish
    ? ''
    : `  "englishText": "natural English translation of the entire transcript",`

  const vocabRoma = roma
    ? `      "romanization": "${roma.instruction} for this word/phrase only",`
    : ''

  const langNote = roma
    ? `The content is in language code "${detectedLanguage}". You MUST ALWAYS include the "romanization" field (${roma.instruction}) for the full transcript AND for every vocab item — this is mandatory and must never be omitted or left blank. `
    : ''

  return `You are a language tutor assistant helping a Portuguese (Brazilian) speaker.
${langNote}When given a transcribed audio segment, respond with a JSON object (no markdown, raw JSON only):
{
${romanizationField}
${englishField}
  "vocab": [
    {
      "word": "word or phrase in original language",
${vocabRoma}
      "translation": "tradução em português",
      "example": "example sentence in original language"
    }
  ],
  "tip": "one short contextual tip in Portuguese, max 2 sentences"
}

Rules:
${roma ? '- romanization: MANDATORY. Provide it for the full transcript and for each vocab word. Never omit it.\n' : ''}- vocab: 1-4 most useful words/phrases for a learner. Skip trivial words (a, the, is, etc).
- tip: grammar, pronunciation, idiom explanation, or cultural context.
${isEnglish ? '' : '- englishText: a fluent English translation of the whole transcript.\n'}- If transcript is trivial/too short, return {"vocab":[],"tip":""}
- Respond ONLY with raw JSON. No markdown fences, no explanation.`
}
