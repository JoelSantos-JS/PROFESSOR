import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'fs'
import http from 'http'
import os from 'os'
import path from 'path'

const ref = vi.hoisted(() => ({
  dir: '',
  auth: {} as Record<string, unknown>,
  redirectTo: '',
}))

vi.mock('electron', () => ({
  app: { getPath: () => ref.dir },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(`enc:${value}`, 'utf-8'),
    decryptString: (buffer: Buffer) => buffer.toString('utf-8').replace(/^enc:/, ''),
  },
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: ref.auth,
  }),
}))

function session(email = 'user@example.com', name?: string) {
  return {
    access_token: 'access-secret',
    refresh_token: 'refresh-secret',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: {
      id: 'user_1',
      email,
      user_metadata: name ? { name, full_name: name } : {},
    },
  }
}

async function freshService() {
  const { AuthService } = await import('./authService.js')
  return new AuthService()
}

describe('AuthService', () => {
  beforeEach(() => {
    ref.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'professor-auth-'))
    ref.auth = {
      signInWithPassword: vi.fn(async () => ({ data: { session: session() }, error: null })),
      signUp: vi.fn(async () => ({ data: { session: null }, error: null })),
      signInWithOAuth: vi.fn(async (opts: { options: { redirectTo: string } }) => {
        ref.redirectTo = opts.options.redirectTo
        return { data: { url: 'https://accounts.google.com/o/oauth2/v2/auth' }, error: null }
      }),
      exchangeCodeForSession: vi.fn(async () => ({ data: { session: session('google@example.com') }, error: null })),
      refreshSession: vi.fn(async () => ({ data: { session: session() }, error: null })),
      setSession: vi.fn(async () => ({ data: {}, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
    }
  })

  afterEach(() => {
    fs.rmSync(ref.dir, { recursive: true, force: true })
    vi.resetModules()
  })

  it('login salva sessao criptografada e retorna somente dados publicos', async () => {
    const auth = await freshService()
    const result = await auth.login({ email: 'USER@EXAMPLE.COM', password: 'password123' })
    expect(result.session?.user.email).toBe('user@example.com')
    expect(JSON.stringify(result)).not.toMatch(/access-secret|refresh-secret|access_token|refresh_token/)

    const raw = fs.readFileSync(path.join(ref.dir, 'auth-session.json'), 'utf-8')
    expect(raw).toContain('encrypted')
    expect(raw).not.toContain('access-secret')
    expect(raw).not.toContain('refresh-secret')
  })

  it('rejeita payload invalido antes de chamar Supabase', async () => {
    const auth = await freshService()
    await expect(auth.login({ email: 'not-email', password: '123' })).rejects.toThrow()
    expect(ref.auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('signup envia nome como metadata, normaliza dados e indica confirmacao de email', async () => {
    const auth = await freshService()
    const result = await auth.signup({ name: '  Joel  ', email: 'NEW@EXAMPLE.COM ', password: 'secret1' })

    expect(ref.auth.signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'secret1',
      options: {
        data: {
          name: 'Joel',
          full_name: 'Joel',
        },
      },
    })
    expect(result.needsEmailConfirmation).toBe(true)
    expect(result.session).toBeNull()
    expect(fs.existsSync(path.join(ref.dir, 'auth-session.json'))).toBe(false)
  })

  it('signup com sessao salva login criptografado e retorna somente dados publicos', async () => {
    ref.auth.signUp = vi.fn(async () => ({ data: { session: session('new@example.com', 'Joel') }, error: null }))
    const auth = await freshService()

    const result = await auth.signup({ name: 'Joel', email: 'new@example.com', password: 'secret1' })

    expect(result.needsEmailConfirmation).toBe(false)
    expect(result.session?.user.email).toBe('new@example.com')
    expect(result.session?.user.name).toBe('Joel')
    expect(JSON.stringify(result)).not.toMatch(/access-secret|refresh-secret|access_token|refresh_token/)

    const raw = fs.readFileSync(path.join(ref.dir, 'auth-session.json'), 'utf-8')
    expect(raw).toContain('encrypted')
    expect(raw).not.toContain('access-secret')
    expect(raw).not.toContain('refresh-secret')
  })

  it('signup rejeita payloads invalidos antes de chamar Supabase', async () => {
    const auth = await freshService()
    await expect(auth.signup({ email: 'new@example.com', password: 'secret1' })).rejects.toThrow()
    await expect(auth.signup({ name: ' ', email: 'new@example.com', password: 'secret1' })).rejects.toThrow()
    await expect(auth.signup({ name: 'Joel', email: 'not-email', password: 'secret1' })).rejects.toThrow()
    await expect(auth.signup({ name: 'Joel', email: 'new@example.com', password: '12345' })).rejects.toThrow()
    await expect(auth.signup({ name: 'Joel', email: 'new@example.com', password: 'secret1', role: 'admin' })).rejects.toThrow()
    expect(ref.auth.signUp).not.toHaveBeenCalled()
  })

  it('signup propaga erro do provider sem salvar sessao local', async () => {
    ref.auth.signUp = vi.fn(async () => ({ data: { session: null }, error: { message: 'User already registered' } }))
    const auth = await freshService()

    await expect(auth.signup({ name: 'Joel', email: 'new@example.com', password: 'secret1' })).rejects.toThrow(/User already registered/)
    expect(fs.existsSync(path.join(ref.dir, 'auth-session.json'))).toBe(false)
  })

  it('login com Google usa PKCE/callback local e salva somente sessao publica', async () => {
    const auth = await freshService()
    const result = await auth.loginWithGoogle(async () => {
      setTimeout(() => {
        http.get(`${ref.redirectTo}&code=google-code`).on('error', () => undefined)
      }, 0)
    })

    expect(ref.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: expect.stringMatching(/^http:\/\/127\.0\.0\.1:17654\/auth\/callback\?request=/),
        skipBrowserRedirect: true,
      },
    })
    expect(ref.auth.exchangeCodeForSession).toHaveBeenCalledWith('google-code')
    expect(result.session?.user.email).toBe('google@example.com')
    expect(JSON.stringify(result)).not.toMatch(/access-secret|refresh-secret|access_token|refresh_token/)
  })

  it('logout limpa a sessao local e revoga no provider sem expor token', async () => {
    const auth = await freshService()
    await auth.login({ email: 'user@example.com', password: 'password123' })
    await auth.logout()
    expect(fs.existsSync(path.join(ref.dir, 'auth-session.json'))).toBe(false)
    expect(ref.auth.signOut).toHaveBeenCalled()
  })
})
