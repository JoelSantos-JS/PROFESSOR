import { useEffect, useState } from 'react'
import { storeAPI } from '../services/electron'
import { summarizeUsage, type UsageStats } from '../lib/usageStats'
import { formatUsd } from '../lib/modelPricing'
import { uiText, type AppLanguage, type UiKey } from '../lib/uiLanguage'

// Painel "Uso & Custo": agrega o uso de IA (BYOK) em custo estimado (US$) + tempo de uso.
// Serve pro usuário ver quanto gasta e pra avaliarmos preço (especialmente o plano gerenciado).
export default function UsageCostPanel({ uiLang }: { uiLang: AppLanguage }) {
  const t = (key: UiKey) => uiText(uiLang, key)
  const [stats, setStats] = useState<UsageStats | null>(null)

  useEffect(() => {
    storeAPI.usageEvents()
      .then(({ events, sessions }) => setStats(summarizeUsage(
        events.map(e => ({ ...e, provider: e.provider ?? '' })),
        sessions,
      )))
      .catch(() => setStats(null))
  }, [])

  if (!stats || (stats.callCount === 0 && stats.sessionCount === 0)) {
    return <p className="text-sm text-muted py-2">{t('usageCostEmpty')}</p>
  }

  const fmtMin = (m: number) => (m >= 60 ? `${(m / 60).toFixed(1)} h` : `${Math.round(m)} min`)
  const fmtTokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n))

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Stat label={t('estimatedSpend')} value={formatUsd(stats.totalUsd)}
          sub={`${formatUsd(stats.todayUsd)} ${t('today')} · ${formatUsd(stats.monthUsd)} ${t('thisMonth')}`} />
        <Stat label={t('usageTimeLabel')} value={fmtMin(stats.usageMinutes)}
          sub={`${stats.sessionCount} ${t('sessionsLabel')}`} />
        <Stat label={t('perSessionAvg')} value={formatUsd(stats.avgUsdPerSession)}
          sub={`${fmtTokens(stats.totalTokens)} tokens · ${Math.round(stats.audioMinutes)} ${t('audioMinutesLabel')}`} />
      </div>

      <Breakdown title={t('byProviderLabel')} rows={stats.byProvider.map(p => ({ name: p.provider, usd: p.usd, calls: p.calls }))} callsLabel={t('calls')} />
      <Breakdown title={t('byFeatureLabel')} rows={stats.byFeature.map(f => ({ name: f.feature, usd: f.usd, calls: f.calls }))} callsLabel={t('calls')} />

      <p className="text-[11px] text-muted/70 leading-snug">{t('usageCostNote')}</p>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted/60">{label}</div>
      <div className="display-title text-[22px] leading-none text-foreground mt-1 tabular-nums">{value}</div>
      <div className="text-[11px] text-muted/70 mt-1">{sub}</div>
    </div>
  )
}

function Breakdown({ title, rows, callsLabel }: { title: string; rows: Array<{ name: string; usd: number; calls: number }>; callsLabel: string }) {
  if (rows.length === 0) return null
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted/50 mb-1">{title}</p>
      <div className="flex flex-col gap-1">
        {rows.map(r => (
          <div key={r.name} className="flex items-center gap-2 text-[13px]">
            <span className="font-semibold text-foreground capitalize min-w-[90px]">{r.name}</span>
            <span className="text-muted/60 text-xs">{r.calls} {callsLabel}</span>
            <span className="ml-auto tabular-nums font-bold text-primary">{formatUsd(r.usd)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
