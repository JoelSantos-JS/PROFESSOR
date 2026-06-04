import { describe, it, expect } from 'vitest'
import { encodeWav } from './wav'

function readStr(view: DataView, offset: number, len: number): string {
  let s = ''
  for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(offset + i))
  return s
}

describe('encodeWav', () => {
  it('writes a valid RIFF/WAVE header', () => {
    const buf = encodeWav([new Float32Array([0, 0, 0])], 16000)
    const v = new DataView(buf)
    expect(readStr(v, 0, 4)).toBe('RIFF')
    expect(readStr(v, 8, 4)).toBe('WAVE')
    expect(readStr(v, 12, 4)).toBe('fmt ')
    expect(readStr(v, 36, 4)).toBe('data')
  })

  it('encodes PCM (1), correct channels/sampleRate/bit depth', () => {
    const v = new DataView(encodeWav([new Float32Array(10)], 44100))
    expect(v.getUint16(20, true)).toBe(1)       // PCM
    expect(v.getUint16(22, true)).toBe(1)       // mono
    expect(v.getUint32(24, true)).toBe(44100)   // sample rate
    expect(v.getUint16(34, true)).toBe(16)      // bits per sample
    expect(v.getUint16(32, true)).toBe(2)       // block align (mono * 2 bytes)
  })

  it('has the right total size (44 header + 2 bytes/sample)', () => {
    const frames = 8
    const buf = encodeWav([new Float32Array(frames)], 16000)
    expect(buf.byteLength).toBe(44 + frames * 2)
    const v = new DataView(buf)
    expect(v.getUint32(4, true)).toBe(36 + frames * 2)   // RIFF size
    expect(v.getUint32(40, true)).toBe(frames * 2)        // data size
  })

  it('converts float samples to 16-bit PCM (full-scale + clamp)', () => {
    const v = new DataView(encodeWav([new Float32Array([1, -1, 0, 2, -2])], 16000))
    expect(v.getInt16(44, true)).toBe(32767)    // +1.0 → max
    expect(v.getInt16(46, true)).toBe(-32768)   // -1.0 → min
    expect(v.getInt16(48, true)).toBe(0)        // 0
    expect(v.getInt16(50, true)).toBe(32767)    // +2.0 clamped to +1.0
    expect(v.getInt16(52, true)).toBe(-32768)   // -2.0 clamped to -1.0
  })

  it('interleaves stereo channels', () => {
    const L = new Float32Array([1, 0])
    const R = new Float32Array([-1, 0])
    const v = new DataView(encodeWav([L, R], 16000))
    expect(v.getUint16(22, true)).toBe(2)        // 2 channels
    expect(v.getUint16(32, true)).toBe(4)        // block align (2ch * 2 bytes)
    expect(v.getInt16(44, true)).toBe(32767)     // L[0]
    expect(v.getInt16(46, true)).toBe(-32768)    // R[0]
  })

  it('starts with RIFF magic bytes (so the server detects WAV)', () => {
    const v = new DataView(encodeWav([new Float32Array(1)], 16000))
    expect([v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3)]).toEqual([0x52, 0x49, 0x46, 0x46])
  })

  it('handles an empty signal', () => {
    const buf = encodeWav([new Float32Array(0)], 16000)
    expect(buf.byteLength).toBe(44)
  })
})
