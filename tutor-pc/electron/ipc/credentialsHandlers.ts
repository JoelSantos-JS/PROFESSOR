import { ipcMain } from 'electron'
import { CredentialsService, type ProviderId } from '../services/credentialsService'
import { providerFetch } from '../lib/providerFetch.js'

export function setupCredentialsHandlers(): void {
  const credentials = new CredentialsService()

  ipcMain.handle('credentials:list', () => credentials.list())

  ipcMain.handle('credentials:set', async (_e, id: ProviderId, key: string) => {
    try {
      credentials.set(id, key)
      return { ok: true }
    } catch (err) {
      console.error('[credentials:set] error:', (err as Error).message)
      return { ok: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('credentials:get', (_e, id: ProviderId) => credentials.get(id))

  ipcMain.handle('credentials:remove', (_e, id: ProviderId) => credentials.remove(id))

  ipcMain.handle('credentials:debug', () => credentials.debugInfo())

  ipcMain.handle('credentials:test', async (_e, id: ProviderId) => {
    const apiKey = credentials.get(id)
    if (!apiKey) return { ok: false, error: `Nenhuma chave configurada para "${id}".` }

    try {
      if (id === 'gemini') {
        const res = await providerFetch('Gemini test', `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
        if (!res.ok) return { ok: false, error: `Gemini ${res.status}: ${await compactProviderError(res)}` }
        return { ok: true, message: 'Gemini respondeu com sucesso para esta chave.' }
      }
      return { ok: false, error: `Teste ainda não implementado para "${id}".` }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })
}

async function compactProviderError(res: Response): Promise<string> {
  const body = await res.text()
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string; status?: string } }
    return [parsed.error?.status, parsed.error?.message].filter(Boolean).join(': ') || body
  } catch {
    return body
  }
}
