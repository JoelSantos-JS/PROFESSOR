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
  onTime?: (ms: number) => void  // playback position, for karaoke sync
  onEnd?: () => void
  startMs?: number               // play only a slice (e.g. one word)
  endMs?: number
}

/** Play a clip (or a slice of it); pauses listening for its duration. */
export function playClip(url?: string, opts?: PlayOpts): void {
  if (!url) return
  current?.pause()
  ensurePaused()

  const audio = new Audio(url)
  current = audio
  const done = () => {
    if (current === audio) { ensureResumed(); current = null; opts?.onEnd?.() }
  }
  const endSec = opts?.endMs != null ? opts.endMs / 1000 : null

  audio.ontimeupdate = () => {
    if (endSec != null && audio.currentTime >= endSec) { audio.pause(); done(); return }
    opts?.onTime?.(audio.currentTime * 1000)
  }
  audio.onended = done
  audio.onerror = done

  if (opts?.startMs != null) {
    // Seek before playing so we don't hear the lead-in
    audio.addEventListener('loadedmetadata', () => {
      try { audio.currentTime = opts.startMs! / 1000 } catch { /* ignore */ }
      audio.play().catch(done)
    }, { once: true })
  } else {
    audio.play().catch(done)
  }
}

/** Stop any clip and resume listening (e.g. on unmount). */
export function stopClip(): void {
  current?.pause()
  current = null
  ensureResumed()
}
