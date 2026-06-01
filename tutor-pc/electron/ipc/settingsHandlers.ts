import { ipcMain } from 'electron'
import { SettingsService } from '../services/settingsService'

export function setupSettingsHandlers(): void {
  const settings = new SettingsService()
  ipcMain.handle('settings:get-all', () => settings.getAll())
  ipcMain.handle('settings:set', (_event, key: string, value: string) => settings.set(key, value))
}
