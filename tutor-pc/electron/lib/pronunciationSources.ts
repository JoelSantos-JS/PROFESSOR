// Núcleo PURO das fontes de pronúncia por NATIVOS REAIS (sem I/O — testável).
// Duas fontes: Forvo (precisa de chave, melhor cobertura) e Wikimedia/Lingua Libre (grátis).

export interface NativePronunciation {
  url: string                          // áudio direto (mp3/ogg/wav)
  source: 'forvo' | 'wikimedia'
  country?: string                     // ex.: 'United States'
  speaker?: string                     // usuário/falante
  attribution?: string                 // necessário p/ CC (Wikimedia)
}

// ── Mapas de idioma ────────────────────────────────────────────────────────────
// Forvo usa códigos de 2 letras (mesma base do nosso lang).
export function forvoLangCode(lang: string): string {
  return (lang || '').toLowerCase().split('-')[0]
}

// Lingua Libre nomeia os arquivos com o ISO 639-3 entre parênteses: "LL-Q1860 (eng)-…".
const ISO3: Record<string, string> = {
  en: 'eng', pt: 'por', es: 'spa', fr: 'fra', de: 'deu', it: 'ita',
  ru: 'rus', zh: 'cmn', ja: 'jpn', ko: 'kor', ar: 'ara', hi: 'hin',
  nl: 'nld', pl: 'pol', tr: 'tur', sv: 'swe',
}
export function linguaLibreIso3(lang: string): string | null {
  return ISO3[forvoLangCode(lang)] ?? null
}

// ── Forvo ───────────────────────────────────────────────────────────────────────
interface ForvoItem {
  pathmp3?: string; pathogg?: string; country?: string; username?: string
  num_positive_votes?: number; num_votes?: number
}
export function forvoApiUrl(key: string, word: string, lang: string): string {
  const w = encodeURIComponent(word.trim())
  const code = forvoLangCode(lang)
  return `https://apifree.forvo.com/key/${key}/format/json/action/word-pronunciations/word/${w}/language/${code}/`
}

export function parseForvoPronunciations(json: unknown, limit = 4): NativePronunciation[] {
  const items = (json as { items?: ForvoItem[] })?.items
  if (!Array.isArray(items)) return []
  return items
    .filter(it => it.pathmp3 || it.pathogg)
    .sort((a, b) => (b.num_positive_votes ?? b.num_votes ?? 0) - (a.num_positive_votes ?? a.num_votes ?? 0))
    .slice(0, limit)
    .map(it => ({
      url: (it.pathmp3 || it.pathogg) as string,
      source: 'forvo' as const,
      country: it.country || undefined,
      speaker: it.username || undefined,
      attribution: it.username ? `Forvo · ${it.username}` : 'Forvo',
    }))
}

// ── Wikimedia / Lingua Libre (Commons) ───────────────────────────────────────────
export function commonsApiUrl(word: string, iso3: string): string {
  // Busca arquivos (namespace 6) do Lingua Libre: `intitle:"<palavra>.wav"` traz a PALAVRA SOZINHA
  // (em vez de frases "fresh water…"), e o ISO3 garante o idioma. O parse ainda filtra pelo sufixo exato.
  const search = `intitle:"(${iso3})" intitle:"${word.trim()}.wav"`
  const p = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search',
    gsrsearch: search, gsrnamespace: '6', gsrlimit: '30',
    prop: 'imageinfo', iiprop: 'url', origin: '*',
  })
  return `https://commons.wikimedia.org/w/api.php?${p.toString()}`
}

interface CommonsPage { title?: string; imageinfo?: { url?: string }[] }

/**
 * Mantém só os arquivos Lingua Libre DESTA palavra: o padrão é
 * "LL-Q… (iso3)-<Falante>-<palavra>.<ext>". Filtra pelo sufixo "-<palavra>.<ext>"
 * (evita falso-positivo como "underwater") e extrai o falante.
 */
export function parseCommonsPronunciations(json: unknown, word: string, limit = 4): NativePronunciation[] {
  const pages = (json as { query?: { pages?: Record<string, CommonsPage> } })?.query?.pages
  if (!pages) return []
  const w = word.trim().toLowerCase()
  const out: NativePronunciation[] = []
  for (const page of Object.values(pages)) {
    const title = (page.title ?? '').replace(/^File:/i, '')
    const url = page.imageinfo?.[0]?.url
    if (!url) continue
    const m = title.toLowerCase().match(/-([^-]+)\.(wav|ogg|flac|mp3)$/)
    if (!m || m[1] !== w) continue                   // sufixo "-<palavra>.<ext>" exato
    const speaker = title.replace(/\.(wav|ogg|flac|mp3)$/i, '').match(/\([a-z]{3}\)-(.+)-[^-]+$/i)?.[1]
    out.push({ url, source: 'wikimedia', speaker, attribution: speaker ? `Lingua Libre · ${speaker} · CC` : 'Lingua Libre · CC' })
    if (out.length >= limit) break
  }
  return out
}
