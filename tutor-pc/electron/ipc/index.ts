import { WindowManager } from '../windows/windowManager.js'
import { setupWindowHandlers } from './windowHandlers.js'
import { setupSettingsHandlers } from './settingsHandlers.js'
import { setupCredentialsHandlers } from './credentialsHandlers.js'
import { setupAudioHandlers } from './audioHandlers.js'
import { setupTutorHandlers } from './tutorHandlers.js'
import { setupTtsHandlers } from './ttsHandlers.js'
import { setupStoreHandlers } from './storeHandlers.js'
import { setupMediaHandlers } from './mediaHandlers.js'
import { setupAuthHandlers } from './authHandlers.js'
import { setupPronunciationHandlers } from './pronunciationHandlers.js'

export function setupIPC(windowManager: WindowManager, onAuthComplete?: () => void, onLogout?: () => void): void {
  setupAuthHandlers()
  setupWindowHandlers(windowManager, onAuthComplete, onLogout)
  setupSettingsHandlers(windowManager)
  setupCredentialsHandlers()
  setupAudioHandlers()
  setupTutorHandlers(windowManager)
  setupTtsHandlers()
  setupStoreHandlers()
  setupMediaHandlers()
  setupPronunciationHandlers()
}
