import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, isEnglishLang, resolveRomanization, ROMANIZATION_SYSTEM, buildVariationsPrompt } from './tutorPrompt'

describe('buildSystemPrompt — sentence translation field', () => {
  it('always requests a Portuguese translation of the whole sentence', () => {
    expect(buildSystemPrompt('en')).toContain('"translation"')
    expect(buildSystemPrompt('ko')).toContain('"translation"')
  })
  it('describes translation as Brazilian Portuguese of the whole transcript', () => {
    expect(buildSystemPrompt('en').toLowerCase()).toContain('portuguese translation of the whole transcript')
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

  it('always targets a Portuguese (Brazilian) speaker', () => {
    expect(buildSystemPrompt('zh')).toContain('Portuguese (Brazilian)')
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
