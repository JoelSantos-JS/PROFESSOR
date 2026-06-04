import { useState, useEffect } from 'react'
import { Eye, EyeOff, Check, ExternalLink, Trash2, KeyRound } from 'lucide-react'
import TitleBar from '../components/TitleBar'
import { settingsAPI, credentialsAPI } from '../services/electron'
import type { AppSettings, ProviderId, ProviderStatus } from '../types'

const PROVIDER_META: Record<ProviderId, {
  name: string
  placeholder: string
  docsUrl: string
  supportsTranscription: boolean
}> = {
  openai: {
    name: 'OpenAI',
    placeholder: 'sk-...',
    docsUrl: 'https://platform.openai.com/api-keys',
    supportsTranscription: true,
  },
  gemini: {
    name: 'Google Gemini',
    placeholder: 'AIzaSy...',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    supportsTranscription: true,
  },
  anthropic: {
    name: 'Anthropic',
    placeholder: 'sk-ant-...',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    supportsTranscription: false,
  },
  groq: {
    name: 'Groq',
    placeholder: 'gsk_...',
    docsUrl: 'https://console.groq.com/keys',
    supportsTranscription: true,
  },
}

const SHORTCUTS = [
  { key: 'Ctrl+Alt+L', desc: 'Iniciar / parar escuta' },
  { key: 'Ctrl+Alt+D', desc: 'Abrir Dashboard' },
  { key: 'Ctrl+Alt+S', desc: 'Abrir Configurações' },
  { key: 'Ctrl+Alt+B', desc: 'Abrir Tutor Board' },
  { key: 'Ctrl+Alt+Space', desc: 'Pausar / retomar player' },
]

export default function Settings() {
  const [settings, setSettings] = useState<Partial<AppSettings>>({})
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const [editing, setEditing] = useState<ProviderId | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [testingProvider, setTestingProvider] = useState<ProviderId | null>(null)

  useEffect(() => {
    settingsAPI.getAll().then(setSettings)
    credentialsAPI.list().then(setProviders)
  }, [])

  const isConfigured = (id: ProviderId) =>
    providers.find(p => p.id === id)?.configured ?? false

  const startEdit = async (id: ProviderId) => {
    const existing = await credentialsAPI.get(id)
    setKeyInput(existing ?? '')
    setShowKey(false)
    setEditing(id)
  }

  const saveKey = async () => {
    if (!editing) return
    setSaving(true)
    setSaveError(null)
    const result = await credentialsAPI.set(editing, keyInput)
    if (result && !result.ok) {
      setSaveError(result.error ?? 'Erro desconhecido ao salvar')
      setSaving(false)
      return
    }
    const updated = await credentialsAPI.list()
    setProviders(updated)
    setEditing(null)
    setKeyInput('')
    setSaving(false)
    flash()
  }

  const removeKey = async (id: ProviderId) => {
    await credentialsAPI.remove(id)
    setProviders(prev => prev.map(p => p.id === id ? { ...p, configured: false } : p))
    if (editing === id) setEditing(null)
    flash()
  }

  const updateSetting = async (key: keyof AppSettings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    await settingsAPI.set(key, value)
    flash()
  }

  const testProvider = async (id: ProviderId) => {
    setTestingProvider(id)
    setTestResult(null)
    const result = await credentialsAPI.test(id)
    setTestResult(result.ok ? (result.message ?? 'OK') : (result.error ?? 'Falha no teste'))
    setTestingProvider(null)
  }

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1500) }

  const configuredProviders = providers.filter(p => p.configured)

  return (
    <div className="flex flex-col h-screen app-paper text-foreground">
      <TitleBar title="Configurações" showMinimize={false} />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Providers */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="label-eyebrow">
              Provedores de IA — Sua chave, seus tokens
            </h2>
            <div className="flex items-center gap-2">
              {saved && (
                <span className="flex items-center gap-1 text-xs text-success">
                  <Check size={11} /> Salvo
                </span>
              )}
              {saveError && (
                <span className="text-xs text-danger truncate max-w-48" title={saveError}>
                  Erro: {saveError}
                </span>
              )}
              {testResult && (
                <span className="text-xs text-muted truncate max-w-72" title={testResult}>
                  {testResult}
                </span>
              )}
              <button
                onClick={async () => {
                  const info = await credentialsAPI.debug()
                  alert(JSON.stringify(info, null, 2))
                }}
                className="text-xs text-muted hover:text-foreground transition-colors"
                title="Debug: ver estado salvo no disco"
              >
                debug
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {(Object.keys(PROVIDER_META) as ProviderId[]).map(id => {
              const meta = PROVIDER_META[id]
              const configured = isConfigured(id)
              const isEditing = editing === id

              return (
                <div
                  key={id}
                  className={[
                    'rounded-2xl border transition-colors shadow-[var(--sh-1)]',
                    isEditing
                      ? 'border-primary bg-surface-2'
                      : 'border-border bg-white',
                  ].join(' ')}
                >
                  {/* Header row */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <KeyRound size={14} className={configured ? 'text-success' : 'text-muted'} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-foreground">{meta.name}</span>
                      {configured && (
                        <span className="ml-2 text-xs text-success">configurado</span>
                      )}
                    </div>
                    <a
                      href={meta.docsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted hover:text-foreground transition-colors"
                      title="Obter chave"
                    >
                      <ExternalLink size={13} />
                    </a>
                    {configured && !isEditing && (
                      <button
                        onClick={() => testProvider(id)}
                        disabled={testingProvider === id}
                        className="text-xs px-3 py-1.5 rounded-full font-bold transition-colors text-primary bg-primary/10 hover:bg-primary/15 disabled:opacity-50"
                        title="Testar esta chave no provider"
                      >
                        {testingProvider === id ? 'Testando...' : 'Testar'}
                      </button>
                    )}
                    {configured && !isEditing && (
                      <button
                        onClick={() => removeKey(id)}
                        className="text-muted hover:text-danger transition-colors ml-1"
                        title="Remover chave"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                    <button
                      onClick={() => isEditing ? setEditing(null) : startEdit(id)}
                      className={[
                        'text-xs px-3 py-1.5 rounded-full font-bold transition-colors ml-1',
                        isEditing
                          ? 'text-muted hover:text-foreground'
                          : configured
                            ? 'text-muted hover:text-foreground bg-surface-2'
                            : 'text-primary border border-primary/40 hover:bg-primary/10',
                      ].join(' ')}
                    >
                      {isEditing ? 'Cancelar' : configured ? 'Editar' : '+ Adicionar'}
                    </button>
                  </div>

                  {/* Inline key input */}
                  {isEditing && (
                    <div className="px-4 pb-3 flex gap-2">
                      <div className="flex-1 flex items-center bg-white border border-border rounded-xl overflow-hidden focus-within:border-primary transition-colors">
                        <input
                          type={showKey ? 'text' : 'password'}
                          value={keyInput}
                          onChange={e => setKeyInput(e.target.value)}
                          placeholder={meta.placeholder}
                          autoFocus
                          onKeyDown={e => e.key === 'Enter' && saveKey()}
                          className="flex-1 bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted/40 outline-none font-mono"
                        />
                        <button
                          onClick={() => setShowKey(s => !s)}
                          className="px-3 py-2 text-muted hover:text-foreground transition-colors"
                          type="button"
                        >
                          {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                      <button
                        onClick={saveKey}
                        disabled={saving || !keyInput.trim()}
                        className="pill-button pill-primary px-4 py-2 disabled:opacity-40 text-sm"
                      >
                        <Check size={13} />
                        Salvar
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Active providers */}
        <section>
          <h2 className="label-eyebrow mb-3">
            Provider Ativo
          </h2>
          <div className="paper-card divide-y divide-border">
            <ProviderSelect
              label="Tutor AI"
              value={(settings.activeAiProvider as ProviderId) ?? 'gemini'}
              options={configuredProviders.map(p => p.id)}
              onChange={v => updateSetting('activeAiProvider', v)}
            />
            <ProviderSelect
              label="Transcrição"
              value={(settings.activeTranscriptionProvider as ProviderId) ?? 'gemini'}
              options={configuredProviders
                .filter(p => PROVIDER_META[p.id].supportsTranscription)
                .map(p => p.id)}
              onChange={v => updateSetting('activeTranscriptionProvider', v)}
            />
          </div>
          {configuredProviders.length === 0 && (
            <p className="text-xs text-muted mt-2 px-1">
              Configure ao menos um provider acima para habilitar as funções.
            </p>
          )}
        </section>


        {/* Shortcuts */}
        <section>
          <h2 className="label-eyebrow mb-3">
            Atalhos globais
          </h2>
          <div className="paper-card overflow-hidden">
            {SHORTCUTS.map(({ key, desc }, i) => (
              <div
                key={key}
                className={[
                  'flex items-center justify-between px-4 py-2.5 text-sm',
                  i < SHORTCUTS.length - 1 ? 'border-b border-border' : '',
                ].join(' ')}
              >
                <span className="text-muted">{desc}</span>
                <kbd className="px-2 py-0.5 bg-surface-2 text-foreground rounded-md text-xs font-mono border border-border">
                  {key}
                </kbd>
              </div>
            ))}
          </div>
        </section>

        {/* About */}
        <section>
          <h2 className="label-eyebrow mb-3">Sobre</h2>
          <div className="paper-card p-4">
            <p className="display-title text-xl text-foreground mb-1">PROFESSOR</p>
            <p className="text-xs text-muted">
              v0.1.0 — M0 Shell · Seu professor flutuante de inglês para qualquer áudio do PC.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}

function ProviderSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: ProviderId
  options: ProviderId[]
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-muted">{label}</span>
      {options.length === 0 ? (
        <span className="text-xs text-muted/60">nenhum configurado</span>
      ) : (
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="bg-surface-2 border border-border text-foreground text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-primary transition-colors cursor-pointer"
        >
          {options.map(id => (
            <option key={id} value={id}>{PROVIDER_META[id].name}</option>
          ))}
        </select>
      )}
    </div>
  )
}
