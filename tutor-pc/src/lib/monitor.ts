// Pure state machine for "Auto-Practice" mode: while watching a video, each
// completed sentence pauses the player and prompts the user to repeat it.
// Kept side-effect-free so the whole decision flow is unit-testable.

import type { WordCue } from '../types'

export type MonitorPhase = 'watching' | 'practicing'

// Cada frase candidata ao treino carrega o SEU áudio/cues/idioma (vinculados por instância),
// pra não usar o "último clipe" global. É o que o TutorBoard faz e o que conserta o bug.
export interface PracticeItem {
  text: string
  audioUrl?: string
  cues?: WordCue[]
  lang: string
}

export interface MonitorState {
  phase: MonitorPhase
  current: PracticeItem | null   // frase (com áudio) sendo praticada
  queue: PracticeItem[]          // frases (com áudio) capturadas enquanto pratica
}

export type MonitorAction =
  | 'none'               // do nothing (just show transcript)
  | 'pause-and-practice' // pause the video, start practicing `current`
  | 'resume'             // resume the video (queue drained)
  | 'practice-next'      // keep video paused, practice next queued sentence

export const INITIAL_MONITOR: MonitorState = { phase: 'watching', current: null, queue: [] }

// Auto-practice is meant for single spoken lines. Very long captures are usually
// run-on speech / background chatter over-captured by the VAD — too unwieldy to
// repeat, so they're transcribed but skipped for practice.
export const MAX_PRACTICE_WORDS = 24

function tooLongToPractice(text: string): boolean {
  return text.split(/\s+/).filter(Boolean).length > MAX_PRACTICE_WORDS
}

/**
 * A sentence was just transcribed.
 * - auto OFF            → no-op.
 * - auto ON & watching  → begin practicing it (caller pauses the video).
 * - auto ON & practicing→ queue it (don't interrupt the current practice).
 */
export function onSentence(
  state: MonitorState,
  item: PracticeItem,
  autoMode: boolean,
): { state: MonitorState; action: MonitorAction } {
  const text = item.text.trim()
  if (!autoMode || !text) return { state, action: 'none' }
  // Skip run-ons / background chatter — too long to be a useful practice line.
  if (tooLongToPractice(text)) return { state, action: 'none' }

  const entry: PracticeItem = { ...item, text }

  if (state.phase === 'watching') {
    return {
      state: { phase: 'practicing', current: entry, queue: [] },
      action: 'pause-and-practice',
    }
  }

  // already practicing → queue (mantém o áudio/cues da frase junto)
  return {
    state: { ...state, queue: [...state.queue, entry] },
    action: 'none',
  }
}

/**
 * The current practice finished (or was skipped).
 * - queue empty → back to watching, resume the video.
 * - queue has items → practice the next one, video stays paused.
 */
export function onPracticeDone(
  state: MonitorState,
): { state: MonitorState; action: MonitorAction } {
  if (state.phase !== 'practicing') return { state, action: 'none' }

  if (state.queue.length === 0) {
    return { state: INITIAL_MONITOR, action: 'resume' }
  }

  const [next, ...rest] = state.queue
  return {
    state: { phase: 'practicing', current: next, queue: rest },
    action: 'practice-next',
  }
}

/**
 * User turned auto-mode OFF (or stopped listening) mid-practice.
 * Always returns to a clean watching state; caller resumes the video if it was
 * paused.
 */
export function onAbort(state: MonitorState): { state: MonitorState; action: MonitorAction } {
  const wasPaused = state.phase === 'practicing'
  return { state: INITIAL_MONITOR, action: wasPaused ? 'resume' : 'none' }
}
