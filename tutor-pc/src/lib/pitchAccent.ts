// Acento tonal do japonês padrão (Tóquio). Puro e testável.
//
// O japonês tem acento de ALTURA (pitch): cada mora é Alta (H) ou Baixa (L). O "número
// de acento" (downstep) indica a última mora alta antes da queda; 0 = sem queda (heiban).
// Regras canônicas:
//   • mora 1 e mora 2 têm sempre alturas OPOSTAS;
//   • heiban   (a=0): L H H H … H  → partícula seguinte ALTA
//   • atamadaka(a=1): H L L L … L  → partícula BAIXA
//   • nakadaka (1<a<N): L H … H(a) L … L → partícula BAIXA
//   • odaka    (a=N): L H H … H  → mas a partícula seguinte CAI (BAIXA)
// Odaka e heiban têm o MESMO padrão nas moras; a diferença aparece só na partícula.

import { splitMora } from './kana'

export type Pitch = 'H' | 'L'
export type AccentType = 'heiban' | 'atamadaka' | 'nakadaka' | 'odaka'

export interface PitchPattern {
  moras: Pitch[]         // altura de cada mora
  particleHigh: boolean   // a partícula seguinte é alta? (só no heiban)
  type: AccentType
  accent: number          // posição do downstep normalizada (0 = heiban)
  moraCount: number
}

/** Garante 0 ≤ accent ≤ moraCount. */
function clampAccent(accent: number, moraCount: number): number {
  if (!Number.isFinite(accent) || accent < 0) return 0
  return Math.min(Math.floor(accent), moraCount)
}

/** Classifica o tipo de acento a partir do nº de moras e da posição do downstep. */
export function accentType(moraCount: number, accent: number): AccentType {
  const a = clampAccent(accent, moraCount)
  if (a === 0) return 'heiban'
  if (a === 1) return 'atamadaka'
  if (a === moraCount) return 'odaka'
  return 'nakadaka'
}

/** Padrão de altura (H/L) por mora + se a partícula seguinte é alta. */
export function pitchPattern(moraCount: number, accent: number): PitchPattern {
  const a = clampAccent(accent, moraCount)
  const moras: Pitch[] = []
  for (let i = 0; i < moraCount; i++) {
    const pos = i + 1 // 1-indexado
    let p: Pitch
    if (pos === 1) p = a === 1 ? 'H' : 'L'
    else p = (a === 0 || pos <= a) ? 'H' : 'L'
    moras.push(p)
  }
  return {
    moras,
    particleHigh: a === 0,
    type: accentType(moraCount, a),
    accent: a,
    moraCount,
  }
}

/** Conveniência: padrão de altura a partir do texto kana + nº de acento. */
export function pitchForKana(kana: string, accent: number): PitchPattern {
  return pitchPattern(splitMora(kana).length, accent)
}

const TYPE_LABEL: Record<'pt' | 'en', Record<AccentType, string>> = {
  pt: {
    heiban: 'Heiban (平板) — plano, sem queda',
    atamadaka: 'Atamadaka (頭高) — cai após a 1ª mora',
    nakadaka: 'Nakadaka (中高) — sobe e cai no meio',
    odaka: 'Odaka (尾高) — cai na partícula seguinte',
  },
  en: {
    heiban: 'Heiban (平板) — flat, no drop',
    atamadaka: 'Atamadaka (頭高) — drops after the 1st mora',
    nakadaka: 'Nakadaka (中高) — rises and drops in the middle',
    odaka: 'Odaka (尾高) — drops on the next particle',
  },
}

export function accentTypeLabel(type: AccentType, uiLang: string = 'pt'): string {
  return TYPE_LABEL[uiLang === 'pt' ? 'pt' : 'en'][type]
}
