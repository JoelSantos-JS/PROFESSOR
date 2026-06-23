// O Whisper costuma "alucinar" a MESMA frase CURTA no silêncio/ruído (ex.: "Thank you.", "...",
// "you"). Então só descartamos repetições exatas E curtas — uma frase longa idêntica provavelmente
// é fala real repetida e deve ser MANTIDA (não perder conteúdo).
export function isLikelyDuplicate(text: string, lastText: string, maxLen = 24): boolean {
  const a = text.trim()
  return a.length > 0 && a === lastText.trim() && a.length <= maxLen
}
