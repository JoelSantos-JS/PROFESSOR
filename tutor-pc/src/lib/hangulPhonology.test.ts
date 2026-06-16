import { describe, it, expect } from 'vitest'
import { hangulSpoken, hasHangulSoundChange, decompose, compose, isSyllable } from './hangulPhonology'

describe('Hangul decompose/compose (Unicode)', () => {
  it('decomposes 한 into ㅎ+ㅏ+ㄴ', () => {
    const s = decompose('한'.codePointAt(0)!)
    expect(s).toEqual({ L: 18, V: 0, T: 4 }) // ㅎ, ㅏ, ㄴ
  })
  it('round-trips compose(decompose(x)) === x', () => {
    for (const ch of ['한', '국', '어', '좋', '학', '교', '같', '신', '라']) {
      expect(compose(decompose(ch.codePointAt(0)!))).toBe(ch)
    }
  })
  it('detects syllable vs non-syllable', () => {
    expect(isSyllable('한'.codePointAt(0)!)).toBe(true)
    expect(isSyllable('a'.codePointAt(0)!)).toBe(false)
    expect(isSyllable(' '.codePointAt(0)!)).toBe(false)
  })
})

describe('hangulSpoken — Linking (연음)', () => {
  it('한국어 → 한구거', () => {
    expect(hangulSpoken('한국어')).toBe('한구거')
  })
  it('음악 → 으막', () => {
    expect(hangulSpoken('음악')).toBe('으막')
  })
  it('한국어를 좋아해요-ish: 직업이 → 지거비', () => {
    expect(hangulSpoken('직업이')).toBe('지거비')
  })
  it('does NOT move a ㅇ batchim (강아지 stays)', () => {
    expect(hangulSpoken('강아지')).toBe('강아지')
  })
  it('complex batchim links the last jamo: 읽어 → 일거', () => {
    expect(hangulSpoken('읽어')).toBe('일거')
  })
})

describe('hangulSpoken — ㅎ (queda e aspiração)', () => {
  it('좋아 → 조아 (ㅎ cai antes de vogal)', () => {
    expect(hangulSpoken('좋아')).toBe('조아')
  })
  it('좋다 → 조타 (ㅎ + ㄷ → ㅌ)', () => {
    expect(hangulSpoken('좋다')).toBe('조타')
  })
  it('좋고 → 조코 (ㅎ + ㄱ → ㅋ)', () => {
    expect(hangulSpoken('좋고')).toBe('조코')
  })
  it('축하 → 추카 (ㄱ-som + ㅎ → ㅋ)', () => {
    expect(hangulSpoken('축하')).toBe('추카')
  })
  it('입학 → 이팍 (ㅂ + ㅎ → ㅍ)', () => {
    expect(hangulSpoken('입학')).toBe('이팍')
  })
})

describe('hangulSpoken — Palatalização (구개음화)', () => {
  it('같이 → 가치 (ㅌ + 이 → 치)', () => {
    expect(hangulSpoken('같이')).toBe('가치')
  })
  it('굳이 → 구지 (ㄷ + 이 → 지)', () => {
    expect(hangulSpoken('굳이')).toBe('구지')
  })
})

describe('hangulSpoken — Assimilação ㄹ (유음화)', () => {
  it('신라 → 실라 (ㄴ+ㄹ)', () => {
    expect(hangulSpoken('신라')).toBe('실라')
  })
  it('설날 → 설랄 (ㄹ+ㄴ)', () => {
    expect(hangulSpoken('설날')).toBe('설랄')
  })
})

describe('hangulSpoken — Nasalização (비음화)', () => {
  it('국물 → 궁물 (ㄱ + ㅁ → ㅇ)', () => {
    expect(hangulSpoken('국물')).toBe('궁물')
  })
  it('입니다 → 임니다 (ㅂ + ㄴ → ㅁ)', () => {
    expect(hangulSpoken('입니다')).toBe('임니다')
  })
  it('닫는 → 단는 (ㄷ + ㄴ → ㄴ)', () => {
    expect(hangulSpoken('닫는')).toBe('단는')
  })
})

describe('hangulSpoken — Tensão (경음화)', () => {
  it('학교 → 학꾜 (ㄱ + ㄱ → ㄲ)', () => {
    expect(hangulSpoken('학교')).toBe('학꾜')
  })
  it('먹다 → 먹따 (ㄱ + ㄷ → ㄸ)', () => {
    expect(hangulSpoken('먹다')).toBe('먹따')
  })
  it('입국 → 입꾹 (ㅂ + ㄱ → ㄲ)', () => {
    expect(hangulSpoken('입국')).toBe('입꾹')
  })
})

describe('hangulSpoken — neutralização do batchim (대표음)', () => {
  it('finais aspirados/complexos no fim viram o som representativo', () => {
    expect(hangulSpoken('부엌')).toBe('부억')   // ㅋ → ㄱ
    expect(hangulSpoken('옷')).toBe('옫')        // ㅅ → ㄷ
    expect(hangulSpoken('낮')).toBe('낟')        // ㅈ → ㄷ
    expect(hangulSpoken('꽃')).toBe('꼳')        // ㅊ → ㄷ
    expect(hangulSpoken('밖')).toBe('박')        // ㄲ → ㄱ
  })
  it('final complexo antes de consoante: 읽다 → 익따', () => {
    expect(hangulSpoken('읽다')).toBe('익따')     // ㄺ→ㄱ (som) + tensão ㄷ→ㄸ
  })
})

describe('hangulSpoken — invariância e bordas', () => {
  it('não muda quando não há batchim relevante', () => {
    expect(hangulSpoken('아버지')).toBe('아버지')
    expect(hangulSpoken('어머니')).toBe('어머니')
  })
  it('preserva espaços, pontuação e texto não-Hangul', () => {
    expect(hangulSpoken('한국어, 좋아!')).toBe('한구거, 조아!')
    expect(hangulSpoken('OK 아버지')).toBe('OK 아버지')  // não-Hangul + Hangul sem mudança
  })

  it('não cruza fronteira de não-Hangul (espaço quebra o par)', () => {
    // 'ㄱ' final de '학' não tensiona '교' se houver separador entre eles
    expect(hangulSpoken('학 교')).toBe('학 교')
  })
  it('é idempotente (aplicar 2x = 1x)', () => {
    const once = hangulSpoken('한국어를 좋다')
    expect(hangulSpoken(once)).toBe(once)
  })
  it('lida com string vazia / só pontuação', () => {
    expect(hangulSpoken('')).toBe('')
    expect(hangulSpoken('...')).toBe('...')
  })
})

describe('hasHangulSoundChange', () => {
  it('true quando muda', () => {
    expect(hasHangulSoundChange('한국어')).toBe(true)
    expect(hasHangulSoundChange('좋아')).toBe(true)
  })
  it('false quando não muda', () => {
    expect(hasHangulSoundChange('아버지')).toBe(false)
    expect(hasHangulSoundChange('')).toBe(false)
  })
})
