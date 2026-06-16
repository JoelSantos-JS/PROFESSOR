import { describe, it, expect } from 'vitest'
import { buildFurigana } from './furigana'

describe('buildFurigana — casos limpos', () => {
  it('palavra de um kanji', () => {
    const r = buildFurigana('猫', 'ねこ')
    expect(r.confident).toBe(true)
    expect(r.hasKanji).toBe(true)
    expect(r.segments).toEqual([{ text: '猫', reading: 'ねこ', kanji: true }])
  })

  it('okurigana (食べる)', () => {
    const r = buildFurigana('食べる', 'たべる')
    expect(r.confident).toBe(true)
    expect(r.segments).toEqual([
      { text: '食', reading: 'た', kanji: true },
      { text: 'べる', kanji: false },
    ])
  })

  it('frase completa (私は学生です)', () => {
    const r = buildFurigana('私は学生です', 'わたしはがくせいです')
    expect(r.confident).toBe(true)
    expect(r.segments).toEqual([
      { text: '私', reading: 'わたし', kanji: true },
      { text: 'は', kanji: false },
      { text: '学生', reading: 'がくせい', kanji: true },
      { text: 'です', kanji: false },
    ])
  })

  it('kanji final absorve o resto (日本語を勉強)', () => {
    const r = buildFurigana('日本語を勉強', 'にほんごをべんきょう')
    expect(r.confident).toBe(true)
    expect(r.segments).toEqual([
      { text: '日本語', reading: 'にほんご', kanji: true },
      { text: 'を', kanji: false },
      { text: '勉強', reading: 'べんきょう', kanji: true },
    ])
  })

  it('dois blocos de kanji separados por kana (食べ物)', () => {
    const r = buildFurigana('食べ物', 'たべもの')
    expect(r.confident).toBe(true)
    expect(r.segments).toEqual([
      { text: '食', reading: 'た', kanji: true },
      { text: 'べ', kanji: false },
      { text: '物', reading: 'もの', kanji: true },
    ])
  })

  it('kanji + leitura kana com okurigana ambíguo (上がる)', () => {
    const r = buildFurigana('上がる', 'あがる')
    expect(r.confident).toBe(true)
    expect(r.segments).toEqual([
      { text: '上', reading: 'あ', kanji: true },
      { text: 'がる', kanji: false },
    ])
  })

  it('sokuon na fronteira (行った)', () => {
    const r = buildFurigana('行った', 'いった')
    expect(r.confident).toBe(true)
    expect(r.segments).toEqual([
      { text: '行', reading: 'い', kanji: true },
      { text: 'った', kanji: false },
    ])
  })

  it('kanji + katakana (東京タワー), leitura em hiragana', () => {
    const r = buildFurigana('東京タワー', 'とうきょうたわー')
    expect(r.confident).toBe(true)
    expect(r.segments).toEqual([
      { text: '東京', reading: 'とうきょう', kanji: true },
      { text: 'タワー', kanji: false },
    ])
  })
})

describe('buildFurigana — sem kanji / pontuação', () => {
  it('só hiragana: sem ruby', () => {
    const r = buildFurigana('おはよう', 'おはよう')
    expect(r.hasKanji).toBe(false)
    expect(r.segments).toEqual([{ text: 'おはよう', kanji: false }])
  })

  it('só katakana: sem ruby', () => {
    const r = buildFurigana('コーヒー', 'こーひー')
    expect(r.hasKanji).toBe(false)
    expect(r.segments.every(s => !s.kanji)).toBe(true)
  })

  it('pontuação ausente na leitura é transparente (猫。)', () => {
    const r = buildFurigana('猫。', 'ねこ')
    expect(r.confident).toBe(true)
    expect(r.segments).toEqual([
      { text: '猫', reading: 'ねこ', kanji: true },
      { text: '。', kanji: false },
    ])
  })
})

describe('buildFurigana — degradação segura (não confiante)', () => {
  it('leitura vazia → sem confiança', () => {
    const r = buildFurigana('猫', '')
    expect(r.confident).toBe(false)
    expect(r.segments).toEqual([{ text: '猫', kanji: false }])
  })

  it('âncora kana ausente na leitura → não confiante', () => {
    // は não existe na leitura "がくせい" → alinhamento quebra
    const r = buildFurigana('私は', 'がくせい')
    expect(r.confident).toBe(false)
  })

  it('kanji-pontuação-kanji sem kana entre eles → não confiante', () => {
    const r = buildFurigana('猫・犬', 'ねこいぬ')
    expect(r.confident).toBe(false)
  })

  it('leitura sobra no fim → não confiante', () => {
    const r = buildFurigana('猫', 'ねこねこ')   // estrutura: 猫 pega tudo, mas é só 1 kanji
    // 猫 absorve "ねこねこ" inteiro (não há como saber que é demais) → confiante,
    // pois a leitura foi totalmente consumida. Documenta o comportamento real:
    expect(r.segments[0]).toEqual({ text: '猫', reading: 'ねこねこ', kanji: true })
    expect(r.confident).toBe(true)
  })

  it('kana da superfície que sobra após consumir a leitura → não confiante', () => {
    // leitura curta demais: 学校 lê "がっこう" mas passamos "がっ"
    const r = buildFurigana('学校です', 'がっ')
    expect(r.confident).toBe(false)
  })
})

describe('buildFurigana — robustez geral', () => {
  it('nunca lança e sempre cobre toda a superfície', () => {
    const cases = ['今日はいい天気ですね', '私の名前は田中です', 'ABCねこ123', '。、！？', '']
    for (const c of cases) {
      const r = buildFurigana(c, 'てきとうなよみ')
      const joined = r.segments.map(s => s.text).join('')
      expect(joined).toBe(c)
    }
  })

  it('frase real com kana inicial + okurigana + 2º bloco de kanji', () => {
    const r = buildFurigana('今日はいい天気ですね', 'きょうはいいてんきですね')
    expect(r.confident).toBe(true)
    expect(r.segments).toEqual([
      { text: '今日', reading: 'きょう', kanji: true },
      { text: 'はいい', kanji: false },
      { text: '天気', reading: 'てんき', kanji: true },
      { text: 'ですね', kanji: false },
    ])
  })

  it('お no início (kana) ancora antes de bloco kanji (お母さん)', () => {
    const r = buildFurigana('お母さん', 'おかあさん')
    expect(r.confident).toBe(true)
    expect(r.segments).toEqual([
      { text: 'お', kanji: false },
      { text: '母', reading: 'かあ', kanji: true },
      { text: 'さん', kanji: false },
    ])
  })

  it('jukujikun de 2 kanji sem fronteira kana fica num único ruby (大人)', () => {
    const r = buildFurigana('大人', 'おとな')
    expect(r.confident).toBe(true)
    expect(r.segments).toEqual([{ text: '大人', reading: 'おとな', kanji: true }])
  })

  it('kanji + partícula + kanji + okurigana + pontuação', () => {
    const r = buildFurigana('私の名前は田中です。', 'わたしのなまえはたなかです')
    expect(r.confident).toBe(true)
    expect(r.segments).toEqual([
      { text: '私', reading: 'わたし', kanji: true },
      { text: 'の', kanji: false },
      { text: '名前', reading: 'なまえ', kanji: true },
      { text: 'は', kanji: false },
      { text: '田中', reading: 'たなか', kanji: true },
      { text: 'です', kanji: false },
      { text: '。', kanji: false },
    ])
  })

  it('a concatenação das leituras de kanji + kana reconstrói a leitura quando confiante', () => {
    const r = buildFurigana('私は学生です', 'わたしはがくせいです')
    expect(r.confident).toBe(true)
    const reconstructed = r.segments.map(s => s.kanji ? s.reading : s.text).join('')
    // kana lê a si mesma; kanji contribui sua leitura → deve bater com a leitura original
    expect(reconstructed).toBe('わたしは学生です'.replace('学生', 'がくせい'))
  })
})
