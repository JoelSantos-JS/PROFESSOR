import { describe, it, expect } from 'vitest'
import {
  buildProfessorSystemPrompt, parseProfessorTurn, sessionContext, trimHistory,
  MAX_CONTEXT_SENTENCES, MAX_HISTORY_MESSAGES, type ProfessorMessage,
} from './professorPrompt'

describe('sessionContext', () => {
  it('tira vazios e mantém as últimas N', () => {
    expect(sessionContext(['a', '', '  ', 'b'])).toEqual(['a', 'b'])
  })
  it('limita ao máximo (últimas)', () => {
    const many = Array.from({ length: 20 }, (_, i) => `s${i}`)
    const out = sessionContext(many)
    expect(out).toHaveLength(MAX_CONTEXT_SENTENCES)
    expect(out[out.length - 1]).toBe('s19')   // mantém as MAIS RECENTES
    expect(out[0]).toBe(`s${20 - MAX_CONTEXT_SENTENCES}`)
  })
  it('lida com entrada vazia/inválida', () => {
    expect(sessionContext([])).toEqual([])
    expect(sessionContext(undefined as unknown as string[])).toEqual([])
  })
})

describe('trimHistory', () => {
  const msg = (role: 'assistant' | 'user', text: string): ProfessorMessage => ({ role, text })
  it('mantém só as últimas N mensagens', () => {
    const h = Array.from({ length: 20 }, (_, i) => msg(i % 2 ? 'user' : 'assistant', `m${i}`))
    expect(trimHistory(h)).toHaveLength(MAX_HISTORY_MESSAGES)
  })
  it('descarta mensagens inválidas/vazias', () => {
    const h = [msg('assistant', 'oi'), msg('user', '  '), { role: 'x', text: 'z' } as unknown as ProfessorMessage]
    expect(trimHistory(h)).toEqual([msg('assistant', 'oi')])
  })
})

describe('buildProfessorSystemPrompt', () => {
  const base = { lang: 'ko', native: 'pt', level: 'beginner', context: ['안녕하세요'], history: [] as ProfessorMessage[] }

  it('instrui SÓ perguntar/conversar e não dar aula', () => {
    const p = buildProfessorSystemPrompt(base)
    expect(p).toMatch(/ONLY ask questions/i)
    expect(p).toMatch(/NEVER give lectures|do NOT lecture/i)
  })
  it('usa o idioma-alvo e o idioma nativo corretos', () => {
    const p = buildProfessorSystemPrompt({ ...base, lang: 'ko', native: 'pt' })
    expect(p).toContain('Korean')              // alvo
    expect(p).toContain('Brazilian Portuguese') // nativo
  })
  it('idioma-alvo desconhecido cai para o código', () => {
    expect(buildProfessorSystemPrompt({ ...base, lang: 'th' })).toContain('TH')
  })
  it('inclui o contexto numerado da sessão', () => {
    const p = buildProfessorSystemPrompt({ ...base, context: ['frase um', 'frase dois'] })
    expect(p).toContain('1. frase um')
    expect(p).toContain('2. frase dois')
  })
  it('renderiza o histórico como TEACHER/STUDENT', () => {
    const p = buildProfessorSystemPrompt({
      ...base,
      history: [{ role: 'assistant', text: 'Pergunta?' }, { role: 'user', text: 'Resposta.' }],
    })
    expect(p).toContain('TEACHER: Pergunta?')
    expect(p).toContain('STUDENT: Resposta.')
  })
  it('sinaliza quando a conversa ainda não começou', () => {
    expect(buildProfessorSystemPrompt(base)).toMatch(/has not started/i)
  })
  it('pede saída JSON com question + translation + feedback', () => {
    const p = buildProfessorSystemPrompt(base)
    expect(p).toContain('"question"')
    expect(p).toContain('"translation"')
    expect(p).toContain('"feedback"')
    expect(p).toContain('"issue"')
    expect(p).toMatch(/raw JSON/i)
  })
  it('nível default = beginner', () => {
    const p = buildProfessorSystemPrompt({ lang: 'ko', context: [], history: [] })
    expect(p).toContain('level: beginner')
  })
  it('exige feedback honesto e bloqueia elogio falso', () => {
    const p = buildProfessorSystemPrompt(base)
    expect(p).toMatch(/BE HONEST/i)
    expect(p).toMatch(/never give empty praise/i)
    expect(p).toMatch(/feedback\.issue/i)
  })

  it('manda corrigir a resposta inteira sem inventar citações', () => {
    const p = buildProfessorSystemPrompt(base)
    expect(p).toMatch(/FULL LAST answer/i)
    expect(p).toMatch(/Evaluate the whole answer/i)
    expect(p).toMatch(/full corrected\/natural rewrite/i)
    expect(p).toMatch(/Do NOT quote or paraphrase/i)
    expect(p).toMatch(/copy it exactly/i)
    expect(p).toMatch(/Do NOT nitpick a tiny fragment/i)
  })
})

describe('parseProfessorTurn', () => {
  it('parse completo: pergunta + tradução + feedback', () => {
    const raw = JSON.stringify({
      question: '오늘 뭐 했어요?',
      translation: 'O que você fez hoje?',
      feedback: { better: '저는 영화를 봤어요.', models: ['저는 책을 읽었어요.', '저는 친구를 만났어요.'] },
    })
    expect(parseProfessorTurn(raw)).toEqual({
      question: '오늘 뭐 했어요?',
      translation: 'O que você fez hoje?',
      feedback: { better: '저는 영화를 봤어요.', models: ['저는 책을 읽었어요.', '저는 친구를 만났어요.'] },
    })
  })
  it('sem feedback quando better vazio e models vazio (1ª pergunta)', () => {
    const raw = JSON.stringify({ question: 'Q?', translation: '', feedback: { better: '', models: [] } })
    const t = parseProfessorTurn(raw)
    expect(t.question).toBe('Q?')
    expect(t.translation).toBeUndefined()
    expect(t.feedback).toBeUndefined()
  })
  it('mantém feedback se só houver "better"', () => {
    const raw = JSON.stringify({ question: 'Q?', feedback: { better: 'melhor', models: [] } })
    expect(parseProfessorTurn(raw).feedback).toEqual({ better: 'melhor', models: [] })
  })
  it('filtra models não-string/vazios', () => {
    const raw = JSON.stringify({ question: 'Q?', feedback: { better: '', models: ['ok', '', 3, null] } })
    expect(parseProfessorTurn(raw).feedback).toEqual({ better: '', models: ['ok'] })
  })
  it('JSON inválido → pergunta vazia (sem quebrar)', () => {
    const issueOnly = JSON.stringify({ question: 'Q?', feedback: { issue: 'Verbo no tempo errado.', better: '', models: [] } })
    const withIssue = JSON.stringify({ question: 'Q?', feedback: { issue: '  Palavra errada.  ', better: '', models: [] } })
    const emptyIssue = JSON.stringify({ question: 'Q?', feedback: { issue: '   ', better: 'melhor', models: [] } })
    expect(parseProfessorTurn(issueOnly).feedback).toEqual({ issue: 'Verbo no tempo errado.', better: '', models: [] })
    expect(parseProfessorTurn(withIssue).feedback).toEqual({ issue: 'Palavra errada.', better: '', models: [] })
    expect(parseProfessorTurn(emptyIssue).feedback).toEqual({ better: 'melhor', models: [] })
    expect(parseProfessorTurn('not json')).toEqual({ question: '' })
    expect(parseProfessorTurn('{}')).toEqual({ question: '' })
  })
  it('faz trim dos campos', () => {
    const raw = JSON.stringify({ question: '  Q?  ', translation: '  T  ' })
    const t = parseProfessorTurn(raw)
    expect(t.question).toBe('Q?')
    expect(t.translation).toBe('T')
  })
})
