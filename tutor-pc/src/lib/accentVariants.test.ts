import { describe, expect, it } from 'vitest'
import { accentVariantsFor } from './accentVariants'

describe('accentVariantsFor', () => {
  it('inglês → US, UK, AU', () => {
    const v = accentVariantsFor('en')
    expect(v.map(x => x.label)).toEqual(['US', 'UK', 'AU'])
  })

  it('aceita BCP-47 (en-US) e usa a base do idioma', () => {
    expect(accentVariantsFor('en-GB').map(x => x.id)).toEqual(['en-US', 'en-GB', 'en-AU'])
  })

  it('português → BR e PT', () => {
    expect(accentVariantsFor('pt').map(x => x.label)).toEqual(['BR', 'PT'])
  })

  it('idioma sem variação relevante → []', () => {
    expect(accentVariantsFor('ja')).toEqual([])
    expect(accentVariantsFor('ko')).toEqual([])
  })

  it('idioma vazio/desconhecido → []', () => {
    expect(accentVariantsFor('')).toEqual([])
    expect(accentVariantsFor('xx')).toEqual([])
  })

  it('toda variante tem id, label, flag e voice preenchidos', () => {
    for (const lang of ['en', 'pt', 'es', 'fr', 'de', 'zh']) {
      for (const v of accentVariantsFor(lang)) {
        expect(v.id).toBeTruthy()
        expect(v.label).toBeTruthy()
        expect(v.flag).toBeTruthy()
        expect(v.voice).toMatch(/Neural$/)  // vozes Edge TTS válidas
      }
    }
  })
})
