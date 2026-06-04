import { useEffect, useState } from 'react'
import { Activity, AlertTriangle, BookOpen, Brain, Flame, Home, Mic, Settings, Zap } from 'lucide-react'
import TitleBar from '../components/TitleBar'
import { windowAPI, storeAPI } from '../services/electron'
import { languageLabel } from '../lib/languages'
import type { StoreStats } from '../types'

export default function Dashboard() {
  const [stats, setStats] = useState<StoreStats | null>(null)

  useEffect(() => {
    storeAPI.stats().then(setStats).catch(console.error)
  }, [])

  const totalDue = stats?.dueCount ?? 0
  const cards = [
    { label: 'Sessões', value: stats?.sessionCount ?? 0, icon: Activity },
    { label: 'Frases', value: stats?.phraseCount ?? 0, icon: BookOpen },
    { label: 'Sequência', value: stats?.streak ?? 0, suffix: 'dias', icon: Flame, accent: true },
  ]

  return (
    <div className="flex flex-col h-screen app-paper text-foreground">
      <TitleBar title="Início" />

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-[62px] shrink-0 flex flex-col items-center gap-1.5 py-3.5 bg-surface-2 border-r border-border">
          <div className="w-[38px] h-[38px] rounded-xl bg-primary text-white grid place-items-center display-title text-[21px] mb-2">
            P
          </div>

          <NavButton icon={Home} label="Início" active />
          <NavButton icon={Brain} label="Revisão" onClick={() => windowAPI.show('review')} />
          <NavButton icon={BookOpen} label="Tutor Board" onClick={() => windowAPI.show('tutor-board')} />
          <NavButton icon={Mic} label="Barra flutuante" onClick={() => windowAPI.show('floating-bar')} />

          <div className="mt-auto">
            <NavButton icon={Settings} label="Configurações" onClick={() => windowAPI.show('settings')} />
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto px-8 py-7">
          <div className="mb-6">
            <h1 className="display-title text-[30px] leading-tight text-foreground">Bem-vindo de volta</h1>
            <p className="text-[15px] text-muted mt-1">
              Pronto para praticar hoje? Você tem{' '}
              <b className="text-primary">{totalDue}</b>{' '}
              {totalDue === 1 ? 'frase' : 'frases'} para revisar.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3.5 mb-7">
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

          {stats && stats.languages.length > 0 && (
            <section className="mb-7">
              <h2 className="display-title text-[19px] mb-3.5">Revisar por idioma</h2>
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
                      title={active ? `Revisar ${l.due} de ${languageLabel(l.lang)}` : 'Nada a revisar agora'}
                    >
                      <span className="text-2xl">{languageFlag(l.lang)}</span>
                      <span className="min-w-0">
                        <span className="block text-[15px] font-bold text-foreground">{languageLabel(l.lang)}</span>
                        <span className="block text-[12.5px] text-muted">{l.total} frases</span>
                      </span>
                      <span className={[
                        'ml-auto rounded-full px-2.5 py-1 text-xs font-bold',
                        active ? 'bg-primary text-white' : 'bg-border text-muted',
                      ].join(' ')}>
                        {active ? `${l.due} a revisar` : 'em dia'}
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
                Revisar tudo ({totalDue} pendentes)
              </button>
            </section>
          )}

          <div className="grid grid-cols-2 gap-5.5">
            <section className="paper-card px-5 py-4">
              <h2 className="display-title text-[19px] mb-3 flex items-center gap-2">
                <AlertTriangle size={17} className="text-warning" />
                Palavras que mais erro
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
                <p className="text-sm text-muted py-4">As palavras recorrentes aparecem aqui depois das primeiras práticas.</p>
              )}
            </section>

            <section className="paper-card px-5 py-4">
              <h2 className="display-title text-[19px] mb-3">Sessões recentes</h2>
              {stats && stats.recentSessions.length > 0 ? (
                <div>
                  {stats.recentSessions.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-b-0">
                      <div>
                        <div className="text-sm font-semibold text-foreground">
                          {new Date(s.startedAt).toLocaleString('pt-BR')}
                        </div>
                        <div className="text-xs text-muted">sessão capturada</div>
                      </div>
                      <span className="ml-auto text-[12.5px] font-bold text-foreground">{s.lineCount} frases</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-5 text-sm text-muted">
                  Use <kbd className="rounded bg-surface-2 px-1.5 py-0.5 text-xs font-mono text-foreground">Ctrl+Alt+L</kbd> para começar.
                </div>
              )}
            </section>
          </div>

          <section className="paper-card mt-5 px-5 py-4">
            <h2 className="display-title text-[19px] mb-3">Atalhos rápidos</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'Ctrl+Alt+L', desc: 'Mostrar/esconder barra' },
                { key: 'Ctrl+Alt+S', desc: 'Configurações' },
                { key: 'Ctrl+Alt+B', desc: 'Tutor Board' },
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
    </div>
  )
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

function languageFlag(lang: string) {
  if (lang.startsWith('en')) return '🇬🇧'
  if (lang.startsWith('ko')) return '🇰🇷'
  if (lang.startsWith('es')) return '🇪🇸'
  if (lang.startsWith('fr')) return '🇫🇷'
  if (lang.startsWith('de')) return '🇩🇪'
  if (lang.startsWith('ja')) return '🇯🇵'
  if (lang.startsWith('zh')) return '🇨🇳'
  return '🌐'
}
