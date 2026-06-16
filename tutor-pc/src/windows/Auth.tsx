import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRight, Check, Eye, FileText, KeyRound, ShieldCheck, User, UserRound, X } from 'lucide-react'
import TitleBar from '../components/TitleBar'
import { authAPI, windowAPI, settingsAPI } from '../services/electron'
import { uiText, appLanguage, type AppLanguage } from '../lib/uiLanguage'
import { UiLangProvider, useT, useUiLang } from '../lib/uiLangContext'
import googleLogo from '../assets/google-logo.svg'

type Mode = 'login' | 'signup'
type LegalDoc = 'terms' | 'privacy'

export default function Auth() {
  const [uiLang, setUiLang] = useState<AppLanguage>('pt')
  const t = (key: Parameters<typeof uiText>[1]) => uiText(uiLang, key)
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null)

  useEffect(() => { settingsAPI.getAll().then(s => setUiLang(appLanguage(s.appLanguage))).catch(() => {}) }, [])

  useEffect(() => {
    let alive = true
    authAPI.getSession()
      .then(res => {
        if (!alive) return
        if (res.ok && res.session) windowAPI.authComplete()
      })
      .catch(() => undefined)
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const setScreen = (next: Mode) => {
    setMode(next)
    setError(null)
    setMessage(null)
    setPassword('')
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const cleanEmail = email.trim().toLowerCase()
    if (mode === 'signup' && (!name.trim() || !acceptedTerms)) return
    if (!cleanEmail || password.length < (mode === 'signup' ? 6 : 8)) return

    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const res = mode === 'login'
        ? await authAPI.login({ email: cleanEmail, password })
        : await authAPI.signup({ name: name.trim(), email: cleanEmail, password })

      if (!res.ok) {
        setError(res.error ?? t('authFailed'))
        return
      }
      setPassword('')
      if (res.needsEmailConfirmation) {
        setMessage(t('confirmEmail'))
        return
      }
      if (mode === 'signup') {
        setMessage(t('accountCreated'))
        await wait(700)
      }
      windowAPI.authComplete()
    } catch (err) {
      setError(authErrorMessage(err, t('authFailedRetry')))
    } finally {
      setLoading(false)
    }
  }

  const startGoogle = async () => {
    if (mode === 'signup' && !acceptedTerms) return
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const res = await authAPI.google()
      if (!res.ok || !res.session) {
        setError(res.error ?? t('googleFailed'))
        return
      }
      windowAPI.authComplete()
    } catch (err) {
      setError(authErrorMessage(err, t('authFailedRetry')))
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = mode === 'login'
    ? !!email.trim() && password.length >= 8
    : !!name.trim() && !!email.trim() && password.length >= 6 && acceptedTerms

  return (
    <UiLangProvider value={uiLang}>
    <div className="h-screen bg-[#FCF7F1] text-foreground flex flex-col overflow-hidden rounded-[18px] border border-border-strong shadow-[0_18px_45px_rgba(58,46,38,.18)]">
      <TitleBar title={mode === 'login' ? t('signIn') : t('createAccount')} />

      <main className="flex-1 min-h-0 overflow-hidden px-6 pt-3 pb-2">
        <div className="flex flex-col items-center text-center">
          <div className="w-[48px] h-[48px] rounded-[15px] bg-primary text-white grid place-items-center display-title text-[28px] shadow-[0_10px_22px_rgba(194,104,63,.32)] mb-2">
            S
          </div>
          <h1 className="display-title text-[21px] leading-tight text-foreground">
            {mode === 'login' ? t('welcome') : t('createYourAccount')}
          </h1>
          <p className="mt-1 text-[11.5px] text-muted">
            {mode === 'login' ? t('continueWhereLeft') : t('startLearningSubtitles')}
          </p>
        </div>

        <div className="mt-3 mb-3 rounded-full border border-border bg-surface-2 p-1 grid grid-cols-2">
          <button
            type="button"
            onClick={() => setScreen('login')}
            className={[
              'h-[32px] rounded-full text-[12.5px] font-bold transition-colors',
              mode === 'login' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-foreground',
            ].join(' ')}
          >
            {t('signIn')}
          </button>
          <button
            type="button"
            onClick={() => setScreen('signup')}
            className={[
              'h-[32px] rounded-full text-[12.5px] font-bold transition-colors',
              mode === 'signup' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-foreground',
            ].join(' ')}
          >
            {t('createAccount')}
          </button>
        </div>

        <button
          type="button"
          onClick={startGoogle}
          disabled={loading || (mode === 'signup' && !acceptedTerms)}
          className="mb-3 w-full h-[36px] rounded-lg border border-border-strong bg-white text-[12.5px] font-bold text-foreground flex items-center justify-center gap-2 hover:bg-surface transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
        >
          <img src={googleLogo} alt="" aria-hidden="true" className="h-[17px] w-[17px]" />
          {t('continueWithGoogle')}
        </button>

        <div className="mb-2 flex items-center gap-3 text-[10px] font-black tracking-[.18em] uppercase text-muted">
          <span className="h-px flex-1 bg-border" />
          {t('orWithEmail')}
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-2">
          {mode === 'signup' && (
            <Field label={t('name')} icon={<UserRound size={15} />} placeholder={t('whatToCallYou')}>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                autoComplete="name"
                placeholder={t('whatToCallYou')}
                className="w-full h-full bg-transparent pl-9 pr-3 text-[13px] text-foreground outline-none placeholder:text-muted/65"
              />
            </Field>
          )}

          <Field label="Email" icon={<User size={15} />} placeholder="voce@email.com">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="voce@email.com"
              className="w-full h-full bg-transparent pl-9 pr-3 text-[13px] text-foreground outline-none placeholder:text-muted/65"
            />
          </Field>

          <Field label={t('password')} icon={<KeyRound size={15} />} placeholder={mode === 'login' ? t('yourPassword') : t('createPassword')}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder={mode === 'login' ? t('yourPassword') : t('createPassword')}
              className="w-full h-full bg-transparent pl-9 pr-8 text-[13px] text-foreground outline-none placeholder:text-muted/65"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              title={t('showPassword')}
            >
              <Eye size={14} />
            </button>
          </Field>

          {mode === 'login' ? (
            <div className="flex items-center justify-between text-[12px]">
              <label className="flex items-center gap-2 text-muted">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded accent-primary"
                />
                {t('rememberMe')}
              </label>
              <button type="button" className="font-semibold text-primary hover:underline">
                {t('forgotPassword')}
              </button>
            </div>
          ) : (
            <label className="flex items-start gap-2 rounded-md border border-border/70 bg-surface/55 px-2 py-1 text-[10.5px] leading-snug text-muted">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={e => setAcceptedTerms(e.target.checked)}
                aria-label={t('iAcceptAria')}
                className="mt-0.5 h-4 w-4 shrink-0 rounded accent-primary"
              />
              <span>
                {t('iAcceptThe')}{' '}
                <button type="button" onClick={() => setLegalDoc('terms')} className="font-bold text-primary hover:underline">
                  {t('termsOfUse')}
                </button>{' '}
                {t('andThe')}{' '}
                <button type="button" onClick={() => setLegalDoc('privacy')} className="font-bold text-primary hover:underline">
                  {t('privacyPolicy')}
                </button>.
              </span>
            </label>
          )}

          {(error || message) && <div aria-live="polite">
            {error && (
              <p className="rounded-lg border border-danger/30 bg-danger/10 px-2.5 py-1.5 text-[11.5px] leading-snug text-danger">
                {error}
              </p>
            )}
            {message && (
              <p className="rounded-lg border border-success/30 bg-success/10 px-2.5 py-1.5 text-[11.5px] leading-snug text-success">
                {message}
              </p>
            )}
          </div>}

          <button
            type="submit"
            disabled={loading || !canSubmit}
            className="mt-1.5 w-full h-[40px] rounded-lg bg-[#E2AD96] text-white text-[13px] font-black flex items-center justify-center gap-2 transition-colors hover:bg-primary disabled:hover:bg-[#E2AD96] disabled:opacity-100 disabled:cursor-not-allowed"
          >
            {mode === 'login' ? <ArrowRight size={15} /> : <Check size={15} />}
            {loading ? t('pleaseWait') : mode === 'login' ? t('signIn') : t('createAccount')}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setScreen(mode === 'login' ? 'signup' : 'login')}
          disabled={loading}
          className="mt-2 w-full text-center text-[12px] text-muted disabled:opacity-50"
        >
          {mode === 'login' ? (
            <>{t('newHere')} <span className="font-bold text-primary">{t('createOne')}</span></>
          ) : (
            <>{t('haveAccount')} <span className="font-bold text-primary">{t('signIn')}</span></>
          )}
        </button>
      </main>

      {legalDoc && <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />}
    </div>
    </UiLangProvider>
  )
}

function Field({ label, icon, children }: {
  label: string
  icon: ReactNode
  placeholder: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="block mb-1 text-[11.5px] font-semibold text-foreground/80">{label}</span>
      <span className="relative flex items-center h-[40px] rounded-lg border border-border-strong bg-white text-muted focus-within:border-primary">
        <span className="absolute left-3 top-1/2 -translate-y-1/2">{icon}</span>
        {children}
      </span>
    </label>
  )
}

function LegalModal({ doc, onClose }: { doc: LegalDoc; onClose: () => void }) {
  const t = useT()
  const uiLang = useUiLang()
  const isPrivacy = doc === 'privacy'
  const Icon = isPrivacy ? ShieldCheck : FileText
  const title = isPrivacy ? t('privacyPolicy') : t('termsOfUse')
  const items = LEGAL[uiLang][isPrivacy ? 'privacy' : 'terms']

  return (
    <div className="fixed inset-0 z-50 bg-black/25 p-4 flex items-center justify-center">
      <section className="w-full max-h-full rounded-xl border border-border bg-surface shadow-xl overflow-hidden">
        <header className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Icon size={17} className="text-primary" />
          <h2 className="text-sm font-black text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={`${t('close')} ${title}`}
            className="ml-auto w-8 h-8 rounded-lg grid place-items-center text-muted hover:text-danger hover:bg-danger/10"
            title={t('close')}
          >
            <X size={15} />
          </button>
        </header>
        <div className="max-h-[350px] overflow-y-auto px-4 py-3 text-[12px] leading-relaxed text-muted space-y-2">
          {items.map(item => <p key={item}>{item}</p>)}
        </div>
      </section>
    </div>
  )
}

// Texto legal por idioma da UI. ⚠️ É conteúdo jurídico — ainda precisa de revisão legal.
const LEGAL: Record<'pt' | 'en', { terms: string[]; privacy: string[] }> = {
  pt: {
    terms: [
      'O Soaken e uma ferramenta de estudo de idiomas. Ele pode gerar analises, traducoes e feedbacks com IA, mas nao substitui professor humano, avaliador oficial ou certificacao.',
      'Voce e responsavel pelo conteudo que captura, envia ou pratica no app, incluindo direitos de uso de audio, video, legenda e materiais de terceiros.',
      'O uso de provedores externos, como Supabase, Google e APIs de IA configuradas no app, tambem segue os termos dessas plataformas.',
      'Podemos alterar recursos, limites e funcionamento do app durante o desenvolvimento. Use com cuidado antes de depender dele para estudo, trabalho ou avaliacao oficial.',
    ],
    privacy: [
      'A autenticacao usa Supabase e Google quando voce escolhe entrar com Google. O app recebe apenas a sessao necessaria para manter seu acesso.',
      'As chaves de API configuradas por voce ficam armazenadas localmente no computador. Elas nao devem ser compartilhadas com outras pessoas.',
      'Transcricoes, frases, praticas e metricas podem ser salvas localmente para historico, revisao, contexto do professor e acompanhamento de progresso.',
      'Quando voce usa recursos de IA, o conteudo necessario pode ser enviado ao provedor configurado para gerar transcricao, analise, explicacao ou resposta.',
      'Evite capturar informacoes sensiveis de terceiros. O app esta em desenvolvimento e ainda precisa de revisao juridica antes de uso publico amplo.',
    ],
  },
  en: {
    terms: [
      'Soaken is a language-study tool. It can generate analyses, translations and feedback with AI, but it does not replace a human teacher, official examiner or certification.',
      'You are responsible for the content you capture, send or practice in the app, including usage rights for audio, video, subtitles and third-party materials.',
      'Using external providers such as Supabase, Google and the AI APIs configured in the app also follows the terms of those platforms.',
      'We may change features, limits and how the app works during development. Use it with care before relying on it for study, work or official assessment.',
    ],
    privacy: [
      'Authentication uses Supabase and Google when you choose to sign in with Google. The app receives only the session needed to keep you signed in.',
      'The API keys you configure are stored locally on your computer. They should not be shared with other people.',
      'Transcripts, sentences, practice and metrics may be saved locally for history, review, teacher context and progress tracking.',
      'When you use AI features, the necessary content may be sent to the configured provider to generate transcription, analysis, explanation or response.',
      'Avoid capturing sensitive third-party information. The app is in development and still needs legal review before broad public use.',
    ],
  },
}

function authErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message
  return fallback
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
