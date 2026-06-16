import { describe, it, expect } from 'vitest'
import {
  isHiragana, isKatakana, isKana, isKanji, isJapanese,
  kataToHira, hiraToKata, splitMora, moraCount, kanaToRomaji,
} from './kana'

describe('detecção de caracteres', () => {
  it('isHiragana', () => {
    expect(isHiragana('あ')).toBe(true)
    expect(isHiragana('ん')).toBe(true)
    expect(isHiragana('ア')).toBe(false)
    expect(isHiragana('猫')).toBe(false)
    expect(isHiragana('a')).toBe(false)
  })
  it('isKatakana (inclui ー)', () => {
    expect(isKatakana('ア')).toBe(true)
    expect(isKatakana('ー')).toBe(true)
    expect(isKatakana('あ')).toBe(false)
    expect(isKatakana('猫')).toBe(false)
  })
  it('isKana', () => {
    expect(isKana('あ')).toBe(true)
    expect(isKana('ア')).toBe(true)
    expect(isKana('猫')).toBe(false)
  })
  it('isKanji (inclui 々)', () => {
    expect(isKanji('猫')).toBe(true)
    expect(isKanji('学')).toBe(true)
    expect(isKanji('々')).toBe(true)
    expect(isKanji('あ')).toBe(false)
    expect(isKanji('A')).toBe(false)
  })
  it('isJapanese', () => {
    expect(isJapanese('猫')).toBe(true)
    expect(isJapanese('ね')).toBe(true)
    expect(isJapanese('A')).toBe(false)
    expect(isJapanese('1')).toBe(false)
  })
})

describe('katakana ↔ hiragana', () => {
  it('kataToHira', () => {
    expect(kataToHira('カタカナ')).toBe('かたかな')
    expect(kataToHira('コーヒー')).toBe('こーひー')   // ー preservado
    expect(kataToHira('ヴ')).toBe('ゔ')
  })
  it('hiraToKata', () => {
    expect(hiraToKata('ひらがな')).toBe('ヒラガナ')
    expect(hiraToKata('ねこ')).toBe('ネコ')
  })
  it('roundtrip preserva não-kana', () => {
    expect(kataToHira('ネコ123')).toBe('ねこ123')
    expect(hiraToKata('ねこ、です')).toBe('ネコ、デス')
  })
})

describe('moras', () => {
  it('dígrafo conta como 1 mora', () => {
    expect(splitMora('きゃ')).toEqual(['きゃ'])
    expect(moraCount('きゃ')).toBe(1)
  })
  it('sokuon っ e ん são moras próprias', () => {
    expect(splitMora('がっこう')).toEqual(['が', 'っ', 'こ', 'う'])
    expect(moraCount('しんぶん')).toBe(4)   // し ん ぶ ん
  })
  it('vogal longa ー é mora própria', () => {
    expect(moraCount('コーヒー')).toBe(4)   // コ ー ヒ ー
  })
  it('とうきょう = 4 moras', () => {
    expect(splitMora('とうきょう')).toEqual(['と', 'う', 'きょ', 'う'])
  })
})

describe('kana → romaji (Hepburn)', () => {
  it('básico', () => {
    expect(kanaToRomaji('ねこ')).toBe('neko')
    expect(kanaToRomaji('ともだち')).toBe('tomodachi')
    expect(kanaToRomaji('せんせい')).toBe('sensei')
  })
  it('sokuon duplica a consoante', () => {
    expect(kanaToRomaji('がっこう')).toBe('gakkou')
    expect(kanaToRomaji('きって')).toBe('kitte')
  })
  it('sokuon + ち vira tch', () => {
    expect(kanaToRomaji('まっちゃ')).toBe('matcha')
  })
  it('dígrafos', () => {
    expect(kanaToRomaji('しゃしん')).toBe('shashin')
    expect(kanaToRomaji('きょう')).toBe('kyou')
  })
  it('ん vira apóstrofo antes de vogal/y', () => {
    expect(kanaToRomaji('しんよう')).toBe("shin'you")
    expect(kanaToRomaji('こんにちは')).toBe('konnichiha')  // literal (は = ha)
  })
  it('vogal longa katakana ー repete a vogal', () => {
    expect(kanaToRomaji('ラーメン')).toBe('raamen')
    expect(kanaToRomaji('コーヒー')).toBe('koohii')
  })
  it('converte katakana via hiragana', () => {
    expect(kanaToRomaji('カタカナ')).toBe('katakana')
  })
  it('preserva pontuação/espaços', () => {
    expect(kanaToRomaji('ねこ です')).toBe('neko desu')
  })
})
