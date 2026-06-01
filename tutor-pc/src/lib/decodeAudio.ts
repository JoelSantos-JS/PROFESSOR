// Decode an audio data URL to a mono Float32Array (for pitch analysis).
// Browser-only (uses AudioContext); the pitch math itself is in pitch.ts (tested).

export interface DecodedAudio {
  samples: Float32Array
  sampleRate: number
}

export async function decodeToMono(dataUrl: string): Promise<DecodedAudio | null> {
  try {
    const resp = await fetch(dataUrl)
    const arr = await resp.arrayBuffer()
    const Ctx: typeof AudioContext =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const audio = await ctx.decodeAudioData(arr)
    ctx.close()

    const channels = audio.numberOfChannels
    const len = audio.length
    const mono = new Float32Array(len)
    for (let c = 0; c < channels; c++) {
      const data = audio.getChannelData(c)
      for (let i = 0; i < len; i++) mono[i] += data[i] / channels
    }
    return { samples: mono, sampleRate: audio.sampleRate }
  } catch {
    return null
  }
}
