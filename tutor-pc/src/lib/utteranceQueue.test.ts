import { describe, expect, it } from 'vitest'
import { createDrainController } from './utteranceQueue'

const tick = () => new Promise<void>(r => setTimeout(r, 0))

describe('createDrainController', () => {
  it('processa os itens EM ORDEM', async () => {
    const seen: number[] = []
    const c = createDrainController<number>({ process: async n => { seen.push(n) }, active: () => true })
    c.enqueue(1); c.enqueue(2); c.enqueue(3)
    await tick(); await tick()
    expect(seen).toEqual([1, 2, 3])
  })

  it('NÃO descarta itens enfileirados durante o processamento de outro', async () => {
    const seen: number[] = []
    let resolveFirst!: () => void
    const c = createDrainController<number>({
      process: async n => {
        seen.push(n)
        if (n === 1) await new Promise<void>(r => { resolveFirst = r })  // trava no 1º
      },
      active: () => true,
    })
    c.enqueue(1)
    await tick()
    // enquanto o 1 está "em voo", chegam 2 e 3 → devem entrar na fila, não sumir
    c.enqueue(2); c.enqueue(3)
    expect(seen).toEqual([1])
    resolveFirst()
    await tick(); await tick()
    expect(seen).toEqual([1, 2, 3])
  })

  it('um único drain roda por vez (sem concorrência)', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const c = createDrainController<number>({
      process: async () => {
        inFlight++; maxInFlight = Math.max(maxInFlight, inFlight)
        await tick()
        inFlight--
      },
      active: () => true,
    })
    c.enqueue(1); c.enqueue(2); c.enqueue(3)
    await tick(); await tick(); await tick(); await tick()
    expect(maxInFlight).toBe(1)
  })

  it('para de drenar quando active() vira false', async () => {
    const seen: number[] = []
    let on = true
    const c = createDrainController<number>({
      process: async n => { seen.push(n); if (n === 1) on = false },
      active: () => on,
    })
    c.enqueue(1); c.enqueue(2); c.enqueue(3)
    await tick(); await tick()
    expect(seen).toEqual([1])  // após o 1, active=false → não processa 2/3
  })

  it('onBusyChange sinaliza início e fim do dreno', async () => {
    const events: boolean[] = []
    const c = createDrainController<number>({
      process: async () => { await tick() },
      active: () => true,
      onBusyChange: b => events.push(b),
    })
    c.enqueue(1)
    await tick(); await tick()
    expect(events[0]).toBe(true)
    expect(events[events.length - 1]).toBe(false)
  })

  it('clear esvazia a fila pendente', async () => {
    const seen: number[] = []
    let resolveFirst!: () => void
    const c = createDrainController<number>({
      process: async n => { seen.push(n); if (n === 1) await new Promise<void>(r => { resolveFirst = r }) },
      active: () => true,
    })
    c.enqueue(1); await tick()
    c.enqueue(2); c.enqueue(3)
    expect(c.size()).toBe(2)
    c.clear()
    expect(c.size()).toBe(0)
    resolveFirst()
    await tick(); await tick()
    expect(seen).toEqual([1])  // 2 e 3 foram limpos
  })

  it('uma falha em um item NÃO leva embora o resto da fila', async () => {
    const seen: number[] = []
    const c = createDrainController<number>({
      process: async n => { seen.push(n); if (n === 2) throw new Error('falha no 2') },
      active: () => true,
    })
    c.enqueue(1); c.enqueue(2); c.enqueue(3); c.enqueue(4)
    await tick(); await tick(); await tick()
    expect(seen).toEqual([1, 2, 3, 4])  // o 2 falhou mas 3 e 4 ainda foram processados
  })

  it('volta a drenar quando um novo item chega após a fila esvaziar', async () => {
    const seen: number[] = []
    const c = createDrainController<number>({ process: async n => { seen.push(n) }, active: () => true })
    c.enqueue(1)
    await tick(); await tick()
    expect(seen).toEqual([1])
    expect(c.isBusy()).toBe(false)
    c.enqueue(2)   // fila já tinha esvaziado → precisa reiniciar o dreno
    await tick(); await tick()
    expect(seen).toEqual([1, 2])
  })

  it('nada é processado se active() já começa false', async () => {
    const seen: number[] = []
    const c = createDrainController<number>({ process: async n => { seen.push(n) }, active: () => false })
    c.enqueue(1); c.enqueue(2)
    await tick(); await tick()
    expect(seen).toEqual([])
    expect(c.size()).toBe(2)  // ficam na fila, não somem
  })

  it('preserva a ordem mesmo com durações de processamento diferentes', async () => {
    const seen: number[] = []
    const delays: Record<number, number> = { 1: 30, 2: 5, 3: 15 }
    const c = createDrainController<number>({
      process: async n => { await new Promise<void>(r => setTimeout(r, delays[n])); seen.push(n) },
      active: () => true,
    })
    c.enqueue(1); c.enqueue(2); c.enqueue(3)
    await new Promise<void>(r => setTimeout(r, 300))  // folga p/ não dar flake sob carga
    expect(seen).toEqual([1, 2, 3])  // ordem de chegada, não de duração
  })
})
