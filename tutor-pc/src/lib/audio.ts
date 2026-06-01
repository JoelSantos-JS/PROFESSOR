/**
 * Extract EBML+Tracks header bytes from the first WebM chunk produced by
 * MediaRecorder in timeslice mode. The header ends just before the first
 * Cluster element (ID = 0x1F 0x43 0xB6 0x75). Prepending this header to
 * any subsequent cluster-only chunk produces a valid standalone WebM file.
 */
export function extractWebMHeader(buf: ArrayBuffer): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.length - 3; i++) {
    if (
      bytes[i]     === 0x1F &&
      bytes[i + 1] === 0x43 &&
      bytes[i + 2] === 0xB6 &&
      bytes[i + 3] === 0x75
    ) {
      return bytes.slice(0, i) as Uint8Array<ArrayBuffer>
    }
  }
  return bytes as Uint8Array<ArrayBuffer>
}

/**
 * Returns true if the time-domain data from an AnalyserNode contains
 * enough voiced samples to be considered speech (not silence/noise).
 *
 * @param data  Uint8Array from AnalyserNode.getByteTimeDomainData()
 * @param threshold  absolute deviation from 128 to count as voiced (default 14)
 * @param minRatio   fraction of samples that must exceed threshold (default 0.03)
 */
export function isVoiced(
  data: Uint8Array<ArrayBufferLike>,
  threshold = 16,
  minRatio   = 0.04,
): boolean {
  let count = 0
  for (const v of data) if (Math.abs(v - 128) > threshold) count++
  return count > data.length * minRatio
}

/**
 * Peak absolute deviation from the 128 midpoint in a time-domain frame.
 * Real speech peaks well above ambient noise; used as an energy gate to
 * discard near-silent utterances before sending them to transcription
 * (prevents model hallucinations on silence/noise).
 */
export function peakLevel(data: Uint8Array<ArrayBufferLike>): number {
  let peak = 0
  for (const v of data) {
    const d = Math.abs(v - 128)
    if (d > peak) peak = d
  }
  return peak
}
