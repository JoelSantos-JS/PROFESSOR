import { describe, it, expect } from 'vitest'
import {
  ONBOARDING_STEPS, LEVELS, TOTAL_NAV_STEPS, DEFAULT_LEVEL,
  stepIndex, nextStep, prevStep, isLastStep, resourceSectionsFor,
  serializeLevels, parseLevels,
} from './onboarding'

describe('navegação de passos', () => {
  it('ordem dos passos', () => {
    expect(ONBOARDING_STEPS).toEqual(['welcome', 'apiKey', 'resources', 'done'])
  })
  it('nextStep avança e trava no done', () => {
    expect(nextStep('welcome')).toBe('apiKey')
    expect(nextStep('apiKey')).toBe('resources')
    expect(nextStep('resources')).toBe('done')
    expect(nextStep('done')).toBe('done')
  })
  it('prevStep volta e trava no welcome', () => {
    expect(prevStep('done')).toBe('resources')
    expect(prevStep('welcome')).toBe('welcome')
  })
  it('stepIndex', () => {
    expect(stepIndex('welcome')).toBe(0)
    expect(stepIndex('done')).toBe(3)
  })
  it('isLastStep', () => {
    expect(isLastStep('done')).toBe(true)
    expect(isLastStep('resources')).toBe(false)
  })
  it('TOTAL_NAV_STEPS exclui o done', () => {
    expect(TOTAL_NAV_STEPS).toBe(3)
  })
})

describe('resourceSectionsFor', () => {
  it('iniciante: escrita + canais', () => {
    expect(resourceSectionsFor('beginner')).toEqual(['writing', 'channels'])
  })
  it('já lê a escrita: só canais', () => {
    expect(resourceSectionsFor('knows-script')).toEqual(['channels'])
  })
  it('intermediário: prática + canais', () => {
    expect(resourceSectionsFor('intermediate')).toEqual(['practice', 'channels'])
  })
  it('avançado: só prática/conversação (sem recursos de iniciante)', () => {
    expect(resourceSectionsFor('advanced')).toEqual(['practice'])
  })
  it('só o iniciante mostra a escrita', () => {
    for (const lvl of ['knows-script', 'intermediate', 'advanced'] as const) {
      expect(resourceSectionsFor(lvl)).not.toContain('writing')
    }
  })
  it('prática aparece para intermediário e avançado', () => {
    expect(resourceSectionsFor('intermediate')).toContain('practice')
    expect(resourceSectionsFor('advanced')).toContain('practice')
    expect(resourceSectionsFor('beginner')).not.toContain('practice')
    expect(resourceSectionsFor('knows-script')).not.toContain('practice')
  })
})

describe('LEVELS', () => {
  it('tem os 4 níveis com id/label/desc (iniciante → conversação)', () => {
    expect(LEVELS.map(l => l.id)).toEqual(['beginner', 'knows-script', 'intermediate', 'advanced'])
    for (const l of LEVELS) {
      expect(l.label.length).toBeGreaterThan(0)
      expect(l.desc.length).toBeGreaterThan(0)
    }
  })
  it('DEFAULT_LEVEL é beginner', () => {
    expect(DEFAULT_LEVEL).toBe('beginner')
  })
})

describe('nível por idioma — serialize/parse', () => {
  it('serializa na ordem dada', () => {
    expect(serializeLevels({ zh: 'beginner', en: 'advanced' }, ['zh', 'en'])).toBe('zh:beginner,en:advanced')
    expect(serializeLevels({ zh: 'beginner', en: 'advanced' }, ['en', 'zh'])).toBe('en:advanced,zh:beginner')
  })
  it('ignora idiomas da ordem que não têm nível', () => {
    expect(serializeLevels({ zh: 'intermediate' }, ['zh', 'ja'])).toBe('zh:intermediate')
  })
  it('faz o parse de volta', () => {
    expect(parseLevels('zh:beginner,en:advanced')).toEqual({ zh: 'beginner', en: 'advanced' })
  })
  it('roundtrip', () => {
    const levels = { ko: 'beginner' as const, ja: 'knows-script' as const, zh: 'advanced' as const }
    const order = ['ko', 'ja', 'zh']
    expect(parseLevels(serializeLevels(levels, order))).toEqual(levels)
  })
  it('ignora entradas inválidas e vazias', () => {
    expect(parseLevels('zh:banana,en:advanced,:beginner,xx')).toEqual({ en: 'advanced' })
    expect(parseLevels('')).toEqual({})
  })
  it('tolera espaços', () => {
    expect(parseLevels(' zh : beginner , en : advanced ')).toEqual({ zh: 'beginner', en: 'advanced' })
  })
  it('o caso de uso do usuário: Chinês iniciante + Inglês avançado', () => {
    const s = serializeLevels({ zh: 'beginner', en: 'advanced' }, ['zh', 'en'])
    const back = parseLevels(s)
    expect(back.zh).toBe('beginner')
    expect(back.en).toBe('advanced')
  })
})
