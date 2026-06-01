import { createRequire } from 'module'

// ESM cannot use named imports from Electron's CJS module directly.
// createRequire forces the CJS require() that Electron intercepts correctly.
const _require = createRequire(import.meta.url)
const e = _require('electron') as typeof import('electron')

export const {
  app,
  BrowserWindow,
  ipcMain,
  ipcRenderer,
  contextBridge,
  globalShortcut,
  screen,
  Tray,
  Menu,
  nativeImage,
  dialog,
  shell,
} = e

export default e
