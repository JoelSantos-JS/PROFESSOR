import { describe, it, expect } from 'vitest'
import { isHan, hasHan, hanChars, uniqueHanChars, hanCharCount } from './cjk'

describe('isHan', () => {
  it('reconhece Hanzi/Kanji comuns', () => {
    expect(isHan('好')).toBe(true)
    expect(isHan('学')).toBe(true)
    expect(isHan('愛')).toBe(true)
  })
  it('reconhece marcas de repetição', () => {
    expect(isHan('々')).toBe(true)
  })
  it('rejeita kana, latim, dígitos e pontuação', () => {
    expect(isHan('あ')).toBe(false)
    expect(isHan('ア')).toBe(false)
    expect(isHan('A')).toBe(false)
    expect(isHan('1')).toBe(false)
    expect(isHan('。')).toBe(false)
  })
})

describe('hasHan', () => {
  it('detecta presença de Han', () => {
    expect(hasHan('私は学生です')).toBe(true)
    expect(hasHan('你好')).toBe(true)
  })
  it('falso quando não há Han', () => {
    expect(hasHan('ひらがなだけ')).toBe(false)
    expect(hasHan('hello world')).toBe(false)
    expect(hasHan('')).toBe(false)
  })
})

describe('hanChars', () => {
  it('extrai todos os Han em ordem (com repetições)', () => {
    expect(hanChars('私は学生です')).toEqual(['私', '学', '生'])
    expect(hanChars('人人')).toEqual(['人', '人'])
  })
  it('ignora kana e pontuação', () => {
    expect(hanChars('猫が好き。')).toEqual(['猫', '好'])
  })
})

describe('uniqueHanChars', () => {
  it('remove duplicados preservando a ordem', () => {
    expect(uniqueHanChars('人人々')).toEqual(['人', '々'])
    expect(uniqueHanChars('学生は学校')).toEqual(['学', '生', '校'])
  })
  it('vazio quando não há Han', () => {
    expect(uniqueHanChars('ねこ')).toEqual([])
  })
})

describe('hanCharCount', () => {
  it('conta caracteres Han distintos', () => {
    expect(hanCharCount('学生は学校で勉強する')).toBe(5) // 学 生 校 勉 強 (学 repetido conta 1×)
    expect(hanCharCount('你好你好')).toBe(2)
  })
})
