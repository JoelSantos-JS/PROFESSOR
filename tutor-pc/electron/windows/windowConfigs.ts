import type { BrowserWindowConstructorOptions } from 'electron'

export type WindowName = 'auth' | 'dashboard' | 'floating-bar' | 'settings' | 'tutor-board' | 'review' | 'dock' | 'splash'

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
  // Splash de abertura: janela frameless arredondada, centralizada, sempre no topo. Aparece
  // antes das janelas reais e fecha quando a UI principal fica pronta (tempo mínimo de exibição).
  splash: {
    options: {
      width: 320,
      height: 400,
      show: false,
      frame: false,
      center: true,
      resizable: false,
      transparent: true,
      backgroundColor: '#00000000',  // alpha total — sem isso a margem renderiza preta no Windows
      alwaysOnTop: true,
      skipTaskbar: true,
      webPreferences: baseWebPrefs,
    },
    devTools: false,
  },

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
      transparent: true,             // cantos arredondados (o root desenha o card; as quinas viram transparentes)
      backgroundColor: '#00000000',  // alpha total — sem isso a quina arredondada renderiza preta no Windows
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
      transparent: true,             // cantos arredondados (o root desenha o card)
      backgroundColor: '#00000000',  // alpha total — quina arredondada não renderiza preta no Windows
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
      backgroundColor: '#00000000',  // alpha total — quina arredondada não renderiza preta no Windows
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
      backgroundColor: '#EDF3F2',  // --bg (Deep Soak) p/ não dar flash antes do conteúdo pintar
      webPreferences: baseWebPrefs,
    },
  },

  // Dock: barrinha horizontal flutuante (launcher) — vidro translúcido, sempre no topo.
  // Janela um pouco maior que a barra interna para as quinas arredondadas + sombra aparecerem.
  // skipTaskbar:true → sem botão na taskbar (janela transparente não rende confiável lá);
  // o ponto de restauração quando escondido é o ícone na bandeja do sistema (system tray).
  dock: {
    options: {
      width: 330,
      height: 80,
      show: false,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',  // alpha total — sem isso a margem renderiza preta no Windows
      alwaysOnTop: true,
      resizable: false,
      movable: true,    // precisa ser true p/ o setPosition (positionDock) funcionar no Windows; o "fixo"
                        // vem de NÃO ter região de arrastar no Dock.tsx (usuário não consegue mover)
      skipTaskbar: true,
      title: 'Soaken',
      webPreferences: baseWebPrefs,
    },
    devTools: false,
  },
}
