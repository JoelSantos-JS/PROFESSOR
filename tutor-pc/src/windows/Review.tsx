import { useEffect, useState, useCallback } from 'react'
import { Volume2, Check, X, Brain, Shuffle, Loader2 } from 'lucide-react'
import TitleBar from '../components/TitleBar'
import { storeAPI, ttsAPI, tutorAPI, windowAPI, onChannel, settingsAPI } from '../services/electron'
import { reviewCard, nextDue, type Grade } from '../lib/srs'
import { playClip } from '../lib/playClip'
import { languageFlag, languageNameFor } from '../lib/languages'
import { uiText, appLanguage, type AppLanguage } from '../lib/uiLanguage'
import type { VocabCard, SentenceVariation, LangStat } from '../types'

async function speak(text: string, lang: string) {
  try {
    const res = await ttsAPI.speak(text, lang)
    if (res.ok && res.dataUrl) playClip(res.dataUrl)
  } catch { /* ignore */ }
}

export default function Review() {
  const [uiLang, setUiLang] = useState<AppLanguage>('pt')
  const t = (key: Parameters<typeof uiText>[1]) => uiText(uiLang, key)
  const [queue, setQueue]   = useState<VocabCard[]>([])
  const [idx, setIdx]       = useState(0)
  const [revealed, setReveal] = useState(false)
  const [done, setDone]     = useState(0)
  const [loading, setLoading] = useState(true)

  // On-demand sentence variations (paraphrases)
  const [variations, setVariations] = useState<SentenceVariation[] | null>(null)
  const [varLoading, setVarLoading] = useState(false)

  // Language separation: each studied language is its own deck
  const [languages, setLanguages] = useState<LangStat[]>([])
  const [selectedLang, setSelectedLang] = useState<string | null>(null)

  const loadDeck = useCallback((lang: string) => {
    setSelectedLang(lang)
    setLoading(true)
    setQueue([]); setIdx(0); setDone(0); setReveal(false); setVariations(null)
    storeAPI.dueVocab(lang)
      .then(cards => { setQueue(cards); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { settingsAPI.getAll().then(s => setUiLang(appLanguage(s.appLanguage))).catch(() => {}) }, [])

  useEffect(() => {
    Promise.all([storeAPI.languages(), windowAPI.pendingReviewLang()]).then(([langs, pending]) => {
      setLanguages(langs)
      // Open the deck the Dashboard asked for, else the most-due one.
      const target = pending && langs.some(l => l.lang === pending) ? pending : langs[0]?.lang
      if (target) loadDeck(target)
      else setLoading(false)
    }).catch(() => setLoading(false))
  }, [loadDeck])

  // Switch deck live if the Dashboard requests another language while we're open.
  useEffect(() => onChannel('review:language', (lang) => {
    if (typeof lang === 'string' && lang) loadDeck(lang)
  }), [loadDeck])

  const card = queue[idx]

  const loadVariations = useCallback(async () => {
    if (!card) return
    setVarLoading(true)
    const res = await tutorAPI.variations(card.word, card.lang).catch(() => null)
    setVariations(res?.ok ? (res.variations ?? []) : [])
    setVarLoading(false)
  }, [card])

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
    setVariations(null)
    setIdx(i => i + 1)
  }, [card])

  return (
    <div className="flex flex-col h-screen app-paper text-foreground">
      <TitleBar title={t('review')} />

      {/* Language separator — one deck per studied language */}
      {languages.length > 1 && (
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 overflow-x-auto bg-surface-2">
          {languages.map(l => (
            <button
              key={l.lang}
              onClick={() => loadDeck(l.lang)}
              className={[
                'pill-button text-xs px-3 py-1.5 whitespace-nowrap transition-colors border',
                l.lang === selectedLang
                  ? 'bg-primary/15 text-primary border-primary/40'
                  : 'text-muted hover:text-foreground hover:bg-white border-transparent',
              ].join(' ')}
            >
              {languageFlag(l.lang)} {languageNameFor(l.lang, uiLang)}
              {l.due > 0 && (
                <span className={l.lang === selectedLang ? 'text-primary' : 'text-warning'}>{l.due}</span>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center p-7">
        {loading ? (
          <p className="text-sm text-muted">{t('loadingWord')}</p>
        ) : !card ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <Brain size={40} className="text-success opacity-50" />
            <h2 className="display-title text-2xl">
              {done > 0 ? t('reviewDone') : t('nothingDue')}
            </h2>
            <p className="text-sm text-muted">
              {done > 0
                ? `${t('youReviewed')} ${done} ${t(done === 1 ? 'phrase' : 'phrases')}.`
                : t('captureAndComeBack')}
            </p>
          </div>
        ) : (
          <div className="w-full max-w-md">
            {/* Progress */}
            <div className="flex items-center justify-between mb-4 text-xs text-muted">
              <span>{idx + 1} / {queue.length}</span>
              <span>{done} {t('reviewedCount')}</span>
            </div>

            {/* Card */}
            <div className="paper-card p-7 min-h-56 flex flex-col items-center justify-center text-center gap-3">
              <div className="flex items-start gap-2">
                <span className="display-title text-[28px] leading-snug">{card.word}</span>
                <button
                  onClick={() => speak(card.word, card.lang)}
                  className="text-muted hover:text-primary transition-colors shrink-0 mt-2"
                  title={t('listen')}
                >
                  <Volume2 size={18} />
                </button>
              </div>
              {card.romanization && <span className="text-sm text-primary/70 font-mono">{card.romanization}</span>}

              {revealed && (
                <div className="mt-2 pt-4 border-t border-border w-full">
                  <p className="text-base text-foreground">{card.translation}</p>

                  {/* Variations (paraphrases) — generated on demand */}
                  {variations === null ? (
                    <button
                      onClick={loadVariations}
                      disabled={varLoading}
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary/80 hover:text-primary transition-colors disabled:opacity-50"
                    >
                      {varLoading ? <Loader2 size={13} className="animate-spin" /> : <Shuffle size={13} />}
                      {varLoading ? t('generatingVariations') : t('seeVariations')}
                    </button>
                  ) : variations.length > 0 ? (
                    <div className="mt-3 space-y-1.5 text-left">
                      <p className="text-[10px] uppercase tracking-wider text-muted/50">{t('otherWaysToSay')}</p>
                      {variations.map((v, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <button
                            onClick={() => speak(v.text, card.lang)}
                            className="text-muted hover:text-primary transition-colors shrink-0 mt-0.5"
                            title={t('listen')}
                          >
                            <Volume2 size={13} />
                          </button>
                          <div>
                            <p className="text-sm text-foreground/90">{v.text}</p>
                            {v.translation && <p className="text-xs text-muted/60">{v.translation}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-muted/50">{t('noVariations')}</p>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            {!revealed ? (
              <button
                onClick={() => setReveal(true)}
                className="w-full mt-4 pill-button pill-primary py-3 text-sm"
              >
                {t('showAnswer')}
              </button>
            ) : (
              <div className="grid grid-cols-3 gap-2 mt-4">
                <button onClick={() => grade(1)} className="flex flex-col items-center gap-1 bg-danger/15 text-danger hover:bg-danger/25 py-3 rounded-xl text-xs font-bold transition-colors">
                  <X size={16} /> {t('gotWrong')}
                </button>
                <button onClick={() => grade(3)} className="flex flex-col items-center gap-1 bg-warning/15 text-warning hover:bg-warning/25 py-3 rounded-xl text-xs font-bold transition-colors">
                  <Brain size={16} /> {t('hard')}
                </button>
                <button onClick={() => grade(5)} className="flex flex-col items-center gap-1 bg-success/15 text-success hover:bg-success/25 py-3 rounded-xl text-xs font-bold transition-colors">
                  <Check size={16} /> {t('easy')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
