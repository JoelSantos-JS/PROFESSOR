// Enumeração de microfones para os seletores das Configurações.

/** Abre o microfone escolhido nas Configurações (deviceId), com fallback pro padrão se sumir. */
export async function openMicStream(deviceId?: string): Promise<MediaStream> {
  const audio: MediaTrackConstraints | boolean =
    deviceId && deviceId !== 'default' ? { deviceId: { exact: deviceId } } : true
  try {
    return await navigator.mediaDevices.getUserMedia({ audio, video: false })
  } catch {
    return navigator.mediaDevices.getUserMedia({ audio: true, video: false })
  }
}

/** Rótulo amigável do microfone (nome do device; ou "Microfone N" quando o label vem vazio). */
export function micLabel(label: string, index: number, uiLang: 'pt' | 'en'): string {
  const clean = (label || '').trim()
  if (clean) return clean
  return uiLang === 'en' ? `Microphone ${index + 1}` : `Microfone ${index + 1}`
}

/**
 * Lista os microfones (audioinput). Sem permissão concedida os rótulos vêm vazios, então pedimos
 * acesso uma vez (e soltamos o stream) só pra DESTRAVAR os nomes, e re-enumeramos.
 */
export async function listMicrophones(): Promise<MediaDeviceInfo[]> {
  try {
    let devices = await navigator.mediaDevices.enumerateDevices()
    let mics = devices.filter(d => d.kind === 'audioinput')
    if (mics.length > 0 && mics.every(d => !d.label)) {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null)
      if (s) {
        s.getTracks().forEach(t => t.stop())
        devices = await navigator.mediaDevices.enumerateDevices()
        mics = devices.filter(d => d.kind === 'audioinput')
      }
    }
    // Remove o "default"/"communications" duplicados do Windows (mesmo device com id especial).
    return mics.filter(d => d.deviceId !== 'default' && d.deviceId !== 'communications')
  } catch {
    return []
  }
}
