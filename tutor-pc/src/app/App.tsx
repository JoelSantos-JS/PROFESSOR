import { useState } from 'react'
import type { WindowName } from '../types'
import Auth from '../windows/Auth'
import FloatingBar from '../windows/FloatingBar'
import Dashboard from '../windows/Dashboard'
import Settings from '../windows/Settings'
import TutorBoard from '../windows/TutorBoard'
import Review from '../windows/Review'
import Dock from '../windows/Dock'
import Splash from '../windows/Splash'

function getWindowName(): WindowName {
  const p = new URLSearchParams(window.location.search)
  return (p.get('window') as WindowName) ?? 'dashboard'
}

const WINDOWS: Record<string, React.ComponentType> = {
  auth: Auth,
  dashboard: Dashboard,
  'floating-bar': FloatingBar,
  settings: Settings,
  'tutor-board': TutorBoard,
  review: Review,
  dock: Dock,
  splash: Splash,
}

export default function App() {
  const [windowName] = useState<WindowName>(getWindowName)
  const Component = WINDOWS[windowName] ?? Dashboard
  return <Component />
}
