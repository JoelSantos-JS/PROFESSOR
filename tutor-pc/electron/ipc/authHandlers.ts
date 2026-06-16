import { ipcMain, shell } from 'electron'
import { ZodError } from 'zod'
import { AuthService } from '../services/authService.js'

export function setupAuthHandlers(): void {
  const auth = new AuthService()

  ipcMain.handle('auth:get-session', async () => {
    try {
      return { ok: true, session: await auth.getSession() }
    } catch (err) {
      return { ok: false, error: safeError(err) }
    }
  })

  ipcMain.handle('auth:login', async (_event, payload: unknown) => {
    try {
      return { ok: true, ...(await auth.login(payload)) }
    } catch (err) {
      return { ok: false, error: safeError(err) }
    }
  })

  ipcMain.handle('auth:signup', async (_event, payload: unknown) => {
    try {
      return { ok: true, ...(await auth.signup(payload)) }
    } catch (err) {
      return { ok: false, error: safeError(err) }
    }
  })

  ipcMain.handle('auth:google', async () => {
    try {
      return { ok: true, ...(await auth.loginWithGoogle(url => shell.openExternal(url))) }
    } catch (err) {
      return { ok: false, error: safeError(err) }
    }
  })

  ipcMain.handle('auth:refresh', async () => {
    try {
      return { ok: true, session: await auth.refresh() }
    } catch (err) {
      return { ok: false, error: safeError(err) }
    }
  })

  ipcMain.handle('auth:logout', async () => {
    try {
      await auth.logout()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: safeError(err) }
    }
  })
}

function safeError(err: unknown): string {
  if (err instanceof ZodError) return 'Email ou senha em formato invalido.'
  return (err as Error).message || 'Falha de autenticacao.'
}
