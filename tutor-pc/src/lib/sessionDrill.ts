import type { SessionAttempt } from '../types'

// "Treinar os erros desta sessão": junta as palavras que o aluno ERROU (status 'missing')
// em todas as tentativas da sessão e devolve as distintas do idioma DOMINANTE (o que tem
// mais erros) — pronto pra alimentar o drill de pronúncia (wordDrillItems).

export interface SessionMistakes {
  lang: string
  words: string[]   // distintas, na ordem em que apareceram
}

export function sessionMistakes(attempts: SessionAttempt[]): SessionMistakes {
  const byLang = new Map<string, string[]>()
  const seen = new Map<string, Set<string>>()

  for (const a of attempts) {
    const lang = (a.lang || '').trim()
    if (!lang) continue
    for (const tok of a.diff ?? []) {
      if (tok.status !== 'missing') continue
      const word = (tok.word || '').trim()
      if (!word) continue
      const key = word.toLowerCase()
      const seenSet = seen.get(lang) ?? new Set<string>()
      if (seenSet.has(key)) continue
      seenSet.add(key); seen.set(lang, seenSet)
      const list = byLang.get(lang) ?? []
      list.push(word); byLang.set(lang, list)
    }
  }

  let best: SessionMistakes = { lang: '', words: [] }
  for (const [lang, words] of byLang) {
    if (words.length > best.words.length) best = { lang, words }
  }
  return best
}
