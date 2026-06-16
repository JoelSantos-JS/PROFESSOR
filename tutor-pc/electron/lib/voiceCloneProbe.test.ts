import { describe, it, expect } from 'vitest'
import { buildVoiceEnrollRequest, buildCloneSynthesisRequest } from './voiceCloneProbe'

describe('buildVoiceEnrollRequest', () => {
  it('ElevenLabs: URL + xi-api-key + parte de arquivo "files"', () => {
    const spec = buildVoiceEnrollRequest('elevenlabs', { name: 'Joel', apiKey: 'k_123' })!
    expect(spec.url).toBe('https://api.elevenlabs.io/v1/voices/add')
    expect(spec.method).toBe('POST')
    expect(spec.headers['xi-api-key']).toBe('k_123')
    expect(spec.fields.name).toBe('Joel')
    expect(spec.fileField).toBe('files')
  })
  it('nome vazio cai num rótulo padrão', () => {
    expect(buildVoiceEnrollRequest('elevenlabs', { name: '  ', apiKey: 'k' })!.fields.name)
      .toMatch(/Capta/)
  })
  it('sem chave → undefined', () => {
    expect(buildVoiceEnrollRequest('elevenlabs', { name: 'x', apiKey: '' })).toBeUndefined()
  })
  it('xtts é local → undefined', () => {
    expect(buildVoiceEnrollRequest('xtts', { name: 'x', apiKey: 'k' })).toBeUndefined()
  })
})

describe('buildCloneSynthesisRequest', () => {
  const base = { text: '안녕하세요', lang: 'ko', voiceId: 'v_abc', apiKey: 'k_123' }

  it('ElevenLabs: URL com voiceId + headers + body multilíngue', () => {
    const spec = buildCloneSynthesisRequest('elevenlabs', base)!
    expect(spec.url).toBe('https://api.elevenlabs.io/v1/text-to-speech/v_abc')
    expect(spec.headers['xi-api-key']).toBe('k_123')
    expect(spec.headers.Accept).toBe('audio/mpeg')
    const body = JSON.parse(spec.body)
    expect(body.text).toBe('안녕하세요')
    expect(body.model_id).toBe('eleven_multilingual_v2')
  })

  it('o mesmo model_id serve qualquer idioma (cross-lingual)', () => {
    const ko = JSON.parse(buildCloneSynthesisRequest('elevenlabs', { ...base, lang: 'ko' })!.body)
    const ja = JSON.parse(buildCloneSynthesisRequest('elevenlabs', { ...base, lang: 'ja', text: 'こんにちは' })!.body)
    expect(ko.model_id).toBe(ja.model_id)
  })

  it('voiceId é URL-encoded', () => {
    const spec = buildCloneSynthesisRequest('elevenlabs', { ...base, voiceId: 'a/b c' })!
    expect(spec.url).toBe('https://api.elevenlabs.io/v1/text-to-speech/a%2Fb%20c')
  })

  it('voice_settings: usa defaults e respeita overrides (clamp 0..1)', () => {
    const def = JSON.parse(buildCloneSynthesisRequest('elevenlabs', base)!.body).voice_settings
    expect(def).toEqual({ stability: 0.5, similarity_boost: 0.85 })
    const over = JSON.parse(buildCloneSynthesisRequest('elevenlabs', { ...base, stability: 9, similarity: -1 })!.body).voice_settings
    expect(over).toEqual({ stability: 1, similarity_boost: 0 })
  })

  it('faltando chave/voiceId/texto → undefined', () => {
    expect(buildCloneSynthesisRequest('elevenlabs', { ...base, apiKey: '' })).toBeUndefined()
    expect(buildCloneSynthesisRequest('elevenlabs', { ...base, voiceId: '' })).toBeUndefined()
    expect(buildCloneSynthesisRequest('elevenlabs', { ...base, text: '   ' })).toBeUndefined()
  })

  it('xtts é local → undefined (vai por worker)', () => {
    expect(buildCloneSynthesisRequest('xtts', base)).toBeUndefined()
  })
})
