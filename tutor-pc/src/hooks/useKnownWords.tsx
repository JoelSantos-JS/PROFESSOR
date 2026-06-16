import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { storeAPI } from '../services/electron'
import { normalizeKnownWord, type WordStatus } from '../lib/comprehension'

// Normaliza o código de idioma no renderer (zh-CN → zh, ko-KR → ko) para casar com a
// canonicalização feita no store, mantendo um único "balde" de status por idioma.
export function baseLang(lang: string): string {
  return (lang || '').toLowerCase().split('-')[0]
}

type StatusRecord = Record<string, WordStatus>   // normWord → status

interface KnownWordsApi {
  /** Garante que o mapa de status de um idioma foi carregado (idempotente). */
  ensureLang: (lang: string) => void
  /** Status de uma palavra (já normaliza internamente), ou undefined se não marcada. */
  statusOf: (lang: string, word: string) => WordStatus | undefined
  /** Mapa Map<normWord,status> de um idioma (para as funções puras de compreensão). */
  statusMap: (lang: string) => Map<string, WordStatus>
  /** Define/limpa o status de uma palavra (otimista + persiste). */
  setStatus: (lang: string, word: string, status: WordStatus | '') => void
  /** Nº de palavras `known` de um idioma (para marcos/cobertura). */
  knownCount: (lang: string) => number
}

const Ctx = createContext<KnownWordsApi | null>(null)

const EMPTY_MAP = new Map<string, WordStatus>()

export function KnownWordsProvider({ children }: { children: ReactNode }) {
  const [maps, setMaps] = useState<Record<string, StatusRecord>>({})
  const requested = useRef<Set<string>>(new Set())

  const ensureLang = useCallback((lang: string) => {
    const key = baseLang(lang)
    if (!key || requested.current.has(key)) return
    requested.current.add(key)
    storeAPI.knownWords(key)
      .then(rec => setMaps(prev => ({ ...prev, [key]: rec ?? {} })))
      .catch(() => setMaps(prev => ({ ...prev, [key]: {} })))
  }, [])

  const statusOf = useCallback((lang: string, word: string): WordStatus | undefined => {
    const rec = maps[baseLang(lang)]
    if (!rec) return undefined
    return rec[normalizeKnownWord(word)]
  }, [maps])

  // Memoiza um Map por idioma enquanto o record não muda, para não recriar em cada render.
  const mapCache = useRef<Record<string, { src: StatusRecord; map: Map<string, WordStatus> }>>({})
  const statusMap = useCallback((lang: string): Map<string, WordStatus> => {
    const key = baseLang(lang)
    const rec = maps[key]
    if (!rec) return EMPTY_MAP
    const cached = mapCache.current[key]
    if (cached && cached.src === rec) return cached.map
    const map = new Map(Object.entries(rec))
    mapCache.current[key] = { src: rec, map }
    return map
  }, [maps])

  const setStatus = useCallback((lang: string, word: string, status: WordStatus | '') => {
    const key = baseLang(lang)
    const norm = normalizeKnownWord(word)
    if (!norm) return
    setMaps(prev => {
      const rec = { ...(prev[key] ?? {}) }
      if (status) rec[norm] = status
      else delete rec[norm]
      return { ...prev, [key]: rec }
    })
    storeAPI.setWordStatus(key, norm, status).catch(console.error)
  }, [])

  const knownCount = useCallback((lang: string): number => {
    const rec = maps[baseLang(lang)]
    if (!rec) return 0
    let n = 0
    for (const s of Object.values(rec)) if (s === 'known') n++
    return n
  }, [maps])

  const api = useMemo<KnownWordsApi>(
    () => ({ ensureLang, statusOf, statusMap, setStatus, knownCount }),
    [ensureLang, statusOf, statusMap, setStatus, knownCount],
  )

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useKnownWords(): KnownWordsApi {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useKnownWords must be used within KnownWordsProvider')
  return ctx
}
