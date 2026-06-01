import type { BrowserWindowConstructorOptions } from 'electron'

export type WindowName = 'dashboard' | 'floating-bar' | 'settings' | 'tutor-board' | 'review'

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
  dashboard: {
    options: {
      width: 1100,
      height: 680,
      minWidth: 900,
      minHeight: 600,
      show: false,
      frame: false,
      backgroundColor: '#070D17',
      webPreferences: baseWebPrefs,
    },
  },

  'floating-bar': {
    options: {
      width: 400,
      height: 520,
      minWidth: 320,
      minHeight: 300,
      show: false,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: false,
      resizable: true,
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
      backgroundColor: '#070D17',
      webPreferences: baseWebPrefs,
    },
  },

  'tutor-board': {
    startHidden: true,  // only appears once there's a transcription to show
    options: {
      width: 680,
      height: 480,
      minWidth: 500,
      minHeight: 360,
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
      backgroundColor: '#070D17',
      webPreferences: baseWebPrefs,
    },
  },
}
