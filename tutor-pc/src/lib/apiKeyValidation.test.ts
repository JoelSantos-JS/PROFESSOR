import { describe, it, expect } from 'vitest'
import { validateApiKey, pickActiveProvider, KEY_FORMATS } from './apiKeyValidation'

describe('validateApiKey — erros (bloqueiam)', () => {
  it('vazia', () => {
    const v = validateApiKey('openai', '')
    expect(v.ok).toBe(false)
    expect(v.level).toBe('error')
    expect(v.message).toMatch(/Cole/)
  })
  it('só espaços', () => {
    expect(validateApiKey('openai', '   ').level).toBe('error')
  })
  it('com espaço interno', () => {
    const v = validateApiKey('openai', 'sk-abc def ghijklmnop')
    expect(v.ok).toBe(false)
    expect(v.message).toMatch(/espaços/)
  })
  it('quebra de linha interna', () => {
    expect(validateApiKey('groq', 'gsk_abc\ndef').level).toBe('error')
  })
  it('parece URL', () => {
    const v = validateApiKey('gemini', 'https://aistudio.google.com/app/apikey')
    expect(v.ok).toBe(false)
    expect(v.message).toMatch(/URL/)
  })
})

describe('validateApiKey — avisos (permitem salvar)', () => {
  it('prefixo inesperado avisa mas deixa salvar', () => {
    const v = validateApiKey('openai', 'xx-1234567890123456789012')
    expect(v.ok).toBe(true)
    expect(v.level).toBe('warn')
    expect(v.message).toMatch(/sk-/)
  })
  it('curta demais avisa', () => {
    const v = validateApiKey('openai', 'sk-123')
    expect(v.ok).toBe(true)
    expect(v.level).toBe('warn')
    expect(v.message).toMatch(/curta/)
  })
})

describe('validateApiKey — ok', () => {
  it('OpenAI sk-', () => {
    expect(validateApiKey('openai', 'sk-' + 'a'.repeat(40)).level).toBe('ok')
  })
  it('Gemini AIza', () => {
    expect(validateApiKey('gemini', 'AIza' + 'b'.repeat(35)).level).toBe('ok')
  })
  it('Anthropic sk-ant-', () => {
    expect(validateApiKey('anthropic', 'sk-ant-' + 'c'.repeat(30)).level).toBe('ok')
  })
  it('Groq gsk_', () => {
    expect(validateApiKey('groq', 'gsk_' + 'd'.repeat(30)).level).toBe('ok')
  })
  it('faz trim e devolve normalized', () => {
    const v = validateApiKey('openai', '  sk-' + 'a'.repeat(40) + '  ')
    expect(v.normalized.startsWith('sk-')).toBe(true)
    expect(v.normalized).not.toMatch(/\s/)
  })
  it('anthropic não dispara aviso de prefixo só por começar com sk-', () => {
    expect(validateApiKey('anthropic', 'sk-ant-' + 'x'.repeat(30)).level).toBe('ok')
  })
})

describe('KEY_FORMATS', () => {
  it('cobre os 4 providers', () => {
    for (const id of ['openai', 'gemini', 'anthropic', 'groq'] as const) {
      expect(KEY_FORMATS[id]).toBeDefined()
      expect(KEY_FORMATS[id].example.length).toBeGreaterThan(0)
    }
  })
})

describe('validateApiKey — bordas agressivas', () => {
  it('tab/CRLF nas bordas é tratado como trim e some', () => {
    const v = validateApiKey('groq', '\t gsk_' + 'a'.repeat(30) + '\r\n')
    expect(v.normalized).toBe('gsk_' + 'a'.repeat(30))
    expect(v.level).toBe('ok')
  })
  it('tab NO MEIO é erro de espaço', () => {
    expect(validateApiKey('groq', 'gsk_a\tb').level).toBe('error')
  })
  it('anthropic: chave "sk-" sem "ant-" AVISA (prefixo é sk-ant-)', () => {
    const v = validateApiKey('anthropic', 'sk-' + 'x'.repeat(25))
    expect(v.level).toBe('warn')
    expect(v.message).toMatch(/sk-ant-/)
  })
  it('gemini: prefixo AIza exigido', () => {
    expect(validateApiKey('gemini', 'BIza' + 'y'.repeat(35)).level).toBe('warn')
    expect(validateApiKey('gemini', 'AIza' + 'y'.repeat(35)).level).toBe('ok')
  })
  it('http/https viram erro de URL; ftp NÃO (cai em aviso de prefixo)', () => {
    expect(validateApiKey('openai', 'http://x').level).toBe('error')
    expect(validateApiKey('openai', 'https://x').level).toBe('error')
    expect(validateApiKey('openai', 'ftp://x').level).toBe('warn')  // não é http(s) → checa prefixo
  })
  it('exatamente no minLen é ok; 1 abaixo avisa', () => {
    // openai minLen 20, prefixo sk- (3) → precisa de 17 chars após
    expect(validateApiKey('openai', 'sk-' + 'a'.repeat(17)).level).toBe('ok')      // len 20
    expect(validateApiKey('openai', 'sk-' + 'a'.repeat(16)).level).toBe('warn')    // len 19
  })
  it('raw undefined/null não quebra', () => {
    expect(validateApiKey('openai', undefined as unknown as string).level).toBe('error')
    expect(validateApiKey('openai', null as unknown as string).normalized).toBe('')
  })
})

describe('pickActiveProvider', () => {
  it('mantém o atual se ainda configurado', () => {
    expect(pickActiveProvider(['openai', 'groq'], 'groq')).toBe('groq')
  })
  it('cai para o primeiro configurado se o atual sumiu', () => {
    expect(pickActiveProvider(['openai', 'groq'], 'gemini')).toBe('openai')
  })
  it('usa o primeiro quando não há atual', () => {
    expect(pickActiveProvider(['anthropic'], undefined)).toBe('anthropic')
  })
  it('undefined quando nada configurado', () => {
    expect(pickActiveProvider([], 'openai')).toBeUndefined()
  })
  it('respeita o filtro de elegibilidade (ex.: transcrição)', () => {
    // anthropic não suporta transcrição
    const supportsTranscription = (id: string) => id !== 'anthropic'
    expect(pickActiveProvider(['anthropic', 'openai'], 'anthropic', supportsTranscription)).toBe('openai')
    expect(pickActiveProvider(['anthropic'], undefined, supportsTranscription)).toBeUndefined()
  })
})
