// Conteúdo estático do onboarding do iniciante: primer do sistema de escrita + canais de
// comprehensible input por idioma. Dados puros (derivados de INICIANTE_IDIOMAS_ASIATICOS.md).
// Localizado por idioma da UI (pt/en).

export interface WritingPrimer {
  system: string
  summary: string
  bullets: string[]
}

export interface Channel {
  name: string
  url: string
  note?: string
}

export interface LearnContent {
  writing?: WritingPrimer
  channels: Channel[]
}

type UiLang = 'pt' | 'en'

function wiki(uiLang: UiLang): Channel {
  return {
    name: 'Comprehensible Input Wiki',
    url: 'https://comprehensibleinputwiki.org/wiki/Main_Page',
    note: uiLang === 'en' ? 'content lists by language and level' : 'listas de conteúdo por idioma e nível',
  }
}

const CONTENT: Record<UiLang, Record<string, LearnContent>> = {
  pt: {
    ko: {
      writing: {
        system: 'Hangul (한글)',
        summary: 'O sistema de escrita mais lógico do mundo — dá pra aprender em um fim de semana.',
        bullets: [
          'São blocos de sílabas montados a partir de poucas letras (consoantes + vogais).',
          'Aprenda Hangul ANTES da romanização — leia o coreano de verdade.',
          'Meta-vitória: ler Hangul em um fim de semana.',
        ],
      },
      channels: [
        { name: 'GO! Billy Korean', url: 'https://www.youtube.com/@GoBillyKorean', note: 'do zero ao intermediário' },
        wiki('pt'),
      ],
    },
    ja: {
      writing: {
        system: 'Kana (Hiragana + Katakana)',
        summary: 'Dois silabários de ~46 sinais cada. A base para ler antes dos kanji.',
        bullets: [
          'Comece pelo Hiragana, depois Katakana (usado em palavras estrangeiras).',
          'Kanji vêm depois — no app você terá furigana (leitura kana sobre o kanji).',
          'Foque em reconhecer o som de cada kana rapidamente.',
        ],
      },
      channels: [
        { name: 'Comprehensible Japanese', url: 'https://www.youtube.com/@cijapanese', note: 'playlists por nível (Complete Beginner)' },
        wiki('pt'),
      ],
    },
    zh: {
      writing: {
        system: 'Pinyin + TONS',
        summary: 'A romanização oficial — mas o tom é PARTE da palavra, não opcional.',
        bullets: [
          'Aprenda os 4 tons (+ neutro) desde o começo: mā / má / mǎ / mà são palavras diferentes.',
          'No app: o tom (1–4) aparece em cada sílaba do Pinyin + a curva de pitch.',
          'Depois você associa os caracteres (Hanzi) aos sons.',
        ],
      },
      channels: [
        { name: 'Lazy Chinese', url: 'https://www.youtube.com/@LazyChinese', note: 'comprehensible input para iniciantes' },
        wiki('pt'),
      ],
    },
  },
  en: {
    ko: {
      writing: {
        system: 'Hangul (한글)',
        summary: 'The most logical writing system in the world — you can learn it in a weekend.',
        bullets: [
          'They’re syllable blocks built from a few letters (consonants + vowels).',
          'Learn Hangul BEFORE romanization — read real Korean.',
          'Quick win: read Hangul in a weekend.',
        ],
      },
      channels: [
        { name: 'GO! Billy Korean', url: 'https://www.youtube.com/@GoBillyKorean', note: 'from zero to intermediate' },
        wiki('en'),
      ],
    },
    ja: {
      writing: {
        system: 'Kana (Hiragana + Katakana)',
        summary: 'Two syllabaries of ~46 signs each. The base for reading before kanji.',
        bullets: [
          'Start with Hiragana, then Katakana (used for foreign words).',
          'Kanji come later — in the app you’ll have furigana (kana reading above the kanji).',
          'Focus on recognizing each kana’s sound quickly.',
        ],
      },
      channels: [
        { name: 'Comprehensible Japanese', url: 'https://www.youtube.com/@cijapanese', note: 'playlists by level (Complete Beginner)' },
        wiki('en'),
      ],
    },
    zh: {
      writing: {
        system: 'Pinyin + TONES',
        summary: 'The official romanization — but the tone is PART of the word, not optional.',
        bullets: [
          'Learn the 4 tones (+ neutral) from the start: mā / má / mǎ / mà are different words.',
          'In the app: the tone (1–4) appears on each Pinyin syllable + the pitch curve.',
          'Then you associate the characters (Hanzi) with the sounds.',
        ],
      },
      channels: [
        { name: 'Lazy Chinese', url: 'https://www.youtube.com/@LazyChinese', note: 'comprehensible input for beginners' },
        wiki('en'),
      ],
    },
  },
}

/** Conteúdo de aprendizado para um idioma (base zh/ja/ko), no idioma da UI, com fallback genérico. */
export function learnContentFor(lang: string, uiLang: UiLang = 'pt'): LearnContent {
  const base = (lang || '').toLowerCase().split('-')[0]
  return CONTENT[uiLang][base] ?? { channels: [wiki(uiLang)] }
}
