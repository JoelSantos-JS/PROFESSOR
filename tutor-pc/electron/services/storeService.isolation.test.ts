import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs'

// userData isolado + usuário ativo controlável (mock do secureSessionStore).
const ref = vi.hoisted(() => ({ dir: '', user: '' }))
vi.mock('electron', () => ({ app: { getPath: () => ref.dir } }))
vi.mock('./secureSessionStore.js', () => ({ activeUserId: () => ref.user }))

async function freshStore() {
  const { StoreService } = await import('./storeService.js')
  return new StoreService()
}

describe('StoreService — isolamento por usuário (conta)', () => {
  beforeEach(() => { ref.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'soaken-iso-')); ref.user = '' })
  afterEach(() => { fs.rmSync(ref.dir, { recursive: true, force: true }) })

  it('cada conta tem seus próprios dados — NÃO vaza entre usuários no mesmo PC', async () => {
    ref.user = 'user-A'
    const a = await freshStore()
    a.recordMistakes([{ word: 'apple', lang: 'en' }])
    expect(a.getMistakes('en').length).toBe(1)

    // outra conta no MESMO PC → começa VAZIA (o bug que estávamos corrigindo)
    ref.user = 'user-B'
    const b = await freshStore()
    expect(b.getMistakes('en')).toEqual([])

    // volta pra A → dados preservados
    ref.user = 'user-A'
    const a2 = await freshStore()
    expect(a2.getMistakes('en').length).toBe(1)
  })

  it('grava em pasta separada por usuário (users/<id>/store.json)', async () => {
    ref.user = 'user-X'
    const s = await freshStore()
    s.recordMistakes([{ word: 'x', lang: 'en' }])
    expect(fs.existsSync(path.join(ref.dir, 'users', 'user-X', 'store.json'))).toBe(true)
  })

  it('sem login (user vazio) cai no arquivo legado da máquina', async () => {
    ref.user = ''
    const s = await freshStore()
    s.recordMistakes([{ word: 'y', lang: 'en' }])
    expect(fs.existsSync(path.join(ref.dir, 'store.json'))).toBe(true)
  })
})
