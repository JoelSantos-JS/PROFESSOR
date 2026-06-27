import { describe, expect, it } from 'vitest'
import { parseRetryDelayMs } from './retryAfter'

describe('parseRetryDelayMs', () => {
  it('lê segundos do corpo do 429 (Groq) + buffer', () => {
    const body = '{"error":{"message":"Rate limit reached ... Please try again in 3s.","code":"rate_limit_exceeded"}}'
    expect(parseRetryDelayMs(body)).toBe(3300)  // 3000 + 300
  })
  it('lê segundos fracionados', () => {
    expect(parseRetryDelayMs('try again in 1.5s')).toBe(1800)  // 1500 + 300
  })
  it('lê milissegundos', () => {
    expect(parseRetryDelayMs('try again in 800ms')).toBe(1100)  // 800 + 300
  })
  it('limita o teto em 10s', () => {
    expect(parseRetryDelayMs('try again in 60s')).toBe(10_000)
  })
  it('sem padrão → fallback', () => {
    expect(parseRetryDelayMs('algum erro qualquer')).toBe(3000)
    expect(parseRetryDelayMs('algum erro qualquer', 1500)).toBe(1500)
  })
})
