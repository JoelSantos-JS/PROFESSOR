// Utilidades puras para caracteres Han (Hanzi 漢字 / Kanji). Detecção e extração de
// caracteres para o estudo por decomposição (radicais/componentes). Testável.

/** Caractere Han (CJK Unified + Extensão A + marcas de repetição 々〆〇). */
export function isHan(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0
  return (
    (c >= 0x4e00 && c <= 0x9fff) ||   // CJK Unified Ideographs
    (c >= 0x3400 && c <= 0x4dbf) ||   // Extension A
    (c >= 0x20000 && c <= 0x2a6df) || // Extension B (caracteres raros)
    c === 0x3005 ||                   // 々
    c === 0x3006 ||                   // 〆
    c === 0x3007                      // 〇
  )
}

/** Há ao menos um caractere Han no texto? */
export function hasHan(text: string): boolean {
  for (const ch of text) if (isHan(ch)) return true
  return false
}

/** Todos os caracteres Han na ordem em que aparecem (com repetições). */
export function hanChars(text: string): string[] {
  const out: string[] = []
  for (const ch of text) if (isHan(ch)) out.push(ch)
  return out
}

/** Caracteres Han DISTINTOS, preservando a ordem da 1ª aparição. */
export function uniqueHanChars(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const ch of text) {
    if (!isHan(ch) || seen.has(ch)) continue
    seen.add(ch)
    out.push(ch)
  }
  return out
}

/** Quantidade de caracteres Han distintos. */
export function hanCharCount(text: string): number {
  return uniqueHanChars(text).length
}
