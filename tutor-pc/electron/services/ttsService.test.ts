import { describe, it, expect } from 'vitest'
import { resolveVoice, VOICE_MAP, DEFAULT_VOICE } from '../lib/ttsVoices'

// ── resolveVoice ──────────────────────────────────────────────────────────────

describe('resolveVoice', () => {
  describe('exact language code matches', () => {
    it.each([
      ['zh',    'zh-CN-XiaoyiNeural'],
      ['zh-CN', 'zh-CN-XiaoyiNeural'],
      ['zh-TW', 'zh-TW-HsiaoChenNeural'],
      ['ja',    'ja-JP-NanamiNeural'],
      ['ko',    'ko-KR-SunHiNeural'],
      ['th',    'th-TH-PremwadeeNeural'],
      ['ar',    'ar-EG-SalmaNeural'],
      ['hi',    'hi-IN-SwaraNeural'],
      ['ru',    'ru-RU-SvetlanaNeural'],
      ['en',    'en-US-AriaNeural'],
      ['pt',    'pt-BR-ThalitaNeural'],
      ['pt-BR', 'pt-BR-ThalitaNeural'],
      ['es',    'es-ES-XimenaNeural'],
      ['fr',    'fr-FR-EloiseNeural'],
      ['de',    'de-DE-AmalaNeural'],
      ['it',    'it-IT-IsabellaNeural'],
    ])('resolves %s → %s', (lang, expected) => {
      expect(resolveVoice(lang)).toBe(expected)
    })
  })

  describe('base-language fallback (BCP-47 region stripping)', () => {
    it('resolves en-GB → en-US-AriaNeural via base "en"', () => {
      expect(resolveVoice('en-GB')).toBe('en-US-AriaNeural')
    })

    it('resolves es-MX → es-ES-XimenaNeural via base "es"', () => {
      expect(resolveVoice('es-MX')).toBe('es-ES-XimenaNeural')
    })

    it('resolves fr-CA → fr-FR-EloiseNeural via base "fr"', () => {
      expect(resolveVoice('fr-CA')).toBe('fr-FR-EloiseNeural')
    })

    it('resolves pt-PT → pt-BR-ThalitaNeural via base "pt"', () => {
      expect(resolveVoice('pt-PT')).toBe('pt-BR-ThalitaNeural')
    })

    it('resolves de-AT → de-DE-AmalaNeural via base "de"', () => {
      expect(resolveVoice('de-AT')).toBe('de-DE-AmalaNeural')
    })
  })

  describe('unknown language falls back to default', () => {
    it('returns default voice for completely unknown code', () => {
      expect(resolveVoice('xx')).toBe(DEFAULT_VOICE)
    })

    it('returns default voice for empty string', () => {
      expect(resolveVoice('')).toBe(DEFAULT_VOICE)
    })

    it('returns default voice for unknown BCP-47 with unknown base', () => {
      expect(resolveVoice('xx-YY')).toBe(DEFAULT_VOICE)
    })

    it('default voice is English Aria', () => {
      expect(DEFAULT_VOICE).toBe('en-US-AriaNeural')
    })
  })

  describe('voice map completeness', () => {
    it('all mapped voices follow the {lang}-{region}-{Name}Neural format', () => {
      for (const [, voice] of Object.entries(VOICE_MAP)) {
        expect(voice).toMatch(/^[a-z]{2}-[A-Z]{2}-\w+Neural$/)
      }
    })

    it('covers all major Asian languages', () => {
      const asian = ['zh', 'zh-CN', 'zh-TW', 'ja', 'ko', 'th', 'ar', 'hi']
      for (const lang of asian) {
        expect(resolveVoice(lang)).not.toBe(DEFAULT_VOICE)
      }
    })

    it('covers all major European languages with explicit voice entries', () => {
      const european = ['en', 'pt', 'es', 'fr', 'de', 'it', 'ru']
      for (const lang of european) {
        // Each language must have an explicit entry in VOICE_MAP (not just the fallback path)
        expect(VOICE_MAP).toHaveProperty(lang)
      }
    })
  })
})
