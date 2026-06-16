// Núcleo puro do japonês: detecção de kana/kanji, conversão katakana↔hiragana,
// divisão em moras e kana→romaji (Hepburn). Determinístico e testável — a base da
// renderização de furigana e (futuramente) do acento tonal.

// ── Faixas Unicode ─────────────────────────────────────────────────────────────
const HIRA_LO = 0x3041, HIRA_HI = 0x3096      // ぁ..ゖ
const KATA_LO = 0x30a1, KATA_HI = 0x30f6      // ァ..ヶ
const KATA_HIRA_GAP = 0x60                     // katakana = hiragana + 0x60
const PROLONG = 'ー'                            // U+30FC (chōonpu / vogal longa)

export function isHiragana(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0
  return c >= HIRA_LO && c <= HIRA_HI
}

export function isKatakana(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0
  return (c >= KATA_LO && c <= KATA_HI) || ch === PROLONG
}

export function isKana(ch: string): boolean {
  return isHiragana(ch) || isKatakana(ch)
}

/** Kanji (CJK unificado + extensão A + 々 iteração + 〆 etc.). */
export function isKanji(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0
  return (
    (c >= 0x4e00 && c <= 0x9fff) ||   // CJK Unified Ideographs
    (c >= 0x3400 && c <= 0x4dbf) ||   // Extension A
    c === 0x3005 ||                   // 々 (marca de repetição)
    c === 0x3006 ||                   // 〆
    c === 0x3007                      // 〇
  )
}

/** Qualquer caractere japonês (kana ou kanji). */
export function isJapanese(ch: string): boolean {
  return isKana(ch) || isKanji(ch)
}

/** Converte katakana → hiragana (mantém ー, pontuação e demais caracteres). */
export function kataToHira(s: string): string {
  let out = ''
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0
    if (c >= KATA_LO && c <= KATA_HI) out += String.fromCodePoint(c - KATA_HIRA_GAP)
    else out += ch
  }
  return out
}

/** Converte hiragana → katakana (mantém demais caracteres). */
export function hiraToKata(s: string): string {
  let out = ''
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0
    if (c >= HIRA_LO && c <= HIRA_HI) out += String.fromCodePoint(c + KATA_HIRA_GAP)
    else out += ch
  }
  return out
}

// ── Moras ──────────────────────────────────────────────────────────────────────
// O japonês conta MORAS, não sílabas. Pequenos ya/yu/yo e vogais pequenas combinam
// com a mora anterior (きゃ = 1 mora); っ (sokuon) e ん são moras próprias; ー (vogal
// longa) é uma mora própria.
const SMALL_COMBINERS = new Set([
  'ゃ', 'ゅ', 'ょ', 'ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ', 'ゎ',
  'ャ', 'ュ', 'ョ', 'ァ', 'ィ', 'ゥ', 'ェ', 'ォ', 'ヮ',
])

/** Divide um texto kana em moras (ignora não-kana, exceto que os trata como separador). */
export function splitMora(kana: string): string[] {
  const moras: string[] = []
  for (const ch of kana) {
    if (SMALL_COMBINERS.has(ch) && moras.length > 0 && isKana(moras[moras.length - 1][0])) {
      moras[moras.length - 1] += ch
    } else {
      moras.push(ch)
    }
  }
  return moras
}

/** Nº de moras de um texto kana. */
export function moraCount(kana: string): number {
  return splitMora(kana).length
}

// ── kana → romaji (Hepburn) ─────────────────────────────────────────────────────
// Tabela de dígrafos (kana + pequeno ya/yu/yo) e kana base. Determinístico.
const DIGRAPHS: Record<string, string> = {
  きゃ: 'kya', きゅ: 'kyu', きょ: 'kyo', ぎゃ: 'gya', ぎゅ: 'gyu', ぎょ: 'gyo',
  しゃ: 'sha', しゅ: 'shu', しょ: 'sho', じゃ: 'ja', じゅ: 'ju', じょ: 'jo',
  ちゃ: 'cha', ちゅ: 'chu', ちょ: 'cho', にゃ: 'nya', にゅ: 'nyu', にょ: 'nyo',
  ひゃ: 'hya', ひゅ: 'hyu', ひょ: 'hyo', びゃ: 'bya', びゅ: 'byu', びょ: 'byo',
  ぴゃ: 'pya', ぴゅ: 'pyu', ぴょ: 'pyo', みゃ: 'mya', みゅ: 'myu', みょ: 'myo',
  りゃ: 'rya', りゅ: 'ryu', りょ: 'ryo',
}
const BASE: Record<string, string> = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', を: 'o', ん: 'n',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o',
  ゔ: 'vu',
}
const VOWEL_OF: Record<string, string> = { a: 'a', i: 'i', u: 'u', e: 'e', o: 'o' }

/** Converte texto kana (hiragana ou katakana) em romaji Hepburn. Determinístico. */
export function kanaToRomaji(input: string): string {
  const s = kataToHira(input)
  const chars = Array.from(s)
  let out = ''
  let i = 0
  while (i < chars.length) {
    const ch = chars[i]
    const next = chars[i + 1] ?? ''

    // Sokuon っ → duplica a próxima consoante
    if (ch === 'っ') {
      const pair = DIGRAPHS[next + (chars[i + 2] ?? '')] // não usado, mas mantém simetria
      void pair
      const after = romajiOfNext(chars, i + 1)
      if (after.romaji) {
        const first = after.romaji[0]
        // ch + ... → "tch" para ち-base (Hepburn): っち = tchi
        out += first === 'c' ? 't' : first
      }
      i++
      continue
    }

    // Dígrafo (kana + ゃゅょ)
    const di = DIGRAPHS[ch + next]
    if (di) { out += di; i += 2; continue }

    // ん com apóstrofo antes de vogal/y (Hepburn: shin'you)
    if (ch === 'ん') {
      const nx = chars[i + 1] ?? ''
      const nr = BASE[nx] ?? DIGRAPHS[nx + (chars[i + 2] ?? '')] ?? ''
      out += (nr && /^[aiueoy]/.test(nr)) ? "n'" : 'n'
      i++
      continue
    }

    // Vogal longa ー → repete a última vogal
    if (ch === PROLONG) {
      const last = out[out.length - 1]
      if (last && VOWEL_OF[last]) out += last
      i++
      continue
    }

    const base = BASE[ch]
    if (base) { out += base; i++; continue }

    // não-kana (pontuação, espaço): passa direto
    out += ch
    i++
  }
  return out
}

/** Romaji da kana em `idx` (auxiliar do sokuon). */
function romajiOfNext(chars: string[], idx: number): { romaji: string } {
  const ch = chars[idx] ?? ''
  const next = chars[idx + 1] ?? ''
  const di = DIGRAPHS[ch + next]
  if (di) return { romaji: di }
  return { romaji: BASE[ch] ?? '' }
}
