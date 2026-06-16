// "Pronúncia real" do mandarim: aplica o TONE SANDHI do terceiro tom ao Pinyin.
// Em mandarim, os tons mudam na fala conectada mas o Pinyin escrito não muda. A regra
// mais importante e ENSINADA a todo iniciante: numa sequência de terceiros tons, todos
// menos o último viram segundo tom (你好 nǐ hǎo → ní hǎo; 我很好 wǒ hěn hǎo → wó hén hǎo).
//
// Esta versão cobre o sandhi do 3º tom (puramente tonal → sempre correto a partir do
// Pinyin, sem precisar dos caracteres). As regras de 不/一 dependem do caractere e ficam
// para uma versão futura (com alinhamento Hanzi↔Pinyin). Função pura, totalmente testável.

// Vogal tonada → [vogal base, tom]
const TONED: Record<string, [string, number]> = {
  'ā': ['a', 1], 'á': ['a', 2], 'ǎ': ['a', 3], 'à': ['a', 4],
  'ē': ['e', 1], 'é': ['e', 2], 'ě': ['e', 3], 'è': ['e', 4],
  'ī': ['i', 1], 'í': ['i', 2], 'ǐ': ['i', 3], 'ì': ['i', 4],
  'ō': ['o', 1], 'ó': ['o', 2], 'ǒ': ['o', 3], 'ò': ['o', 4],
  'ū': ['u', 1], 'ú': ['u', 2], 'ǔ': ['u', 3], 'ù': ['u', 4],
  'ǖ': ['ü', 1], 'ǘ': ['ü', 2], 'ǚ': ['ü', 3], 'ǜ': ['ü', 4],
}

// Vogal base → formas tonadas [neutra(0), 1, 2, 3, 4]
const TONE_FORMS: Record<string, string[]> = {
  a: ['a', 'ā', 'á', 'ǎ', 'à'],
  e: ['e', 'ē', 'é', 'ě', 'è'],
  i: ['i', 'ī', 'í', 'ǐ', 'ì'],
  o: ['o', 'ō', 'ó', 'ǒ', 'ò'],
  u: ['u', 'ū', 'ú', 'ǔ', 'ù'],
  'ü': ['ü', 'ǖ', 'ǘ', 'ǚ', 'ǜ'],
}

const TONED_CHARS = Object.keys(TONED).join('')
// Uma sílaba de Pinyin = letras latinas + vogais tonadas (+ ü). 'i' casa tonadas maiúsculas.
const SYLLABLE_RE = new RegExp(`[a-zü${TONED_CHARS}]+`, 'gi')

/** Tom de uma sílaba de Pinyin (1-4), ou 0 para neutro/sem marca. (case-insensitive) */
export function toneOf(syllable: string): number {
  for (const ch of syllable) {
    const t = TONED[ch] ?? TONED[ch.toLowerCase()]
    if (t) return t[1]
  }
  return 0
}

/** Remove as marcas de tom, deixando as vogais base (preservando maiúsculas: Ā → A). */
export function stripTone(syllable: string): string {
  let out = ''
  for (const ch of syllable) {
    const lower = TONED[ch] ?? TONED[ch.toLowerCase()]
    if (!lower) { out += ch; continue }
    const base = lower[0]
    // preserva a capitalização: se o caractere original era maiúsculo, a base também
    out += ch !== ch.toLowerCase() ? base.toUpperCase() : base
  }
  return out
}

/** Coloca a marca de tom na vogal correta (regra do Pinyin: a/e primeiro; ou→o; senão a última). */
export function setTone(base: string, tone: number): string {
  if (tone < 1 || tone > 4) return base
  const lower = base
  let idx = -1
  if (lower.includes('a')) idx = lower.indexOf('a')
  else if (lower.includes('e')) idx = lower.indexOf('e')
  else if (lower.includes('ou')) idx = lower.indexOf('o')
  else {
    for (let i = lower.length - 1; i >= 0; i--) {
      if ('aeiouü'.includes(lower[i])) { idx = i; break }
    }
  }
  if (idx < 0) return base
  const forms = TONE_FORMS[lower[idx]]
  if (!forms) return base
  return lower.slice(0, idx) + forms[tone] + lower.slice(idx + 1)
}

/** Troca o tom de uma sílaba (preservando maiúscula inicial). */
function retone(syllable: string, tone: number): string {
  const result = setTone(stripTone(syllable).toLowerCase(), tone)
  // preserva capitalização da 1ª letra
  if (syllable[0] && syllable[0] === syllable[0].toUpperCase() && syllable[0] !== syllable[0].toLowerCase()) {
    return result.charAt(0).toUpperCase() + result.slice(1)
  }
  return result
}

interface Token { text: string; isSyllable: boolean; tone: number }

function tokenize(pinyin: string): Token[] {
  const tokens: Token[] = []
  let last = 0
  let m: RegExpExecArray | null
  SYLLABLE_RE.lastIndex = 0
  while ((m = SYLLABLE_RE.exec(pinyin)) !== null) {
    if (m.index > last) tokens.push({ text: pinyin.slice(last, m.index), isSyllable: false, tone: -1 })
    tokens.push({ text: m[0], isSyllable: true, tone: toneOf(m[0]) })
    last = m.index + m[0].length
  }
  if (last < pinyin.length) tokens.push({ text: pinyin.slice(last), isSyllable: false, tone: -1 })
  return tokens
}

/** Um separador "quebra" a sequência de tons se contiver pontuação (pausa). Espaço/apóstrofo não quebram. */
function breaksRun(sep: string): boolean {
  return /[^\s'·]/.test(sep)  // qualquer coisa que não seja espaço/apóstrofo/ponto-medial
}

/**
 * Aplica o tone sandhi do 3º tom: em cada sequência contígua de sílabas de 3º tom (sem
 * pausa/pontuação no meio), todas menos a última viram 2º tom.
 */
export function pinyinSandhi(pinyin: string, hanzi?: string): string {
  if (!pinyin) return pinyin
  const tokens = tokenize(pinyin)

  // Agrupa as sílabas em "runs" (sem pontuação no meio; espaço não quebra).
  const runs: number[][] = []
  let cur: number[] = []
  for (let t = 0; t < tokens.length; t++) {
    if (tokens[t].isSyllable) cur.push(t)
    else if (breaksRun(tokens[t].text) && cur.length) { runs.push(cur); cur = [] }
  }
  if (cur.length) runs.push(cur)

  const apply = (tk: number, tone: number) => {
    tokens[tk].text = retone(tokens[tk].text, tone)
    tokens[tk].tone = tone
  }

  // Alinha Hanzi 1:1 com as sílabas (só se a contagem bater) → habilita 不/一.
  const allSyl = runs.flat()
  const charOf = new Map<number, string>()
  if (hanzi) {
    const han = Array.from(hanzi).filter(ch => /\p{Script=Han}/u.test(ch))
    if (han.length === allSyl.length) allSyl.forEach((tk, n) => charOf.set(tk, han[n]))
  }

  // 1) Sandhi de 不/一 (usa o tom de CITAÇÃO da próxima sílaba; dentro do mesmo run).
  if (charOf.size) {
    for (const run of runs) {
      const citation = run.map(tk => tokens[tk].tone)  // antes de qualquer mudança
      for (let p = 0; p < run.length; p++) {
        const ch = charOf.get(run[p])
        const next = p + 1 < run.length ? citation[p + 1] : null
        if (ch === '不' && next === 4) apply(run[p], 2)                  // 不是 → bú shì
        else if (ch === '一' && next != null) apply(run[p], next === 4 ? 2 : 4)  // 一个→yí · 一天→yì
      }
    }
  }

  // 2) Sandhi do 3º tom: em cada run, numa sequência de 3º tons, todos menos o último → 2º.
  for (const run of runs) {
    let k = 0
    while (k < run.length) {
      if (tokens[run[k]].tone === 3) {
        let end = k
        while (end + 1 < run.length && tokens[run[end + 1]].tone === 3) end++
        for (let s = k; s < end; s++) apply(run[s], 2)
        k = end + 1
      } else k++
    }
  }

  return tokens.map(t => t.text).join('')
}

/** True quando o sandhi muda algo (para só mostrar a linha quando há diferença). */
export function hasPinyinSandhi(pinyin: string, hanzi?: string): boolean {
  return pinyinSandhi(pinyin, hanzi) !== pinyin
}
