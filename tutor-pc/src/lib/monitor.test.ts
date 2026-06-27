import { describe, it, expect } from 'vitest'
import { onSentence, onPracticeDone, onAbort, INITIAL_MONITOR, MAX_PRACTICE_WORDS, type MonitorState, type PracticeItem } from './monitor'

// helper: frase de prática com áudio/idioma (o que o monitor agora carrega)
const item = (text: string, audioUrl = `audio:${text}`): PracticeItem => ({ text, audioUrl, lang: 'en' })

describe('onSentence', () => {
  it('does nothing when auto mode is OFF', () => {
    const r = onSentence(INITIAL_MONITOR, item('Hello there.'), false)
    expect(r.action).toBe('none')
    expect(r.state).toBe(INITIAL_MONITOR)
  })

  it('does nothing for empty/blank sentence', () => {
    expect(onSentence(INITIAL_MONITOR, item('   '), true).action).toBe('none')
    expect(onSentence(INITIAL_MONITOR, item(''), true).action).toBe('none')
  })

  it('starts practicing when watching and auto ON', () => {
    const r = onSentence(INITIAL_MONITOR, item('Hello there.'), true)
    expect(r.action).toBe('pause-and-practice')
    expect(r.state.phase).toBe('practicing')
    expect(r.state.current?.text).toBe('Hello there.')
    expect(r.state.queue).toEqual([])
  })

  it('trims the sentence', () => {
    const r = onSentence(INITIAL_MONITOR, item('  Hi  '), true)
    expect(r.state.current?.text).toBe('Hi')
  })

  it('queues a new sentence while already practicing', () => {
    const practicing: MonitorState = { phase: 'practicing', current: item('First.'), queue: [] }
    const r = onSentence(practicing, item('Second.'), true)
    expect(r.action).toBe('none')
    expect(r.state.current?.text).toBe('First.')       // unchanged
    expect(r.state.queue.map(q => q.text)).toEqual(['Second.'])
  })

  it('appends multiple queued sentences in order', () => {
    let s = onSentence(INITIAL_MONITOR, item('A'), true).state
    s = onSentence(s, item('B'), true).state
    s = onSentence(s, item('C'), true).state
    expect(s.current?.text).toBe('A')
    expect(s.queue.map(q => q.text)).toEqual(['B', 'C'])
  })

  // ── O cerne do fix: o ÁUDIO viaja junto da frase ────────────────────────────
  it('mantém o áudio/cues vinculados à frase (na fila e ao avançar)', () => {
    let s = onSentence(INITIAL_MONITOR, item('A', 'audio:A'), true).state  // pratica A
    s = onSentence(s, item('B', 'audio:B'), true).state                    // fila: B
    s = onSentence(s, item('C', 'audio:C'), true).state                    // fila: B, C
    expect(s.current?.audioUrl).toBe('audio:A')
    s = onPracticeDone(s).state                                            // → B
    expect(s.current?.text).toBe('B')
    expect(s.current?.audioUrl).toBe('audio:B')   // áudio de B, não o "último" (C)
    s = onPracticeDone(s).state                                            // → C
    expect(s.current?.audioUrl).toBe('audio:C')
  })
})

describe('onPracticeDone', () => {
  it('resumes the video when the queue is empty', () => {
    const s: MonitorState = { phase: 'practicing', current: item('A'), queue: [] }
    const r = onPracticeDone(s)
    expect(r.action).toBe('resume')
    expect(r.state).toEqual(INITIAL_MONITOR)
  })

  it('practices the next queued sentence, keeping video paused', () => {
    const s: MonitorState = { phase: 'practicing', current: item('A'), queue: [item('B'), item('C')] }
    const r = onPracticeDone(s)
    expect(r.action).toBe('practice-next')
    expect(r.state.current?.text).toBe('B')
    expect(r.state.queue.map(q => q.text)).toEqual(['C'])
  })

  it('is a no-op when not practicing', () => {
    expect(onPracticeDone(INITIAL_MONITOR).action).toBe('none')
  })

  it('drains a multi-item queue across successive calls then resumes', () => {
    let s: MonitorState = { phase: 'practicing', current: item('A'), queue: [item('B'), item('C')] }
    let r = onPracticeDone(s); s = r.state           // → B
    expect(r.action).toBe('practice-next')
    r = onPracticeDone(s); s = r.state               // → C
    expect(r.action).toBe('practice-next')
    expect(s.current?.text).toBe('C')
    r = onPracticeDone(s); s = r.state               // → resume
    expect(r.action).toBe('resume')
    expect(s).toEqual(INITIAL_MONITOR)
  })
})

describe('onAbort', () => {
  it('resumes when aborting mid-practice', () => {
    const s: MonitorState = { phase: 'practicing', current: item('A'), queue: [item('B')] }
    const r = onAbort(s)
    expect(r.action).toBe('resume')
    expect(r.state).toEqual(INITIAL_MONITOR)
  })

  it('does not resume when only watching', () => {
    const r = onAbort(INITIAL_MONITOR)
    expect(r.action).toBe('none')
    expect(r.state).toEqual(INITIAL_MONITOR)
  })
})

describe('full cycle integration', () => {
  it('watch → sentence → practice → done → watch', () => {
    let s = INITIAL_MONITOR
    const a = onSentence(s, item('The quick brown fox.'), true)
    expect(a.action).toBe('pause-and-practice')
    s = a.state
    const b = onPracticeDone(s)
    expect(b.action).toBe('resume')
    s = b.state
    expect(s.phase).toBe('watching')
  })
})

describe('onSentence — run-on / long-capture guard', () => {
  const longText = Array.from({ length: MAX_PRACTICE_WORDS + 5 }, (_, i) => `word${i}`).join(' ')

  it('does NOT auto-practice a capture longer than the word cap', () => {
    const { state, action } = onSentence(INITIAL_MONITOR, item(longText), true)
    expect(action).toBe('none')
    expect(state.phase).toBe('watching')  // stays watching, no pause
  })

  it('still practices a normal-length line', () => {
    const { action } = onSentence(INITIAL_MONITOR, item('This is a normal line.'), true)
    expect(action).toBe('pause-and-practice')
  })

  it('does not queue an over-long capture while practicing', () => {
    const practicing: MonitorState = { phase: 'practicing', current: item('hi'), queue: [] }
    const { state, action } = onSentence(practicing, item(longText), true)
    expect(action).toBe('none')
    expect(state.queue).toEqual([])  // not queued
  })

  it('accepts a line exactly at the cap', () => {
    const atCap = Array.from({ length: MAX_PRACTICE_WORDS }, () => 'w').join(' ')
    expect(onSentence(INITIAL_MONITOR, item(atCap), true).action).toBe('pause-and-practice')
  })
})
