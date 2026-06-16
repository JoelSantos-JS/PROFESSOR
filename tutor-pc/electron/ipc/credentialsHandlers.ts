import { ipcMain } from 'electron'
import { CredentialsService, type ProviderId } from '../services/credentialsService'
import { providerFetch } from '../lib/providerFetch.js'
import { buildTestProbe } from '../lib/providerTestProbe.js'

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

    const probe = buildTestProbe(id, apiKey)
    if (!probe) return { ok: false, error: `Teste não disponível para "${id}".` }

    try {
      const res = await providerFetch(`${probe.label} test`, probe.url, { headers: probe.headers })
      if (!res.ok) return { ok: false, error: `${probe.label} ${res.status}: ${await compactProviderError(res)}` }
      return { ok: true, message: `${probe.label}: chave válida ✓` }
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
