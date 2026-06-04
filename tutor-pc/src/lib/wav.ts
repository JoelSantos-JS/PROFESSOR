// Encode PCM samples into a standard 16-bit WAV file (ArrayBuffer).
// MediaRecorder produces "streaming" WebM with no container duration, which
// makes Whisper return text but NO word-level timestamps. Re-encoding to WAV
// (proper RIFF header + length) restores word timestamps. Pure + testable.

/** Write an ASCII tag into a DataView at `offset`. */
function writeString(view: DataView, offset: number, s: string): void {
  for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
}

/** Clamp a float sample to [-1,1] and convert to signed 16-bit. */
function toInt16(sample: number): number {
  const s = Math.max(-1, Math.min(1, sample))
  return s < 0 ? s * 0x8000 : s * 0x7fff
}

/**
 * Encode mono/multi-channel float PCM to a 16-bit WAV ArrayBuffer.
 * Channels are interleaved. `channels` must all have the same length.
 */
export function encodeWav(channels: Float32Array[], sampleRate: number): ArrayBuffer {
  const numChannels = Math.max(1, channels.length)
  const numFrames = channels[0]?.length ?? 0
  const bytesPerSample = 2
  const blockAlign = numChannels * bytesPerSample
  const dataSize = numFrames * blockAlign
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)            // fmt chunk size
  view.setUint16(20, 1, true)             // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)  // byte rate
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 8 * bytesPerSample, true)       // bits per sample
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let frame = 0; frame < numFrames; frame++) {
    for (let ch = 0; ch < numChannels; ch++) {
      view.setInt16(offset, toInt16(channels[ch][frame]), true)
      offset += 2
    }
  }
  return buffer
}
