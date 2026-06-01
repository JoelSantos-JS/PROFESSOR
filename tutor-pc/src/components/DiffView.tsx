import { CheckCircle, XCircle } from 'lucide-react'
import type { DiffToken } from '../types'

// Word-diff chips: ok (green) / missing (red, struck) / extra (yellow, "+")
export default function DiffView({ diff }: { diff: DiffToken[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {diff.map((t, i) => {
        const cls =
          t.status === 'ok'        ? 'bg-success/15 text-success'
          : t.status === 'missing' ? 'bg-danger/15 text-danger line-through opacity-70'
          : 'bg-warning/15 text-warning'  // extra
        const icon =
          t.status === 'ok'        ? <CheckCircle size={10} />
          : t.status === 'missing' ? <XCircle size={10} />
          : <span className="text-[9px] font-bold leading-none">+</span>
        const title =
          t.status === 'ok'        ? 'correto'
          : t.status === 'missing' ? 'faltou falar'
          : 'falou a mais'
        return (
          <span key={i} title={title} className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded ${cls}`}>
            {icon}{t.word}
          </span>
        )
      })}
    </div>
  )
}
