// "Pronúncia real" do coreano: aplica as mudanças sonoras do discurso conectado ao Hangul.
// O Hangul é escrito morfofonemicamente (한국어) mas pronunciado com regras de som (한구거).
// O Hangul decompõe DETERMINISTICAMENTE via Unicode (sem ambiguidade), então isto é puro e
// totalmente testável. Cobre as regras de maior impacto para o aprendiz:
//   • Linking (연음)        한국어 → 한구거
//   • ㅎ: queda/aspiração   좋아 → 조아 · 좋다 → 조타 · 축하 → 추카
//   • Palatalização (구개음화) 같이 → 가치
//   • Assimilação ㄹ (유음화) 신라 → 실라 · 설날 → 설랄
//   • Nasalização (비음화)   국물 → 궁물 · 입니다 → 임니다
//   • Tensão (경음화)       학교 → 학꾜

const SBASE = 0xac00
const LCOUNT = 19, VCOUNT = 21, TCOUNT = 28
const NCOUNT = VCOUNT * TCOUNT
const SCOUNT = LCOUNT * NCOUNT

// 초성 (initial) índice → jamo
const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ']
// 종성 (final/batchim) índice → jamo (0 = sem batchim)
const JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ']

// índice de 초성 por jamo (para mover batchim → próxima inicial no linking)
const CHO_IDX: Record<string, number> = Object.fromEntries(CHO.map((j, i) => [j, i]))
const C = (j: string): number => CHO_IDX[j]
const J = (j: string): number => JONG.indexOf(j)

// Linking de um batchim: jong index → [jong que fica, cho que vai]. Para batchim
// composto (ㄺ=ㄹ+ㄱ), o ㄹ fica e o ㄱ vai; simples: o batchim inteiro vira a inicial.
const LINK: Record<number, [number, number]> = {
  1:  [0, C('ㄱ')], 2: [0, C('ㄲ')], 4: [0, C('ㄴ')], 7: [0, C('ㄷ')],
  8:  [0, C('ㄹ')], 16:[0, C('ㅁ')], 17:[0, C('ㅂ')], 19:[0, C('ㅅ')],
  20: [0, C('ㅆ')], 22:[0, C('ㅈ')], 23:[0, C('ㅊ')], 24:[0, C('ㅋ')],
  25: [0, C('ㅌ')], 26:[0, C('ㅍ')],
  // compostos (o último jamo vai, o primeiro fica):
  3:  [J('ㄱ'), C('ㅅ')], // ㄳ → ㄱ + ㅅ
  9:  [J('ㄹ'), C('ㄱ')], // ㄺ → ㄹ + ㄱ
  10: [J('ㄹ'), C('ㅁ')], // ㄻ → ㄹ + ㅁ
  11: [J('ㄹ'), C('ㅂ')], // ㄼ → ㄹ + ㅂ
  18: [J('ㅂ'), C('ㅅ')], // ㅄ → ㅂ + ㅅ
}

// Som representativo do batchim (대표음) — jong index → consoante "sonora" (ㄱㄴㄷㄹㅁㅂㅇ)
const SOUND: Record<number, string> = {
  0:'', 1:'ㄱ',2:'ㄱ',24:'ㄱ',3:'ㄱ',9:'ㄱ',
  4:'ㄴ',5:'ㄴ',6:'ㄴ',
  7:'ㄷ',19:'ㄷ',20:'ㄷ',22:'ㄷ',23:'ㄷ',25:'ㄷ',27:'ㄷ',
  8:'ㄹ',11:'ㄹ',12:'ㄹ',13:'ㄹ',15:'ㄹ',
  16:'ㅁ',10:'ㅁ',
  17:'ㅂ',26:'ㅂ',14:'ㅂ',18:'ㅂ',
  21:'ㅇ',
}

interface Syl { L: number; V: number; T: number }
function isSyllable(cp: number): boolean { return cp >= SBASE && cp < SBASE + SCOUNT }
function decompose(cp: number): Syl {
  const s = cp - SBASE
  return { L: Math.floor(s / NCOUNT), V: Math.floor((s % NCOUNT) / TCOUNT), T: s % TCOUNT }
}
function compose(s: Syl): string {
  return String.fromCodePoint(SBASE + s.L * NCOUNT + s.V * TCOUNT + s.T)
}

/**
 * Aplica as mudanças sonoras a um texto em Hangul, retornando o "Hangul falado".
 * Processa pares de sílabas adjacentes (batchim da atual + inicial da próxima).
 */
export function hangulSpoken(text: string): string {
  const chars = Array.from(text)
  // converte em [tipo, syl?] preservando não-sílabas
  const items = chars.map(ch => {
    const cp = ch.codePointAt(0)!
    return isSyllable(cp) ? { syl: decompose(cp), raw: ch } : { syl: null as Syl | null, raw: ch }
  })

  for (let i = 0; i < items.length - 1; i++) {
    const a = items[i].syl
    const b = items[i + 1].syl
    if (!a || !b) continue
    const T = a.T, L = b.L

    // 1) Palatalização: ㄷ/ㅌ + 이 → ㅈ/ㅊ (batchim cai, inicial muda)
    if ((T === J('ㄷ') || T === J('ㅌ')) && L === C('ㅇ') && b.V === 20 /* ㅣ */) {
      a.T = 0
      b.L = T === J('ㄷ') ? C('ㅈ') : C('ㅊ')
      continue
    }

    // 2) ㅎ batchim + próxima inicial
    if (T === J('ㅎ')) {
      if (L === C('ㅇ')) { a.T = 0; continue }                       // 좋아 → 조아 (queda)
      const asp: Record<number, number> = { [C('ㄱ')]: C('ㅋ'), [C('ㄷ')]: C('ㅌ'), [C('ㅈ')]: C('ㅊ') }
      if (asp[L] !== undefined) { a.T = 0; b.L = asp[L]; continue }  // 좋다 → 조타
    }

    // 3) batchim (ㄱ/ㄷ/ㅂ/ㅈ) + ㅎ → aspiração na próxima
    if (L === C('ㅎ')) {
      const s = SOUND[T]
      const aspByFinal: Record<string, number> = { 'ㄱ': C('ㅋ'), 'ㄷ': C('ㅌ'), 'ㅂ': C('ㅍ') }
      if (T === J('ㅈ')) { a.T = 0; b.L = C('ㅊ'); continue }
      if (aspByFinal[s] !== undefined) { a.T = 0; b.L = aspByFinal[s]; continue } // 축하 → 추카
    }

    // 4) Assimilação ㄹ (유음화): ㄴ+ㄹ → ㄹ+ㄹ ; ㄹ+ㄴ → ㄹ+ㄹ
    if (T === J('ㄴ') && L === C('ㄹ')) { a.T = J('ㄹ'); continue }   // 신라 → 실라
    if (SOUND[T] === 'ㄹ' && L === C('ㄴ')) { b.L = C('ㄹ'); continue } // 설날 → 설랄

    // 5) Linking (연음): batchim != 0/ㅇ + inicial ㅇ → batchim vira a inicial
    if (T !== 0 && SOUND[T] !== 'ㅇ' && T !== J('ㅎ') && L === C('ㅇ')) {
      const link = LINK[T]
      if (link) { a.T = link[0]; b.L = link[1]; continue }
    }

    // 6) Nasalização (비음화): som ㄱ/ㄷ/ㅂ + ㄴ/ㅁ → ㅇ/ㄴ/ㅁ
    if ((L === C('ㄴ') || L === C('ㅁ'))) {
      const s = SOUND[T]
      const nasal: Record<string, string> = { 'ㄱ': 'ㅇ', 'ㄷ': 'ㄴ', 'ㅂ': 'ㅁ' }
      if (nasal[s] !== undefined) { a.T = J(nasal[s]); continue }   // 국물 → 궁물 · 입니다 → 임니다
    }

    // 7) Tensão (경음화): som ㄱ/ㄷ/ㅂ + ㄱ/ㄷ/ㅂ/ㅅ/ㅈ → tensa a próxima
    {
      const s = SOUND[T]
      if (s === 'ㄱ' || s === 'ㄷ' || s === 'ㅂ') {
        const tense: Record<number, number> = {
          [C('ㄱ')]: C('ㄲ'), [C('ㄷ')]: C('ㄸ'), [C('ㅂ')]: C('ㅃ'), [C('ㅅ')]: C('ㅆ'), [C('ㅈ')]: C('ㅉ'),
        }
        if (tense[L] !== undefined) { b.L = tense[L]; continue }    // 학교 → 학꾜
      }
    }
  }

  // Passe final: neutraliza todo batchim restante para o SOM representativo (대표음).
  // ㅋ/ㄲ→ㄱ · ㅅ/ㅆ/ㅈ/ㅊ/ㅌ/ㅎ→ㄷ · ㅍ→ㅂ · complexos→sua representação. (부엌→부억, 옷→옫)
  for (const it of items) {
    if (it.syl && it.syl.T !== 0) {
      const rep = J(SOUND[it.syl.T] ?? '')
      if (rep !== it.syl.T) it.syl.T = rep
    }
  }

  return items.map(it => (it.syl ? compose(it.syl) : it.raw)).join('')
}

/** True quando a pronúncia difere da escrita (para só mostrar a linha quando há diferença). */
export function hasHangulSoundChange(text: string): boolean {
  return hangulSpoken(text) !== text
}

// Exposto para testes / futura UI de estrutura silábica.
export { isSyllable, decompose, compose }
