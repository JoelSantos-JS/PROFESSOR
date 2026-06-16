import { describe, it, expect } from 'vitest'
import { pinyinSandhi, hasPinyinSandhi, toneOf, stripTone, setTone } from './pinyinSandhi'

describe('toneOf', () => {
  it('reads the tone from the marked vowel', () => {
    expect(toneOf('nǐ')).toBe(3)
    expect(toneOf('hǎo')).toBe(3)
    expect(toneOf('mā')).toBe(1)
    expect(toneOf('má')).toBe(2)
    expect(toneOf('mà')).toBe(4)
  })
  it('returns 0 for neutral / no mark', () => {
    expect(toneOf('ma')).toBe(0)
    expect(toneOf('de')).toBe(0)
  })
})

describe('stripTone / setTone', () => {
  it('strips marks to base vowels', () => {
    expect(stripTone('nǐ')).toBe('ni')
    expect(stripTone('hǎo')).toBe('hao')
    expect(stripTone('lǜ')).toBe('lü')
  })
  it('places the mark on the right vowel (a/e first, ou→o, else last)', () => {
    expect(setTone('hao', 3)).toBe('hǎo')   // a wins
    expect(setTone('hao', 2)).toBe('háo')
    expect(setTone('gou', 3)).toBe('gǒu')   // ou → o
    expect(setTone('hui', 2)).toBe('huí')   // last vowel
    expect(setTone('ni', 2)).toBe('ní')
    expect(setTone('lü', 4)).toBe('lǜ')
  })
})

describe('pinyinSandhi — third-tone sandhi', () => {
  it('the classic: nǐ hǎo → ní hǎo', () => {
    expect(pinyinSandhi('nǐ hǎo')).toBe('ní hǎo')
  })

  it('two 3rd tones: only the first changes', () => {
    expect(pinyinSandhi('hěn hǎo')).toBe('hén hǎo')
    expect(pinyinSandhi('wǒ hǎo')).toBe('wó hǎo')
  })

  it('a run of three 3rd tones: all but the last become 2nd', () => {
    expect(pinyinSandhi('wǒ hěn hǎo')).toBe('wó hén hǎo')
  })

  it('does NOT change a 3rd tone before a non-3rd tone', () => {
    expect(pinyinSandhi('hǎo de')).toBe('hǎo de')      // before neutral
    expect(pinyinSandhi('nǐ máng')).toBe('nǐ máng')    // before 2nd
    expect(pinyinSandhi('hǎo kàn')).toBe('hǎo kàn')    // before 4th
  })

  it('only the LAST in a run stays 3rd; isolated 3rd tones are untouched', () => {
    expect(pinyinSandhi('hǎo')).toBe('hǎo')
    expect(pinyinSandhi('mǎi shū')).toBe('mǎi shū')    // 3rd then 1st → no change
  })

  it('resets the run at punctuation (a pause)', () => {
    // "nǐ hǎo, wǒ hǎo" → two separate runs, each: first→2nd, last stays 3rd
    expect(pinyinSandhi('nǐ hǎo, wǒ hǎo')).toBe('ní hǎo, wó hǎo')
  })

  it('handles a longer run across a comma correctly', () => {
    expect(pinyinSandhi('wǒ hěn hǎo, nǐ ne')).toBe('wó hén hǎo, nǐ ne')
  })

  it('leaves non-3rd sequences untouched', () => {
    expect(pinyinSandhi('wǒ shì lǎoshī')).toBe('wǒ shì lǎoshī') // 3,4,3+1 → no adjacent 3-3
    expect(pinyinSandhi('xièxie nǐ')).toBe('xièxie nǐ')
  })

  it('preserves spacing, punctuation and non-pinyin text', () => {
    expect(pinyinSandhi('nǐ hǎo!')).toBe('ní hǎo!')
    expect(pinyinSandhi('  nǐ   hǎo  ')).toBe('  ní   hǎo  ')
  })

  it('is idempotent (applying twice = applying once)', () => {
    const once = pinyinSandhi('wǒ hěn hǎo')
    expect(pinyinSandhi(once)).toBe(once)
  })

  it('handles empty / no-pinyin input', () => {
    expect(pinyinSandhi('')).toBe('')
    expect(pinyinSandhi('...')).toBe('...')
  })
})

describe('pinyinSandhi — 不 (bù) sandhi (com Hanzi)', () => {
  it('不 → 2º tom antes de 4º tom: 不是 bù shì → bú shì', () => {
    expect(pinyinSandhi('bù shì', '不是')).toBe('bú shì')
  })
  it('不 permanece 4º antes de não-4º: 不好 bù hǎo (好=3º) fica bù hǎo', () => {
    expect(pinyinSandhi('bù hǎo', '不好')).toBe('bù hǎo')
  })
  it('不 permanece 4º antes de 1º: 不大 bù dà... (dà=4º vira 2º; usar 不吃 bù chī, chī=1º)', () => {
    expect(pinyinSandhi('bù chī', '不吃')).toBe('bù chī')
  })
  it('不 isolado (sem próxima) fica 4º', () => {
    expect(pinyinSandhi('bù', '不')).toBe('bù')
  })
  it('NÃO aplica 不 sem o Hanzi (não dá pra distinguir 不 de 步)', () => {
    expect(pinyinSandhi('bù shì')).toBe('bù shì')   // sem hanzi → inalterado
  })
  it('não confunde 步 (também bù) com 不: 散步是 sàn bù shì fica igual', () => {
    expect(pinyinSandhi('sàn bù shì', '散步是')).toBe('sàn bù shì')  // 步 não muda
  })
})

describe('pinyinSandhi — 一 (yī) sandhi (com Hanzi)', () => {
  it('一 → 4º antes de 1º/2º/3º: 一天 yī tiān → yì tiān', () => {
    expect(pinyinSandhi('yī tiān', '一天')).toBe('yì tiān')
  })
  it('一 → 2º antes de 4º: 一个 yī gè → yí gè', () => {
    expect(pinyinSandhi('yī gè', '一个')).toBe('yí gè')
  })
  it('一 → 4º antes de 3º: 一起 yī qǐ → yì qǐ', () => {
    expect(pinyinSandhi('yī qǐ', '一起')).toBe('yì qǐ')
  })
  it('一 isolado/ordinal (sem próxima) fica 1º: 第一 dì yī → dì yī', () => {
    expect(pinyinSandhi('dì yī', '第一')).toBe('dì yī')
  })
})

describe('pinyinSandhi — 不/一 combinam com sandhi do 3º tom', () => {
  it('不 4º + sequência de 3º: 不好好 bù hǎo hǎo → bù háo hǎo', () => {
    expect(pinyinSandhi('bù hǎo hǎo', '不好好')).toBe('bù háo hǎo')
  })
  it('fallback seguro: contagem Hanzi≠Pinyin → só 3º tom', () => {
    // pinyin tem 2 sílabas, hanzi tem 3 chars → não alinha; só 3º-tom sandhi
    expect(pinyinSandhi('nǐ hǎo', '你好吗')).toBe('ní hǎo')
  })
})

describe('hasPinyinSandhi', () => {
  it('true when something changes', () => {
    expect(hasPinyinSandhi('nǐ hǎo')).toBe(true)
    expect(hasPinyinSandhi('wǒ hěn hǎo')).toBe(true)
  })
  it('false when nothing changes', () => {
    expect(hasPinyinSandhi('hǎo')).toBe(false)
    expect(hasPinyinSandhi('wǒ shì lǎoshī')).toBe(false)
    expect(hasPinyinSandhi('')).toBe(false)
  })
})
