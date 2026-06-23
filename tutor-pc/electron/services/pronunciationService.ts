import { CredentialsService } from './credentialsService.js'
import { providerFetch } from '../lib/providerFetch.js'
import {
  forvoApiUrl, parseForvoPronunciations,
  commonsApiUrl, parseCommonsPronunciations, linguaLibreIso3,
  type NativePronunciation,
} from '../lib/pronunciationSources.js'

// Wikimedia EXIGE um User-Agent descritivo (sem ele, upload.wikimedia.org bloqueia/limita o .wav).
const UA = 'Soaken/0.1 (https://soaken.app; language-learning app)'
const reqInit: RequestInit = { method: 'GET', headers: { 'User-Agent': UA, 'Api-User-Agent': UA } }

// Vozes de NATIVOS REAIS para uma palavra: tenta Forvo (se houver chave), senão Wikimedia/Lingua
// Libre (grátis). Vazio → o renderer cai no TTS (fallback). Tudo no main (chamadas de API + chave).
export async function nativePronunciations(word: string, lang: string): Promise<NativePronunciation[]> {
  if (!word.trim()) return []

  // 1) Forvo — melhor cobertura, mas precisa de chave (BYOK).
  const key = new CredentialsService().getForvoKey()
  if (key) {
    try {
      const res = await providerFetch('Forvo', forvoApiUrl(key, word, lang), reqInit)
      if (res.ok) {
        const list = parseForvoPronunciations(await res.json())
        if (list.length) return list
      }
    } catch (err) {
      console.warn('[pron] forvo failed:', (err as Error).message)
    }
  }

  // 2) Wikimedia / Lingua Libre — grátis, sem chave.
  const iso3 = linguaLibreIso3(lang)
  if (iso3) {
    try {
      const res = await providerFetch('Commons', commonsApiUrl(word, iso3), reqInit)
      if (res.ok) return parseCommonsPronunciations(await res.json(), word)
    } catch (err) {
      console.warn('[pron] commons failed:', (err as Error).message)
    }
  }

  return []
}

/** Baixa o áudio (remoto) e devolve como data URL — evita a CSP de media-src e toca direto. */
export async function fetchPronunciationAudio(url: string): Promise<string> {
  const res = await providerFetch('Pronunciation audio', url, reqInit)
  if (!res.ok) throw new Error(`audio ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase()
  const mime = ext === 'ogg' ? 'audio/ogg' : ext === 'wav' ? 'audio/wav' : ext === 'flac' ? 'audio/flac' : 'audio/mpeg'
  return `data:${mime};base64,${buf.toString('base64')}`
}
