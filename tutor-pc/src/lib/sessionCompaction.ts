import type { ProfessorMessage } from '../types'

export interface ProfessorCompactionResult {
  context: string[]
  history: ProfessorMessage[]
  summary: string
  removedContextCount: number
  removedMessageCount: number
}

export interface ProfessorCompactionOptions {
  keepContext?: number
  keepHistory?: number
}

const cleanText = (text: string) => text.replace(/\s+/g, ' ').trim()

function shortList(items: string[], max = 6): string {
  return items.slice(-max).map(cleanText).filter(Boolean).join(' | ')
}

function historyLine(message: ProfessorMessage): string {
  return `${message.role === 'assistant' ? 'Professor' : 'Aluno'}: ${cleanText(message.text)}`
}

export function compactProfessorSession(
  context: string[],
  history: ProfessorMessage[],
  options: ProfessorCompactionOptions = {},
): ProfessorCompactionResult {
  const keepContext = Math.max(1, Math.floor(options.keepContext ?? 12))
  const keepHistory = Math.max(1, Math.floor(options.keepHistory ?? 8))
  const cleanContext = (context ?? []).map(cleanText).filter(Boolean)
  const cleanHistory = (history ?? [])
    .filter(msg => msg && (msg.role === 'assistant' || msg.role === 'user') && cleanText(msg.text))
    .map(msg => ({ role: msg.role, text: cleanText(msg.text) }))

  const oldContext = cleanContext.slice(0, Math.max(0, cleanContext.length - keepContext))
  const recentContext = cleanContext.slice(-keepContext)
  const oldHistory = cleanHistory.slice(0, Math.max(0, cleanHistory.length - keepHistory))
  const recentHistory = cleanHistory.slice(-keepHistory)

  if (oldContext.length === 0 && oldHistory.length === 0) {
    return {
      context: cleanContext,
      history: cleanHistory,
      summary: '',
      removedContextCount: 0,
      removedMessageCount: 0,
    }
  }

  const parts = [
    `Resumo compactado da sessao: ${oldContext.length} frases antigas e ${oldHistory.length} mensagens antigas foram resumidas.`,
  ]
  const contextSummary = shortList(oldContext)
  const historySummary = shortList(oldHistory.map(historyLine))
  if (contextSummary) parts.push(`Frases/topicos anteriores: ${contextSummary}.`)
  if (historySummary) parts.push(`Conversa anterior: ${historySummary}.`)

  const summary = parts.join(' ')
  return {
    context: [summary, ...recentContext],
    history: recentHistory,
    summary,
    removedContextCount: oldContext.length,
    removedMessageCount: oldHistory.length,
  }
}
