import { describe, it, expect } from 'vitest'
import { pronunciationProfile, wordDrillItems, type MistakeWord } from './pronunciationProfile'

const mw = (word: string, count: number): MistakeWord => ({ word, count })

describe('top (universal)', () => {
  it('ordena por frequência e limita', () => {
    const p = pronunciationProfile('en', [mw('a', 1), mw('b', 5), mw('c', 3)], 2)
    expect(p.top.map(t => t.word)).toEqual(['b', 'c'])
    expect(p.total).toBe(3)
  })
  it('desempata por palavra (determinístico)', () => {
    const p = pronunciationProfile('en', [mw('zebra', 2), mw('apple', 2)])
    expect(p.top[0].word).toBe('apple')
  })
  it('entrada vazia/inválida → zerado', () => {
    expect(pronunciationProfile('en', [])).toEqual({ total: 0, top: [], groups: [] })
    expect(pronunciationProfile('ko', [mw('  ', 3)]).total).toBe(0)
  })
})

describe('coreano — batchim (som representativo)', () => {
  it('한국어 entra nos baldes ㄴ e ㄱ', () => {
    const p = pronunciationProfile('ko', [mw('한국어', 2)])
    const keys = p.groups.map(g => g.key)
    expect(keys).toContain('batchim-ㄴ')   // 한 → ㄴ
    expect(keys).toContain('batchim-ㄱ')   // 국 → ㄱ
  })
  it('neutraliza para o som representativo (좋 ㅎ → ㄷ, 앞 ㅍ → ㅂ)', () => {
    const p = pronunciationProfile('ko', [mw('좋', 1), mw('앞', 1)])
    const keys = p.groups.map(g => g.key)
    expect(keys).toContain('batchim-ㄷ')   // ㅎ → ㄷ
    expect(keys).toContain('batchim-ㅂ')   // ㅍ → ㅂ
  })
  it('sílaba sem batchim não gera grupo', () => {
    expect(pronunciationProfile('ko', [mw('가', 1)]).groups).toEqual([])
  })
  it('soma a contagem e agrupa palavras', () => {
    const p = pronunciationProfile('ko', [mw('발', 2), mw('물', 3)])  // ambos batchim ㄹ
    const g = p.groups.find(x => x.key === 'batchim-ㄹ')!
    expect(g.count).toBe(5)
    expect(g.words.sort()).toEqual(['물', '발'])
  })
})

describe('japonês — mora', () => {
  it('detecta vogal longa, sokuon e contraído', () => {
    const p = pronunciationProfile('ja', [mw('コーヒー', 1), mw('がっこう', 1), mw('きょう', 1)])
    const keys = p.groups.map(g => g.key)
    expect(keys).toContain('long')     // ー
    expect(keys).toContain('sokuon')   // っ
    expect(keys).toContain('youon')    // ょ
  })
  it('palavra sem traço não entra em grupo', () => {
    expect(pronunciationProfile('ja', [mw('ねこ', 1)]).groups).toEqual([])
  })
})

describe('inglês — th / r', () => {
  it('agrupa por th e r', () => {
    const p = pronunciationProfile('en', [mw('think', 2), mw('red', 1), mw('three', 1)])
    const th = p.groups.find(g => g.key === 'th')!
    const r = p.groups.find(g => g.key === 'r')!
    expect(th.words.sort()).toEqual(['think', 'three'])
    expect(r.words.sort()).toEqual(['red', 'three'])
  })
})

describe('chinês e outros — sem grupos (só top)', () => {
  it('zh não agrupa (tons precisam de pinyin)', () => {
    const p = pronunciationProfile('zh', [mw('你好', 3), mw('谢谢', 1)])
    expect(p.groups).toEqual([])
    expect(p.top.map(t => t.word)).toEqual(['你好', '谢谢'])
  })
  it('normaliza variantes (ko-KR usa as regras do coreano)', () => {
    expect(pronunciationProfile('ko-KR', [mw('한', 1)]).groups[0].key).toBe('batchim-ㄴ')
  })
})

describe('wordDrillItems — palavras fracas → itens de treino', () => {
  it('cada palavra vira um item com o texto preservado', () => {
    const items = wordDrillItems('en', ['red', 'think'])
    expect(items.map(i => i.text)).toEqual(['red', 'think'])
  })
  it('foco = traço fonético quando dá pra derivar (en th/r)', () => {
    const [r, th] = wordDrillItems('en', ['red', 'think'])
    expect(r.focus).toMatch(/Som “r”/)
    expect(th.focus).toMatch(/Som “th”/)
  })
  it('junta múltiplos traços (three = th · r)', () => {
    expect(wordDrillItems('en', ['three'])[0].focus).toBe('Som “th” · Som “r”')
  })
  it('coreano usa o batchim como foco', () => {
    expect(wordDrillItems('ko', ['발'])[0].focus).toMatch(/Batchim ㄹ/)
  })
  it('sem traço derivável → foco padrão honesto', () => {
    expect(wordDrillItems('zh', ['你好'])[0].focus).toBe('pronúncia da palavra')
    expect(wordDrillItems('en', ['was'])[0].focus).toBe('pronúncia da palavra')
  })
  it('ignora vazios e remove duplicatas (preservando a ordem)', () => {
    expect(wordDrillItems('en', ['red', '  ', 'red', 'blue']).map(i => i.text)).toEqual(['red', 'blue'])
    expect(wordDrillItems('en', null as unknown as string[])).toEqual([])
  })
})
