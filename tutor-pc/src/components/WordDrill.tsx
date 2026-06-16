import { Volume2, AlertTriangle } from 'lucide-react'
import { ttsAPI } from '../services/electron'
import { playClip, playSlice } from '../lib/playClip'
import { findWordCue } from '../lib/tts'
import { missingWords } from '../lib/text'
import { useT } from '../lib/uiLangContext'
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
  const t = useT()
  const missed = missingWords(attempt.diff)
  if (missed.length === 0) return null

  return (
    <div className="mt-2 rounded-lg border border-danger/30 bg-danger/[0.06] p-2.5">
      <div className="flex items-center gap-1.5 mb-2">
        <AlertTriangle size={12} className="text-danger" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-danger">
          {t('pronToFix')} {missed.length} {t(missed.length === 1 ? 'wordSingular' : 'wordsPlural')}
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
                  onClick={() => attempt.originalAudioUrl && playSlice(attempt.originalAudioUrl, cue.start, cue.end)}
                  className="flex items-center justify-center w-5 h-5 rounded text-success hover:bg-success/15 transition-colors"
                  title={t('listenOriginalSceneVoice')}
                >
                  <Volume2 size={11} />
                </button>
              )}
              <button
                onClick={() => speakWord(word, attempt.lang)}
                className="flex items-center justify-center w-5 h-5 rounded text-primary/80 hover:bg-primary/15 transition-colors"
                title={t('listenCorrectTts')}
              >
                <Volume2 size={11} />
              </button>
            </div>
          )
        })}
      </div>

      <p className="text-[10px] text-muted/50 mt-2 leading-snug">
        {t('drillHint')}
      </p>
    </div>
  )
}
