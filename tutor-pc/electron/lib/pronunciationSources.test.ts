import { describe, expect, it } from 'vitest'
import {
  forvoLangCode, linguaLibreIso3, forvoApiUrl, commonsApiUrl,
  parseForvoPronunciations, parseCommonsPronunciations,
} from './pronunciationSources'

describe('mapas de idioma', () => {
  it('forvoLangCode usa a base de 2 letras', () => {
    expect(forvoLangCode('en-US')).toBe('en')
    expect(forvoLangCode('PT')).toBe('pt')
  })
  it('linguaLibreIso3 mapeia p/ ISO 639-3', () => {
    expect(linguaLibreIso3('en')).toBe('eng')
    expect(linguaLibreIso3('pt-BR')).toBe('por')
    expect(linguaLibreIso3('xx')).toBeNull()
  })
})

describe('URLs', () => {
  it('forvoApiUrl monta a rota com chave, palavra e idioma', () => {
    const u = forvoApiUrl('KEY123', 'água', 'pt')
    expect(u).toContain('/key/KEY123/')
    expect(u).toContain('/word/' + encodeURIComponent('água') + '/')
    expect(u).toContain('/language/pt/')
  })
  it('commonsApiUrl inclui o ISO3 e a palavra na busca', () => {
    const u = commonsApiUrl('water', 'eng')
    expect(u).toContain('commons.wikimedia.org')
    // URLSearchParams usa "+" p/ espaço (Commons aceita); valida os pedaços da busca
    const gsr = new URL(u).searchParams.get('gsrsearch')
    expect(gsr).toBe('intitle:"(eng)" intitle:"water.wav"')
  })
})

describe('parseForvoPronunciations', () => {
  it('ordena por votos e mapeia mp3 + país', () => {
    const json = { items: [
      { pathmp3: 'a.mp3', country: 'United States', username: 'us1', num_positive_votes: 2 },
      { pathmp3: 'b.mp3', country: 'United Kingdom', username: 'uk1', num_positive_votes: 9 },
    ] }
    const r = parseForvoPronunciations(json)
    expect(r[0].url).toBe('b.mp3')          // mais votado primeiro
    expect(r[0].country).toBe('United Kingdom')
    expect(r[0].source).toBe('forvo')
  })
  it('descarta itens sem áudio e respeita o limite', () => {
    const json = { items: [
      { country: 'x' }, { pathogg: 'c.ogg' }, { pathmp3: 'd.mp3' }, { pathmp3: 'e.mp3' },
    ] }
    expect(parseForvoPronunciations(json, 2)).toHaveLength(2)
  })
  it('json inválido → []', () => {
    expect(parseForvoPronunciations(null)).toEqual([])
    expect(parseForvoPronunciations({})).toEqual([])
  })
})

describe('parseCommonsPronunciations', () => {
  const page = (title: string, url: string) => ({ title, imageinfo: [{ url }] })

  it('mantém só os arquivos da palavra exata e extrai o falante', () => {
    const json = { query: { pages: {
      '1': page('File:LL-Q1860 (eng)-Wodencafe-water.wav', 'https://up/water.wav'),
      '2': page('File:LL-Q1860 (eng)-Speaker2-underwater.wav', 'https://up/underwater.wav'), // não é "water"
    } } }
    const r = parseCommonsPronunciations(json, 'water')
    expect(r).toHaveLength(1)
    expect(r[0].url).toBe('https://up/water.wav')
    expect(r[0].speaker).toBe('Wodencafe')
    expect(r[0].source).toBe('wikimedia')
    expect(r[0].attribution).toContain('CC')
  })

  it('ignora páginas sem url e json vazio', () => {
    expect(parseCommonsPronunciations({}, 'x')).toEqual([])
    expect(parseCommonsPronunciations({ query: { pages: { '1': { title: 'File:LL (eng)-a-x.wav' } } } }, 'x')).toEqual([])
  })
})
