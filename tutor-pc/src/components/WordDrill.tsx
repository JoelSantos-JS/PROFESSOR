import { Volume2, AlertTriangle } from 'lucide-react'
import { ttsAPI } from '../services/electron'
import { playClip } from '../lib/playClip'
import { findWordCue } from '../lib/tts'
import { missingWords } from '../lib/text'
import type { SessionAttempt } from '../types'

async function speakWord(word: string, lang: string) {
  const res = await ttsAPI.speak(word, lang).catch(() => null)
  if (res?.ok && res.dataUrl) playClip(res.dataUrl)
}

/**
 * Rigorous pronunciation drill: lists exactly the words the learner got wrong
 * and lets them hear the correct pronunciation (original voice + TTS) for each,
 * so they can fix their speaking word by word.
 */
export default function WordDrill({ attempt }: { attempt: SessionAttempt }) {
  const missed = missingWords(attempt.diff)
  if (missed.length === 0) return null

  return (
    <div className="mt-2 rounded-lg border border-danger/30 bg-danger/[0.06] p-2.5">
      <div className="flex items-center gap-1.5 mb-2">
        <AlertTriangle size={12} className="text-danger" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-danger">
          Pronúncia a corrigir — {missed.length} {missed.length === 1 ? 'palavra' : 'palavras'}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {missed.map((word, i) => {
          const cue = attempt.originalCues ? findWordCue(attempt.originalCues, word) : undefined
          return (
            <div
              key={i}
              className="flex items-center gap-1 rounded-md bg-surface border border-danger/20 pl-2 pr-1 py-1"
            >
              <span className="text-xs font-medium text-foreground">{word}</span>
              {cue && attempt.originalAudioUrl && (
                <button
                  onClick={() => playClip(attempt.originalAudioUrl, { startMs: cue.start, endMs: cue.end })}
                  className="flex items-center justify-center w-5 h-5 rounded text-success hover:bg-success/15 transition-colors"
                  title="Ouvir a pronúncia original (voz da cena)"
                >
                  <Volume2 size={11} />
                </button>
              )}
              <button
                onClick={() => speakWord(word, attempt.lang)}
                className="flex items-center justify-center w-5 h-5 rounded text-primary/80 hover:bg-primary/15 transition-colors"
                title="Ouvir pronúncia correta (TTS)"
              >
                <Volume2 size={11} />
              </button>
            </div>
          )
        })}
      </div>

      <p className="text-[10px] text-muted/50 mt-2 leading-snug">
        🟢 voz original · 🔵 TTS. Repita cada palavra até acertar — o objetivo é zerar esta lista.
      </p>
    </div>
  )
}
