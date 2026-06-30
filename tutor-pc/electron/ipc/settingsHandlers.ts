import { ipcMain, BrowserWindow } from 'electron'
import { SettingsService } from '../services/settingsService'
import type { WindowManager } from '../windows/windowManager'

export function setupSettingsHandlers(windowManager?: WindowManager): void {
  const settings = new SettingsService()
  ipcMain.handle('settings:get-all', () => settings.getAll())
  ipcMain.handle('settings:set', (_event, key: string, value: string) => {
    settings.set(key, value)
    // Notifica TODAS as janelas → elas re-renderizam (idioma/ajustes mudam NA HORA, sem reiniciar).
    for (const w of BrowserWindow.getAllWindows()) {
      if (!w.isDestroyed()) w.webContents.send('settings:changed', key, value)
    }
    // Idioma do app mudou → reconstrói o menu da bandeja (que vive no processo main).
    if (key === 'appLanguage') windowManager?.refreshTrayMenu()
  })
}
