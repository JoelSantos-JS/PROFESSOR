// Núcleo lógico do rastreio de progresso: % de compreensão, palavras desconhecidas e o
// "ponto ideal +1" (frase com exatamente 1 palavra nova — o nível perfeito para aprender).
// Puro e testável. A camada de dados (palavras conhecidas por idioma) e a UI usam isto.

export type WordStatus = 'known' | 'learning' | 'ignore'

/** Normaliza uma palavra para comparação: minúsculas, sem espaços/pontuação nas bordas.
 *  Para CJK (sem maiúsculas/acentos), é praticamente identidade. */
export function normalizeKnownWord(w: string): string {
  return w
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // tira diacríticos (latim)
    .normalize('NFC')                                    // recompõe (Hangul etc.)
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')    // tira pontuação nas bordas
}

/** Palavras "contáveis" de uma lista de tokens (não-vazias após normalizar). */
function contentWords(words: string[]): string[] {
  return words.map(normalizeKnownWord).filter(w => w.length > 0)
}

/**
 * Uma palavra "conta como conhecida" se está marcada como `known` OU `ignore`
 * (ignorar = nomes próprios/coisas que o usuário não quer aprender, mas entende).
 */
function isConsideredKnown(word: string, status: Map<string, WordStatus>): boolean {
  const s = status.get(word)
  return s === 'known' || s === 'ignore'
}

/** % de compreensão de uma frase (0–100): fração das palavras que o usuário já conhece. */
export function comprehensionPct(words: string[], status: Map<string, WordStatus>): number {
  const cw = contentWords(words)
  if (cw.length === 0) return 100   // nada para entender → 100%
  const known = cw.filter(w => isConsideredKnown(w, status)).length
  return Math.round((known / cw.length) * 100)
}

/** Palavras DISTINTAS desconhecidas (preservando a ordem da 1ª aparição). */
export function unknownWords(words: string[], status: Map<string, WordStatus>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const w of contentWords(words)) {
    if (isConsideredKnown(w, status) || seen.has(w)) continue
    seen.add(w)
    out.push(w)
  }
  return out
}

/** Nº de palavras DISTINTAS desconhecidas. */
export function unknownCount(words: string[], status: Map<string, WordStatus>): number {
  return unknownWords(words, status).length
}

/** "+1": a frase tem exatamente 1 palavra nova → nível ideal para aprender. */
export function isPlusOne(words: string[], status: Map<string, WordStatus>): boolean {
  return unknownCount(words, status) === 1
}

// ── Marcos de palavras conhecidas (sensação de progresso) ──────────────────────
export const KNOWN_MILESTONES = [100, 250, 500, 1000, 2000, 5000, 10000] as const

/** Próximo marco a alcançar, ou null se já passou de todos. */
export function nextMilestone(knownCount: number): number | null {
  for (const m of KNOWN_MILESTONES) if (knownCount < m) return m
  return null
}

/** Estimativa pedagógica de cobertura do idioma pelo nº de palavras conhecidas
 *  (100 ≈ 50%, 1000 ≈ 75%, 5000 ≈ ~92% — aproximação para motivar). */
export function estimatedCoverage(knownCount: number): number {
  if (knownCount < 1) return 0
  const pct = 25 * Math.log10(knownCount)   // 100→50, 1000→75, 5000→~92
  return Math.max(0, Math.min(98, Math.round(pct)))
}
