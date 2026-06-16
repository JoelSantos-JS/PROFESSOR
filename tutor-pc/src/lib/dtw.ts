// Dynamic Time Warping — alinha duas séries temporais de tamanhos/velocidades diferentes.
// Usado para comparar a SUA curva de pitch com a do nativo (tom do chinês / pitch accent do
// japonês / entonação): mesmo que você fale mais rápido ou mais devagar, o DTW alinha as
// formas e mede o quão próximas elas são (score de tom objetivo). Puro e testável.

type Dist = (a: number, b: number) => number
const absDist: Dist = (a, b) => Math.abs(a - b)

/**
 * Distância DTW entre duas sequências (custo mínimo de alinhamento monotônico).
 * 0 para sequências idênticas; tolera diferenças de velocidade (esticar/encolher).
 */
export function dtwDistance(a: number[], b: number[], dist: Dist = absDist): number {
  const n = a.length, m = b.length
  if (n === 0 && m === 0) return 0
  if (n === 0 || m === 0) return Infinity

  let prev = new Array(m + 1).fill(Infinity)
  let curr = new Array(m + 1).fill(Infinity)
  prev[0] = 0
  // dp[0][j>0] = Infinity (já preenchido), dp[i][0>] idem
  for (let i = 1; i <= n; i++) {
    curr[0] = Infinity
    for (let j = 1; j <= m; j++) {
      const cost = dist(a[i - 1], b[j - 1])
      curr[j] = cost + Math.min(prev[j], curr[j - 1], prev[j - 1])
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[m]
}

/** Caminho de alinhamento (pares de índices) — útil para visualizar/depurar. */
export function dtwPath(a: number[], b: number[], dist: Dist = absDist): Array<[number, number]> {
  const n = a.length, m = b.length
  if (n === 0 || m === 0) return []
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(Infinity))
  dp[0][0] = 0
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = dist(a[i - 1], b[j - 1])
      dp[i][j] = cost + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  // backtrack
  const path: Array<[number, number]> = []
  let i = n, j = m
  while (i > 0 && j > 0) {
    path.push([i - 1, j - 1])
    const diag = dp[i - 1][j - 1], up = dp[i - 1][j], left = dp[i][j - 1]
    const best = Math.min(diag, up, left)
    if (best === diag) { i--; j-- }
    else if (best === up) { i-- }
    else { j-- }
  }
  return path.reverse()
}

/** Z-score de uma série (média 0, desvio 1) — remove diferenças de altura/escala entre vozes. */
export function zNormalize(xs: number[]): number[] {
  if (xs.length === 0) return []
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length
  const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length
  const std = Math.sqrt(variance)
  if (std === 0) return xs.map(() => 0)
  return xs.map(x => (x - mean) / std)
}

/**
 * Score de SEMELHANÇA DE FORMA (0–100) entre duas curvas de pitch (Hz; 0 = não-vozeado).
 * Compara o FORMATO (entonação/tom), não a altura absoluta: filtra trechos não-vozeados,
 * normaliza cada curva (z-score) e usa DTW. 100 = idêntico; cai conforme diverge.
 */
export function pitchShapeScore(user: number[], ref: number[]): number {
  const u = zNormalize(user.filter(v => v > 0))
  const r = zNormalize(ref.filter(v => v > 0))
  if (u.length < 2 || r.length < 2) return 0
  const d = dtwDistance(u, r)
  const steps = Math.max(u.length, r.length)
  const avg = d / steps                 // distância média por passo (em desvios-padrão)
  return Math.round(100 * Math.exp(-avg))  // 0 dist → 100; cresce a distância → cai suave
}
