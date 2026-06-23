// Fila sequencial para finalizar falas SEM perder nenhuma. Várias falas podem terminar
// enquanto uma está sendo transcrita (fala contínua/rápida); todas entram na fila e são
// processadas EM ORDEM, uma por vez. Era esse o bug do "pulou frases": antes uma fala que
// terminava durante o processamento de outra era descartada.

export interface DrainController<T> {
  enqueue(item: T): void
  size(): number
  isBusy(): boolean
  clear(): void
}

export function createDrainController<T>(opts: {
  process: (item: T) => Promise<void>
  active: () => boolean              // enquanto false, para de drenar (ex.: parou de escutar)
  onBusyChange?: (busy: boolean) => void
}): DrainController<T> {
  const queue: T[] = []
  let busy = false

  async function drain(): Promise<void> {
    if (busy) return                 // já drenando → enqueue só empilha, este loop pega
    busy = true
    opts.onBusyChange?.(true)
    try {
      while (queue.length > 0 && opts.active()) {
        // try/catch POR ITEM: se o processamento de um estourar, o RESTO da fila continua
        // (uma falha não pode levar embora as outras falas).
        try { await opts.process(queue.shift() as T) } catch { /* segue a fila */ }
      }
    } finally {
      busy = false
      opts.onBusyChange?.(false)
    }
  }

  return {
    enqueue(item: T) { queue.push(item); void drain() },
    size: () => queue.length,
    isBusy: () => busy,
    clear: () => { queue.length = 0 },
  }
}
