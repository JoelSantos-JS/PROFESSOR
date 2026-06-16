import { describe, it, expect } from 'vitest'
import { buildTestProbe } from './providerTestProbe'
import type { ProviderId } from '../services/credentialsService'

describe('buildTestProbe — URL + headers por provider', () => {
  it('OpenAI: Bearer + /v1/models', () => {
    const p = buildTestProbe('openai', 'sk-KEY')!
    expect(p.label).toBe('OpenAI')
    expect(p.url).toBe('https://api.openai.com/v1/models')
    expect(p.headers).toEqual({ Authorization: 'Bearer sk-KEY' })
  })

  it('Groq: Bearer + endpoint OpenAI-compatível', () => {
    const p = buildTestProbe('groq', 'gsk_KEY')!
    expect(p.url).toBe('https://api.groq.com/openai/v1/models')
    expect(p.headers).toEqual({ Authorization: 'Bearer gsk_KEY' })
  })

  it('Anthropic: x-api-key + anthropic-version (NÃO usa Bearer)', () => {
    const p = buildTestProbe('anthropic', 'sk-ant-KEY')!
    expect(p.url).toBe('https://api.anthropic.com/v1/models')
    expect(p.headers).toEqual({ 'x-api-key': 'sk-ant-KEY', 'anthropic-version': '2023-06-01' })
    expect(p.headers.Authorization).toBeUndefined()
  })

  it('Gemini: chave na query, sem headers de auth', () => {
    const p = buildTestProbe('gemini', 'AIzaKEY')!
    expect(p.url).toBe('https://generativelanguage.googleapis.com/v1beta/models?key=AIzaKEY')
    expect(p.headers).toEqual({})
  })

  it('a chave é embutida exatamente (sem encode/alteração)', () => {
    expect(buildTestProbe('openai', 'a b+c')!.headers.Authorization).toBe('Bearer a b+c')
    expect(buildTestProbe('gemini', 'a b+c')!.url).toContain('key=a b+c')
  })

  it('cobre os 4 providers conhecidos', () => {
    for (const id of ['openai', 'groq', 'anthropic', 'gemini'] as ProviderId[]) {
      const p = buildTestProbe(id, 'x')
      expect(p).toBeDefined()
      expect(p!.url).toMatch(/^https:\/\//)
      expect(p!.label.length).toBeGreaterThan(0)
    }
  })

  it('provider desconhecido → undefined', () => {
    expect(buildTestProbe('nope' as ProviderId, 'x')).toBeUndefined()
  })
})
