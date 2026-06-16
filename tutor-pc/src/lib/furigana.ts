// Alinhamento de furigana: dada a frase de superfície (mistura de kanji/kana) e sua
// LEITURA em kana, produz segmentos ruby (leitura kana sobre os kanji). Puro e testável.
//
// Estratégia: a kana da superfície "ancora" a leitura (kana lê a si mesma), e cada bloco
// de kanji absorve a leitura entre as âncoras. Quando o alinhamento não fecha de forma
// limpa, `confident=false` e a UI cai de volta para o romaji — nunca mostra furigana errado.

import { isKana, isKanji, kataToHira } from './kana'

export interface RubySeg {
  text: string        // trecho da superfície
  reading?: string     // furigana (só em blocos de kanji)
  kanji: boolean       // true = bloco de kanji (recebe ruby)
}

export interface FuriganaResult {
  segments: RubySeg[]
  confident: boolean   // true = leitura alinhou de forma limpa
  hasKanji: boolean
}

type RunType = 'kanji' | 'kana' | 'other'
interface Run { text: string; type: RunType }

function classify(ch: string): RunType {
  if (isKanji(ch)) return 'kanji'
  if (isKana(ch)) return 'kana'
  return 'other'
}

/** Quebra a superfície em sequências contíguas do mesmo tipo (kanji/kana/outro). */
function tokenize(surface: string): Run[] {
  const runs: Run[] = []
  for (const ch of surface) {
    const type = classify(ch)
    const last = runs[runs.length - 1]
    if (last && last.type === type) last.text += ch
    else runs.push({ text: ch, type })
  }
  return runs
}

export function buildFurigana(surface: string, reading: string): FuriganaResult {
  const runs = tokenize(surface)
  const hasKanji = runs.some(r => r.type === 'kanji')
  const read = kataToHira(reading.trim())

  // Sem leitura ou sem kanji → nada para alinhar (a superfície é a própria leitura).
  if (!read || !hasKanji) {
    return { segments: runs.map(r => ({ text: r.text, kanji: false })), confident: !!read || !hasKanji, hasKanji }
  }

  const segments: RubySeg[] = []
  let r = 0           // ponteiro na leitura (kana é BMP → índices de string são seguros)
  let confident = true

  for (let i = 0; i < runs.length; i++) {
    const run = runs[i]

    if (run.type === 'kana') {
      const runHira = kataToHira(run.text)
      if (read.startsWith(runHira, r)) {
        r += runHira.length
      } else {
        // Desencontro: tenta ressincronizar adiante; marca como não confiável.
        confident = false
        const f = read.indexOf(runHira, r)
        if (f >= 0) r = f + runHira.length
      }
      segments.push({ text: run.text, kanji: false })
      continue
    }

    if (run.type === 'kanji') {
      // Próxima âncora kana, garantindo que não haja OUTRO bloco de kanji antes dela.
      let j = i + 1
      let blockedByKanji = false
      while (j < runs.length && runs[j].type !== 'kana') {
        if (runs[j].type === 'kanji') blockedByKanji = true
        j++
      }

      if (j < runs.length && !blockedByKanji) {
        const anchor = kataToHira(runs[j].text)
        const f = read.indexOf(anchor, r)
        if (f >= r) {
          segments.push({ text: run.text, reading: read.slice(r, f), kanji: true })
          r = f
        } else {
          confident = false
          segments.push({ text: run.text, reading: '', kanji: true })
        }
      } else {
        // Kanji final (sem âncora kana limpa à frente) → absorve o resto da leitura.
        const rest = read.slice(r)
        if (rest && !blockedByKanji) {
          segments.push({ text: run.text, reading: rest, kanji: true })
          r = read.length
        } else {
          confident = false
          segments.push({ text: run.text, reading: rest, kanji: true })
          r = read.length
        }
      }
      continue
    }

    // 'other' (pontuação/ASCII/dígitos): consome se aparecer na leitura, senão é transparente.
    if (read.startsWith(run.text, r)) r += run.text.length
    segments.push({ text: run.text, kanji: false })
  }

  if (r !== read.length) confident = false
  return { segments, confident, hasKanji }
}
