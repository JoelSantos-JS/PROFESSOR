import { listeningAPI } from '../services/electron'

// Plays an audio clip (data URL) while PAUSING the live listener, so the system
// loopback doesn't re-capture and re-transcribe our own playback. Handles
// overlapping plays: the listener only resumes when the latest clip finishes.

let current: HTMLAudioElement | null = null
let pausedByClip = false

function ensurePaused() {
  if (!pausedByClip) { listeningAPI.pause(); pausedByClip = true }
}
function ensureResumed() {
  if (pausedByClip) { listeningAPI.resume(); pausedByClip = false }
}

interface PlayOpts {
  onTime?: (ms: number, durationMs: number) => void  // position + total, for karaoke sync
  onEnd?: () => void
  startMs?: number               // play only a slice (e.g. one word)
  endMs?: number
  rate?: number                  // playback speed (1 = normal, 0.8 = slower for listening)
}

/** Play a clip (or a slice of it); pauses listening for its duration. */
export function playClip(url?: string, opts?: PlayOpts): void {
  if (!url) return
  current?.pause()
  ensurePaused()

  const audio = new Audio(url)
  if (opts?.rate && opts.rate > 0) audio.playbackRate = opts.rate
  current = audio
  const endSec = opts?.endMs != null ? opts.endMs / 1000 : null
  let raf = 0

  const done = () => {
    cancelAnimationFrame(raf)
    if (current === audio) { ensureResumed(); current = null; opts?.onEnd?.() }
  }

  // Poll position at screen refresh rate (~60fps) instead of the coarse, ~4fps
  // `timeupdate` event — needed for word-accurate karaoke that doesn't drift.
  const tick = () => {
    if (current !== audio) return
    if (endSec != null && audio.currentTime >= endSec) { audio.pause(); done(); return }
    const dur = Number.isFinite(audio.duration) ? audio.duration * 1000 : 0
    opts?.onTime?.(audio.currentTime * 1000, dur)
    raf = requestAnimationFrame(tick)
  }

  audio.onended = done
  audio.onerror = done
  audio.onplaying = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(tick) }

  const startPlayback = () => {
    if (opts?.startMs != null) { try { audio.currentTime = opts.startMs / 1000 } catch { /* ignore */ } }
    audio.play().catch(done)
  }

  if (opts?.startMs != null) {
    // SLICE (one word): seek straight to the word and play. Do NOT run the
    // duration-fix below — seeking a streamed WebM to the end first breaks the
    // subsequent seek back to the word (it would play the whole clip).
    audio.addEventListener('loadedmetadata', startPlayback, { once: true })
  } else {
    // WHOLE clip: WebM from MediaRecorder reports duration = Infinity. Force a
    // real duration (seek past the end → browser clamps + fires durationchange)
    // so the time-based karaoke fallback works even without word cues.
    audio.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) { startPlayback(); return }
      const onDur = () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          audio.removeEventListener('durationchange', onDur)
          audio.currentTime = 0
          startPlayback()
        }
      }
      audio.addEventListener('durationchange', onDur)
      try { audio.currentTime = 1e101 } catch { startPlayback() }
    }, { once: true })
  }
}

// Shared output context for slice playback (decoding + playing exact ranges).
let sliceCtx: AudioContext | null = null
let sliceSource: AudioBufferSourceNode | null = null
function getSliceCtx(): AudioContext {
  if (!sliceCtx) {
    const Ctx: typeof AudioContext =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    sliceCtx = new Ctx()
  }
  return sliceCtx
}

async function decodeClip(url: string): Promise<AudioBuffer> {
  const ctx = getSliceCtx()
  if (ctx.state === 'suspended') await ctx.resume()
  const arr = await (await fetch(url)).arrayBuffer()
  return ctx.decodeAudioData(arr)
}

function playBufferSlice(buf: AudioBuffer, startSec: number, durSec: number): void {
  const ctx = getSliceCtx()
  const safeStart = Math.min(Math.max(0, startSec), Math.max(0, buf.duration - 0.05))
  const safeDur = Math.min(Math.max(0.08, durSec), Math.max(0.05, buf.duration - safeStart))
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.connect(ctx.destination)
  sliceSource = src
  src.onended = () => { if (sliceSource === src) { sliceSource = null; ensureResumed() } }
  src.start(0, safeStart, safeDur)
}

function probeDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url)
    const done = (duration: number) => {
      audio.onloadedmetadata = null
      audio.ondurationchange = null
      audio.onerror = null
      resolve(duration)
    }
    audio.onerror = () => reject(new Error('Could not load audio'))
    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        done(audio.duration * 1000)
        return
      }
      audio.ondurationchange = () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) done(audio.duration * 1000)
      }
      try { audio.currentTime = 1e101 } catch { reject(new Error('Could not probe duration')) }
    }
  })
}

async function playRatioSliceWithElement(url: string, startRatio: number, endRatio: number): Promise<void> {
  const durationMs = await probeDuration(url)
  const startMs = Math.min(durationMs, Math.max(0, startRatio * durationMs))
  const endMs = Math.min(durationMs, Math.max(startMs + 80, endRatio * durationMs))
  const wordMs = endMs - startMs
  const spanMs = Math.min(1200, Math.max(360, wordMs + 180))
  const shiftedStartMs = startMs + Math.min(90, wordMs * 0.18)
  const paddedStartMs = Math.min(Math.max(0, shiftedStartMs), Math.max(0, durationMs - spanMs))
  playClip(url, { startMs: paddedStartMs, endMs: paddedStartMs + spanMs })
}

/**
 * Play ONLY the [startMs, endMs] range of a clip — decodes it and plays the
 * exact buffer range via Web Audio. This is reliable for WebM/MediaRecorder
 * blobs, which can't be seeked accurately with an <audio> element (the reason a
 * word slice would play the whole sentence). Pauses the listener while playing.
 */
export async function playSlice(url: string, startMs: number, endMs: number): Promise<void> {
  if (!url) return
  current?.pause(); current = null
  try { sliceSource?.stop() } catch { /* ignore */ }
  ensurePaused()
  try {
    const buf = await decodeClip(url)
    const startSec = Math.max(0, startMs / 1000)
    const durSec   = Math.max(0.08, (endMs - startMs) / 1000)  // floor so very short words are audible
    playBufferSlice(buf, startSec, durSec)
  } catch {
    ensureResumed()
    playClip(url, { startMs, endMs })
  }
}

/**
 * Best-effort fallback when the transcription provider did not return word
 * timestamps. It plays a small proportional slice instead of the whole sentence.
 */
export async function playRatioSlice(url: string, startRatio: number, endRatio: number): Promise<void> {
  if (!url) return
  current?.pause(); current = null
  try { sliceSource?.stop() } catch { /* ignore */ }
  ensurePaused()
  try {
    const buf = await decodeClip(url)
    const durationMs = buf.duration * 1000
    if (!Number.isFinite(durationMs) || durationMs <= 0) throw new Error('Invalid audio duration')

    const startMs = Math.min(durationMs, Math.max(0, startRatio * durationMs))
    const endMs = Math.min(durationMs, Math.max(startMs + 80, endRatio * durationMs))
    const wordMs = endMs - startMs
    const spanMs = Math.min(1200, Math.max(360, wordMs + 180))
    const shiftedStartMs = startMs + Math.min(90, wordMs * 0.18)
    const paddedStartMs = Math.min(Math.max(0, shiftedStartMs), Math.max(0, durationMs - spanMs))

    playBufferSlice(buf, paddedStartMs / 1000, spanMs / 1000)
  } catch {
    ensureResumed()
    playRatioSliceWithElement(url, startRatio, endRatio).catch(() => undefined)
  }
}

/** Stop any clip and resume listening (e.g. on unmount). */
export function stopClip(): void {
  current?.pause()
  current = null
  try { sliceSource?.stop() } catch { /* ignore */ }
  sliceSource = null
  ensureResumed()
}
