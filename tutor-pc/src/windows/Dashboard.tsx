import { useEffect, useState } from 'react'
import { Activity, AlertTriangle, BookOpen, Brain, Flame, Home, Mic, Settings, Target } from 'lucide-react'
import TitleBar from '../components/TitleBar'
import { windowAPI, storeAPI, settingsAPI, authAPI, onChannel } from '../services/electron'
import { languageFlagCountry, languageNameFor } from '../lib/languages'
import { flagAssetForCountry } from '../lib/flagAssets'
import { goalProgress } from '../lib/dailyGoal'
import { appLanguage, uiText } from '../lib/uiLanguage'
import Onboarding from '../components/Onboarding'
import PronunciationDiagnostic from '../components/PronunciationDiagnostic'
import PronunciationProfileCard from '../components/PronunciationProfileCard'
import { wordDrillItems } from '../lib/pronunciationProfile'
import type { DiagnosticItem } from '../lib/diagnosticSentences'
import type { StoreStats } from '../types'

export default function Dashboard() {
  const [stats, setStats] = useState<StoreStats | null>(null)
  const [capturedToday, setCapturedToday] = useState(0)
  const [onboarded, setOnboarded] = useState<boolean | null>(null)
  const [uiLang, setUiLang] = useState(appLanguage())
  const [userName, setUserName] = useState('')
  const [targetLang, setTargetLang] = useState('en')
  const [diagOpen, setDiagOpen] = useState(false)
  const [drillItems, setDrillItems] = useState<DiagnosticItem[] | null>(null)   // treino focado nas palavras fracas

  useEffect(() => {
    storeAPI.stats().then(setStats).catch(console.error)
    storeAPI.capturedToday().then(setCapturedToday).catch(() => setCapturedToday(0))
    settingsAPI.getAll().then(s => {
      setOnboarded(s.onboarded === '1')
      setUiLang(appLanguage(s.appLanguage))
      setTargetLang((s.targetLanguage || 'en').split('-')[0])
    }).catch(() => setOnboarded(true))
    authAPI.getSession()
      .then(res => setUserName(res.ok && res.session?.user.name ? res.session.user.name : ''))
      .catch(() => setUserName(''))
  }, [])

  // Idioma/idioma-alvo mudam NA HORA quando o usuário troca nas Configurações (sem reiniciar).
  useEffect(() => onChannel('settings:changed', () => {
    settingsAPI.getAll().then(s => {
      setUiLang(appLanguage(s.appLanguage))
      setTargetLang((s.targetLanguage || 'en').split('-')[0])
    }).catch(() => {})
  }), [])

  if (onboarded === false) return <Onboarding onDone={() => setOnboarded(true)} />

  const goal = goalProgress(capturedToday)
  const totalDue = stats?.dueCount ?? 0
  const t = (key: Parameters<typeof uiText>[1]) => uiText(uiLang, key)
  const welcome = userName ? `${t('welcome')}, ${userName}` : t('welcome')
  const cards = [
    { label: t('sessions'), value: stats?.sessionCount ?? 0, icon: Activity },
    { label: t('phrases'), value: stats?.phraseCount ?? 0, icon: BookOpen },
    { label: t('streak'), value: stats?.streak ?? 0, suffix: t('days'), icon: Flame, accent: true },
  ]

  return (
    <div className="flex flex-col h-screen app-paper text-foreground overflow-hidden rounded-[14px] border border-border-strong">
      <TitleBar title={t('dashboardTitle')} />

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-[62px] shrink-0 flex flex-col items-center gap-1.5 py-3.5 bg-surface-2 border-r border-border">
          <div className="w-[38px] h-[38px] rounded-xl bg-primary text-white grid place-items-center display-title text-[21px] mb-2">
            S
          </div>

          <NavButton icon={Home} label={t('dashboardTitle')} active />
          <NavButton icon={Brain} label={t('review')} onClick={() => windowAPI.show('review')} />
          <NavButton icon={BookOpen} label={t('tutorBoard')} onClick={() => windowAPI.show('tutor-board')} />
          <NavButton icon={Mic} label={t('floatingBar')} onClick={() => windowAPI.show('floating-bar')} />

          <div className="mt-auto">
            <NavButton icon={Settings} label={t('settings')} onClick={() => windowAPI.show('settings')} />
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto px-8 py-7">
          <div className="mb-6">
            <h1 className="display-title text-[30px] leading-tight text-foreground">{welcome}</h1>
            <p className="text-[15px] text-muted mt-1">
              {t('ready')}{' '}
              <b className="text-primary">{totalDue}</b>{' '}
              {totalDue === 1 ? t('phrase') : t('phrases')} {t('toReview')}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3.5 mb-4">
            {cards.map(({ label, value, suffix, icon: Icon, accent }) => (
              <div key={label} className="paper-card px-5 py-4">
                <div className={['display-title text-[34px] leading-none', accent ? 'text-primary' : 'text-foreground'].join(' ')}>
                  {value}
                  {suffix && <span className="ml-1 text-base font-semibold font-sans text-muted">{suffix}</span>}
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-muted">
                  <Icon size={14} />
                  {label}
                </div>
              </div>
            ))}
          </div>

          {/* Meta diária */}
          <div className="paper-card px-5 py-4 mb-7">
            <div className="flex items-center gap-2 mb-2.5">
              <Target size={16} className={goal.reached ? 'text-success' : 'text-primary'} />
              <h2 className="display-title text-[17px]">{t('todayGoal')}</h2>
              <span className={['ml-auto text-sm font-bold', goal.reached ? 'text-success' : 'text-foreground'].join(' ')}>
                {goal.reached ? `${t('goalHit')} 🎉` : `${goal.done}/${goal.target} ${t('phrases')}`}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-border overflow-hidden">
              <div
                className={['h-full rounded-full transition-all', goal.reached ? 'bg-success' : 'bg-primary'].join(' ')}
                style={{ width: `${goal.pct}%` }}
              />
            </div>
            {!goal.reached && (
              <p className="text-xs text-muted mt-2">
                {t('remaining')} <b className="text-foreground">{goal.remaining}</b> — {t('startListeningHint')}{' '}
                <kbd className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-mono border border-border">Ctrl+Alt+L</kbd>.
              </p>
            )}
          </div>

          {/* Diagnóstico de pronúncia (a IA ouve seu som, não só o texto) */}
          <button
            onClick={() => { setDrillItems(null); setDiagOpen(true) }}
            className="paper-card paper-card-hover w-full flex items-center gap-3 px-5 py-4 mb-7 text-left"
          >
            <span className="grid place-items-center w-10 h-10 rounded-xl bg-primary/15 text-primary shrink-0"><Activity size={20} /></span>
            <span className="min-w-0">
              <span className="block display-title text-[17px]">{t('pronTestTitle')}</span>
              <span className="block text-xs text-muted">{t('pronTestSub')}</span>
            </span>
            <span className="ml-auto shrink-0 pill-button pill-primary px-3.5 py-2 text-sm"><Mic size={14} /> {t('start')}</span>
          </button>

          {/* Perfil de pontos fracos de pronúncia (usa os erros que já gravamos) */}
          <PronunciationProfileCard
            lang={targetLang}
            uiLang={uiLang}
            onTrain={words => {
              const items = wordDrillItems(targetLang, words)
              if (items.length === 0) return
              setDrillItems(items)
              setDiagOpen(true)
            }}
          />

          {stats && stats.languages.length > 0 && (
            <section className="mb-7">
              <h2 className="display-title text-[19px] mb-3.5">{t('reviewByLanguage')}</h2>
              <div className="flex flex-wrap gap-3">
                {stats.languages.map(l => {
                  const active = l.due > 0
                  return (
                    <button
                      key={l.lang}
                      onClick={() => active && windowAPI.openReview(l.lang)}
                      disabled={!active}
                      className={[
                        'paper-card paper-card-hover min-w-[188px] flex items-center gap-3 px-4 py-3 text-left',
                        active ? 'cursor-pointer' : 'opacity-55 cursor-default hover:transform-none',
                      ].join(' ')}
                      title={active ? `${t('review')} ${l.due} ${languageNameFor(l.lang, uiLang)}` : t('nothingDue')}
                    >
                      <LanguageFlag lang={l.lang} />
                      <span className="min-w-0">
                        <span className="flex items-baseline gap-1.5">
                          <span className="text-[10px] font-black uppercase tracking-wide text-primary">{l.lang || 'auto'}</span>
                          <span className="min-w-0 truncate text-[15px] font-bold text-foreground">{languageNameFor(l.lang, uiLang)}</span>
                        </span>
                        <span className="block text-[12.5px] text-muted">{l.total} {l.total === 1 ? t('phrase') : t('phrases')}</span>
                      </span>
                      <span className={[
                        'ml-auto rounded-full px-2.5 py-1 text-xs font-bold',
                        active ? 'bg-primary text-white' : 'bg-border text-muted',
                      ].join(' ')}>
                        {active ? `${l.due} ${t('dueSuffix')}` : t('upToDate')}
                      </span>
                    </button>
                  )
                })}
              </div>
              <button
                onClick={() => windowAPI.openReview()}
                className="pill-button pill-primary mt-4 px-5 py-2.5 text-sm"
              >
                <Brain size={16} />
                {t('reviewAll')} ({totalDue} {t('pending')})
              </button>
            </section>
          )}

          <div className="grid grid-cols-2 gap-5.5">
            <section className="paper-card px-5 py-4">
              <h2 className="display-title text-[19px] mb-3 flex items-center gap-2">
                <AlertTriangle size={17} className="text-warning" />
                {t('topMistakes')}
              </h2>
              {stats && stats.topMistakes.length > 0 ? (
                <div>
                  {stats.topMistakes.map((m, i) => (
                    <div key={i} className="flex items-center gap-2.5 py-2.5 border-b border-border last:border-b-0">
                      <span className="text-[16px] font-semibold display-title text-foreground">{m.word}</span>
                      <span className="ml-auto rounded-full bg-danger/10 px-2.5 py-0.5 text-[13px] font-bold text-danger">
                        {m.count}x
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted py-4">{t('topMistakesEmpty')}</p>
              )}
            </section>

            <section className="paper-card px-5 py-4">
              <h2 className="display-title text-[19px] mb-3">{t('recentSessions')}</h2>
              {stats && stats.recentSessions.length > 0 ? (
                <div>
                  {stats.recentSessions.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-b-0">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground truncate">
                          {s.title || formatSessionDate(s.startedAt)}
                        </div>
                        <div className="text-xs text-muted">
                          {formatSessionDate(s.startedAt)}
                          {s.endedAt && s.endedAt > s.startedAt ? ` · ${formatSessionDuration(s.startedAt, s.endedAt)}` : ''}
                          {s.lang ? ` · ${languageNameFor(s.lang, uiLang)}` : ''}
                        </div>
                        {s.preview && s.preview.length > 1 && (
                          <div className="mt-1 text-[11px] text-muted/80 truncate">
                            {s.preview.slice(1, 3).join(' / ')}
                          </div>
                        )}
                      </div>
                      <span className="ml-auto text-[12.5px] font-bold text-foreground">{s.lineCount} {s.lineCount === 1 ? t('phrase') : t('phrases')}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-5 text-sm text-muted">
                  {t('startPrompt')} <kbd className="rounded bg-surface-2 px-1.5 py-0.5 text-xs font-mono text-foreground">Ctrl+Alt+L</kbd> {t('toStart')}
                </div>
              )}
            </section>
          </div>

          <section className="paper-card mt-5 px-5 py-4">
            <h2 className="display-title text-[19px] mb-3">{t('quickShortcuts')}</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'Ctrl+Alt+L', desc: t('showHideBar') },
                { key: 'Ctrl+Alt+S', desc: t('settings') },
                { key: 'Ctrl+Alt+B', desc: t('tutorBoard') },
              ].map(({ key, desc }) => (
                <div key={key} className="rounded-xl bg-surface-2 border border-border px-3 py-2.5">
                  <div className="text-xs text-muted">{desc}</div>
                  <kbd className="mt-1 inline-block rounded-md bg-white px-2 py-0.5 text-xs font-mono text-foreground border border-border">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>

      {diagOpen && (
        <PronunciationDiagnostic
          lang={targetLang}
          uiLang={uiLang}
          items={drillItems ?? undefined}
          title={drillItems ? t('pronDrillTitle') : undefined}
          onClose={() => { setDiagOpen(false); setDrillItems(null) }}
        />
      )}
    </div>
  )
}

function formatSessionDate(startedAt: number): string {
  return new Date(startedAt).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatSessionDuration(startedAt: number, endedAt: number): string {
  const minutes = Math.max(1, Math.round((endedAt - startedAt) / 60_000))
  return `${minutes} min`
}

function NavButton({ icon: Icon, label, active = false, onClick }: {
  icon: React.ElementType
  label: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      className={[
        'w-[42px] h-[42px] rounded-xl grid place-items-center transition-colors',
        active ? 'bg-primary/15 text-primary' : 'text-muted hover:text-foreground hover:bg-border',
      ].join(' ')}
    >
      <Icon size={20} />
    </button>
  )
}

function LanguageFlag({ lang }: { lang: string }) {
  const flag = flagAssetForCountry(languageFlagCountry(lang))
  if (!flag) {
    return <span className="language-flag language-flag-fallback">AUTO</span>
  }

  return (
    <span className="language-flag">
      <img src={flag} alt="" aria-hidden="true" />
    </span>
  )
}
