import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock child_process.exec so no real media command runs during tests.
const execMock = vi.fn((_cmd: string, cb: (e: Error | null) => void) => cb(null))
vi.mock('child_process', () => ({ exec: (cmd: string, cb: (e: Error | null) => void) => execMock(cmd, cb) }))

const { pauseMedia, resumeMedia, toggleMedia, resetMediaState } = await import('./mediaControl')

/** Decode the base64 of `powershell ... -EncodedCommand <b64>` back to script text. */
function decodeScript(cmd: string): string {
  const b64 = cmd.split('-EncodedCommand ')[1]?.trim() ?? ''
  return Buffer.from(b64, 'base64').toString('utf16le')
}

beforeEach(() => {
  execMock.mockClear()
  resetMediaState()
})

describe('mediaControl (SMTC)', () => {
  it('pause invokes powershell with an EncodedCommand', async () => {
    await pauseMedia()
    expect(execMock).toHaveBeenCalledTimes(1)
    const cmd = execMock.mock.calls[0][0]
    expect(cmd.toLowerCase()).toContain('powershell')
    expect(cmd).toContain('-EncodedCommand')
  })

  it('pause uses TryPauseAsync on the SMTC session', async () => {
    await pauseMedia()
    const script = decodeScript(execMock.mock.calls[0][0])
    expect(script).toContain('GlobalSystemMediaTransportControlsSessionManager')
    expect(script).toContain('TryPauseAsync')
    expect(script).not.toContain('TryPlayAsync')
  })

  it('resume uses TryPlayAsync', async () => {
    await pauseMedia()
    await resumeMedia()
    const script = decodeScript(execMock.mock.calls[1][0])
    expect(script).toContain('TryPlayAsync')
  })

  it('pause is idempotent — second pause does not re-send', async () => {
    await pauseMedia()
    await pauseMedia()
    expect(execMock).toHaveBeenCalledTimes(1)
  })

  it('resume without a prior pause is a no-op', async () => {
    await resumeMedia()
    expect(execMock).not.toHaveBeenCalled()
  })

  it('a full pause→resume→pause cycle sends three commands', async () => {
    await pauseMedia()
    await resumeMedia()
    await pauseMedia()
    expect(execMock).toHaveBeenCalledTimes(3)
  })

  it('toggleMedia alternates pause/play and always fires', async () => {
    await toggleMedia()
    expect(decodeScript(execMock.mock.calls[0][0])).toContain('TryPauseAsync')
    await toggleMedia()
    expect(decodeScript(execMock.mock.calls[1][0])).toContain('TryPlayAsync')
  })

  it('a failing exec does not throw (degrades gracefully)', async () => {
    execMock.mockImplementationOnce((_cmd, cb) => cb(new Error('boom')))
    await expect(pauseMedia()).resolves.toBeUndefined()
  })

  it('resetMediaState clears the paused flag so next resume is a no-op', async () => {
    await pauseMedia()
    resetMediaState()
    await resumeMedia()
    expect(execMock).toHaveBeenCalledTimes(1)
  })
})
