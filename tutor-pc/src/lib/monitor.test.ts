import { describe, it, expect } from 'vitest'
import { onSentence, onPracticeDone, onAbort, INITIAL_MONITOR, type MonitorState } from './monitor'

describe('onSentence', () => {
  it('does nothing when auto mode is OFF', () => {
    const r = onSentence(INITIAL_MONITOR, 'Hello there.', false)
    expect(r.action).toBe('none')
    expect(r.state).toBe(INITIAL_MONITOR)
  })

  it('does nothing for empty/blank sentence', () => {
    expect(onSentence(INITIAL_MONITOR, '   ', true).action).toBe('none')
    expect(onSentence(INITIAL_MONITOR, '', true).action).toBe('none')
  })

  it('starts practicing when watching and auto ON', () => {
    const r = onSentence(INITIAL_MONITOR, 'Hello there.', true)
    expect(r.action).toBe('pause-and-practice')
    expect(r.state.phase).toBe('practicing')
    expect(r.state.current).toBe('Hello there.')
    expect(r.state.queue).toEqual([])
  })

  it('trims the sentence', () => {
    const r = onSentence(INITIAL_MONITOR, '  Hi  ', true)
    expect(r.state.current).toBe('Hi')
  })

  it('queues a new sentence while already practicing', () => {
    const practicing = { phase: 'practicing' as const, current: 'First.', queue: [] as string[] }
    const r = onSentence(practicing, 'Second.', true)
    expect(r.action).toBe('none')
    expect(r.state.current).toBe('First.')       // unchanged
    expect(r.state.queue).toEqual(['Second.'])
  })

  it('appends multiple queued sentences in order', () => {
    let s = onSentence(INITIAL_MONITOR, 'A', true).state
    s = onSentence(s, 'B', true).state
    s = onSentence(s, 'C', true).state
    expect(s.current).toBe('A')
    expect(s.queue).toEqual(['B', 'C'])
  })
})

describe('onPracticeDone', () => {
  it('resumes the video when the queue is empty', () => {
    const s = { phase: 'practicing' as const, current: 'A', queue: [] as string[] }
    const r = onPracticeDone(s)
    expect(r.action).toBe('resume')
    expect(r.state).toEqual(INITIAL_MONITOR)
  })

  it('practices the next queued sentence, keeping video paused', () => {
    const s = { phase: 'practicing' as const, current: 'A', queue: ['B', 'C'] }
    const r = onPracticeDone(s)
    expect(r.action).toBe('practice-next')
    expect(r.state.current).toBe('B')
    expect(r.state.queue).toEqual(['C'])
  })

  it('is a no-op when not practicing', () => {
    expect(onPracticeDone(INITIAL_MONITOR).action).toBe('none')
  })

  it('drains a multi-item queue across successive calls then resumes', () => {
    let s: MonitorState = { phase: 'practicing', current: 'A', queue: ['B', 'C'] }
    let r = onPracticeDone(s); s = r.state           // → B
    expect(r.action).toBe('practice-next')
    r = onPracticeDone(s); s = r.state               // → C
    expect(r.action).toBe('practice-next')
    expect(s.current).toBe('C')
    r = onPracticeDone(s); s = r.state               // → resume
    expect(r.action).toBe('resume')
    expect(s).toEqual(INITIAL_MONITOR)
  })
})

describe('onAbort', () => {
  it('resumes when aborting mid-practice', () => {
    const s = { phase: 'practicing' as const, current: 'A', queue: ['B'] }
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
    const a = onSentence(s, 'The quick brown fox.', true)
    expect(a.action).toBe('pause-and-practice')
    s = a.state
    const b = onPracticeDone(s)
    expect(b.action).toBe('resume')
    s = b.state
    expect(s.phase).toBe('watching')
  })
})

import { MAX_PRACTICE_WORDS } from './monitor'

describe('onSentence — run-on / long-capture guard', () => {
  const longText = Array.from({ length: MAX_PRACTICE_WORDS + 5 }, (_, i) => `word${i}`).join(' ')

  it('does NOT auto-practice a capture longer than the word cap', () => {
    const { state, action } = onSentence(INITIAL_MONITOR, longText, true)
    expect(action).toBe('none')
    expect(state.phase).toBe('watching')  // stays watching, no pause
  })

  it('still practices a normal-length line', () => {
    const { action } = onSentence(INITIAL_MONITOR, 'This is a normal line.', true)
    expect(action).toBe('pause-and-practice')
  })

  it('does not queue an over-long capture while practicing', () => {
    const practicing = { phase: 'practicing' as const, current: 'hi', queue: [] as string[] }
    const { state, action } = onSentence(practicing, longText, true)
    expect(action).toBe('none')
    expect(state.queue).toEqual([])  // not queued
  })

  it('accepts a line exactly at the cap', () => {
    const atCap = Array.from({ length: MAX_PRACTICE_WORDS }, () => 'w').join(' ')
    expect(onSentence(INITIAL_MONITOR, atCap, true).action).toBe('pause-and-practice')
  })
})
