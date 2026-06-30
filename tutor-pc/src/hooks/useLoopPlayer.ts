import { useCallback, useEffect, useRef, useState } from 'react'
import { listeningAPI } from '../services/electron'
import { stopClip } from '../lib/playClip'
import { speedForRepeat } from '../lib/loopPlan'

// Executor do modo Loop/Chorus. Reproduz o clipe original N vezes (com velocidade
// graduada opcional) e intervalos entre as repetições para o aluno repetir (shadowing).
// O gap "echo" é medido pela duração REAL da reprodução — robusto a WebM/MediaRecorder
// (cuja duração declarada pode ser Infinity). Pausa o listener enquanto toca.

export interface LoopRunConfig {
  repeats: number
  gap: 'none' | 'echo' | number
  speeds?: number[]
  onTime?: (ms: number, dur: number) => void   // progresso da reprodução → sync de palavras (karaokê)
  onEnd?: () => void                            // ao terminar/parar → reseta o destaque
}

export interface LoopPlayerState {
  phase: 'idle' | 'play' | 'gap'
  repeat: number   // repetição atual (0-based)
  total: number
}

export function useLoopPlayer(url?: string) {
  const [state, setState] = useState<LoopPlayerState>({ phase: 'idle', repeat: 0, total: 0 })
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number | null>(null)
  const cfgRef = useRef<LoopRunConfig | null>(null)
  const cancelledRef = useRef(false)
  const pausedRef = useRef(false)

  const teardown = useCallback(() => {
    cancelledRef.current = true
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    const a = audioRef.current
    if (a) { a.onended = null; a.onerror = null; try { a.pause() } catch { /* ignore */ } }
    audioRef.current = null
    if (pausedRef.current) { listeningAPI.resume(); pausedRef.current = false }
  }, [])

  const stop = useCallback(() => {
    cfgRef.current?.onEnd?.()   // reseta o destaque das palavras (no fim natural ou no stop manual)
    teardown()
    setState({ phase: 'idle', repeat: 0, total: 0 })
  }, [teardown])

  const start = useCallback((cfg: LoopRunConfig) => {
    if (!url) return
    const total = Math.max(0, Math.floor(cfg.repeats))
    if (total === 0) return

    teardown()
    cancelledRef.current = false
    cfgRef.current = cfg
    stopClip()                        // encerra qualquer outro clipe + reseta seu estado
    listeningAPI.pause(); pausedRef.current = true
    setState({ phase: 'play', repeat: 0, total })

    const playOne = (idx: number) => {
      if (cancelledRef.current) return
      setState({ phase: 'play', repeat: idx, total })
      const audio = new Audio(url)
      audioRef.current = audio
      audio.playbackRate = speedForRepeat(cfg.speeds, idx)
      const startedAt = performance.now()
      let advanced = false

      // Emite o tempo da reprodução a cada frame → sincroniza o destaque das palavras (karaokê).
      const tick = () => {
        if (cancelledRef.current || advanced) return
        const dur = Number.isFinite(audio.duration) ? audio.duration * 1000 : 0
        cfg.onTime?.(audio.currentTime * 1000, dur)
        rafRef.current = requestAnimationFrame(tick)
      }

      const next = () => {
        if (advanced) return    // onended + onerror/catch podem disparar juntos
        advanced = true
        if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
        audio.onended = null; audio.onerror = null
        if (cancelledRef.current) return
        if (idx + 1 >= total) { stop(); return }
        const playedMs = performance.now() - startedAt
        const gap = cfg.gap === 'none' ? 0 : cfg.gap === 'echo' ? playedMs : Math.max(0, cfg.gap)
        if (gap > 0) {
          setState({ phase: 'gap', repeat: idx, total })
          timerRef.current = setTimeout(() => playOne(idx + 1), gap)
        } else {
          playOne(idx + 1)
        }
      }

      audio.onended = next
      audio.onerror = next
      audio.play().catch(next)
      rafRef.current = requestAnimationFrame(tick)   // começa a sincronizar as palavras
    }

    playOne(0)
  }, [url, teardown, stop])

  // Encerra ao desmontar (não deixa o listener pausado nem timers vazando).
  useEffect(() => () => teardown(), [teardown])

  return { ...state, running: state.phase !== 'idle', start, stop }
}
