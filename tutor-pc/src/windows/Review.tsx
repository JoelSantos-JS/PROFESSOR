import { useEffect, useState, useCallback } from 'react'
import { Volume2, Check, X, Brain } from 'lucide-react'
import TitleBar from '../components/TitleBar'
import { storeAPI, ttsAPI } from '../services/electron'
import { reviewCard, nextDue, type Grade } from '../lib/srs'
import { playClip } from '../lib/playClip'
import type { VocabCard } from '../types'

async function speak(text: string, lang: string) {
  try {
    const res = await ttsAPI.speak(text, lang)
    if (res.ok && res.dataUrl) playClip(res.dataUrl)
  } catch { /* ignore */ }
}

export default function Review() {
  const [queue, setQueue]   = useState<VocabCard[]>([])
  const [idx, setIdx]       = useState(0)
  const [revealed, setReveal] = useState(false)
  const [done, setDone]     = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    storeAPI.dueVocab().then(cards => { setQueue(cards); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const card = queue[idx]

  const grade = useCallback(async (quality: Grade) => {
    if (!card) return
    const next = reviewCard({ ease: card.ease, interval: card.interval, reps: card.reps }, quality)
    await storeAPI.gradeVocab(card.id, {
      ease: next.ease,
      interval: next.interval,
      reps: next.reps,
      due: nextDue(next.interval),
      lapsed: quality < 3,
    }).catch(console.error)
    setDone(d => d + 1)
    setReveal(false)
    setIdx(i => i + 1)
  }, [card])

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <TitleBar title="Revisão" />

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {loading ? (
          <p className="text-sm text-muted">Carregando...</p>
        ) : !card ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <Brain size={40} className="text-success opacity-50" />
            <h2 className="text-lg font-semibold">
              {done > 0 ? 'Revisão concluída! 🎉' : 'Nada para revisar agora'}
            </h2>
            <p className="text-sm text-muted">
              {done > 0
                ? `Você revisou ${done} ${done === 1 ? 'palavra' : 'palavras'}.`
                : 'Capture vocabulário no Tutor Board e volte mais tarde.'}
            </p>
          </div>
        ) : (
          <div className="w-full max-w-md">
            {/* Progress */}
            <div className="flex items-center justify-between mb-4 text-xs text-muted">
              <span>{idx + 1} / {queue.length}</span>
              <span>{done} revisadas</span>
            </div>

            {/* Card */}
            <div className="bg-surface border border-border rounded-2xl p-8 min-h-52 flex flex-col items-center justify-center text-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-3xl font-semibold">{card.word}</span>
                <button
                  onClick={() => speak(card.word, card.lang)}
                  className="text-muted hover:text-primary transition-colors"
                  title="Ouvir"
                >
                  <Volume2 size={18} />
                </button>
              </div>
              {card.romanization && <span className="text-sm text-primary/70 font-mono">{card.romanization}</span>}

              {revealed && (
                <div className="mt-2 pt-3 border-t border-border w-full">
                  <p className="text-base text-foreground">{card.translation}</p>
                  {card.example && <p className="text-xs text-muted/70 italic mt-2">{card.example}</p>}
                </div>
              )}
            </div>

            {/* Actions */}
            {!revealed ? (
              <button
                onClick={() => setReveal(true)}
                className="w-full mt-4 bg-primary hover:bg-primary/90 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                Mostrar resposta
              </button>
            ) : (
              <div className="grid grid-cols-3 gap-2 mt-4">
                <button onClick={() => grade(1)} className="flex flex-col items-center gap-1 bg-danger/15 text-danger hover:bg-danger/25 py-2.5 rounded-lg text-xs font-medium transition-colors">
                  <X size={16} /> Errei
                </button>
                <button onClick={() => grade(3)} className="flex flex-col items-center gap-1 bg-warning/15 text-warning hover:bg-warning/25 py-2.5 rounded-lg text-xs font-medium transition-colors">
                  <Brain size={16} /> Difícil
                </button>
                <button onClick={() => grade(5)} className="flex flex-col items-center gap-1 bg-success/15 text-success hover:bg-success/25 py-2.5 rounded-lg text-xs font-medium transition-colors">
                  <Check size={16} /> Fácil
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
