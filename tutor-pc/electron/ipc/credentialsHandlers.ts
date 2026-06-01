import { ipcMain } from 'electron'
import { CredentialsService, type ProviderId } from '../services/credentialsService'

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
}
