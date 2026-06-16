// Constrói a requisição de "validação de chave" (auth) por provider — um GET barato de
// "listar modelos". Puro/testável: separa a montagem de URL+headers da chamada de rede.

import type { ProviderId } from '../services/credentialsService'

export interface TestProbe {
  label: string
  url: string
  headers: Record<string, string>
}

const BUILDERS: Record<ProviderId, (key: string) => TestProbe> = {
  openai: key => ({
    label: 'OpenAI',
    url: 'https://api.openai.com/v1/models',
    headers: { Authorization: `Bearer ${key}` },
  }),
  groq: key => ({
    label: 'Groq',
    url: 'https://api.groq.com/openai/v1/models',
    headers: { Authorization: `Bearer ${key}` },
  }),
  anthropic: key => ({
    label: 'Anthropic',
    url: 'https://api.anthropic.com/v1/models',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
  }),
  gemini: key => ({
    label: 'Gemini',
    url: `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
    headers: {},
  }),
}

/** Probe de validação para um provider, ou undefined se não houver. */
export function buildTestProbe(provider: ProviderId, key: string): TestProbe | undefined {
  return BUILDERS[provider]?.(key)
}
