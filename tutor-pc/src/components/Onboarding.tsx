import { useEffect, useState } from 'react'
import { Check, ExternalLink, KeyRound, RefreshCw, ArrowRight, Sparkles, Lock } from 'lucide-react'
import TitleBar from './TitleBar'
import { settingsAPI, credentialsAPI, windowAPI, onChannel } from '../services/electron'
import { languageNameFor, languageFlag } from '../lib/languages'
import { uiText, appLanguage, type AppLanguage, type UiKey } from '../lib/uiLanguage'
import { UiLangProvider, useT, useUiLang } from '../lib/uiLangContext'
import {
  type OnboardingStep, type OnboardingLevel, LEVELS, DEFAULT_LEVEL,
  nextStep, prevStep, stepIndex, TOTAL_NAV_STEPS, resourceSectionsFor, serializeLevels,
} from '../lib/onboarding'
import { learnContentFor } from '../lib/learnContent'
import { resolveNativeLanguage, NATIVE_LANGUAGES } from '../lib/nativeLang'

// Idiomas oferecidos no 1º acesso — foco nos asiáticos (diferencial do app) + comuns.
const LANG_OPTIONS = ['ko', 'ja', 'zh', 'en', 'es', 'fr', 'de', 'it']

// Rótulo do nível (id → chave traduzida) — a estrutura LEVELS continua pura na lib.
const LEVEL_LABEL_KEY: Record<OnboardingLevel, UiKey> = {
  beginner: 'levelBeginner',
  'knows-script': 'levelKnowsScript',
  intermediate: 'levelIntermediate',
  advanced: 'levelAdvanced',
}

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [uiLang, setUiLang] = useState<AppLanguage>('pt')
  const t = (key: UiKey) => uiText(uiLang, key)
  const [step, setStep] = useState<OnboardingStep>('welcome')
  const [langs, setLangs] = useState<string[]>([])   // multi-seleção; o 1º é o "primário"
  const [levels, setLevels] = useState<Record<string, OnboardingLevel>>({})  // nível POR idioma
  // Idioma do usuário (no qual as explicações aparecem) — detectado do locale do sistema.
  const [native, setNative] = useState(() =>
    resolveNativeLanguage(typeof navigator !== 'undefined' ? navigator.language : 'pt-BR'))
  const [hasKey, setHasKey] = useState<boolean | null>(null)

  const primary = langs[0]
  const toggleLang = (id: string) => {
    setLangs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    setLevels(prev => {
      if (id in prev) { const next = { ...prev }; delete next[id]; return next }
      return { ...prev, [id]: DEFAULT_LEVEL }
    })
  }
  const setLevelFor = (lang: string, lvl: OnboardingLevel) =>
    setLevels(prev => ({ ...prev, [lang]: lvl }))

  const refreshKeys = () =>
    credentialsAPI.list().then(ps => setHasKey(ps.some(p => p.configured))).catch(() => setHasKey(false))

  useEffect(() => { if (step === 'apiKey') refreshKeys() }, [step])
  // Re-checa quando uma chave é salva (mesmo em OUTRA janela — Configurações) e quando a janela
  // recebe foco de volta → destrava o "Continuar" sem precisar reabrir o app.
  useEffect(() => onChannel('credentials:changed', refreshKeys), [])
  useEffect(() => {
    const onFocus = () => { if (step === 'apiKey') refreshKeys() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [step])
  useEffect(() => { settingsAPI.getAll().then(s => setUiLang(appLanguage(s.appLanguage))).catch(() => {}) }, [])

  const finish = async () => {
    await settingsAPI.set('nativeLanguage', native)
    await settingsAPI.set('targetLanguage', primary ?? 'en')
    await settingsAPI.set('learnLanguages', langs.join(','))
    await settingsAPI.set('languageLevels', serializeLevels(levels, langs))
    await settingsAPI.set('level', (primary && levels[primary]) || DEFAULT_LEVEL)  // compat
    await settingsAPI.set('onboarded', '1')
    windowAPI.onboardingComplete()   // libera a barra flutuante + tutor board
    onDone()
  }

  const go = (s: OnboardingStep) => setStep(s)

  return (
    <UiLangProvider value={uiLang}>
    <div className="fixed inset-0 z-50 flex flex-col h-screen app-paper text-foreground">
      <TitleBar title={t('onbSetupTitle')} showMinimize={false} />

      {/* Progresso */}
      <div className="px-5 sm:px-8 pt-5 shrink-0">
        <div className="flex items-center gap-2 max-w-[720px] mx-auto w-full">
          {Array.from({ length: TOTAL_NAV_STEPS }).map((_, i) => (
            <div
              key={i}
              className={[
                'h-1.5 flex-1 rounded-full transition-colors',
                i <= stepIndex(step) ? 'bg-primary' : 'bg-border',
              ].join(' ')}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-8 py-6">
        <div className="max-w-[720px] mx-auto w-full paper-card border border-border/70 px-5 py-6 sm:px-8 sm:py-7">

          {step === 'welcome' && (
            <section className="fade-up">
              <p className="label-eyebrow mb-2">{t('welcomeTo')} Soaken</p>
              <h1 className="display-title text-3xl mb-1">{t('whichLanguage')}</h1>
              <p className="text-sm text-muted mb-4">{t('onbWelcomeDesc')}</p>

              {/* Idioma do usuário (detectado do sistema) — as explicações aparecem nele */}
              <div className="flex flex-wrap items-center gap-2 mb-6 rounded-xl bg-surface-2/60 border border-border/60 px-3.5 py-2.5">
                <span className="text-sm text-muted">{t('explanationsAppearIn')}</span>
                <select
                  aria-label={t('yourLanguage')}
                  value={native}
                  onChange={e => setNative(e.target.value)}
                  className="bg-surface border border-border text-foreground text-sm rounded-lg px-2.5 py-1.5 outline-none focus:border-primary transition-colors cursor-pointer font-semibold"
                >
                  {NATIVE_LANGUAGES.map(l => (
                    <option key={l.code} value={l.code}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-7">
                {LANG_OPTIONS.map(id => {
                  const selected = langs.includes(id)
                  return (
                    <button
                      key={id}
                      onClick={() => toggleLang(id)}
                      aria-pressed={selected}
                      className={[
                        'relative paper-card px-3 py-3 flex flex-col items-center gap-1 transition-all',
                        selected
                          ? 'border-primary bg-primary/15 ring-2 ring-primary/45 shadow-[var(--sh-2)]'
                          : 'hover:bg-primary/5 hover:border-primary/40',
                      ].join(' ')}
                    >
                      {selected && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-white grid place-items-center">
                          <Check size={10} strokeWidth={3} />
                        </span>
                      )}
                      <span className="text-2xl leading-none">{languageFlag(id)}</span>
                      <span className={['text-xs font-semibold', selected ? 'text-primary' : ''].join(' ')}>
                        {languageNameFor(id, uiLang)}
                      </span>
                    </button>
                  )
                })}
              </div>

              {langs.length > 0 && (
                <>
                  <h2 className="display-title text-lg mb-1">{t('yourLevelEach')}</h2>
                  <p className="text-xs text-muted mb-3">{t('levelEachDesc')}</p>
                  <div className="flex flex-col gap-2 mb-7">
                    {langs.map(lang => (
                      <div key={lang} className="paper-card px-4 py-3 flex items-center gap-3">
                        <span className="text-lg leading-none">{languageFlag(lang)}</span>
                        <span className="text-sm font-semibold">{languageNameFor(lang, uiLang)}</span>
                        <select
                          aria-label={`${t('levelIn')} ${languageNameFor(lang, uiLang)}`}
                          value={levels[lang] ?? DEFAULT_LEVEL}
                          onChange={e => setLevelFor(lang, e.target.value as OnboardingLevel)}
                          className="ml-auto bg-surface-2 border border-border text-foreground text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-primary transition-colors cursor-pointer max-w-[200px]"
                        >
                          {LEVELS.map(l => (
                            <option key={l.id} value={l.id}>{t(LEVEL_LABEL_KEY[l.id])}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <button
                onClick={() => go(nextStep(step))}
                disabled={langs.length === 0}
                className="pill-button pill-primary px-5 py-2.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                title={langs.length === 0 ? t('pickAtLeastOne') : ''}
              >
                {t('continueWord')} <ArrowRight size={15} />
              </button>
            </section>
          )}

          {step === 'apiKey' && (
            <section className="fade-up">
              <p className="label-eyebrow mb-2">{t('onbStep2')}</p>
              <h1 className="display-title text-3xl mb-1">{t('connectApiKey')}</h1>
              <p className="text-sm text-muted mb-5">{t('onbApiKeyDesc')}</p>

              <div className={[
                'paper-card px-4 py-4 flex items-center gap-3 mb-3',
                hasKey ? 'border-success/40 bg-success/5' : 'border-warning/40 bg-warning/5',
              ].join(' ')}>
                <KeyRound size={18} className={hasKey ? 'text-success' : 'text-warning'} />
                <div className="flex-1 min-w-0">
                  {hasKey === null ? (
                    <span className="text-sm text-muted">{t('checking')}</span>
                  ) : hasKey ? (
                    <span className="text-sm text-success font-semibold">{t('keyConfigured')}</span>
                  ) : (
                    <span className="text-sm text-foreground">{t('noKeyYet')}</span>
                  )}
                </div>
                {!hasKey && (
                  <>
                    <button onClick={() => windowAPI.show('settings')} className="pill-button pill-primary px-3.5 py-2 text-xs whitespace-nowrap">
                      {t('openSettings')} <ExternalLink size={12} />
                    </button>
                    <button onClick={refreshKeys} className="text-muted hover:text-foreground transition-colors p-2 shrink-0" title={t('checkAgain')}>
                      <RefreshCw size={14} />
                    </button>
                  </>
                )}
              </div>

              {!hasKey && hasKey !== null && (
                <p className="flex items-center gap-1.5 text-[11px] text-warning mb-5">
                  <Lock size={11} className="shrink-0" />
                  {t('onbApiKeyHint')}
                </p>
              )}

              <div className="flex items-center gap-2">
                <button onClick={() => go(prevStep(step))} className="pill-button px-4 py-2.5 text-sm border border-border">
                  {t('back')}
                </button>
                <button
                  onClick={() => go(nextStep(step))}
                  disabled={!hasKey}
                  className="pill-button pill-primary px-5 py-2.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  title={hasKey ? '' : t('keyRequiredToContinue')}
                >
                  {t('continueWord')} <ArrowRight size={15} />
                </button>
              </div>
            </section>
          )}

          {step === 'resources' && (
            <ResourcesStep
              langs={langs}
              levels={levels}
              onBack={() => go(prevStep(step))}
              onNext={() => go(nextStep(step))}
            />
          )}

          {step === 'done' && (
            <section className="fade-up text-center pt-2">
              <div className="inline-grid place-items-center w-16 h-16 rounded-2xl bg-primary/15 text-primary mb-4">
                <Sparkles size={30} />
              </div>
              <h1 className="display-title text-3xl mb-2">{t('allSet')}</h1>
              <p className="text-sm text-muted mb-6 max-w-md mx-auto">
                {t('onbGoalPrefix')} <b className="text-primary">{t('onbCapture5')}</b>
                {primary ? <> {t('onbOf')} {languageNameFor(primary, uiLang)}</> : null}.
                {' '}{t('startPrompt')} <kbd className="rounded bg-surface-2 px-1.5 py-0.5 text-xs font-mono border border-border">Ctrl+Alt+L</kbd> {t('onbListenWatchHint')}
                {langs.length > 1 && (
                  <span className="block mt-2 text-xs">
                    {t('onbMultiLangA')} {langs.length} {t('onbMultiLangB')}
                  </span>
                )}
              </p>
              <button onClick={finish} className="pill-button pill-primary px-6 py-3 text-sm">
                {t('startLearning')} <ArrowRight size={16} />
              </button>
            </section>
          )}
        </div>
      </div>
    </div>
    </UiLangProvider>
  )
}

function ResourcesStep({ langs, levels, onBack, onNext }: {
  langs: string[]
  levels: Record<string, OnboardingLevel>
  onBack: () => void
  onNext: () => void
}) {
  const t = useT()
  const uiLang = useUiLang()
  const sectionsFor = (l: string) => resourceSectionsFor(levels[l] ?? DEFAULT_LEVEL)

  // Primers de escrita: idiomas em nível iniciante que têm sistema de escrita.
  const writingLangs = langs.filter(l => sectionsFor(l).includes('writing') && learnContentFor(l, uiLang).writing)
  // Prática/conversação: se QUALQUER idioma for intermediário/avançado.
  const showPractice = langs.some(l => sectionsFor(l).includes('practice'))
  // Canais: só dos idiomas que ainda se beneficiam (iniciante/já-lê-a-escrita), deduplicados.
  const channelLangs = langs.filter(l => sectionsFor(l).includes('channels'))
  const channels = (() => {
    const seen = new Set<string>()
    const out: Array<{ name: string; url: string; note?: string }> = []
    for (const l of channelLangs) {
      for (const ch of learnContentFor(l, uiLang).channels) {
        if (seen.has(ch.url)) continue
        seen.add(ch.url)
        out.push(ch)
      }
    }
    return out
  })()
  const showChannels = channels.length > 0

  const langWord = langs.length > 1 ? t('ofYourLanguages') : `${t('onbOf')} ${languageNameFor(langs[0] ?? '', uiLang)}`
  const heading = writingLangs.length > 0
    ? t('startWithWriting')
    : showPractice
      ? t('focusOnSpeaking')
      : `${t('immersion')} ${langWord}`
  const subheading = writingLangs.length > 0
    ? t('startWithWritingSub')
    : showPractice
      ? t('focusOnSpeakingSub')
      : t('immersionSub')

  return (
    <section className="fade-up">
      <p className="label-eyebrow mb-2">{t('onbStep3')}</p>
      <h1 className="display-title text-3xl mb-1">{heading}</h1>
      <p className="text-sm text-muted mb-5">{subheading}</p>

      {showPractice && (
        <div className="paper-card px-5 py-4 mb-4">
          <h2 className="display-title text-lg mb-2.5">{t('trainProduction')}</h2>
          <ul className="text-sm space-y-1.5">
            {[t('onbBullet1'), t('onbBullet2'), t('onbBullet3'), t('onbBullet4')].map((b, i) => (
              <li key={i} className="flex gap-2">
                <Check size={15} className="text-primary shrink-0 mt-0.5" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {writingLangs.map(l => {
        const w = learnContentFor(l, uiLang).writing!
        return (
          <div key={l} className="paper-card px-5 py-4 mb-4">
            <h2 className="display-title text-lg mb-1">
              {languageNameFor(l, uiLang)} — {w.system}
            </h2>
            <p className="text-sm text-muted mb-2.5">{w.summary}</p>
            <ul className="text-sm space-y-1.5">
              {w.bullets.map((b, i) => (
                <li key={i} className="flex gap-2">
                  <Check size={15} className="text-primary shrink-0 mt-0.5" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        )
      })}

      {showChannels && (
      <div className="paper-card px-5 py-4 mb-6">
        <h2 className="display-title text-lg mb-2.5">{t('channelsToStart')}</h2>
        <div className="flex flex-col gap-2">
          {channels.map(ch => (
            <a
              key={ch.url}
              href={ch.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2.5 rounded-xl border border-border px-3.5 py-2.5 hover:bg-primary/5 transition-colors"
            >
              <ExternalLink size={14} className="text-primary shrink-0" />
              <span className="text-sm font-semibold">{ch.name}</span>
              {ch.note && <span className="text-xs text-muted truncate">— {ch.note}</span>}
            </a>
          ))}
        </div>
      </div>
      )}

      <div className="flex items-center gap-2">
        <button onClick={onBack} className="pill-button px-4 py-2.5 text-sm border border-border">{t('back')}</button>
        <button onClick={onNext} className="pill-button pill-primary px-5 py-2.5 text-sm">
          {t('continueWord')} <ArrowRight size={15} />
        </button>
      </div>
    </section>
  )
}
