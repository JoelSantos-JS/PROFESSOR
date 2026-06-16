import { Archive, CalendarDays, MessageSquare, ScanText, WalletCards } from 'lucide-react'
import { formatTokenCount, type TokenBudgetSummary } from '../lib/tokenBudget'
import { useT } from '../lib/uiLangContext'
import type { TokenUsageSummary } from '../types'

function statusColor(status: TokenBudgetSummary['status']): string {
  if (status === 'critical') return 'bg-danger'
  if (status === 'warning') return 'bg-warning'
  if (status === 'watch') return 'bg-primary'
  return 'bg-success'
}

export default function TokenBudgetMeter({ summary, usage, onCompact }: {
  summary: TokenBudgetSummary
  usage?: TokenUsageSummary | null
  onCompact?: () => void
}) {
  const t = useT()
  const compactReady = !!onCompact

  return (
    <div className="rounded-xl border border-border bg-surface/80 px-3 py-2 shadow-[var(--sh-1)]">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3 text-[11px]">
            <span className="font-semibold text-muted">{t('contextUsed')}</span>
            <span className="font-bold text-foreground tabular-nums">
              ~{formatTokenCount(summary.usedTokens)} / {formatTokenCount(summary.limitTokens)} ({summary.percent}%)
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
            <div
              className={['h-full rounded-full transition-all', statusColor(summary.status)].join(' ')}
              style={{ width: `${summary.percent}%` }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onCompact}
          disabled={!compactReady}
          title={compactReady ? t('compactNowTitle') : t('compactUnavailable')}
          className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-border bg-surface-2 px-2 py-1 text-[11px] font-bold text-muted transition-colors hover:text-foreground disabled:opacity-45 disabled:hover:text-muted"
        >
          <Archive size={12} />
          {t('compact')}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1">
          <MessageSquare size={12} />
          {summary.messageCount} {t('messages')}
        </span>
        <span className="inline-flex items-center gap-1">
          <ScanText size={12} />
          {summary.contextSentenceCount} {t('phrases')}
        </span>
        {usage && (
          <>
            <span className="inline-flex items-center gap-1">
              <WalletCards size={12} />
              ~{formatTokenCount(usage.totalTokens)} {t('tokensSpent')}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={12} />
              {t('today')} ~{formatTokenCount(usage.todayTokens)}
            </span>
            <span>{usage.callCount} {t('calls')}</span>
          </>
        )}
      </div>
    </div>
  )
}
