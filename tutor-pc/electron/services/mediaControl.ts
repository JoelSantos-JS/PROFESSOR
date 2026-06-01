import { exec } from 'child_process'

// Controls the active media session via Windows System Media Transport Controls
// (SMTC / GlobalSystemMediaTransportControlsSessionManager). Unlike a synthetic
// media key, this reliably targets the session that is actually playing
// (Prime Video, Netflix, YouTube, Spotify…) and lets us pause/play explicitly.

let assumedPaused = false

/** Build the PowerShell that pauses or plays the current SMTC session. */
function buildScript(action: 'pause' | 'play'): string {
  const call = action === 'pause' ? 'TryPauseAsync' : 'TryPlayAsync'
  return `
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$ext = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' }
$asTask = $ext[0]
function Await($op, $t) { $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op)); $task.Wait(-1) | Out-Null; $task.Result }
[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime] | Out-Null
$mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
$s = $mgr.GetCurrentSession()
if ($s) { Await ($s.${call}()) ([bool]) | Out-Null }
`.trim()
}

export function sendMediaCommand(action: 'pause' | 'play'): Promise<void> {
  const encoded = Buffer.from(buildScript(action), 'utf16le').toString('base64')
  return new Promise((resolve) => {
    exec(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`, (err) => {
      if (err) console.error(`[media] ${action} failed:`, err.message)
      resolve()
    })
  })
}

/** Pause the active media session (no-op if we believe it's already paused). */
export async function pauseMedia(): Promise<void> {
  if (assumedPaused) return
  await sendMediaCommand('pause')
  assumedPaused = true
}

/** Resume the active media session (no-op if we believe it's already playing). */
export async function resumeMedia(): Promise<void> {
  if (!assumedPaused) return
  await sendMediaCommand('play')
  assumedPaused = false
}

/** Toggle play/pause based on tracked state (manual test / recovery). */
export async function toggleMedia(): Promise<void> {
  await sendMediaCommand(assumedPaused ? 'play' : 'pause')
  assumedPaused = !assumedPaused
}

/** Reset the tracked pause state (e.g. when auto-mode is turned off). */
export function resetMediaState(): void {
  assumedPaused = false
}
