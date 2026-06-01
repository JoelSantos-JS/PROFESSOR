// Alternative, more expressive female voices verified against the official
// Edge TTS catalog. For ja/ko/th/hi/ru the catalog only ships ONE female
// voice, so those keep their single available option.
export const VOICE_MAP: Record<string, string> = {
  'zh':    'zh-CN-XiaoyiNeural',     // lively female (alt of Xiaoxiao)
  'zh-CN': 'zh-CN-XiaoyiNeural',
  'zh-TW': 'zh-TW-HsiaoChenNeural',
  'ja':    'ja-JP-NanamiNeural',     // only female JP voice in catalog
  'ko':    'ko-KR-SunHiNeural',      // only female KO voice in catalog
  'th':    'th-TH-PremwadeeNeural',  // only female TH voice in catalog
  'ar':    'ar-EG-SalmaNeural',      // expressive female (alt of Zariyah)
  'hi':    'hi-IN-SwaraNeural',      // only female HI voice in catalog
  'ru':    'ru-RU-SvetlanaNeural',   // only female RU voice in catalog
  'en':    'en-US-AriaNeural',       // expressive female (alt of Jenny)
  'pt':    'pt-BR-ThalitaNeural',    // alt female (alt of Francisca)
  'pt-BR': 'pt-BR-ThalitaNeural',
  'es':    'es-ES-XimenaNeural',     // alt female (alt of Elvira)
  'fr':    'fr-FR-EloiseNeural',     // alt female (alt of Denise)
  'de':    'de-DE-AmalaNeural',      // alt female (alt of Katja)
  'it':    'it-IT-IsabellaNeural',   // alt female (alt of Elsa)
}

export const DEFAULT_VOICE = 'en-US-AriaNeural'

/** Returns the Edge TTS voice name for a given ISO 639-1 or BCP-47 language tag. */
export function resolveVoice(lang: string): string {
  return VOICE_MAP[lang] ?? VOICE_MAP[lang.split('-')[0]] ?? DEFAULT_VOICE
}
