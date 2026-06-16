// Lógica pura do Professor-IA de conversa ("language parent"): monta o prompt e faz o parse
// da resposta estruturada. Sem imports de electron — testável.
// Spec: PROFESSOR_IA_CONVERSA.md. A IA SÓ pergunta e conversa sobre o contexto da sessão e,
// após cada resposta do aluno, dá (1) forma melhor de responder + (2) modelos para situações
// similares + (3) a próxima pergunta.

import { nativeLanguageEnglishName, targetLanguageEnglishName } from './nativeLang.js'

export type ProfessorRole = 'assistant' | 'user'
export interface ProfessorMessage { role: ProfessorRole; text: string }

export interface ProfessorFeedback {
  issue?: string      // o que estava errado na resposta do aluno (honesto, no idioma do aluno) — ausente se não houver erro
  better: string      // forma melhor de responder (reformulação da última resposta do aluno)
  models: string[]    // 1-2 modelos para situações similares (transferência)
}

export interface ProfessorTurn {
  question: string             // próxima pergunta (no idioma-alvo)
  translation?: string         // tradução da pergunta no idioma do aluno (apoio)
  feedback?: ProfessorFeedback // só quando o aluno já respondeu
}

export const MAX_CONTEXT_SENTENCES = 12
export const MAX_HISTORY_MESSAGES = 12

/** Limita o contexto da sessão às últimas N frases não-vazias (controla custo de tokens). */
export function sessionContext(sentences: string[], max = MAX_CONTEXT_SENTENCES): string[] {
  return (sentences ?? []).map(s => (s ?? '').trim()).filter(Boolean).slice(-max)
}

/** Mantém só as últimas N mensagens do histórico (controla custo de tokens). */
export function trimHistory(history: ProfessorMessage[], max = MAX_HISTORY_MESSAGES): ProfessorMessage[] {
  return (history ?? []).filter(m => m && (m.role === 'assistant' || m.role === 'user') && m.text?.trim()).slice(-max)
}

/** System prompt do professor-conversa: regras + contexto da sessão + diálogo até aqui. */
export function buildProfessorSystemPrompt(opts: {
  lang: string
  native?: string
  level?: string
  context: string[]
  history: ProfessorMessage[]
}): string {
  const target = targetLanguageEnglishName(opts.lang)
  const nat = nativeLanguageEnglishName(opts.native ?? 'pt')
  const level = opts.level || 'beginner'

  const ctx = opts.context.length
    ? opts.context.map((s, i) => `${i + 1}. ${s}`).join('\n')
    : '(no sentences captured yet — keep the conversation simple and general)'

  const convo = opts.history.length
    ? opts.history.map(m => `${m.role === 'assistant' ? 'TEACHER' : 'STUDENT'}: ${m.text}`).join('\n')
    : '(the conversation has not started yet — ask your first question)'

  return `You are a substitute language teacher — a patient "language parent" — for a ${nat}-speaking student learning ${target} (level: ${level}).
Your job is to CONVERSE: you ONLY ask questions and chat about what the student just watched. You NEVER give lectures or grammar lessons.

CONTEXT — sentences from this session (stay on this topic):
${ctx}

CONVERSATION SO FAR:
${convo}

Respond with raw JSON only (no markdown):
{
  "question": "your next question for the student, in ${target}, at their level (one new thing at a time, i+1)",
  "translation": "the question translated to ${nat} as support, or empty string",
  "feedback": {
    "issue": "in ${nat}: the 1-2 highest-impact problems in the student's FULL LAST answer (grammar, word choice, clarity, organization). Do not invent quotes. Empty string if there is no answer yet OR it was genuinely correct",
    "better": "a complete, natural rewrite of the student's FULL LAST answer in ${target}, preserving their meaning and level. Do not reduce a long answer to one tiny sentence. Empty string if the student hasn't answered yet",
    "models": ["1-2 short model answers in ${target} for SIMILAR situations (transfer)"]
  }
}

Rules:
- ONLY ask questions and converse — do NOT lecture, do NOT explain grammar in long form.
- Keep every question tied to the CONTEXT and at the student's level (i+1).
- BE HONEST — never give empty praise. If the answer has a mistake, name it clearly in feedback.issue (in ${nat}); do not pretend it was perfect.
- The current user message is the student's FULL LAST answer. Evaluate the whole answer, not only one clause.
- For multi-sentence answers, feedback.better must be a full corrected/natural rewrite of the whole answer, preserving the student's point.
- Do NOT quote or paraphrase a "mistake" unless it appears in the student's answer. If you mention a specific wording, copy it exactly.
- Do NOT nitpick a tiny fragment while ignoring larger clarity/grammar problems. Choose the 1-2 highest-impact issues.
- feedback.issue: the real problem, short; use "" only when there's no answer yet OR the answer is genuinely correct (then you may briefly confirm in feedback.better).
- feedback.better: the corrected/natural version of the student's full last answer; use "" when there is no student answer yet.
- feedback.models: 1-2 brief example answers for similar situations; use [] when not applicable.
- "question" is ALWAYS present: a single, friendly, conversational question in ${target}.
- Respond ONLY with raw JSON. No markdown fences, no extra text.`
}

/** Parse tolerante da resposta JSON do professor → ProfessorTurn. */
export function parseProfessorTurn(raw: string): ProfessorTurn {
  try {
    const p = JSON.parse(raw) as {
      question?: unknown; translation?: unknown
      feedback?: { issue?: unknown; better?: unknown; models?: unknown }
    }
    const question = typeof p.question === 'string' ? p.question.trim() : ''
    const translation = typeof p.translation === 'string' && p.translation.trim() ? p.translation.trim() : undefined

    let feedback: ProfessorFeedback | undefined
    const fb = p.feedback
    if (fb && typeof fb === 'object') {
      const issue = typeof fb.issue === 'string' && fb.issue.trim() ? fb.issue.trim() : undefined
      const better = typeof fb.better === 'string' ? fb.better.trim() : ''
      const models = Array.isArray(fb.models)
        ? fb.models.filter((m): m is string => typeof m === 'string' && m.trim().length > 0).map(m => m.trim())
        : []
      if (issue || better || models.length) feedback = { ...(issue ? { issue } : {}), better, models }
    }
    return { question, translation, feedback }
  } catch {
    return { question: '' }
  }
}
