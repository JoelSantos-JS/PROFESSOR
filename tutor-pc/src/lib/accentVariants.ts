// Variantes de SOTAQUE por idioma para a pronúncia de uma palavra (ex.: inglês US/UK/AU).
// Cada variante mapeia para uma voz do Edge TTS (grátis) — assim o aluno ouve a mesma palavra
// em sotaques diferentes. Idiomas com um só sotaque no catálogo retornam [] (sem variantes extras).
export interface AccentVariant {
  id: string      // BCP-47 (en-US)
  label: string   // rótulo curto (US)
  flag: string    // bandeira
  voice: string   // voz Edge TTS
}

const VARIANTS: Record<string, AccentVariant[]> = {
  en: [
    { id: 'en-US', label: 'US', flag: '🇺🇸', voice: 'en-US-AriaNeural' },
    { id: 'en-GB', label: 'UK', flag: '🇬🇧', voice: 'en-GB-SoniaNeural' },
    { id: 'en-AU', label: 'AU', flag: '🇦🇺', voice: 'en-AU-NatashaNeural' },
  ],
  pt: [
    { id: 'pt-BR', label: 'BR', flag: '🇧🇷', voice: 'pt-BR-ThalitaNeural' },
    { id: 'pt-PT', label: 'PT', flag: '🇵🇹', voice: 'pt-PT-RaquelNeural' },
  ],
  es: [
    { id: 'es-ES', label: 'ES', flag: '🇪🇸', voice: 'es-ES-ElviraNeural' },
    { id: 'es-MX', label: 'MX', flag: '🇲🇽', voice: 'es-MX-DaliaNeural' },
  ],
  fr: [
    { id: 'fr-FR', label: 'FR', flag: '🇫🇷', voice: 'fr-FR-DeniseNeural' },
    { id: 'fr-CA', label: 'CA', flag: '🇨🇦', voice: 'fr-CA-SylvieNeural' },
  ],
  de: [
    { id: 'de-DE', label: 'DE', flag: '🇩🇪', voice: 'de-DE-KatjaNeural' },
    { id: 'de-AT', label: 'AT', flag: '🇦🇹', voice: 'de-AT-IngridNeural' },
  ],
  zh: [
    { id: 'zh-CN', label: '简', flag: '🇨🇳', voice: 'zh-CN-XiaoxiaoNeural' },
    { id: 'zh-TW', label: '繁', flag: '🇹🇼', voice: 'zh-TW-HsiaoChenNeural' },
  ],
}

/** Variantes de sotaque de um idioma (ISO 639-1 ou BCP-47). [] quando não há variação relevante. */
export function accentVariantsFor(lang: string): AccentVariant[] {
  const base = (lang || '').toLowerCase().split('-')[0]
  return VARIANTS[base] ?? []
}
