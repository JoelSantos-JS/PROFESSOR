import { useState, useRef, useCallback } from 'react'
import { audioAPI, listeningAPI } from '../services/electron'

export type PracticeState = 'idle' | 'countdown' | 'recording' | 'transcribing' | 'result'

export interface PracticeResult {
  text: string
  audioUrl: string
}

/** Read a Blob into a base64 data URL (to replay the user's recording). */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/** Recording time scaled to the sentence length (long sentences get more time). */
export function practiceMaxMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.min(90_000, Math.max(6_000, words * 700 + 4_000))
}

/**
 * Reusable mic-practice flow: 3-2-1 countdown → record → transcribe.
 * Pauses the live listener during recording so the loopback doesn't capture us.
 * `cancel()` guarantees the listener resumes and timers/recorders are torn down
 * (used when the user skips — otherwise listening would stay paused forever).
 */
export function usePractice() {
  const [state, setState]       = useState<PracticeState>('idle')
  const [countdown, setCountdown] = useState(3)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const chunksRef   = useRef<Blob[]>([])
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const onResultRef = useRef<((r: PracticeResult) => void) | null>(null)
  const hintRef     = useRef<string | undefined>(undefined)
  const cancelledRef = useRef(false)
  const pausedListenerRef = useRef(false)

  const resumeListener = useCallback(() => {
    if (pausedListenerRef.current) {
      listeningAPI.resume()
      pausedListenerRef.current = false
    }
  }, [])

  const begin = useCallback(async (maxMs: number) => {
    if (cancelledRef.current) { resumeListener(); return }
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = micStream
      if (cancelledRef.current) {           // cancelled while awaiting mic
        micStream.getTracks().forEach(t => t.stop())
        resumeListener()
        return
      }
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
      const rec = new MediaRecorder(micStream, { mimeType })
      recorderRef.current = rec
      chunksRef.current = []

      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = async () => {
        micStream.getTracks().forEach(t => t.stop())
        streamRef.current = null
        recorderRef.current = null
        resumeListener()
        if (cancelledRef.current) { setState('idle'); return }

        setState('transcribing')
        const blob = new Blob(chunksRef.current, { type: mimeType })
        if (blob.size < 500) { setState('idle'); return }
        try {
          const buf      = await blob.arrayBuffer()
          const audioUrl = await blobToDataUrl(blob)
          const res      = await audioAPI.transcribe(buf, hintRef.current)
          if (res.text && !cancelledRef.current) {
            onResultRef.current?.({ text: res.text, audioUrl })
            setState('result')
          } else {
            setState('idle')
          }
        } catch {
          setState('idle')
        }
      }

      rec.start()
      setState('recording')
      setTimeout(() => { if (rec.state === 'recording') rec.stop() }, maxMs)
    } catch {
      resumeListener()
      setState('idle')
    }
  }, [resumeListener])

  const start = useCallback((maxMs: number, onResult: (r: PracticeResult) => void, hint?: string) => {
    cancelledRef.current = false
    onResultRef.current = onResult
    hintRef.current = hint
    // pause the live listener up-front (so it never captures us, even pre-record)
    listeningAPI.pause()
    pausedListenerRef.current = true
    setState('countdown')
    setCountdown(3)
    let c = 3
    timerRef.current = setInterval(() => {
      c--
      setCountdown(c)
      if (c <= 0) {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        begin(maxMs)
      }
    }, 1000)
  }, [begin])

  const stop = useCallback(() => {
    // normal stop → onstop transcribes
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }, [])

  /** Abort everything and ALWAYS resume the listener (skip / unmount). */
  const cancel = useCallback(() => {
    cancelledRef.current = true
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (recorderRef.current?.state === 'recording') {
      try { recorderRef.current.stop() } catch { /* onstop will resume */ }
    } else {
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
      resumeListener()
    }
    setState('idle')
  }, [resumeListener])

  return { state, countdown, start, stop, cancel }
}
