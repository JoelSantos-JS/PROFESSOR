// Lógica pura do ciclo de vida do splash — desacopla o "quando fechar" das janelas reais.
// O splash deve ficar visível por um tempo MÍNIMO (evita "flash") mesmo que a UI suba rápido.

/** Quanto ainda falta esperar (ms) antes de poder fechar o splash. 0 = já pode. */
export function splashCloseDelay(shownAt: number, now: number, minMs: number): number {
  return Math.max(0, minMs - (now - shownAt))
}

/** true quando já passou o tempo mínimo de exibição. */
export function shouldCloseSplash(shownAt: number, now: number, minMs: number): boolean {
  return splashCloseDelay(shownAt, now, minMs) === 0
}
