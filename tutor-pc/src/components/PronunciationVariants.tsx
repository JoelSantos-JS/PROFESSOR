import { useEffect, useRef, useState } from 'react'
import { Volume2, Loader2, Users } from 'lucide-react'
import { ttsAPI, pronunciationAPI } from '../services/electron'
import { playClip } from '../lib/playClip'
import { useT } from '../lib/uiLangContext'
import { accentVariantsFor, type AccentVariant } from '../lib/accentVariants'
import type { NativePronunciation } from '../types'

// Pronúncia da palavra por NATIVOS REAIS (Forvo se houver chave, senão Wikimedia/Lingua Libre).
// Se não houver gravação de nativo, cai nos SOTAQUES por TTS (sintético) — sempre tem algo a ouvir.
export default function PronunciationVariants({ word, lang }: { word: string; lang: string }) {
  const t = useT()
  const [natives, setNatives] = useState<NativePronunciation[] | null>(null)  // null = carregando
  const [playing, setPlaying] = useState<string | null>(null)
  const audioCache = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    let alive = true
    setNatives(null)
    if (!word.trim()) { setNatives([]); return }
    pronunciationAPI.native(word, lang)
      .then(r => {
        if (!alive) return
        const items = r.ok ? r.items : []
        setNatives(items)
        // Pré-baixa o áudio de cada nativo em segundo plano → clicar toca instantâneo.
        for (const p of items) {
          if (audioCache.current.has(p.url)) continue
          pronunciationAPI.audio(p.url)
            .then(res => { if (res.ok && res.dataUrl) audioCache.current.set(p.url, res.dataUrl) })
            .catch(() => {})
        }
      })
      .catch(() => { if (alive) setNatives([]) })
    return () => { alive = false }
  }, [word, lang])

  const playNative = async (p: NativePronunciation) => {
    if (playing) return
    setPlaying(p.url)
    try {
      let dataUrl = audioCache.current.get(p.url)
      if (!dataUrl) {
        const res = await pronunciationAPI.audio(p.url)
        if (res.ok && res.dataUrl) { dataUrl = res.dataUrl; audioCache.current.set(p.url, dataUrl) }
      }
      if (dataUrl) playClip(dataUrl)
    } catch { /* best-effort */ } finally { setPlaying(null) }
  }

  const playAccent = async (v: AccentVariant) => {
    if (playing) return
    setPlaying(v.id)
    try {
      const res = await ttsAPI.speakVariant(word, v.voice, v.id)
      if (res.ok && res.dataUrl) playClip(res.dataUrl)
    } catch { /* best-effort */ } finally { setPlaying(null) }
  }

  if (!word.trim()) return null

  // Carregando os nativos
  if (natives === null) {
    return (
      <div className="flex items-center gap-1 text-[10px] text-muted/50">
        <Loader2 size={10} className="animate-spin" /> {t('nativeVoices')}…
      </div>
    )
  }

  // Tem nativos reais → mostra eles
  if (natives.length > 0) {
    return (
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider text-muted mr-0.5 flex items-center gap-0.5 font-semibold">
          <Users size={10} /> {t('nativeVoices')}
        </span>
        {natives.map((p, i) => (
          <button
            key={p.url}
            onClick={() => playNative(p)}
            disabled={playing !== null}
            title={p.attribution || p.country || ''}
            className="flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded-md text-foreground/80 hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
          >
            {playing === p.url ? <Loader2 size={10} className="animate-spin" /> : <Volume2 size={10} />}
            <span className="leading-none">{nativeLabel(p, i, t('nativeVoiceN'))}</span>
          </button>
        ))}
      </div>
    )
  }

  // Sem nativos → fallback nos sotaques por TTS
  const accents = accentVariantsFor(lang)
  if (accents.length === 0) return null
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className="text-[10px] uppercase tracking-wider text-muted/50 mr-0.5">{t('accents')}</span>
      {accents.map(v => (
        <button
          key={v.id}
          onClick={() => playAccent(v)}
          disabled={playing !== null}
          title={`${word} — ${v.label} (TTS)`}
          aria-label={`${word} ${v.label}`}
          className="flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded-md text-muted hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
        >
          {playing === v.id ? <Loader2 size={10} className="animate-spin" /> : <Volume2 size={10} />}
          <span className="leading-none">{v.flag} {v.label}</span>
        </button>
      ))}
    </div>
  )
}

/** Rótulo curto e CLARO: país (Forvo, ex.: "United States") ou um número (Wikimedia) — nunca o
 *  username aleatório do voluntário, que confunde. A atribuição completa fica no title (hover). */
function nativeLabel(p: NativePronunciation, i: number, voiceWord: string): string {
  if (p.country) return p.country.length > 16 ? p.country.slice(0, 16) : p.country
  return `${voiceWord} ${i + 1}`   // ex.: "Voz 1"
}
