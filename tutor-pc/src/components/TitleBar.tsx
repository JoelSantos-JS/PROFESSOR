import { Minus, X } from 'lucide-react'
import { windowAPI } from '../services/electron'

interface Props {
  title: string
  showMinimize?: boolean
}

export default function TitleBar({ title, showMinimize = true }: Props) {
  return (
    <div
      className="flex items-center gap-3 h-[46px] px-4 bg-surface-2 border-b border-border select-none shrink-0"
      style={{ WebkitAppRegion: 'drag' }}
    >
      <div className="w-[22px] h-[22px] rounded-[7px] bg-primary text-white grid place-items-center shrink-0">
        <span className="text-[12px] font-bold leading-none">C</span>
      </div>
      <div className="min-w-0">
        <span className="block text-sm font-semibold text-foreground truncate">{title}</span>
        <span className="block text-[11px] font-medium text-muted -mt-0.5">Capta</span>
      </div>
      <div
        className="ml-auto flex items-center gap-1"
        style={{ WebkitAppRegion: 'no-drag' }}
      >
        {showMinimize && (
          <button
            onClick={() => windowAPI.minimize()}
            className="w-[30px] h-[30px] flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-border transition-colors"
            title="Minimizar"
          >
            <Minus size={12} />
          </button>
        )}
        <button
          onClick={() => windowAPI.close()}
          className="w-[30px] h-[30px] flex items-center justify-center rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors"
          title="Fechar"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  )
}
