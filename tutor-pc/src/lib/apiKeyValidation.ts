// Validação pura de chaves de API (BYOK) no cliente — pega erros óbvios ANTES de salvar
// e antes de gastar uma chamada de teste, reduzindo a fricção do setup. Testável.

import type { ProviderId } from '../types'

export interface KeyFormat {
  prefix?: string    // prefixo típico da chave do provider
  minLen: number     // comprimento mínimo plausível
  example: string    // exemplo p/ placeholder/dica
  name: string
}

export const KEY_FORMATS: Record<ProviderId, KeyFormat> = {
  openai:    { prefix: 'sk-',     minLen: 20, example: 'sk-...',     name: 'OpenAI' },
  gemini:    { prefix: 'AIza',    minLen: 30, example: 'AIzaSy...',  name: 'Google Gemini' },
  anthropic: { prefix: 'sk-ant-', minLen: 20, example: 'sk-ant-...', name: 'Anthropic' },
  groq:      { prefix: 'gsk_',    minLen: 20, example: 'gsk_...',    name: 'Groq' },
}

export type ValidationLevel = 'ok' | 'warn' | 'error'

export interface KeyValidation {
  ok: boolean             // pode salvar? (true exceto em 'error')
  level: ValidationLevel
  normalized: string      // chave após trim
  message?: string        // dica quando warn/error
}

/**
 * Valida o formato de uma chave para um provider.
 * - 'error' (bloqueia salvar): vazia, com espaços internos, ou que parece uma URL.
 * - 'warn' (permite salvar, mostra dica): prefixo inesperado ou curta demais — o formato
 *   pode mudar, então não bloqueamos; só avisamos.
 * - 'ok': bate com o formato esperado.
 */
export function validateApiKey(provider: ProviderId, raw: string): KeyValidation {
  const fmt = KEY_FORMATS[provider]
  const normalized = (raw ?? '').trim()

  if (!normalized) {
    return { ok: false, level: 'error', normalized, message: 'Cole sua chave de API.' }
  }
  if (/\s/.test(normalized)) {
    return { ok: false, level: 'error', normalized, message: 'A chave não deve conter espaços ou quebras de linha.' }
  }
  if (/^https?:\/\//i.test(normalized)) {
    return { ok: false, level: 'error', normalized, message: 'Isso parece uma URL — cole a chave de API, não o endereço.' }
  }
  if (fmt.prefix && !normalized.startsWith(fmt.prefix)) {
    return {
      ok: true,
      level: 'warn',
      normalized,
      message: `Chaves da ${fmt.name} normalmente começam com "${fmt.prefix}". Confira se copiou a chave certa.`,
    }
  }
  if (normalized.length < fmt.minLen) {
    return { ok: true, level: 'warn', normalized, message: 'A chave parece curta demais — confira se copiou inteira.' }
  }
  return { ok: true, level: 'ok', normalized }
}

/**
 * Escolhe o provider ATIVO após uma mudança de configuração: mantém o atual se ainda
 * estiver configurado; senão, cai para o primeiro configurado (na ordem dada); senão, undefined.
 * `eligible` filtra (ex.: transcrição só aceita providers que a suportam).
 */
export function pickActiveProvider(
  configured: ProviderId[],
  current: ProviderId | undefined,
  eligible: (id: ProviderId) => boolean = () => true,
): ProviderId | undefined {
  const pool = configured.filter(eligible)
  if (current && pool.includes(current)) return current
  return pool[0]
}
