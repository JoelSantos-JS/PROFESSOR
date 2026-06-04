// Decode an audio data URL to a mono Float32Array (for pitch analysis).
// Browser-only (uses AudioContext); the pitch math itself is in pitch.ts (tested).

export interface DecodedAudio {
  samples: Float32Array
  sampleRate: number
}

// One shared AudioContext for all decoding. Creating a new context per call
// quickly hits Chromium's ~6-context limit and makes decodeAudioData fail.
let sharedCtx: AudioContext | null = null
function getCtx(): AudioContext {
  if (!sharedCtx) {
    const Ctx: typeof AudioContext =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    sharedCtx = new Ctx()
  }
  return sharedCtx
}

function downmix(audio: AudioBuffer): DecodedAudio {
  const channels = audio.numberOfChannels
  const len = audio.length
  const mono = new Float32Array(len)
  for (let c = 0; c < channels; c++) {
    const data = audio.getChannelData(c)
    for (let i = 0; i < len; i++) mono[i] += data[i] / channels
  }
  return { samples: mono, sampleRate: audio.sampleRate }
}

export async function decodeToMono(dataUrl: string): Promise<DecodedAudio | null> {
  if (!dataUrl) return null
  try {
    const arr = await (await fetch(dataUrl)).arrayBuffer()
    return downmix(await getCtx().decodeAudioData(arr.slice(0)))
  } catch (err) {
    console.error('[audio] decode (url) failed:', (err as Error)?.message)
    return null
  }
}

/** Decode raw audio bytes (e.g. a recorded blob) to mono samples. */
export async function decodeBufferToMono(buffer: ArrayBuffer): Promise<DecodedAudio | null> {
  try {
    return downmix(await getCtx().decodeAudioData(buffer.slice(0)))
  } catch (err) {
    console.error('[audio] decode (buffer) failed:', (err as Error)?.message)
    return null
  }
}
