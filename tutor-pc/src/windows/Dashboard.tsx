import { useEffect, useState } from 'react'
import { Activity, BookOpen, Mic, Settings, Zap, AlertTriangle } from 'lucide-react'
import TitleBar from '../components/TitleBar'
import { windowAPI, storeAPI } from '../services/electron'
import type { StoreStats } from '../types'

export default function Dashboard() {
  const [stats, setStats] = useState<StoreStats | null>(null)

  useEffect(() => {
    storeAPI.stats().then(setStats).catch(console.error)
  }, [])

  const cards = [
    { label: 'Sessões',   value: stats?.sessionCount ?? 0,        icon: Activity },
    { label: 'Frases',    value: stats?.phraseCount ?? 0,         icon: BookOpen },
    { label: 'Sequência', value: `${stats?.streak ?? 0} dias`,    icon: Zap },
  ]

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <TitleBar title="PROFESSOR" />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-14 flex flex-col items-center py-3 gap-1 border-r border-border shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center mb-3 shrink-0">
            <span className="text-xs font-bold text-white">T</span>
          </div>

          <NavButton icon={Activity} label="Início" active />
          <NavButton icon={BookOpen} label="Revisão" onClick={() => windowAPI.show('review')} />
          <NavButton icon={Mic} label="Tutor Board" onClick={() => windowAPI.show('tutor-board')} />

          <div className="mt-auto">
            <NavButton icon={Settings} label="Configurações" onClick={() => windowAPI.show('settings')} />
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto p-6">
          <h1 className="text-xl font-semibold text-foreground mb-1">Bem-vindo!</h1>
          <p className="text-sm text-muted mb-6">Pronto para praticar hoje?</p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {cards.map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-surface rounded-xl p-4 border border-border">
                <Icon size={16} className="text-muted mb-2" />
                <div className="text-2xl font-bold text-foreground">{value}</div>
                <div className="text-xs text-muted mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {/* Review CTA */}
          <button
            onClick={() => windowAPI.show('review')}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 active:bg-primary/80 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors mb-8"
          >
            <BookOpen size={16} />
            Revisar {stats?.dueCount ? `(${stats.dueCount} pendentes)` : 'vocabulário'}
          </button>

          {/* Words I mispronounce most */}
          {stats && stats.topMistakes.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-medium text-foreground mb-3 flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-warning" />
                Palavras que mais erro
              </h2>
              <div className="flex flex-wrap gap-2">
                {stats.topMistakes.map((m, i) => (
                  <span key={i} className="flex items-center gap-1.5 bg-surface border border-border rounded-lg px-3 py-1.5 text-sm">
                    <span className="text-foreground">{m.word}</span>
                    <span className="text-xs text-danger font-mono">{m.count}×</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Shortcuts */}
          <div className="mb-6">
            <h2 className="text-sm font-medium text-foreground mb-3">Atalhos rápidos</h2>
            <div className="bg-surface rounded-xl border border-border overflow-hidden">
              {[
                { key: 'Ctrl+Alt+L', desc: 'Mostrar/esconder barra flutuante' },
                { key: 'Ctrl+Alt+S', desc: 'Abrir configurações' },
                { key: 'Ctrl+Alt+B', desc: 'Abrir Tutor Board' },
              ].map(({ key, desc }, i, arr) => (
                <div key={key} className={['flex items-center justify-between px-4 py-2.5 text-sm', i < arr.length - 1 ? 'border-b border-border' : ''].join(' ')}>
                  <span className="text-muted">{desc}</span>
                  <kbd className="px-2 py-0.5 bg-surface-2 text-foreground rounded text-xs font-mono">{key}</kbd>
                </div>
              ))}
            </div>
          </div>

          {/* Recent sessions */}
          <div>
            <h2 className="text-sm font-medium text-foreground mb-3">Sessões recentes</h2>
            <div className="bg-surface rounded-xl border border-border overflow-hidden">
              {stats && stats.recentSessions.length > 0 ? (
                stats.recentSessions.map((s, i, arr) => (
                  <div key={s.id} className={['flex items-center justify-between px-4 py-2.5 text-sm', i < arr.length - 1 ? 'border-b border-border' : ''].join(' ')}>
                    <span className="text-muted">{new Date(s.startedAt).toLocaleString('pt-BR')}</span>
                    <span className="text-foreground">{s.lineCount} frases</span>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center">
                  <p className="text-sm text-muted">
                    Nenhuma sessão ainda. Use{' '}
                    <kbd className="px-1.5 py-0.5 bg-surface-2 rounded text-xs font-mono">Ctrl+Alt+L</kbd>{' '}
                    para começar.
                  </p>
                </div>
              )}
            </div>
          </div>
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
        'w-9 h-9 rounded-lg flex items-center justify-center transition-colors',
        active ? 'bg-primary/20 text-primary' : 'text-muted hover:text-foreground hover:bg-surface',
      ].join(' ')}
    >
      <Icon size={18} />
    </button>
  )
}
