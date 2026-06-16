import { describe, it, expect } from 'vitest'
import { toneShape, numberedToMarks, marksToNumbered, syllableTones, toneColor, toneGlyphPath, TONE_COLORS } from './pinyinTone'

describe('toneShape', () => {
  it('has the right length per tone', () => {
    expect(toneShape(1)).toHaveLength(2)
    expect(toneShape(2)).toHaveLength(2)
    expect(toneShape(3)).toHaveLength(3)
    expect(toneShape(4)).toHaveLength(2)
    expect(toneShape(0)).toHaveLength(1)
    expect(toneShape(9)).toEqual([])
  })
  it('all values are within 0..1', () => {
    for (const t of [0, 1, 2, 3, 4]) {
      for (const v of toneShape(t)) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
    }
  })
  it('tone 1 is high and flat', () => {
    const s = toneShape(1)
    expect(s[0]).toBe(s[1])
    expect(s[0]).toBeGreaterThan(0.8)
  })
  it('tone 2 rises (ends higher than it starts)', () => {
    const s = toneShape(2)
    expect(s[s.length - 1]).toBeGreaterThan(s[0])
  })
  it('tone 3 dips (minimum in the middle)', () => {
    const s = toneShape(3)
    expect(Math.min(...s)).toBe(s[1])
    expect(s[2]).toBeGreaterThan(s[1])
  })
  it('tone 4 falls (ends lower than it starts)', () => {
    const s = toneShape(4)
    expect(s[s.length - 1]).toBeLessThan(s[0])
  })
})

describe('numberedToMarks', () => {
  it('places the mark by the rules (a/e first, ou→o, else last vowel)', () => {
    expect(numberedToMarks('ni3 hao3')).toBe('nǐ hǎo')
    expect(numberedToMarks('gou3')).toBe('gǒu')   // ou → o
    expect(numberedToMarks('hui2')).toBe('huí')   // last vowel
    expect(numberedToMarks('xue2')).toBe('xué')   // e wins
    expect(numberedToMarks('zhuang1')).toBe('zhuāng')
  })
  it('handles v/V as ü/Ü', () => {
    expect(numberedToMarks('lv3')).toBe('lǚ')
    expect(numberedToMarks('nv3')).toBe('nǚ')
  })
  it('neutral tone (5 or 0) → no mark', () => {
    expect(numberedToMarks('ma5')).toBe('ma')
    expect(numberedToMarks('de0')).toBe('de')
  })
  it('preserves capitalization', () => {
    expect(numberedToMarks('Ni3')).toBe('Nǐ')
    expect(numberedToMarks('Beijing')).toBe('Beijing') // sem dígitos → inalterado
  })
  it('leaves non-numbered text untouched', () => {
    expect(numberedToMarks('hello world')).toBe('hello world')
    expect(numberedToMarks('ni3, hao3!')).toBe('nǐ, hǎo!')
  })
  it('vowel-initial syllable capitalized at sentence start (Ān/Ér)', () => {
    expect(numberedToMarks('An1')).toBe('Ān')
    expect(numberedToMarks('Er2')).toBe('Ér')
    expect(numberedToMarks('Ou3')).toBe('Ǒu')
  })
  it('handles joined numbered syllables (digits delimit)', () => {
    expect(numberedToMarks('ni3hao3')).toBe('nǐhǎo')
  })
})

describe('marksToNumbered', () => {
  it('converts marks back to numbers', () => {
    expect(marksToNumbered('nǐ hǎo')).toBe('ni3 hao3')
    expect(marksToNumbered('gǒu')).toBe('gou3')
    expect(marksToNumbered('huí')).toBe('hui2')
  })
  it('neutral syllables get the chosen suffix', () => {
    expect(marksToNumbered('ma')).toBe('ma')          // default: nada
    expect(marksToNumbered('ma', '5')).toBe('ma5')
  })
  it('preserves spacing and punctuation', () => {
    expect(marksToNumbered('nǐ, hǎo!')).toBe('ni3, hao3!')
  })
  it('handles capitalized toned vowels (Ān → An1)', () => {
    expect(marksToNumbered('Ān')).toBe('An1')
    expect(marksToNumbered('Ér')).toBe('Er2')
    expect(marksToNumbered('Ǒu')).toBe('Ou3')
  })
})

describe('round-trip — numbered → marks → numbered (fuzz sobre sílabas reais × tons)', () => {
  const SYLLABLES = [
    'ma', 'mo', 'me', 'ya', 'wo', 'ni', 'hao', 'gou', 'hui', 'xue', 'lü', 'nü',
    'bei', 'jing', 'zhong', 'shang', 'xian', 'qing', 'er', 'an', 'yuan', 'jiu',
    'liu', 'dui', 'gui', 'hua', 'guo', 'zhuang', 'xiong', 'wo', 'he', 'shi', 'de',
  ]
  it('every syllable round-trips for tones 1-4', () => {
    for (const s of SYLLABLES) {
      for (let t = 1; t <= 4; t++) {
        const numbered = `${s}${t}`
        const back = marksToNumbered(numberedToMarks(numbered))
        expect(back, `falhou em ${numbered} → ${numberedToMarks(numbered)} → ${back}`).toBe(numbered)
      }
    }
  })
  it('whole spaced sentences round-trip', () => {
    const sentences = ['wo3 hen3 hao3', 'ni3 shi4 lao3 shi1', 'xie4 xie5 ni3', 'zhong1 guo2 ren2']
    for (const s of sentences) {
      const marks = numberedToMarks(s)
      // neutro round-trip precisa do sufixo 5
      expect(marksToNumbered(marks, '5')).toBe(s)
    }
  })
  it('marks → numbered → marks is stable for spaced syllables', () => {
    const marks = ['nǐ hǎo', 'wǒ hěn hǎo', 'lǎo shī', 'zhōng guó']
    for (const m of marks) {
      expect(numberedToMarks(marksToNumbered(m))).toBe(m)
    }
  })
})

describe('syllableTones', () => {
  it('reads the tone of each space-separated syllable', () => {
    expect(syllableTones('wǒ hěn hǎo')).toEqual([3, 3, 3])
    expect(syllableTones('nǐ máng')).toEqual([3, 2])
    expect(syllableTones('mā má mǎ mà ma')).toEqual([1, 2, 3, 4, 0])
  })
  it('empty input → []', () => {
    expect(syllableTones('')).toEqual([])
    expect(syllableTones('   ')).toEqual([])
  })
})

describe('toneColor', () => {
  it('gives a distinct color per tone', () => {
    const colors = [1, 2, 3, 4, 0].map(toneColor)
    expect(new Set(colors).size).toBe(5)  // todos diferentes
  })
  it('unknown tone falls back to neutral', () => {
    expect(toneColor(9)).toBe(TONE_COLORS[0])
  })
  it('every color is a hex string', () => {
    for (const t of [0, 1, 2, 3, 4]) expect(toneColor(t)).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })
})

describe('toneGlyphPath', () => {
  const W = 20, H = 10
  it('returns "" for an invalid tone', () => {
    expect(toneGlyphPath(9, W, H)).toBe('')
  })
  it('neutral (single point) draws a short horizontal dash', () => {
    const p = toneGlyphPath(0, W, H)
    expect(p).toMatch(/^M[\d.]+,[\d.]+ L[\d.]+,[\d.]+$/)
    // mesmo y nos dois pontos (horizontal)
    const ys = [...p.matchAll(/,([\d.]+)/g)].map(m => Number(m[1]))
    expect(ys[0]).toBe(ys[1])
  })
  it('tone 1 is a flat line at the TOP (high pitch → small y)', () => {
    const p = toneGlyphPath(1, W, H)
    const ys = [...p.matchAll(/,([\d.]+)/g)].map(m => Number(m[1]))
    expect(ys[0]).toBe(ys[1])      // plano
    expect(ys[0]).toBeLessThan(H / 2)  // perto do topo
  })
  it('tone 4 falls (first point higher than last → y increases)', () => {
    const ys = [...toneGlyphPath(4, W, H).matchAll(/,([\d.]+)/g)].map(m => Number(m[1]))
    expect(ys[ys.length - 1]).toBeGreaterThan(ys[0])  // desce (y aumenta)
  })
  it('tone 2 rises (last point higher → y decreases)', () => {
    const ys = [...toneGlyphPath(2, W, H).matchAll(/,([\d.]+)/g)].map(m => Number(m[1]))
    expect(ys[ys.length - 1]).toBeLessThan(ys[0])
  })
  it('tone 3 has 3 points and dips (max y in the middle)', () => {
    const ys = [...toneGlyphPath(3, W, H).matchAll(/,([\d.]+)/g)].map(m => Number(m[1]))
    expect(ys).toHaveLength(3)
    expect(Math.max(...ys)).toBe(ys[1])  // ponto mais baixo (maior y) no meio
  })
  it('x spans 0..W', () => {
    const xs = [...toneGlyphPath(4, W, H).matchAll(/[ML]([\d.]+),/g)].map(m => Number(m[1]))
    expect(xs[0]).toBe(0)
    expect(xs[xs.length - 1]).toBe(W)
  })
})
