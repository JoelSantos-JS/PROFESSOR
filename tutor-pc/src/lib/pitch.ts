// Pitch (fundamental frequency) detection via normalized autocorrelation.
// Used to draw an intonation contour so the user can compare HOW they say a
// sentence (rising/falling pitch, stress) against the TTS and original audio.

/**
 * Detect the fundamental frequency (Hz) of a mono audio frame, or 0 when the
 * frame is unvoiced (silence / noise / no clear pitch).
 */
export function detectPitch(
  buf: Float32Array,
  sampleRate: number,
  minHz = 70,
  maxHz = 400,
  rmsGate = 0.006,
): number {
  const n = buf.length
  if (n === 0 || sampleRate <= 0) return 0

  // Energy / RMS gate — skip silent frames.
  let energy = 0
  for (let i = 0; i < n; i++) energy += buf[i] * buf[i]
  const rms = Math.sqrt(energy / n)
  if (rms < rmsGate) return 0
  const r0 = energy / n

  const maxLag = Math.min(n - 1, Math.floor(sampleRate / minHz))
  const minLag = Math.max(1, Math.floor(sampleRate / maxHz))

  let bestLag = -1
  let bestCorr = 0
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0
    for (let i = 0; i < n - lag; i++) corr += buf[i] * buf[i + lag]
    corr /= (n - lag)
    if (corr > bestCorr) { bestCorr = corr; bestLag = lag }
  }

  if (bestLag < 0 || r0 === 0) return 0
  // Require the peak to be a meaningful fraction of zero-lag energy (periodicity).
  if (bestCorr / r0 < 0.3) return 0

  return sampleRate / bestLag
}

/**
 * Pitch contour: F0 per frame across the whole signal (0 for unvoiced frames).
 */
export function pitchContour(
  samples: Float32Array,
  sampleRate: number,
  frameSize = 1024,
  hop = 512,
): number[] {
  const out: number[] = []
  if (samples.length < frameSize) return out
  for (let i = 0; i + frameSize <= samples.length; i += hop) {
    out.push(detectPitch(samples.subarray(i, i + frameSize), sampleRate))
  }
  return out
}

/**
 * Normalize a pitch contour to 0..1 (for drawing). Unvoiced (0) frames stay
 * null so the line breaks instead of dropping to the floor.
 */
export function normalizeContour(contour: number[]): (number | null)[] {
  const voiced = contour.filter(v => v > 0)
  if (voiced.length === 0) return contour.map(() => null)
  const min = Math.min(...voiced)
  const max = Math.max(...voiced)
  const range = max - min || 1
  return contour.map(v => (v > 0 ? (v - min) / range : null))
}
