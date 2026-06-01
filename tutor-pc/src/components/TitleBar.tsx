import { Minus, X } from 'lucide-react'
import { windowAPI } from '../services/electron'

interface Props {
  title: string
  showMinimize?: boolean
}

export default function TitleBar({ title, showMinimize = true }: Props) {
  return (
    <div
      className="flex items-center justify-between h-9 px-4 bg-background border-b border-border select-none shrink-0"
      style={{ WebkitAppRegion: 'drag' }}
    >
      <span className="text-xs font-medium text-muted">{title}</span>
      <div
        className="flex items-center gap-0.5"
        style={{ WebkitAppRegion: 'no-drag' }}
      >
        {showMinimize && (
          <button
            onClick={() => windowAPI.minimize()}
            className="w-6 h-6 flex items-center justify-center rounded text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
          >
            <Minus size={12} />
          </button>
        )}
        <button
          onClick={() => windowAPI.close()}
          className="w-6 h-6 flex items-center justify-center rounded text-muted hover:text-danger hover:bg-danger/10 transition-colors"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  )
}
