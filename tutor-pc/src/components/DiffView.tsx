import { CheckCircle, XCircle } from 'lucide-react'
import type { DiffToken } from '../types'

// Word-diff chips: ok (green) / missing (red, struck) / extra (yellow, "+")
export default function DiffView({ diff }: { diff: DiffToken[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {diff.map((t, i) => {
        const cls =
          t.status === 'ok'        ? 'bg-success/25 text-success border border-success/50'
          : t.status === 'missing' ? 'bg-danger/25 text-danger border border-danger/50 line-through'
          : 'bg-warning/30 text-[#9A6A1E] border border-warning/50'  // extra
        const icon =
          t.status === 'ok'        ? <CheckCircle size={11} />
          : t.status === 'missing' ? <XCircle size={11} />
          : <span className="text-[10px] font-bold leading-none">+</span>
        const title =
          t.status === 'ok'        ? 'correto'
          : t.status === 'missing' ? 'faltou falar'
          : 'falou a mais'
        return (
          <span key={i} title={title} className={`flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-md ${cls}`}>
            {icon}{t.word}
          </span>
        )
      })}
    </div>
  )
}
