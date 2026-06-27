import { useState, useEffect } from 'react'
import { Eye, EyeOff, Check, ExternalLink, Trash2, KeyRound, AlertTriangle, X, LogOut } from 'lucide-react'
import TitleBar from '../components/TitleBar'
import { settingsAPI, credentialsAPI, forvoAPI, authAPI, windowAPI } from '../services/electron'
import { validateApiKey, pickActiveProvider } from '../lib/apiKeyValidation'
import { NATIVE_LANGUAGES } from '../lib/nativeLang'
import { contentLanguageOptions, normalizeContentLanguage } from '../lib/contentLanguages'
import { APP_LANGUAGES, appLanguage, uiText, type AppLanguage } from '../lib/uiLanguage'
import { listMicrophones, micLabel } from '../lib/audioDevices'
import UsageCostPanel from '../components/UsageCostPanel'
import type { AppSettings, ProviderId, ProviderStatus, TtsProviderId } from '../types'

interface TestState { testing?: boolean; ok?: boolean; msg?: string }

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

const TTS_PROVIDERS: Array<{ id: TtsProviderId; name: string; note: string }> = [
  { id: 'kokoro', name: 'Kokoro local', note: 'voz local em ingles' },
  { id: 'edge', name: 'Edge online', note: 'fallback multi-idioma' },
]

// [id, nome, região, gênero] — o rótulo (com o gênero traduzido) é montado em runtime via uiLang.
const KOKORO_VOICES = [
  ['af_heart', 'Heart', 'US', 'f'],
  ['af_bella', 'Bella', 'US', 'f'],
  ['af_nicole', 'Nicole', 'US', 'f'],
  ['af_sarah', 'Sarah', 'US', 'f'],
  ['am_puck', 'Puck', 'US', 'm'],
  ['am_fenrir', 'Fenrir', 'US', 'm'],
  ['bf_emma', 'Emma', 'UK', 'f'],
  ['bm_fable', 'Fable', 'UK', 'm'],
] as const

function kokoroVoiceLabel(name: string, region: string, gender: string, uiLang: 'pt' | 'en'): string {
  const g = uiLang === 'en'
    ? (gender === 'f' ? 'female' : 'male')
    : (gender === 'f' ? 'feminina' : 'masculina')
  return `${name} - ${region} ${g}`
}

export default function Settings() {
  const [settings, setSettings] = useState<Partial<AppSettings>>({})
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const [editing, setEditing] = useState<ProviderId | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [testState, setTestState] = useState<Partial<Record<ProviderId, TestState>>>({})
  const [mics, setMics] = useState<MediaDeviceInfo[]>([])
  const [logoutConfirm, setLogoutConfirm] = useState(false)

  useEffect(() => {
    settingsAPI.getAll().then(setSettings)
    credentialsAPI.list().then(setProviders)
    listMicrophones().then(setMics)
  }, [])

  const isConfigured = (id: ProviderId) =>
    providers.find(p => p.id === id)?.configured ?? false

  // Validação ao vivo do que está sendo digitado (só dica; não bloqueia a digitação).
  const liveValidation = editing && keyInput ? validateApiKey(editing, keyInput) : null

  // Garante que os providers ATIVOS apontem para chaves configuradas (auto-seleção).
  const ensureActiveProviders = async (configuredIds: ProviderId[], current: Partial<AppSettings>) => {
    const ai = pickActiveProvider(configuredIds, current.activeAiProvider)
    const tx = pickActiveProvider(configuredIds, current.activeTranscriptionProvider, tid => PROVIDER_META[tid].supportsTranscription)
    const patch: Partial<AppSettings> = {}
    if (ai && ai !== current.activeAiProvider) patch.activeAiProvider = ai
    if (tx && tx !== current.activeTranscriptionProvider) patch.activeTranscriptionProvider = tx
    if (Object.keys(patch).length === 0) return
    setSettings(prev => ({ ...prev, ...patch }))
    if (patch.activeAiProvider) await settingsAPI.set('activeAiProvider', patch.activeAiProvider)
    if (patch.activeTranscriptionProvider) await settingsAPI.set('activeTranscriptionProvider', patch.activeTranscriptionProvider)
  }

  const startEdit = async (id: ProviderId) => {
    const existing = await credentialsAPI.get(id)
    setKeyInput(existing ?? '')
    setShowKey(false)
    setEditing(id)
  }

  const saveKey = async () => {
    if (!editing) return
    const provider = editing
    const v = validateApiKey(provider, keyInput)
    if (!v.ok) { setSaveError(v.message ?? 'Chave inválida'); return }   // bloqueia só em erro

    setSaving(true)
    setSaveError(null)
    const result = await credentialsAPI.set(provider, v.normalized)      // salva já normalizada
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

    // Auto-seleciona o provider ativo se ainda não houver um configurado.
    const configuredIds = updated.filter(p => p.configured).map(p => p.id)
    await ensureActiveProviders(configuredIds, settings)
    // Auto-testa a chave recém-salva (feedback imediato sem clique extra).
    testProvider(provider)
  }

  const removeKey = async (id: ProviderId) => {
    await credentialsAPI.remove(id)
    const updated = providers.map(p => p.id === id ? { ...p, configured: false } : p)
    setProviders(updated)
    setTestState(prev => ({ ...prev, [id]: undefined }))
    if (editing === id) setEditing(null)
    flash()
    // Reaponta os providers ativos para chaves ainda válidas.
    await ensureActiveProviders(updated.filter(p => p.configured).map(p => p.id), settings)
  }

  const updateSetting = async (key: keyof AppSettings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    await settingsAPI.set(key, value)
    flash()
  }

  const testProvider = async (id: ProviderId) => {
    setTestState(prev => ({ ...prev, [id]: { testing: true } }))
    const result = await credentialsAPI.test(id)
    setTestState(prev => ({
      ...prev,
      // Localiza no renderer (a mensagem do main vinha hardcoded em PT). Sucesso → chave válida;
      // erro → mostra o erro técnico do provedor (já vem da API) ou um fallback localizado.
      [id]: { testing: false, ok: result.ok, msg: result.ok ? t('keyValid') : (result.error ?? t('keyTestFailed')) },
    }))
  }

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1500) }

  const configuredProviders = providers.filter(p => p.configured)
  const uiLang = appLanguage(settings.appLanguage as string | undefined)
  const t = (key: Parameters<typeof uiText>[1]) => uiText(uiLang, key)
  const localizedShortcuts = [
    { key: 'Ctrl+Alt+L', desc: uiLang === 'en' ? 'Start / stop listening' : 'Iniciar / parar escuta' },
    { key: 'Ctrl+Alt+D', desc: uiLang === 'en' ? 'Open Dashboard' : 'Abrir Dashboard' },
    { key: 'Ctrl+Alt+S', desc: uiLang === 'en' ? 'Open Settings' : 'Abrir Configuracoes' },
    { key: 'Ctrl+Alt+B', desc: uiLang === 'en' ? 'Open Tutor Board' : 'Abrir Tutor Board' },
    { key: 'Ctrl+Alt+K', desc: uiLang === 'en' ? 'Show / hide dock' : 'Mostrar / esconder dock' },
    { key: 'Ctrl+Alt+Space', desc: uiLang === 'en' ? 'Pause / resume player' : 'Pausar / retomar player' },
  ]
  const ttsProviders = TTS_PROVIDERS.map(provider => ({
    ...provider,
    note: uiLang === 'en'
      ? provider.id === 'kokoro' ? 'local English voice' : 'multi-language fallback'
      : provider.note,
  }))

  return (
    <div className="flex flex-col h-screen app-paper text-foreground">
      <TitleBar title={t('settings')} showMinimize={false} />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Providers */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="label-eyebrow">
              {t('aiProviders')}
            </h2>
            <div className="flex items-center gap-2">
              {saved && (
                <span className="flex items-center gap-1 text-xs text-success">
                  <Check size={11} /> {t('saved')}
                </span>
              )}
              {saveError && (
                <span className="text-xs text-danger truncate max-w-64" title={saveError}>
                  {saveError}
                </span>
              )}
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
                        <span className="ml-2 text-xs text-success">{t('configured')}</span>
                      )}
                    </div>
                    <a
                      href={meta.docsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-[11px] font-semibold text-primary/80 hover:text-primary transition-colors whitespace-nowrap"
                      title={t('getKey')}
                    >
                      <ExternalLink size={12} /> {t('getKey')}
                    </a>
                    {configured && !isEditing && (
                      <button
                        onClick={() => testProvider(id)}
                        disabled={testState[id]?.testing}
                        className="text-xs px-3 py-1.5 rounded-full font-bold transition-colors text-primary bg-primary/10 hover:bg-primary/15 disabled:opacity-50"
                        title={t('test')}
                      >
                        {testState[id]?.testing ? t('testing') : t('test')}
                      </button>
                    )}
                    {configured && !isEditing && (
                      <button
                        onClick={() => removeKey(id)}
                        className="text-muted hover:text-danger transition-colors ml-1"
                        title={t('removeKey')}
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
                      {isEditing ? t('cancel') : configured ? t('edit') : t('add')}
                    </button>
                  </div>

                  {/* Inline key input */}
                  {isEditing && (
                    <div className="px-4 pb-3">
                      <div className="flex gap-2">
                        <div className={[
                          'flex-1 flex items-center bg-white border rounded-xl overflow-hidden transition-colors',
                          liveValidation?.level === 'error' ? 'border-danger'
                            : liveValidation?.level === 'warn' ? 'border-warning'
                            : 'border-border focus-within:border-primary',
                        ].join(' ')}>
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
                          disabled={saving || !keyInput.trim() || liveValidation?.level === 'error'}
                          className="pill-button pill-primary px-4 py-2 disabled:opacity-40 text-sm"
                        >
                          <Check size={13} />
                          {t('save')}
                        </button>
                      </div>
                      {/* Dica de validação de formato ao vivo */}
                      {liveValidation?.message && (
                        <p className={[
                          'flex items-center gap-1.5 text-[11px] mt-1.5',
                          liveValidation.level === 'error' ? 'text-danger' : 'text-warning',
                        ].join(' ')}>
                          <AlertTriangle size={11} className="shrink-0" />
                          {liveValidation.message}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Resultado do teste da chave (auto após salvar, ou ao clicar Testar) */}
                  {!isEditing && testState[id] && !testState[id]!.testing && testState[id]!.msg && (
                    <div className="px-4 pb-3 -mt-1">
                      <p className={[
                        'flex items-center gap-1.5 text-[11px]',
                        testState[id]!.ok ? 'text-success' : 'text-danger',
                      ].join(' ')}>
                        {testState[id]!.ok ? <Check size={11} className="shrink-0" /> : <X size={11} className="shrink-0" />}
                        <span className="truncate" title={testState[id]!.msg}>{testState[id]!.msg}</span>
                      </p>
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
            {t('activeProvider')}
          </h2>
          <div className="paper-card divide-y divide-border">
            <ProviderSelect
              label={t('tutorAi')}
              value={(settings.activeAiProvider as ProviderId) ?? 'gemini'}
              options={configuredProviders.map(p => p.id)}
              emptyLabel={t('noneConfigured')}
              onChange={v => updateSetting('activeAiProvider', v)}
            />
            <ProviderSelect
              label={t('transcription')}
              value={(settings.activeTranscriptionProvider as ProviderId) ?? 'gemini'}
              options={configuredProviders
                .filter(p => PROVIDER_META[p.id].supportsTranscription)
                .map(p => p.id)}
              emptyLabel={t('noneConfigured')}
              onChange={v => updateSetting('activeTranscriptionProvider', v)}
            />
          </div>
          {configuredProviders.length === 0 && (
            <p className="text-xs text-muted mt-2 px-1">
              {t('configureProvider')}
            </p>
          )}
        </section>

        {/* Idioma da interface do app */}
        <section>
          <h2 className="label-eyebrow mb-3">{t('appLanguage')}</h2>
          <div className="paper-card divide-y divide-border">
            <div className="flex items-center justify-between px-4 py-3 gap-3">
              <div className="min-w-0">
                <span className="text-sm text-muted">{t('appLanguage')}</span>
                <p className="text-[11px] text-muted mt-0.5">{t('appLanguageNote')}</p>
              </div>
              <select
                aria-label={t('appLanguage')}
                value={uiLang}
                onChange={e => updateSetting('appLanguage', e.target.value)}
                className="bg-surface-2 border border-border text-foreground text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-primary transition-colors cursor-pointer"
              >
                {APP_LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>
        </section>


        {/* Idioma do usuário (no qual as explicações/traduções aparecem) */}
        <section>
          <h2 className="label-eyebrow mb-3">{t('yourLanguage')}</h2>
          <div className="paper-card divide-y divide-border">
            <div className="flex items-center justify-between px-4 py-3 gap-3">
              <div className="min-w-0">
                <span className="text-sm text-muted">{t('explanationsLanguage')}</span>
                <p className="text-[11px] text-muted mt-0.5">{t('explanationsNote')}</p>
              </div>
              <select
                aria-label={t('yourLanguage')}
                value={(settings.nativeLanguage as string)?.split('-')[0] ?? 'pt'}
                onChange={e => updateSetting('nativeLanguage', e.target.value)}
                className="bg-surface-2 border border-border text-foreground text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-primary transition-colors cursor-pointer"
              >
                {NATIVE_LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Idioma do conteúdo (transcrição) */}
        {/* Áudio: microfone (sua voz) + fonte da transcrição (som do PC ou um microfone) */}
        <section>
          <h2 className="label-eyebrow mb-3">{t('audioSection')}</h2>
          <div className="paper-card divide-y divide-border">
            {/* O que transcrever */}
            <div className="flex items-center justify-between px-4 py-3 gap-3">
              <div className="min-w-0">
                <span className="text-sm text-muted">{t('transcribeSource')}</span>
                <p className="text-[11px] text-muted mt-0.5">{t('transcribeSourceNote')}</p>
              </div>
              <select
                aria-label={t('transcribeSource')}
                value={(settings.transcriptionSource as string) ?? 'system'}
                onChange={e => updateSetting('transcriptionSource', e.target.value)}
                className="bg-surface-2 border border-border text-foreground text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-primary transition-colors cursor-pointer max-w-[200px]"
              >
                <option value="system">{t('systemAudioOption')}</option>
                {mics.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>🎤 {micLabel(d.label, i, uiLang)}</option>
                ))}
              </select>
            </div>
            {/* Microfone da sua voz (prática) */}
            <div className="flex items-center justify-between px-4 py-3 gap-3">
              <div className="min-w-0">
                <span className="text-sm text-muted">{t('micYourVoice')}</span>
                <p className="text-[11px] text-muted mt-0.5">{t('micYourVoiceNote')}</p>
              </div>
              <select
                aria-label={t('micYourVoice')}
                value={(settings.audioInputDevice as string) ?? 'default'}
                onChange={e => updateSetting('audioInputDevice', e.target.value)}
                className="bg-surface-2 border border-border text-foreground text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-primary transition-colors cursor-pointer max-w-[200px]"
              >
                <option value="default">{t('defaultMic')}</option>
                {mics.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>{micLabel(d.label, i, uiLang)}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section>
          <h2 className="label-eyebrow mb-3">{t('contentLanguage')}</h2>
          <div className="paper-card divide-y divide-border">
            <div className="flex items-center justify-between px-4 py-3 gap-3">
              <div className="min-w-0">
                <span className="text-sm text-muted">{t('contentLanguageLabel')}</span>
                <p className="text-[11px] text-muted mt-0.5">{t('contentLanguageNote')}</p>
              </div>
              <select
                aria-label={t('contentLanguage')}
                value={normalizeContentLanguage(settings.contentLanguage as string)}
                onChange={e => updateSetting('contentLanguage', e.target.value)}
                className="bg-surface-2 border border-border text-foreground text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-primary transition-colors cursor-pointer max-w-[200px]"
              >
                {contentLanguageOptions(uiLang).map(o => (
                  <option key={o.code} value={o.code}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* TTS */}
        <section>
          <h2 className="label-eyebrow mb-3">
            {t('ttsVoice')}
          </h2>
          <div className="paper-card divide-y divide-border">
            <TtsSelect
              label={t('engine')}
              value={(settings.activeTtsProvider as TtsProviderId) ?? 'kokoro'}
              options={ttsProviders}
              onChange={v => updateSetting('activeTtsProvider', v)}
            />
            <div className="flex items-center justify-between px-4 py-3 gap-3">
              <div className="min-w-0">
                <span className="text-sm text-muted">{t('kokoroVoice')}</span>
                <p className="text-[11px] text-muted mt-0.5">{t('kokoroNote')}</p>
              </div>
              <select
                value={(settings.ttsVoice as string) ?? 'af_heart'}
                onChange={e => updateSetting('ttsVoice', e.target.value)}
                className="bg-surface-2 border border-border text-foreground text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-primary transition-colors cursor-pointer max-w-44"
              >
                {KOKORO_VOICES.map(([id, name, region, gender]) => (
                  <option key={id} value={id}>{kokoroVoiceLabel(name, region, gender, uiLang)}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-muted mt-2 px-1">
            {t('kokoroFirstUse')}
          </p>
        </section>

        {/* Pronúncia nativa (Forvo + Wikimedia) */}
        <section>
          <h2 className="label-eyebrow mb-3">{t('nativePronTitle')}</h2>
          <div className="paper-card p-4">
            <ForvoKeySection uiLang={uiLang} />
          </div>
          <p className="text-xs text-muted mt-2 px-1">{t('nativePronNote')}</p>
        </section>


        {/* Shortcuts */}
        <section>
          <h2 className="label-eyebrow mb-3">
            {t('shortcuts')}
          </h2>
          <div className="paper-card overflow-hidden">
            {localizedShortcuts.map(({ key, desc }, i) => (
              <div
                key={key}
                className={[
                  'flex items-center justify-between px-4 py-2.5 text-sm',
                  i < localizedShortcuts.length - 1 ? 'border-b border-border' : '',
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

        {/* Uso & Custo (estimativa BYOK) */}
        <section>
          <h2 className="label-eyebrow mb-3">{t('usageCostTitle')}</h2>
          <div className="paper-card p-4">
            <UsageCostPanel uiLang={uiLang} />
          </div>
        </section>

        {/* About */}
        <section>
          <h2 className="label-eyebrow mb-3">{t('about')}</h2>
          <div className="paper-card p-4">
            <p className="display-title text-xl text-foreground mb-1">Soaken</p>
            <p className="text-[11px] text-muted/80 mb-1">v0.1.0 · {uiLang === 'en' ? 'Dive into the language' : 'Mergulhe no idioma'}</p>
            <p className="text-xs text-muted leading-relaxed">
              {uiLang === 'en'
                ? 'Your floating tutor for any language. Soaken listens to any audio on your PC — videos, calls, shows — and turns it into real speaking & pronunciation practice.'
                : 'Seu professor flutuante para qualquer idioma. O Soaken escuta qualquer áudio do PC — vídeos, calls, séries — e transforma em prática real de fala e pronúncia.'}
            </p>
          </div>
        </section>

        {/* Conta — sair */}
        <section>
          <button
            onClick={() => setLogoutConfirm(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-danger bg-danger/10 hover:bg-danger/20 border border-danger/30 transition-colors"
          >
            <LogOut size={15} /> {t('logout')}
          </button>
        </section>
      </div>

      {/* Modal de confirmação de logout (no nosso design, no lugar do confirm() nativo) */}
      {logoutConfirm && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-5 fade-up"
          onClick={() => setLogoutConfirm(false)}
        >
          <div
            className="paper-card w-full max-w-[320px] p-5 text-center"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="mx-auto mb-3 w-11 h-11 rounded-full bg-danger/12 grid place-items-center text-danger">
              <LogOut size={20} />
            </div>
            <p className="display-title text-lg text-foreground mb-1">{t('logout')}</p>
            <p className="text-[13px] text-muted leading-relaxed mb-5">{t('logoutConfirm')}</p>
            <div className="flex gap-2.5">
              <button
                onClick={() => setLogoutConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-foreground bg-surface-2 hover:bg-border/60 border border-border transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={async () => {
                  setLogoutConfirm(false)
                  await authAPI.logout().catch(() => {})
                  windowAPI.logout()  // fecha o workspace e volta pra tela de login
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white bg-danger hover:bg-danger/90 transition-colors"
              >
                <LogOut size={14} /> {t('logout')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProviderSelect({
  label,
  value,
  options,
  emptyLabel,
  onChange,
}: {
  label: string
  value: ProviderId
  options: ProviderId[]
  emptyLabel: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-muted">{label}</span>
      {options.length === 0 ? (
        <span className="text-xs text-muted/60">{emptyLabel}</span>
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

function TtsSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: TtsProviderId
  options: Array<{ id: TtsProviderId; name: string; note: string }>
  onChange: (v: string) => void
}) {
  const selected = options.find(option => option.id === value)

  return (
    <div className="flex items-center justify-between px-4 py-3 gap-3">
      <div className="min-w-0">
        <span className="text-sm text-muted">{label}</span>
        {selected && (
          <p className="text-[11px] text-muted mt-0.5">{selected.note}</p>
        )}
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-surface-2 border border-border text-foreground text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-primary transition-colors cursor-pointer"
      >
        {options.map(option => (
          <option key={option.id} value={option.id}>{option.name}</option>
        ))}
      </select>
    </div>
  )
}

// Campo da chave Forvo (opcional). Wikimedia já cobre o caso grátis; isto melhora a cobertura.
function ForvoKeySection({ uiLang }: { uiLang: AppLanguage }) {
  const t = (key: Parameters<typeof uiText>[1]) => uiText(uiLang, key)
  const [configured, setConfigured] = useState(false)
  const [value, setValue] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => { forvoAPI.hasKey().then(setConfigured).catch(() => {}) }, [])

  const save = async () => {
    await forvoAPI.setKey(value.trim()).catch(() => {})
    setConfigured(!!value.trim())
    setValue('')
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="password"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={configured ? '••••••••  ' + t('configured') : 'Forvo API key'}
        className="flex-1 bg-surface-2 border border-border text-foreground text-sm rounded-lg px-3 py-2 outline-none focus:border-primary transition-colors"
      />
      <button
        onClick={save}
        disabled={!value.trim()}
        className="pill-button pill-primary px-3 py-2 text-xs disabled:opacity-40"
      >
        {saved ? <><Check size={13} /> {t('saved')}</> : t('add')}
      </button>
      <a
        href="https://api.forvo.com/" target="_blank" rel="noreferrer"
        className="text-xs text-primary/80 hover:text-primary flex items-center gap-0.5 whitespace-nowrap"
        title={t('getKey')}
      >
        <ExternalLink size={12} /> {t('getKey')}
      </a>
    </div>
  )
}
