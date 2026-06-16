import { pitchShapeScore } from './dtw'

export type PitchScoreId = 'user-original' | 'user-tts' | 'original-tts'

export interface PitchScore {
  id: PitchScoreId
  label: string
  score: number
}

export function voicedCount(contour: number[]): number {
  return contour.filter(v => v > 0).length
}

export function hasEnoughPitch(contour: number[]): boolean {
  return voicedCount(contour) >= 2
}

function maybeScore(id: PitchScoreId, label: string, a: number[], b: number[]): PitchScore | null {
  if (!hasEnoughPitch(a) || !hasEnoughPitch(b)) return null
  return { id, label, score: pitchShapeScore(a, b) }
}

export function pitchComparisonScores(opts: {
  user: number[]
  original?: number[]
  tts?: number[]
}, uiLang: 'pt' | 'en' = 'pt'): PitchScore[] {
  const you = uiLang === 'en' ? 'You' : 'Você'
  const scores: PitchScore[] = []
  const userOriginal = maybeScore('user-original', `${you} x Original`, opts.user, opts.original ?? [])
  const userTts = maybeScore('user-tts', `${you} x TTS`, opts.user, opts.tts ?? [])
  const originalTts = maybeScore('original-tts', 'Original x TTS', opts.original ?? [], opts.tts ?? [])
  if (userOriginal) scores.push(userOriginal)
  if (userTts) scores.push(userTts)
  if (originalTts) scores.push(originalTts)
  return scores
}
