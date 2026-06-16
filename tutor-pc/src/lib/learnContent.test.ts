import { describe, it, expect } from 'vitest'
import { learnContentFor } from './learnContent'

describe('learnContentFor', () => {
  it('coreano: Hangul + Billy Korean', () => {
    const c = learnContentFor('ko')
    expect(c.writing?.system).toMatch(/Hangul/)
    expect(c.channels.some(ch => /Billy/.test(ch.name))).toBe(true)
  })
  it('japonês: Kana + Comprehensible Japanese', () => {
    const c = learnContentFor('ja')
    expect(c.writing?.system).toMatch(/Kana/)
    expect(c.channels.some(ch => /Comprehensible Japanese/.test(ch.name))).toBe(true)
  })
  it('chinês: Pinyin + Tons + Lazy Chinese', () => {
    const c = learnContentFor('zh')
    expect(c.writing?.system).toMatch(/Pinyin/)
    expect(c.writing?.system).toMatch(/TONS/)
    expect(c.channels.some(ch => /Lazy Chinese/.test(ch.name))).toBe(true)
  })
  it('normaliza variantes regionais (zh-CN → zh)', () => {
    expect(learnContentFor('zh-CN').writing?.system).toBe(learnContentFor('zh').writing?.system)
    expect(learnContentFor('ja-JP').writing?.system).toMatch(/Kana/)
  })
  it('fallback sem primer de escrita, mas com a wiki', () => {
    const c = learnContentFor('en')
    expect(c.writing).toBeUndefined()
    expect(c.channels.length).toBeGreaterThan(0)
  })
  it('todos os canais têm url http', () => {
    for (const lang of ['ko', 'ja', 'zh', 'en']) {
      for (const ch of learnContentFor(lang).channels) {
        expect(ch.url).toMatch(/^https?:\/\//)
      }
    }
  })

  it('localiza o conteúdo em inglês (uiLang="en")', () => {
    const ko = learnContentFor('ko', 'en')
    expect(ko.writing?.summary).toMatch(/weekend/i)
    expect(ko.writing?.bullets.join(' ')).toMatch(/Learn Hangul BEFORE/i)
    expect(ko.channels.some(ch => ch.note === 'from zero to intermediate')).toBe(true)
    // a wiki também traduz a nota
    expect(learnContentFor('en', 'en').channels[0].note).toMatch(/content lists/i)
    // zh: "TONES" em vez de "TONS"
    expect(learnContentFor('zh', 'en').writing?.system).toMatch(/TONES/)
  })
})
