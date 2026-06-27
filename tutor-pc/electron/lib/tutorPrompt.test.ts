import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, buildLookupPrompt, buildDecomposePrompt, isEnglishLang, isJapaneseLang, resolveRomanization, ROMANIZATION_SYSTEM, buildVariationsPrompt } from './tutorPrompt'

describe('buildSystemPrompt — sentence translation field', () => {
  it('pede tradução quando o conteúdo é de OUTRO idioma que o nativo', () => {
    expect(buildSystemPrompt('en')).toContain('"translation"')   // en content, nativo pt
    expect(buildSystemPrompt('ko')).toContain('"translation"')
  })
  it('default native: tradução natural/idiomática para português brasileiro', () => {
    const p = buildSystemPrompt('en').toLowerCase()
    expect(p).toContain('natural, idiomatic brazilian portuguese')
    expect(p).toContain('not word-for-word')
  })
  it('OMITE a tradução da FRASE quando conteúdo == idioma do nativo (não gasta token à toa)', () => {
    // inglês → inglês: sem tradução da frase nem englishText (o "translation" do vocab continua)
    const enEn = buildSystemPrompt('en', 'en')
    expect(enEn).not.toContain('natural translation of the whole sentence')
    expect(enEn).not.toContain('translation of the WHOLE transcript')
    expect(enEn).not.toContain('"englishText"')
    // português → português (e aceita region code)
    expect(buildSystemPrompt('pt-BR', 'pt')).not.toContain('natural translation of the whole sentence')
    expect(buildSystemPrompt('pt', 'pt-BR')).not.toContain('natural translation of the whole sentence')
  })

  it('pede o campo everydayUseful (curadoria de frases úteis p/ a Revisão)', () => {
    const p = buildSystemPrompt('en', 'pt')
    expect(p).toContain('"everydayUseful"')
    expect(p).toMatch(/everydayUseful: be STRICT/i)
    // descarta frases curtas, mas julgando "curto" RELATIVO ao idioma (não contagem fixa)
    expect(p).toMatch(/too SHORT/i)
    expect(p).toMatch(/RELATIVE TO THIS LANGUAGE/i)
  })

  it('quando conteúdo == nativo, PROÍBE traduzir p/ outro idioma (mata a alucinação de espanhol)', () => {
    const enEn = buildSystemPrompt('en', 'en')
    // a regra explícita de não-traduzir aparece, citando o idioma do usuário (English)
    expect(enEn).toMatch(/Do NOT translate into ANY other language/i)
    expect(enEn).toContain('NOT Spanish')
    // o "translation" do vocab vira DEFINIÇÃO no mesmo idioma, não tradução
    expect(enEn).toContain('definition/synonym of the word — SAME language')
  })
})

describe('buildSystemPrompt — idioma nativo (i18n da saída do tutor)', () => {
  it('default = português brasileiro', () => {
    expect(buildSystemPrompt('zh')).toContain('Brazilian Portuguese speaker')
  })
  it('native ja → traduz para japonês', () => {
    const p = buildSystemPrompt('en', 'ja')
    expect(p).toContain('Japanese speaker')
    expect(p).toContain('into Japanese')
  })
  it('native en → traduz para inglês e OMITE o englishText extra', () => {
    const p = buildSystemPrompt('zh', 'en')
    expect(p).toContain('English speaker')
    expect(p).toContain('into English')
    expect(p).not.toContain('"englishText"')
  })
  it('aceita region code (pt-BR)', () => {
    expect(buildSystemPrompt('ja', 'pt-BR')).toContain('Brazilian Portuguese')
  })
  it('lookup e decompose também respeitam o nativo', () => {
    expect(buildLookupPrompt('猫', '猫が好き', 'ja', 'en')).toMatch(/meaning in English/)
    expect(buildDecomposePrompt('好', 'zh', 'ja')).toContain('Japanese speaker')
  })
  it('variations respeita o nativo', () => {
    expect(buildVariationsPrompt('hi', 'en', 'ja')).toContain('Japanese speaker')
  })
})

describe('buildVariationsPrompt', () => {
  it('includes the sentence and language code', () => {
    const p = buildVariationsPrompt('How are you?', 'en')
    expect(p).toContain('How are you?')
    expect(p).toContain('"en"')
  })
  it('asks for a variations JSON array with text + translation', () => {
    const p = buildVariationsPrompt('Olá', 'pt')
    expect(p).toContain('"variations"')
    expect(p).toContain('"text"')
    expect(p).toContain('"translation"')
  })
  it('requests 2-3 natural variations', () => {
    expect(buildVariationsPrompt('hi', 'en')).toMatch(/2-3 variations/)
  })
})

describe('resolveRomanization — base-language fallback', () => {
  it('matches exact codes', () => {
    expect(resolveRomanization('zh')?.label).toBe('Pinyin')
    expect(resolveRomanization('zh-CN')?.label).toBe('Pinyin')
    expect(resolveRomanization('ja')?.label).toBe('Romaji')
  })

  it('falls back to base language for unlisted variants (zh-Hans → zh)', () => {
    expect(resolveRomanization('zh-Hans')?.label).toBe('Pinyin')
    expect(resolveRomanization('zh-Hant')?.label).toBe('Pinyin')
  })

  it('returns undefined for languages with no romanization (en, pt)', () => {
    expect(resolveRomanization('en')).toBeUndefined()
    expect(resolveRomanization('pt')).toBeUndefined()
  })
})

describe('buildSystemPrompt — romanization survives language variants', () => {
  it('still requests Pinyin when language is zh-Hans/zh-Hant', () => {
    expect(buildSystemPrompt('zh-Hans')).toContain('"romanization"')
    expect(buildSystemPrompt('zh-Hans')).toContain('Pinyin')
    expect(buildSystemPrompt('zh-Hant')).toContain('Pinyin')
  })

  it('marks romanization as MANDATORY for Asian languages', () => {
    expect(buildSystemPrompt('zh')).toContain('MANDATORY')
    expect(buildSystemPrompt('ja')).toContain('MANDATORY')
  })
})

describe('isEnglishLang', () => {
  it('is true for "en" and en-* variants', () => {
    expect(isEnglishLang('en')).toBe(true)
    expect(isEnglishLang('en-US')).toBe(true)
    expect(isEnglishLang('en-GB')).toBe(true)
  })

  it('is false for non-English languages', () => {
    expect(isEnglishLang('zh')).toBe(false)
    expect(isEnglishLang('ja')).toBe(false)
    expect(isEnglishLang('pt')).toBe(false)
    expect(isEnglishLang('')).toBe(false)
  })
})

describe('buildSystemPrompt — englishText field', () => {
  it('OMITS englishText for English content', () => {
    const p = buildSystemPrompt('en')
    expect(p).not.toContain('englishText')
    expect(p).not.toContain('fluent English translation')
  })

  it('OMITS englishText for en-US', () => {
    expect(buildSystemPrompt('en-US')).not.toContain('englishText')
  })

  it('INCLUDES englishText for Chinese', () => {
    const p = buildSystemPrompt('zh')
    expect(p).toContain('"englishText"')
    expect(p).toContain('fluent English translation')
  })

  it('INCLUDES englishText for Japanese, Korean, Portuguese', () => {
    for (const lang of ['ja', 'ko', 'pt']) {
      expect(buildSystemPrompt(lang)).toContain('"englishText"')
    }
  })
})

describe('isJapaneseLang', () => {
  it('is true for "ja" and ja-* variants', () => {
    expect(isJapaneseLang('ja')).toBe(true)
    expect(isJapaneseLang('ja-JP')).toBe(true)
  })
  it('is false for other languages', () => {
    expect(isJapaneseLang('zh')).toBe(false)
    expect(isJapaneseLang('ko')).toBe(false)
    expect(isJapaneseLang('en')).toBe(false)
    expect(isJapaneseLang('')).toBe(false)
  })
})

describe('buildSystemPrompt — reading field (furigana, só japonês)', () => {
  it('INCLUI o campo reading (hiragana) para japonês', () => {
    const p = buildSystemPrompt('ja')
    expect(p).toContain('"reading"')
    expect(p).toContain('HIRAGANA')
  })
  it('inclui reading para ja-JP', () => {
    expect(buildSystemPrompt('ja-JP')).toContain('"reading"')
  })
  it('OMITE reading para idiomas não-japoneses', () => {
    for (const lang of ['zh', 'ko', 'en', 'pt', 'th']) {
      expect(buildSystemPrompt(lang)).not.toContain('"reading"')
    }
  })
  it('marca reading como MANDATORY para japonês', () => {
    const p = buildSystemPrompt('ja')
    expect(p).toMatch(/reading: MANDATORY/)
  })
})

describe('buildLookupPrompt — acento tonal (japonês)', () => {
  it('pede reading (hiragana) e pitchAccent para japonês', () => {
    const p = buildLookupPrompt('箸', '箸を使う', 'ja')
    expect(p).toContain('"reading"')
    expect(p).toContain('"pitchAccent"')
    expect(p).toContain('HIRAGANA')
    expect(p).toMatch(/heiban/i)
  })
  it('NÃO pede pitchAccent para outros idiomas', () => {
    for (const lang of ['zh', 'ko', 'en']) {
      expect(buildLookupPrompt('x', 'y', lang)).not.toContain('"pitchAccent"')
    }
  })
  it('ainda inclui o nome da palavra e o contexto', () => {
    const p = buildLookupPrompt('猫', '猫が好き', 'ja')
    expect(p).toContain('猫')
    expect(p).toContain('猫が好き')
  })
})

describe('buildDecomposePrompt — decomposição de caracteres', () => {
  it('inclui o caractere e pede componentes/mnemônico em JSON', () => {
    const p = buildDecomposePrompt('好', 'zh')
    expect(p).toContain('好')
    expect(p).toContain('"components"')
    expect(p).toContain('"mnemonic"')
    expect(p).toContain('"strokes"')
  })
  it('usa o sistema de romanização do idioma (pinyin p/ zh)', () => {
    expect(buildDecomposePrompt('好', 'zh')).toContain('Pinyin')
    expect(buildDecomposePrompt('好', 'ja')).toContain('Romaji')
  })
  it('pede resposta só em JSON', () => {
    expect(buildDecomposePrompt('愛', 'ja')).toMatch(/raw JSON/)
  })
})

describe('buildSystemPrompt — romanization field', () => {
  it('includes Pinyin instruction for Chinese', () => {
    const p = buildSystemPrompt('zh')
    expect(p).toContain('"romanization"')
    expect(p).toContain('Pinyin')
  })

  it('includes Romaji instruction for Japanese', () => {
    expect(buildSystemPrompt('ja')).toContain('Hepburn Romaji')
  })

  it('includes Korean romanization instruction', () => {
    expect(buildSystemPrompt('ko')).toContain('Revised Romanization of Korean')
  })

  it('OMITS romanization for languages without a system (en, pt, es)', () => {
    for (const lang of ['en', 'pt', 'es', 'fr', 'de', 'it']) {
      expect(buildSystemPrompt(lang)).not.toContain('"romanization"')
    }
  })
})

describe('buildSystemPrompt — invariants', () => {
  it('always requests vocab and tip', () => {
    for (const lang of ['en', 'zh', 'ja', 'pt']) {
      const p = buildSystemPrompt(lang)
      expect(p).toContain('"vocab"')
      expect(p).toContain('"tip"')
    }
  })

  it('por padrão fala com um nativo de português brasileiro', () => {
    expect(buildSystemPrompt('zh')).toContain('Brazilian Portuguese speaker')
  })

  it('mentions the detected language code in the note when romanized', () => {
    expect(buildSystemPrompt('zh')).toContain('language code "zh"')
  })

  it('produces no double-blank artifacts that would break JSON intent', () => {
    // The prompt should never contain an empty "" field key from missing interpolation
    const p = buildSystemPrompt('en')
    expect(p).not.toMatch(/^\s*,\s*$/m)
  })
})

describe('ROMANIZATION_SYSTEM coverage', () => {
  it('covers the main Asian + transliterated languages', () => {
    for (const lang of ['zh', 'ja', 'ko', 'th', 'ar', 'ru', 'hi']) {
      expect(ROMANIZATION_SYSTEM[lang]).toBeDefined()
      expect(ROMANIZATION_SYSTEM[lang].instruction.length).toBeGreaterThan(0)
    }
  })

  it('has no entry for English (English needs no romanization)', () => {
    expect(ROMANIZATION_SYSTEM['en']).toBeUndefined()
  })
})
