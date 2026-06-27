import { describe, expect, it } from 'vitest'
import { aggregateDownload, emptyDownload } from './modelDownload'

describe('aggregateDownload', () => {
  it('calcula % de um arquivo', () => {
    const r = aggregateDownload(emptyDownload, { file: 'model.onnx', loaded: 50, total: 100 })
    expect(r.percent).toBe(50)
    expect(r.active).toBe(true)
  })

  it('agrega vários arquivos num % geral', () => {
    let s = emptyDownload
    let r = aggregateDownload(s, { file: 'a', loaded: 100, total: 100 }); s = r.state
    r = aggregateDownload(s, { file: 'b', loaded: 50, total: 300 }); s = r.state
    expect(r.percent).toBe(Math.round(150 / 400 * 100))  // 38
  })

  it('não regride o loaded de um arquivo (usa o máximo)', () => {
    let r = aggregateDownload(emptyDownload, { file: 'a', loaded: 80, total: 100 })
    r = aggregateDownload(r.state, { file: 'a', loaded: 30, total: 100 })  // evento fora de ordem
    expect(r.percent).toBe(80)
  })

  it('active=false quando tudo baixou', () => {
    const r = aggregateDownload(emptyDownload, { file: 'a', loaded: 100, total: 100 })
    expect(r.percent).toBe(100)
    expect(r.active).toBe(false)
  })

  it('ignora evento sem total (não quebra)', () => {
    const r = aggregateDownload(emptyDownload, { status: 'initiate', file: 'a' })
    expect(r.percent).toBe(0)
    expect(r.active).toBe(false)
  })
})
