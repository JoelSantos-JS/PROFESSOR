import { describe, it, expect } from 'vitest'
import { canStartProfessor, sentencesNeeded, MIN_SENTENCES_FOR_PROFESSOR } from './professorChat'

describe('canStartProfessor', () => {
  it('falso abaixo do mínimo', () => {
    expect(canStartProfessor(0)).toBe(false)
    expect(canStartProfessor(MIN_SENTENCES_FOR_PROFESSOR - 1)).toBe(false)
  })
  it('verdadeiro no mínimo e acima', () => {
    expect(canStartProfessor(MIN_SENTENCES_FOR_PROFESSOR)).toBe(true)
    expect(canStartProfessor(MIN_SENTENCES_FOR_PROFESSOR + 10)).toBe(true)
  })
  it('respeita um mínimo customizado', () => {
    expect(canStartProfessor(3, 3)).toBe(true)
    expect(canStartProfessor(2, 3)).toBe(false)
  })
})

describe('sentencesNeeded', () => {
  it('conta quantas faltam', () => {
    expect(sentencesNeeded(0)).toBe(MIN_SENTENCES_FOR_PROFESSOR)
    expect(sentencesNeeded(MIN_SENTENCES_FOR_PROFESSOR - 2)).toBe(2)
  })
  it('zero quando já liberou', () => {
    expect(sentencesNeeded(MIN_SENTENCES_FOR_PROFESSOR)).toBe(0)
    expect(sentencesNeeded(80)).toBe(0)
  })
  it('mínimo customizado', () => {
    expect(sentencesNeeded(3, 10)).toBe(7)
  })
})

describe('MIN_SENTENCES_FOR_PROFESSOR', () => {
  it('é 10 (TEMP de teste — voltar para 50)', () => {
    expect(MIN_SENTENCES_FOR_PROFESSOR).toBe(10)
  })
})
