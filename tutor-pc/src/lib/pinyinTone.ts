// Utilidades de TOM do Pinyin para a visualização do mandarim:
//  • toneShape(tom)        → curva-alvo (Chao) normalizada 0..1, para desenhar atrás da
//                            sua curva de pitch
//  • numberedToMarks       "ni3 hao3" → "nǐ hǎo"
//  • marksToNumbered       "nǐ hǎo"   → "ni3 hao3"  (sílabas separadas por espaço/apóstrofo)
//  • syllableTones         tons (1-4, 0=neutro) por sílaba
//
// Reaproveita toneOf/stripTone/setTone de pinyinSandhi. Funções puras, testadas.

import { toneOf, stripTone, setTone } from './pinyinSandhi'

const TONED = 'āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ'
const PINYIN_RUN = new RegExp(`[a-zü${TONED}]+`, 'gi')  // 'i' → casa também vogais tonadas maiúsculas (Ā)

/**
 * Contorno-alvo do tom (notação de Chao, 5 níveis → 0..1; 1 = agudo). Usado para desenhar
 * a forma esperada do tom. Tom 0/neutro = ponto médio curto. Tom inválido → [].
 */
export function toneShape(tone: number): number[] {
  switch (tone) {
    case 1: return [1, 1]            // 55  alto plano
    case 2: return [0.5, 1]          // 35  sobe
    case 3: return [0.25, 0, 0.75]   // 214 desce-e-sobe
    case 4: return [1, 0]            // 51  desce
    case 0: return [0.5]             // neutro, curto, médio
    default: return []
  }
}

/** Aplica o tom preservando a capitalização da 1ª letra (setTone trabalha em minúsculas). */
function setToneCased(base: string, tone: number): string {
  const firstUpper = base.length > 0 && base[0] !== base[0].toLowerCase() && base[0] === base[0].toUpperCase()
  const lower = setTone(base.toLowerCase(), tone)
  return firstUpper ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower
}

/** Pinyin com números → marcas de tom: "ni3 hao3" → "nǐ hǎo" (v/V tratados como ü/Ü). */
export function numberedToMarks(pinyin: string): string {
  return pinyin.replace(/([a-zA-ZüÜvV]+)([0-5])/g, (_m, letters: string, digit: string) => {
    const tone = Number(digit)
    const base = letters.replace(/v/g, 'ü').replace(/V/g, 'Ü')
    if (tone < 1 || tone > 4) return base   // 0/5 = neutro → sem marca
    return setToneCased(base, tone)
  })
}

/** Marcas de tom → números: "nǐ hǎo" → "ni3 hao3". `neutral` = sufixo para sílabas neutras. */
export function marksToNumbered(pinyin: string, neutral = ''): string {
  return pinyin.replace(PINYIN_RUN, (syl) => {
    const tone = toneOf(syl)
    const base = stripTone(syl)
    return tone >= 1 && tone <= 4 ? base + tone : base + neutral
  })
}

/** Tons (1-4, 0=neutro) de cada sílaba separada por espaço. */
export function syllableTones(pinyin: string): number[] {
  return pinyin
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(toneOf)
}

// ── Visualização do tom (cores padrão de aprendizado + glifo da forma) ─────────
/** Cores de tom (esquema clássico estilo Pleco/Hanping). */
export const TONE_COLORS: Record<number, string> = {
  1: '#C0392B', // 1º — vermelho (alto plano)
  2: '#2E7D32', // 2º — verde (sobe)
  3: '#1565C0', // 3º — azul (desce-sobe)
  4: '#6A1B9A', // 4º — roxo (desce)
  0: '#9C8A78', // neutro — cinza
}
export function toneColor(tone: number): string {
  return TONE_COLORS[tone] ?? TONE_COLORS[0]
}

/**
 * Path SVG do glifo da forma do tom dentro de uma caixa w×h. Pitch alto = topo
 * (y pequeno). Tom 0/neutro = traço curto no meio. Tom inválido → ''.
 */
export function toneGlyphPath(tone: number, w: number, h: number): string {
  const shape = toneShape(tone)
  if (shape.length === 0) return ''
  if (shape.length === 1) {
    const y = (h - shape[0] * h).toFixed(1)
    return `M${(w * 0.3).toFixed(1)},${y} L${(w * 0.7).toFixed(1)},${y}`  // traço curto (neutro)
  }
  return shape
    .map((v, i) => {
      const x = (i / (shape.length - 1)) * w
      const y = h - v * h
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}
