import { describe, it, expect } from 'vitest'
import { micLabel } from './audioDevices'

describe('micLabel', () => {
  it('usa o nome do device quando há label', () => {
    expect(micLabel('Headset (Realtek)', 0, 'pt')).toBe('Headset (Realtek)')
  })

  it('cai para "Microfone N" (pt) / "Microphone N" (en) quando sem label', () => {
    expect(micLabel('', 0, 'pt')).toBe('Microfone 1')
    expect(micLabel('   ', 2, 'pt')).toBe('Microfone 3')
    expect(micLabel('', 1, 'en')).toBe('Microphone 2')
  })
})
