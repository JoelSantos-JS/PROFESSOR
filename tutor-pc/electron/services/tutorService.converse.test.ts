import { describe, it, expect, vi, beforeEach } from 'vitest'

// tutorService importa CredentialsService/SettingsService (que importam electron) → mock.
vi.mock('electron', () => ({
  app: { getPath: () => '/tmp' },
  safeStorage: { isEncryptionAvailable: () => false },
}))

const providerFetch = vi.fn()
vi.mock('../lib/providerFetch.js', () => ({ providerFetch: (...a: unknown[]) => providerFetch(...a) }))

import { TutorService } from './tutorService'

type AnyService = InstanceType<typeof TutorService>
function makeService(opts?: { key?: string | null; native?: string; provider?: string }): AnyService {
  const creds = { get: vi.fn(() => (opts?.key === undefined ? 'KEY' : opts.key)) }
  const settings = { getAll: vi.fn(() => ({ activeAiProvider: opts?.provider ?? 'openai', nativeLanguage: opts?.native ?? 'pt' })) }
  return new TutorService(creds as never, settings as never)
}

function mockOpenAI(content: string) {
  providerFetch.mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content } }] }) })
}
function bodyOf(callIndex = 0) {
  return JSON.parse((providerFetch.mock.calls[callIndex][2] as { body: string }).body)
}
function systemOf(callIndex = 0): string {
  return bodyOf(callIndex).messages.find((m: { role: string }) => m.role === 'system').content
}
function userOf(callIndex = 0): string {
  return bodyOf(callIndex).messages.find((m: { role: string }) => m.role === 'user').content
}

beforeEach(() => providerFetch.mockReset())

describe('TutorService.converse', () => {
  it('retorna o turno parseado', async () => {
    mockOpenAI(JSON.stringify({ question: 'Q?', feedback: { better: '', models: [] } }))
    const turn = await makeService().converse({ lang: 'ko', context: ['안녕'], history: [], userMessage: '' })
    expect(turn.question).toBe('Q?')
    expect(turn.feedback).toBeUndefined()   // 1ª pergunta não tem feedback
  })

  it('sem chave configurada → erro', async () => {
    await expect(
      makeService({ key: null }).converse({ lang: 'ko', context: [], history: [], userMessage: '' }),
    ).rejects.toThrow(/Nenhuma chave/)
  })

  it('1ª jogada (sem fala do aluno) dispara o trigger de início; contexto vai no system', async () => {
    mockOpenAI(JSON.stringify({ question: 'Q?' }))
    await makeService().converse({ lang: 'ko', context: ['frase A'], history: [], userMessage: '' })
    expect(systemOf()).toContain('frase A')
    expect(userOf()).toMatch(/Start the conversation/i)
  })

  it('usa a fala do aluno como mensagem do usuário', async () => {
    mockOpenAI(JSON.stringify({ question: 'Q2?' }))
    await makeService().converse({
      lang: 'ko', context: [], history: [{ role: 'assistant', text: 'Q?' }], userMessage: '저는 학생이에요',
    })
    expect(userOf()).toBe('저는 학생이에요')
  })

  it('aplica o idioma nativo das settings + o alvo da sessão no prompt', async () => {
    mockOpenAI(JSON.stringify({ question: 'Q?' }))
    await makeService({ native: 'ja' }).converse({ lang: 'ko', context: [], history: [], userMessage: '' })
    expect(systemOf()).toContain('Japanese-speaking')   // nativo = ja
    expect(systemOf()).toContain('Korean')              // alvo = ko
  })

  it('renderiza o histórico no system (TEACHER/STUDENT)', async () => {
    mockOpenAI(JSON.stringify({ question: 'Q3?' }))
    await makeService().converse({
      lang: 'ko', context: ['ctx'],
      history: [{ role: 'assistant', text: 'P1?' }, { role: 'user', text: 'R1.' }],
      userMessage: 'R2.',
    })
    expect(systemOf()).toContain('TEACHER: P1?')
    expect(systemOf()).toContain('STUDENT: R1.')
  })

  it('JSON inválido do provider → turno com pergunta vazia (não quebra)', async () => {
    mockOpenAI('desculpa, não é json')
    const turn = await makeService().converse({ lang: 'ko', context: [], history: [], userMessage: '' })
    expect(turn).toEqual({ question: '' })
  })
})
