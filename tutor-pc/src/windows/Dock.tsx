import { useEffect, useState } from 'react'
import { Home, Brain, BookOpen, Mic, Settings, EyeOff } from 'lucide-react'
import { windowAPI, settingsAPI } from '../services/electron'
import { uiText, appLanguage, type AppLanguage, type UiKey } from '../lib/uiLanguage'
import type { WindowName } from '../types'

// Dock: launcher horizontal flutuante (vidro teal-petróleo do tema Deep Soak). Logo S + atalhos
// para as janelas principais. Arrastável; fica sempre no topo, ancorado no centro inferior.
const ITEMS: Array<{ icon: React.ElementType; win: WindowName; labelKey: UiKey }> = [
  { icon: Home,     win: 'dashboard',    labelKey: 'dashboardTitle' },
  { icon: Brain,    win: 'review',       labelKey: 'review' },
  { icon: BookOpen, win: 'tutor-board',  labelKey: 'tutorBoard' },
  { icon: Mic,      win: 'floating-bar', labelKey: 'floatingBar' },
  { icon: Settings, win: 'settings',     labelKey: 'settings' },
]

export default function Dock() {
  const [uiLang, setUiLang] = useState<AppLanguage>('pt')
  const t = (key: UiKey) => uiText(uiLang, key)

  useEffect(() => {
    settingsAPI.getAll().then(s => setUiLang(appLanguage(s.appLanguage))).catch(() => {})
  }, [])

  return (
    <div className="h-screen w-screen overflow-hidden select-none flex items-center justify-center"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <div
        className="flex items-center gap-1 h-[52px] rounded-[18px] border border-white/20 px-2 text-[#EAF0EA]"
        style={{
          background: 'linear-gradient(180deg, rgba(28,58,52,.94), rgba(20,44,40,.97))',
          backdropFilter: 'blur(22px) saturate(160%)',
          boxShadow: '0 10px 30px rgba(12,28,25,.5), inset 0 0 0 1px rgba(255,255,255,.06)',
        }}
      >
        <div className="w-9 h-9 rounded-xl bg-primary text-white grid place-items-center display-title text-[18px] leading-none shrink-0 shadow-[0_4px_12px_rgba(31,138,138,.45)]">
          S
        </div>
        <div className="w-px h-6 bg-white/12 mx-0.5 shrink-0" />
        {ITEMS.map(({ icon: Icon, win, labelKey }) => (
          <button
            key={win}
            title={t(labelKey)}
            aria-label={t(labelKey)}
            onClick={() => windowAPI.toggle(win)}
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            className="group relative w-9 h-9 rounded-xl grid place-items-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Icon size={18} />
            <span className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-white/0 group-hover:bg-primary transition-colors" />
          </button>
        ))}

        <div className="w-px h-6 bg-white/12 mx-0.5 shrink-0" />
        {/* Esconder o dock + a barra de transcrição juntos. Volta pelo ícone da bandeja
            (system tray) ou por Ctrl+Alt+K. */}
        <button
          title={`${t('hide')} · Ctrl+Alt+K`}
          aria-label={t('hide')}
          onClick={() => windowAPI.hideBars()}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          className="w-8 h-9 rounded-xl grid place-items-center text-white/55 hover:text-white hover:bg-white/10 transition-colors"
        >
          <EyeOff size={15} />
        </button>
      </div>
    </div>
  )
}
