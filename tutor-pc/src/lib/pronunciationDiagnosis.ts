// Diagnóstico de pronúncia (núcleo puro): agrega precisão de PALAVRAS (Whisper diff) + ENTONAÇÃO
// (curva de pitch via DTW) num score + lista as palavras fracas + dicas por idioma.
// Reaproveita o que já existe (text.diffWords/scoreFromDiff, dtw.pitchShapeScore). Testável.

import { diffWords, scoreFromDiff, missingWords, type DiffToken } from './text'
import { pitchShapeScore } from './dtw'
import { baseLang } from './languages'

export interface DiagnosisInput {
  reference: string        // frase que o usuário deveria ler
  spoken: string           // transcrição do que ele falou (Whisper)
  userContour?: number[]   // curva de pitch da gravação dele
  refContour?: number[]    // curva de pitch do modelo (Original/TTS)
}

export interface PronunciationDiagnosis {
  overall: number                  // 0–100 (palavra + entonação)
  wordScore: number                // 0–100 (precisão das palavras)
  intonationScore: number | null   // 0–100, ou null quando não há curva
  diff: DiffToken[]                // diff palavra a palavra (para colorir)
  weakWords: string[]              // palavras que saíram erradas (para treinar)
}

const WORD_WEIGHT = 0.65
const INTONATION_WEIGHT = 0.35

/** Roda o diagnóstico a partir do texto-alvo, da transcrição e (opcional) das curvas de pitch. */
export function diagnoseReading(input: DiagnosisInput): PronunciationDiagnosis {
  const diff = diffWords(input.reference ?? '', input.spoken ?? '')
  const wordScore = scoreFromDiff(diff)

  const hasContours = !!(input.userContour?.some(v => v > 0) && input.refContour?.some(v => v > 0))
  const intonationScore = hasContours ? pitchShapeScore(input.userContour!, input.refContour!) : null

  const overall = intonationScore == null
    ? wordScore
    : Math.round(wordScore * WORD_WEIGHT + intonationScore * INTONATION_WEIGHT)

  return { overall, wordScore, intonationScore, diff, weakWords: missingWords(diff) }
}

export type UiLang = 'pt' | 'en'

// Dicas curadas por idioma (sempre 1ª linha) + reforço pelas palavras fracas, por idioma da UI.
const LANG_TIPS: Record<UiLang, Record<string, string[]>> = {
  pt: {
    zh: ['Foque nos TONS — a mesma sílaba muda de sentido com o tom (mā/má/mǎ/mà).', 'Mantenha o 3º tom bem baixo e o 4º curto e firme.'],
    ko: ['Pronuncie o batchim (consoante final): ele liga com a sílaba seguinte (연음).', 'Diferencie ㅓ/ㅗ e as consoantes tensas (ㄲ/ㄸ/ㅃ).'],
    ja: ['Cuide das vogais LONGAS (ō, ū) — encurtá-las muda a palavra.', 'Mantenha o ritmo por moras: cada kana vale 1 tempo.'],
    en: ['Capriche no “th” (língua entre os dentes) e no “r” americano.', 'Reduza as vogais átonas (schwa) para soar natural.'],
    es: ['Vibre o “rr” e toque o “r” simples; não aspire como em PT.', 'Vogais sempre puras e curtas (a, e, i, o, u).'],
    fr: ['Trabalhe as vogais nasais e o “r” uvular (no fundo da garganta).'],
    de: ['Pratique o ich-Laut e as vogais ü/ö.'],
    it: ['Marque bem as consoantes duplas (caffè, pizza).'],
    pt: ['Capriche no “r” forte e nas vogais nasais (ã, õ).'],
    ru: ['Atenção aos grupos de consoantes e à palatalização.'],
  },
  en: {
    zh: ['Focus on TONES — the same syllable changes meaning with the tone (mā/má/mǎ/mà).', 'Keep the 3rd tone low and the 4th short and firm.'],
    ko: ['Pronounce the batchim (final consonant): it links into the next syllable (연음).', 'Distinguish ㅓ/ㅗ and the tense consonants (ㄲ/ㄸ/ㅃ).'],
    ja: ['Mind the LONG vowels (ō, ū) — shortening them changes the word.', 'Keep the mora rhythm: each kana is one beat.'],
    en: ['Nail the “th” (tongue between the teeth) and the American “r”.', 'Reduce unstressed vowels (schwa) to sound natural.'],
    es: ['Roll the “rr” and tap the single “r”; don’t aspirate like in Portuguese.', 'Keep vowels pure and short (a, e, i, o, u).'],
    fr: ['Work on the nasal vowels and the uvular “r” (back of the throat).'],
    de: ['Practice the ich-Laut and the ü/ö vowels.'],
    it: ['Mark the double consonants clearly (caffè, pizza).'],
    pt: ['Nail the strong “r” and the nasal vowels (ã, õ).'],
    ru: ['Watch the consonant clusters and palatalization.'],
  },
}

const FALLBACK_TIP: Record<UiLang, string> = {
  pt: 'Ouça o modelo e repita imitando o ritmo e a entonação.',
  en: 'Listen to the model and repeat, mimicking the rhythm and intonation.',
}

/** 1–3 dicas: específica do idioma + reforço com as palavras erradas. */
export function pronunciationTips(lang: string, weakWords: string[], uiLang: UiLang = 'pt'): string[] {
  const base = LANG_TIPS[uiLang][baseLang(lang)] ?? [FALLBACK_TIP[uiLang]]
  const tips = [...base]
  if (weakWords.length) {
    const focus = weakWords.slice(0, 4).join(', ')
    tips.push(uiLang === 'en' ? `Focus mostly on: ${focus}.` : `Treine principalmente: ${focus}.`)
  }
  return tips.slice(0, 3)
}

const SCORE_LABELS: Record<UiLang, [string, string, string, string]> = {
  pt: ['Excelente', 'Bom', 'Razoável', 'A treinar'],
  en: ['Excellent', 'Good', 'Fair', 'Needs work'],
}

/** Rótulo do nível do score (para o card de resultado). */
export function scoreLabel(score: number, uiLang: UiLang = 'pt'): string {
  const [a, b, c, d] = SCORE_LABELS[uiLang]
  if (score >= 85) return a
  if (score >= 70) return b
  if (score >= 50) return c
  return d
}
