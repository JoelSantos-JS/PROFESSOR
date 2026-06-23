// Normaliza (amplifica) amostras mono de fala QUIETA para o Whisper ler melhor — sem distorcer
// e SEM amplificar silêncio/ruído (isso causaria alucinação). Só amplifica; nunca reduz áudio alto.
//
//   peak < floor        → silêncio/ruído → não mexe (não sobe ruído)
//   floor ≤ peak < alvo → amplifica até `targetPeak`, limitado por `maxGain`
//   peak já alto         → não mexe
export interface NormalizeOpts { targetPeak?: number; maxGain?: number; floor?: number }

export function normalizeSamples(
  samples: Float32Array,
  { targetPeak = 0.95, maxGain = 4, floor = 0.02 }: NormalizeOpts = {},
): Float32Array {
  let peak = 0
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i])
    if (a > peak) peak = a
  }
  if (peak < floor) return samples            // silêncio/ruído → não amplifica
  const gain = Math.min(targetPeak / peak, maxGain)
  if (gain <= 1.01) return samples            // já está alto o bastante (margem 1%) → não mexe
  const out = new Float32Array(samples.length)
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] * gain
  return out
}
