import type { BrowserWindowConstructorOptions } from 'electron'

export type WindowName = 'auth' | 'dashboard' | 'floating-bar' | 'settings' | 'tutor-board' | 'review'

export interface WindowConfig {
  options: Omit<BrowserWindowConstructorOptions, 'webPreferences'> & {
    webPreferences?: Omit<NonNullable<BrowserWindowConstructorOptions['webPreferences']>, 'preload'>
  }
  devTools?: boolean
  startHidden?: boolean  // create + load (so it's subscribed) but don't show until asked
}

const baseWebPrefs = {
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: false,
}

export const windowConfigs: Record<WindowName, WindowConfig> = {
  auth: {
    options: {
      width: 368,
      height: 640,
      minWidth: 368,
      minHeight: 640,
      maxWidth: 368,
      maxHeight: 640,
      show: false,
      frame: false,
      center: true,
      resizable: false,
      transparent: true,
      backgroundColor: '#00000000',
      webPreferences: baseWebPrefs,
    },
  },

  dashboard: {
    options: {
      width: 1100,
      height: 680,
      minWidth: 900,
      minHeight: 600,
      show: false,
      frame: false,
      backgroundColor: '#F3EAE0',  // creme base (--bg) p/ não dar flash escuro antes do conteúdo pintar
      webPreferences: baseWebPrefs,
    },
  },

  'floating-bar': {
    options: {
      width: 400,
      height: 228,            // começa compacta; cresce p/ ~560 quando há transcrição
      minWidth: 360,
      minHeight: 180,
      maxWidth: 440,
      maxHeight: 680,
      show: false,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: false,
      resizable: false,
      movable: true,
      webPreferences: baseWebPrefs,
    },
    devTools: false,
  },

  settings: {
    options: {
      width: 640,
      height: 520,
      show: false,
      frame: false,
      resizable: false,
      backgroundColor: '#F3EAE0',  // creme base (--bg) p/ não dar flash escuro antes do conteúdo pintar
      webPreferences: baseWebPrefs,
    },
  },

  'tutor-board': {
    startHidden: true,  // only appears once there's a transcription to show
    options: {
      width: 820,
      height: 680,
      minWidth: 560,
      minHeight: 420,
      show: false,
      frame: false,
      transparent: true,
      webPreferences: baseWebPrefs,
    },
  },

  review: {
    options: {
      width: 560,
      height: 560,
      minWidth: 420,
      minHeight: 440,
      show: false,
      frame: false,
      backgroundColor: '#F3EAE0',  // creme base (--bg) p/ não dar flash escuro antes do conteúdo pintar
      webPreferences: baseWebPrefs,
    },
  },
}
