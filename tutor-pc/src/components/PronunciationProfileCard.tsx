import { useEffect, useMemo, useState } from 'react'
import { Target, Volume2, Mic } from 'lucide-react'
import { storeAPI, ttsAPI } from '../services/electron'
import { playClip } from '../lib/playClip'
import { pronunciationProfile } from '../lib/pronunciationProfile'
import { uiText, type AppLanguage } from '../lib/uiLanguage'
import type { MistakeRecord } from '../types'

// Perfil de pontos fracos de pronúncia: mostra os SONS que o usuário mais erra (agrupados por
// traço fonético do idioma quando dá) + as palavras mais erradas, com "ouvir" e "treinar".
export default function PronunciationProfileCard({ lang, uiLang = 'pt', onTrain }: { lang: string; uiLang?: AppLanguage; onTrain?: (words: string[]) => void }) {
  const t = (key: Parameters<typeof uiText>[1]) => uiText(uiLang, key)
  const [mistakes, setMistakes] = useState<MistakeRecord[]>([])

  useEffect(() => {
    storeAPI.mistakes(lang).then(setMistakes).catch(() => setMistakes([]))
  }, [lang])

  const profile = useMemo(
    () => pronunciationProfile(lang, mistakes.map(m => ({ word: m.word, count: m.count, struggleSessions: m.struggleSessions }))),
    [lang, mistakes],
  )

  const speak = async (word: string) => {
    const res = await ttsAPI.speak(word, lang).catch(() => null)
    if (res?.ok && res.dataUrl) playClip(res.dataUrl)
  }

  return (
    <section className="paper-card px-5 py-4 mb-7">
      <div className="flex items-center gap-2 mb-3">
        <Target size={17} className="text-primary" />
        <h2 className="display-title text-[19px]">{t('pronProfileTitle')}</h2>
      </div>

      {profile.total === 0 ? (
        <p className="text-sm text-muted">
          {t('pronProfileEmpty')}
        </p>
      ) : (
        <div className="space-y-3">
          {/* Sons fracos (grupos por traço fonético) */}
          {profile.groups.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted/60 mb-1.5">{t('pronSoundsYouMiss')}</p>
              <div className="flex flex-wrap gap-1.5">
                {profile.groups.map(g => (
                  <span key={g.key} className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 border border-warning/30 px-2.5 py-1 text-xs">
                    <span className="font-semibold text-foreground">{g.label}</span>
                    <span className="text-warning/80 font-bold">{g.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Palavras mais erradas */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted/60 mb-1.5">{t('pronWordsToTrain')}</p>
            <div className="flex flex-wrap gap-1.5">
              {profile.top.map(w => (
                <button
                  key={w.word}
                  onClick={() => speak(w.word)}
                  title={`${t('listen')} "${w.word}"`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 border border-border px-2.5 py-1 text-sm hover:border-primary/50 transition-colors"
                >
                  <span className="font-semibold text-foreground">{w.word}</span>
                  <span className="text-[11px] text-danger/70 font-bold">{((w.struggleSessions ?? 0) > 0 ? w.struggleSessions : w.count)}×</span>
                  <Volume2 size={12} className="text-muted" />
                </button>
              ))}
            </div>
          </div>

          {onTrain && (
            <button onClick={() => onTrain(profile.top.map(w => w.word))} className="pill-button pill-primary px-4 py-2 text-sm">
              <Mic size={14} /> {t('pronTrainButton')}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
