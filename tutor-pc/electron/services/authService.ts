import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import crypto from 'crypto'
import http from 'http'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, hasSupabaseConfig } from '../lib/supabaseConfig.js'
import { SecureSessionStore } from './secureSessionStore.js'

const OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000
const REFRESH_EARLY_MS = 60 * 1000
const OAUTH_TIMEOUT_MS = 10 * 60 * 1000   // 1º login com Google (consentimento/app não verificado) é lento
const OAUTH_CALLBACK_HOST = '127.0.0.1'
const OAUTH_CALLBACK_PORT = 17654
const OAUTH_CALLBACK_PATH = '/auth/callback'

/** Página branded mostrada no navegador ao voltar do Google (em vez de texto cru / erro do Chrome). */
function oauthResultPage(ok: boolean, heading: string, body: string): string {
  const accent = ok ? '#7fe3cf' : '#ffb3ad'
  return `<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>Soaken</title>
<meta name="viewport" content="width=device-width, initial-scale=1"><style>
html,body{height:100%;margin:0}
body{display:grid;place-items:center;font-family:system-ui,'Segoe UI',sans-serif;background:linear-gradient(180deg,#1c3a34,#142c28);color:#EAF0EA}
.card{text-align:center;padding:40px 32px;max-width:380px}
.dot{width:56px;height:56px;border-radius:50%;margin:0 auto 18px;display:grid;place-items:center;background:${accent}22;color:${accent};font-size:28px;font-weight:700}
h1{font-size:20px;margin:0 0 8px}
p{margin:0;color:#9fb3ad;font-size:14px;line-height:1.55}
.brand{margin-top:22px;font-size:12px;letter-spacing:.16em;color:#5f7d75;text-transform:uppercase}
</style></head><body><div class="card">
<div class="dot">${ok ? '&#10003;' : '!'}</div>
<h1>${heading}</h1><p>${body}</p><div class="brand">Soaken</div>
</div>${ok ? '<script>setTimeout(function(){try{window.close()}catch(e){}},2500)</script>' : ''}</body></html>`
}

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(256),
}).strict()

const signupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6).max(256),
}).strict()

export interface AuthUser {
  id: string
  email: string
  name?: string
}

export interface PublicAuthSession {
  user: AuthUser
  expiresAt: number
  offline: boolean
}

export interface AuthResult {
  session: PublicAuthSession | null
  needsEmailConfirmation?: boolean
}

export class AuthService {
  private client: SupabaseClient
  private pkceStorage = new Map<string, string>()

  constructor(private store = new SecureSessionStore()) {
    if (!hasSupabaseConfig()) throw new Error('Configuracao do Supabase invalida.')
    this.client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        flowType: 'pkce',
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storage: {
          getItem: (key: string) => this.pkceStorage.get(key) ?? null,
          setItem: (key: string, value: string) => { this.pkceStorage.set(key, value) },
          removeItem: (key: string) => { this.pkceStorage.delete(key) },
        },
      },
    })
  }

  async getSession(): Promise<PublicAuthSession | null> {
    const stored = this.store.load()
    if (!stored?.session) return null

    if (!shouldRefresh(stored.session)) return toPublicSession(stored.session, false)

    try {
      const refreshed = await this.refreshStored(stored.session.refresh_token)
      return toPublicSession(refreshed, false)
    } catch {
      const stillAllowed = Date.now() - stored.lastValidatedAt <= OFFLINE_GRACE_MS
      return stillAllowed ? toPublicSession(stored.session, true) : null
    }
  }

  async login(input: unknown): Promise<AuthResult> {
    const { email, password } = credentialsSchema.parse(input)
    const { data, error } = await this.client.auth.signInWithPassword({ email, password })
    if (error) throw new Error(compactAuthError(error.message))
    if (!data.session) return { session: null }
    this.saveSession(data.session)
    return { session: toPublicSession(data.session, false) }
  }

  async signup(input: unknown): Promise<AuthResult> {
    const { name, email, password } = signupSchema.parse(input)
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          full_name: name,
        },
      },
    })
    if (error) throw new Error(compactAuthError(error.message))
    if (!data.session) return { session: null, needsEmailConfirmation: true }
    this.saveSession(data.session)
    return { session: toPublicSession(data.session, false), needsEmailConfirmation: false }
  }

  async loginWithGoogle(openUrl: (url: string) => Promise<void>): Promise<AuthResult> {
    const { redirectTo, waitForCode, close } = await this.createOAuthCallback()
    try {
      const { data, error } = await this.client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      })
      if (error) throw new Error(compactAuthError(error.message))
      if (!data.url) throw new Error('Supabase nao retornou a URL de login do Google.')

      await openUrl(data.url)
      const code = await waitForCode
      const { data: exchanged, error: exchangeError } = await this.client.auth.exchangeCodeForSession(code)
      if (exchangeError) throw new Error(compactAuthError(exchangeError.message))
      if (!exchanged.session) throw new Error('Google nao retornou uma sessao valida.')

      this.saveSession(exchanged.session)
      return { session: toPublicSession(exchanged.session, false) }
    } finally {
      close()
    }
  }

  async refresh(): Promise<PublicAuthSession | null> {
    const stored = this.store.load()
    if (!stored?.session.refresh_token) return null
    const refreshed = await this.refreshStored(stored.session.refresh_token)
    return toPublicSession(refreshed, false)
  }

  async logout(): Promise<void> {
    const stored = this.store.load()
    this.store.clear()
    if (!stored?.session) return
    await this.client.auth.setSession({
      access_token: stored.session.access_token,
      refresh_token: stored.session.refresh_token,
    }).catch(() => undefined)
    await this.client.auth.signOut().catch(() => undefined)
  }

  private async refreshStored(refreshToken: string): Promise<Session> {
    const { data, error } = await this.client.auth.refreshSession({ refresh_token: refreshToken })
    if (error || !data.session) throw new Error(compactAuthError(error?.message ?? 'Sessao expirada.'))
    this.saveSession(data.session)
    return data.session
  }

  private saveSession(session: Session): void {
    const now = Date.now()
    this.store.save({ session, savedAt: now, lastValidatedAt: now })
  }

  private async createOAuthCallback(): Promise<{
    redirectTo: string
    waitForCode: Promise<string>
    close: () => void
  }> {
    const nonce = crypto.randomBytes(18).toString('hex')
    let timeout: NodeJS.Timeout | undefined
    let settled = false

    const server = http.createServer()
    const waitForCode = new Promise<string>((resolve, reject) => {
      const finish = (fn: () => void) => {
        if (settled) return
        settled = true
        if (timeout) clearTimeout(timeout)
        fn()
      }

      server.on('request', (req, res) => {
        const url = new URL(req.url ?? '/', `http://${OAUTH_CALLBACK_HOST}`)
        if (url.pathname !== OAUTH_CALLBACK_PATH) {
          res.writeHead(404).end()
          return
        }

        if (url.searchParams.get('request') !== nonce) {
          res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' }).end('Invalid auth request.')
          return
        }

        const providerError = url.searchParams.get('error_description') ?? url.searchParams.get('error')
        if (providerError) {
          res.writeHead(400, { 'content-type': 'text/html; charset=utf-8' })
            .end(oauthResultPage(false, 'Falha no login', 'Algo deu errado com o Google. Volte ao Soaken e tente de novo.'))
          finish(() => reject(new Error(compactAuthError(providerError))))
          return
        }

        const code = url.searchParams.get('code')
        if (!code) {
          res.writeHead(400, { 'content-type': 'text/html; charset=utf-8' })
            .end(oauthResultPage(false, 'Falha no login', 'O Google não retornou o código. Volte ao Soaken e tente de novo.'))
          finish(() => reject(new Error('Google nao retornou o codigo de autenticacao.')))
          return
        }

        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        res.end(oauthResultPage(true, 'Conectado com o Google!', 'Pronto — você já está logado no Soaken. Pode fechar esta aba e voltar para o app.'))
        finish(() => resolve(code))
      })

      server.on('error', err => finish(() => reject(err)))
      timeout = setTimeout(() => finish(() => reject(new Error('Tempo de login com Google expirou.'))), OAUTH_TIMEOUT_MS)
    })

    await new Promise<void>((resolve, reject) => {
      server.listen(OAUTH_CALLBACK_PORT, OAUTH_CALLBACK_HOST, () => resolve())
      server.once('error', reject)
    })

    const address = server.address()
    if (!address || typeof address === 'string') {
      server.close()
      throw new Error('Nao foi possivel iniciar o callback local do Google.')
    }

    const redirectTo = `http://${OAUTH_CALLBACK_HOST}:${address.port}${OAUTH_CALLBACK_PATH}?request=${nonce}`
    return {
      redirectTo,
      waitForCode,
      close: () => {
        if (timeout) clearTimeout(timeout)
        server.close()
      },
    }
  }
}

function shouldRefresh(session: Session): boolean {
  const expiresAtMs = (session.expires_at ?? 0) * 1000
  if (!expiresAtMs) return true
  return expiresAtMs - Date.now() <= REFRESH_EARLY_MS
}

function toPublicSession(session: Session, offline: boolean): PublicAuthSession {
  const name = displayNameFromMetadata(session.user.user_metadata)
  return {
    user: {
      id: session.user.id,
      email: session.user.email ?? '',
      ...(name ? { name } : {}),
    },
    expiresAt: (session.expires_at ?? 0) * 1000,
    offline,
  }
}

function displayNameFromMetadata(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined
  const data = metadata as Record<string, unknown>
  const value = data.full_name ?? data.name ?? data.display_name
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function compactAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Email ou senha invalidos.'
  if (/email not confirmed/i.test(message)) return 'Confirme seu email antes de entrar.'
  if (/redirect|callback|uri/i.test(message)) return 'Redirect do Google nao permitido no Supabase.'
  return message || 'Falha de autenticacao.'
}
