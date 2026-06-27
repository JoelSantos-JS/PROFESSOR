// Pure prompt-building logic (no electron imports) so it can be unit-tested.

import { nativeLanguageEnglishName } from './nativeLang.js'

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

export function isJapaneseLang(lang: string): boolean {
  return lang === 'ja' || lang.startsWith('ja-')
}

/**
 * Prompt for an on-demand single-word/character dictionary lookup.
 * `context` is the full sentence so the model can disambiguate the right sense.
 */
export function buildLookupPrompt(word: string, context: string, lang: string, native = 'pt'): string {
  const nat = nativeLanguageEnglishName(native)
  const roma = resolveRomanization(lang)
  const romaField = roma
    ? `  "romanization": "${roma.instruction} for "${word}"",`
    : ''

  // Japonês: leitura kana + acento tonal (downstep) para visualizar o pitch accent.
  const isJapanese = isJapaneseLang(lang)
  const jaFields = isJapanese
    ? `  "reading": "the word "${word}" written in HIRAGANA only",
  "pitchAccent": <integer: Tokyo-dialect accent (downstep) position in MORAS, 0 = heiban (no downstep)>,`
    : ''

  return `You are a bilingual dictionary. The user is studying language code "${lang}" and tapped the word/character "${word}".
Full sentence for context: "${context}"

Respond with raw JSON only (no markdown):
{
${romaField}
${jaFields}
  "meanings": ["primary meaning in ${nat} for this context", "other common meaning in ${nat}", "..."],
  "note": "short usage/nuance note in ${nat}, or empty string"
}

Rules:
- meanings: 1-4 short ${nat} glosses. Put the meaning that fits THIS sentence first. Include other common senses/variants if the word has them.
${roma ? '- romanization: REQUIRED, never empty.\n' : ''}${isJapanese ? '- reading: REQUIRED, hiragana only. pitchAccent: REQUIRED integer (mora index of the downstep; 0 if heiban/flat).\n' : ''}- note: only if there is a useful nuance (tone, register, false friend); otherwise "".
- Respond ONLY with raw JSON.`
}

/**
 * Prompt para DECOMPOR um caractere Han (Hanzi/Kanji) em componentes/radicais, com
 * significado de cada parte e um mnemônico — a técnica-chave para memorizar caracteres.
 */
export function buildDecomposePrompt(char: string, lang: string, native = 'pt'): string {
  const nat = nativeLanguageEnglishName(native)
  const roma = resolveRomanization(lang)
  const readingHint = roma ? roma.instruction : 'reading'
  return `You are a Chinese/Japanese character expert helping a ${nat} speaker study the character "${char}" (language code "${lang}").

Respond with raw JSON only (no markdown):
{
  "character": "${char}",
  "meaning": "main meaning(s) in ${nat}, short",
  "reading": "${readingHint} of the character (its on/kun or pinyin reading)",
  "strokes": <integer number of strokes, or 0 if unsure>,
  "components": [
    { "part": "<radical/component>", "meaning": "the component's meaning in ${nat}", "reading": "the component's reading, or empty string" }
  ],
  "mnemonic": "a short mnemonic sentence in ${nat} linking the components to the character's meaning"
}

Rules:
- components: 1-4 real visual parts of the character (radicals/components). If it's a simple atomic character, return a single part = the character itself.
- meaning/mnemonic: in ${nat}, short and concrete.
- strokes: integer stroke count; 0 if unsure.
- Respond ONLY with raw JSON.`
}

/** Resolve the romanization spec, falling back to the base language (zh-Hans → zh). */
export function resolveRomanization(lang: string): RomanizationSpec | undefined {
  return ROMANIZATION_SYSTEM[lang] ?? ROMANIZATION_SYSTEM[lang.split('-')[0]]
}

export function buildSystemPrompt(detectedLanguage: string, native = 'pt'): string {
  const nat = nativeLanguageEnglishName(native)
  const nativeIsEnglish = nat === 'English'
  const roma = resolveRomanization(detectedLanguage)
  const isEnglish = isEnglishLang(detectedLanguage)
  const isJapanese = isJapaneseLang(detectedLanguage)
  // Conteúdo no MESMO idioma do nativo (ex.: inglês→inglês) → traduzir é redundante e gasta token à toa.
  const sameAsNative = detectedLanguage.split('-')[0].toLowerCase() === native.split('-')[0].toLowerCase()

  const romanizationField = roma
    ? `  "romanization": "REQUIRED — full ${roma.instruction} for the ENTIRE transcript, never leave empty",`
    : ''

  // Para japonês: leitura kana da frase inteira (para gerar furigana sobre os kanji).
  const readingField = isJapanese
    ? `  "reading": "REQUIRED — the ENTIRE transcript written in HIRAGANA only (kana reading), keeping the same kana that already appear; e.g. for 私は学生です → わたしはがくせいです",`
    : ''

  // englishText é um extra; redundante quando o conteúdo OU o idioma nativo já é inglês.
  const englishField = isEnglish || nativeIsEnglish
    ? ''
    : `  "englishText": "natural English translation of the entire transcript",`

  // translation só faz sentido se o conteúdo NÃO está já no idioma do usuário.
  const translationField = sameAsNative
    ? ''
    : `  "translation": "natural translation of the whole sentence into ${nat}",`

  const vocabRoma = roma
    ? `      "romanization": "${roma.instruction} for this word/phrase only",`
    : ''

  // Conteúdo no MESMO idioma do nativo: NÃO traduzir (inglês→inglês não tem o que traduzir, e a IA
  // acaba escolhendo um idioma aleatório — ex.: espanhol). Aí o "translation" vira DEFINIÇÃO no
  // próprio idioma.
  const vocabTranslationField = sameAsNative
    ? `      "translation": "a short ${nat} definition/synonym of the word — SAME language, NEVER another language",`
    : `      "translation": "translation into ${nat}",`

  const langNote = roma
    ? `The content is in language code "${detectedLanguage}". You MUST ALWAYS include the "romanization" field (${roma.instruction}) for the full transcript AND for every vocab item — this is mandatory and must never be omitted or left blank. `
    : ''

  return `You are a language tutor assistant helping a ${nat} speaker.
${langNote}When given a transcribed audio segment, respond with a JSON object (no markdown, raw JSON only):
{
${romanizationField}
${readingField}
${englishField}
${translationField}
  "vocab": [
    {
      "word": "word or phrase in original language",
${vocabRoma}
${vocabTranslationField}
      "example": "example sentence in original language"
    }
  ],
  "tip": "one short contextual tip in ${nat}, max 2 sentences",
  "everydayUseful": <boolean: true ONLY if this line is a COMMON, REUSABLE everyday/conversational phrase worth memorizing as a full card (requests, reactions, idioms, small-talk, useful dialogue); false for SHORT/trivial lines, plot-specific, fragmentary, proper-noun-heavy, or rare lines>
}

Rules:
${roma ? '- romanization: MANDATORY. Provide it for the full transcript and for each vocab word. Never omit it.\n' : ''}${isJapanese ? '- reading: MANDATORY. Full hiragana reading of the whole transcript (every kanji converted to its kana reading; existing kana kept as-is; do not add spaces).\n' : ''}${sameAsNative
    ? `- The user is a native ${nat} speaker and the content is ALREADY in ${nat}. Do NOT translate into ANY other language (NOT Spanish, NOT Portuguese — none). For each vocab "translation", give a brief ${nat} definition/synonym. Everything (vocab, tip) stays in ${nat}.\n`
    : `- translation: render the MEANING in natural, idiomatic ${nat} — how a native ${nat} speaker would actually say it, NOT word-for-word. Preserve tone/register (slang stays slang). This matters most for distant languages (e.g. Korean/Japanese/Chinese → ${nat}).\n`}- everydayUseful: be STRICT. true only for lines a learner would genuinely reuse in daily conversation. A longer line is fine if it's a useful dialogue to memorize. Set FALSE for lines that are too SHORT/slight to be worth a full review card — judge "too short" RELATIVE TO THIS LANGUAGE (a 1-2 word line is usually too short in English, but some languages pack a full useful phrase into very few words/characters, so judge by meaning, not raw length). Also false for story-specific lines, names/places, half-sentences, or filler.
- vocab: 1-4 most useful words/phrases for a learner. Skip trivial words (a, the, is, etc).
- tip: grammar, pronunciation, idiom explanation, or cultural context — written in ${nat}.
${isEnglish || nativeIsEnglish ? '' : '- englishText: a fluent English translation of the whole transcript.\n'}- If transcript is trivial/too short, return {"vocab":[],"tip":""}
- Respond ONLY with raw JSON. No markdown fences, no explanation.`
}

/**
 * Prompt for generating natural VARIATIONS (paraphrases) of a sentence, so the
 * learner can practice saying the same idea different ways. Generated on demand.
 */
export function buildVariationsPrompt(sentence: string, lang: string, native = 'pt'): string {
  const nat = nativeLanguageEnglishName(native)
  return `You help a ${nat} speaker practice language code "${lang}".
Given a sentence, produce 3 natural alternative ways a native speaker could say the SAME idea
(different wording/register), each with its ${nat} translation.

Sentence: "${sentence}"

Respond with raw JSON only (no markdown):
{
  "variations": [
    { "text": "alternative phrasing in ${lang}", "translation": "translation into ${nat}" }
  ]
}

Rules:
- Exactly 2-3 variations, all in language "${lang}", natural and conversational.
- Keep roughly the same meaning; vary vocabulary/structure/formality.
- Respond ONLY with raw JSON.`
}
