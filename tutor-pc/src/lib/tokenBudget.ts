import type { ProfessorMessage } from '../types'

export interface TokenBudgetSummary {
  usedTokens: number
  limitTokens: number
  percent: number
  messageCount: number
  contextSentenceCount: number
  status: 'ok' | 'watch' | 'warning' | 'critical'
}

export interface ProfessorTokenBudgetInput {
  context: string[]
  history: ProfessorMessage[]
  userMessage?: string
  lang?: string
  limitTokens?: number
}

export interface ProfessorTokenUsageEstimate {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export const DEFAULT_CONTEXT_LIMIT = 50_000

const HANGUL_RE = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/
const CJK_RE = /[\u3040-\u30ff\u3400-\u9fff]/

export function hasDenseScript(text: string, lang = ''): boolean {
  const base = lang.split('-')[0]?.toLowerCase()
  return base === 'zh' || base === 'ja' || base === 'ko' || HANGUL_RE.test(text) || CJK_RE.test(text)
}

export function estimateTokens(text: string, lang = ''): number {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return 0
  const chars = Array.from(clean).length
  const words = clean.split(/\s+/).filter(Boolean).length
  const byChars = Math.ceil(chars / (hasDenseScript(clean, lang) ? 2 : 4))
  return Math.max(1, byChars, Math.ceil(words * 1.15))
}

export function contextStatus(percent: number): TokenBudgetSummary['status'] {
  if (percent >= 95) return 'critical'
  if (percent >= 85) return 'warning'
  if (percent >= 70) return 'watch'
  return 'ok'
}

export function summarizeProfessorTokenBudget(input: ProfessorTokenBudgetInput): TokenBudgetSummary {
  const limitTokens = Math.max(1, Math.floor(input.limitTokens ?? DEFAULT_CONTEXT_LIMIT))
  const contextTokens = input.context.reduce((sum, line) => sum + estimateTokens(line, input.lang) + 4, 0)
  const historyTokens = input.history.reduce((sum, msg) => sum + estimateTokens(msg.text, input.lang) + 6, 0)
  const pendingTokens = input.userMessage ? estimateTokens(input.userMessage, input.lang) + 6 : 0
  const systemOverhead = 650
  const usedTokens = contextTokens + historyTokens + pendingTokens + systemOverhead
  const percent = Math.min(100, Math.round((usedTokens / limitTokens) * 100))

  return {
    usedTokens,
    limitTokens,
    percent,
    messageCount: input.history.filter(msg => msg.text.trim()).length + (input.userMessage?.trim() ? 1 : 0),
    contextSentenceCount: input.context.filter(line => line.trim()).length,
    status: contextStatus(percent),
  }
}

export function estimateProfessorTurnUsage(input: ProfessorTokenBudgetInput & { outputText?: string }): ProfessorTokenUsageEstimate {
  const inputTokens = summarizeProfessorTokenBudget(input).usedTokens
  const outputTokens = input.outputText ? estimateTokens(input.outputText, input.lang) + 12 : 0
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  }
}

export function formatTokenCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.max(0, Math.round(value)))
}
