// Frases de diagnóstico de pronúncia: curtas e foneticamente ricas, por idioma. O usuário lê
// em voz alta; comparamos a leitura com o modelo (texto + entonação). Dados puros e testáveis.

import { baseLang } from './languages'

export interface DiagnosticItem {
  text: string   // frase a ler
  focus: string  // o que ela treina (mostrado como dica)
}

const DIAGNOSTIC_SETS: Record<string, DiagnosticItem[]> = {
  en: [
    { text: 'I really think this is the right answer.', focus: 'sons "r" e "th"' },
    { text: 'She brought three thick books to the library.', focus: '"th" + grupos de consoantes' },
    { text: 'The weather this Thursday is rather rough.', focus: '"th" sonoro/surdo + "r"' },
    { text: 'He watched the children walk through the park.', focus: 'final "-ed", "ch" e "th"' },
    { text: "The world's worst birds heard the third word.", focus: 'vogal "r" (/ɜːr/)' },
    { text: 'Please measure the pleasure of this leisure.', focus: 'som "zh" (/ʒ/) + vogais' },
  ],
  zh: [
    { text: '妈妈骑马，马慢，妈妈骂马。', focus: 'os 4 tons (mā má mǎ mà)' },
    { text: '我想喝一杯热水。', focus: 'tons + retroflexos (r/sh)' },
    { text: '四是四，十是十。', focus: '"s" vs "sh" (sì / shí)' },
    { text: '请问，洗手间在哪里？', focus: 'iniciais q/x + retroflexo "r"' },
    { text: '他在商店买了三本书。', focus: 'retroflexos sh/ch + tons' },
    { text: '今天天气很好，我们去散步。', focus: 'tons em frase corrida' },
  ],
  ko: [
    { text: '한국어 발음을 연습하고 있어요.', focus: 'batchim / ligação (연음)' },
    { text: '오늘 날씨가 정말 좋네요.', focus: 'vogais ㅓ/ㅗ' },
    { text: '커피 한 잔 주세요.', focus: 'aspiradas (ㅋ/ㅈ)' },
    { text: '빨리 가서 책을 읽으세요.', focus: 'tensas (된소리 ㅃ) + ㄹ' },
    { text: '이것은 무엇입니까?', focus: 'batchim ㅅ → ㄷ (격식체)' },
    { text: '저는 한국 음식을 좋아해요.', focus: 'ligação + ㅎ fraco' },
  ],
  ja: [
    { text: '東京で大きいビルを見ました。', focus: 'vogais longas (ō)' },
    { text: 'おはようございます、お元気ですか。', focus: 'ritmo por moras' },
    { text: '学校に行って、勉強しました。', focus: 'sokuon (って) + vogal longa' },
    { text: 'ちょっと待ってください。', focus: 'contraído (ちょ) + sokuon (って)' },
    { text: '今日は天気がいいですね。', focus: 'contraído (きょう)' },
    { text: 'りんごを三つ買いました。', focus: 'ら-linha (flap) + contagem por moras' },
  ],
  es: [
    { text: 'El perro corre rápido por el parque.', focus: '"rr" e "r" simples' },
    { text: 'Mi familia viaja a la montaña.', focus: 'vogais puras + "ñ"/"j"' },
    { text: 'Roberto rompió el carro rojo.', focus: '"r" vs "rr" + "j"' },
    { text: 'Ella llegó tarde a la fiesta.', focus: '"ll" + "r"' },
    { text: 'La gente trabaja en el jardín.', focus: '"g"/"j" + vogais' },
    { text: 'El cielo está despejado hoy.', focus: '"c" suave + "h" mudo' },
  ],
  fr: [
    { text: "Je voudrais un café, s'il vous plaît.", focus: 'vogais nasais + "r" uvular' },
    { text: 'Le petit chien court dans le jardin.', focus: 'nasais + "r" + "ch"' },
    { text: 'Un bon vin blanc et du pain.', focus: 'vogais nasais (un/on/in/an)' },
    { text: 'Tu as vu la rue où il habite ?', focus: '"u" vs "ou" + liaison' },
    { text: 'Nous sommes allés au théâtre hier soir.', focus: 'liaison + "r"' },
  ],
  de: [
    { text: 'Ich möchte ein Glas Wasser, bitte.', focus: 'ich-Laut / ö' },
    { text: 'Die schöne Königin trägt grüne Kleider.', focus: 'ö, ü, ä + "r"' },
    { text: 'Wir fahren früh nach München.', focus: '"ü" + ach-/ich-Laut' },
    { text: 'Das Mädchen spricht sehr gut Deutsch.', focus: '"ä" + "ch" + "r"' },
    { text: 'Der Koch macht eine reiche Suppe.', focus: 'ach-Laut + "r" uvular' },
  ],
  it: [
    { text: 'Vorrei un caffè e una pizza, per favore.', focus: 'consoantes duplas' },
    { text: 'La famiglia mangia gli gnocchi.', focus: '"gli" + "gn"' },
    { text: 'Il ragazzo legge un bel libro.', focus: 'duplas (zz/gg) + "r"' },
    { text: 'Che bella giornata di sole!', focus: '"gi/ge" + vogais abertas' },
    { text: "Bevo sempre un bicchiere d'acqua.", focus: '"cch"/"cqu" duplas' },
  ],
  pt: [
    { text: 'O rato roeu a roupa do rei de Roma.', focus: '"r" forte' },
    { text: 'A manhã estava ensolarada e tranquila.', focus: 'vogais nasais + "nh"' },
    { text: 'O coelho pulou pela colina molhada.', focus: '"lh" + vogais' },
    { text: 'Não posso entrar naquela montanha.', focus: 'nasal "ão" + "nh"' },
    { text: 'Ele trabalha num grande jardim.', focus: '"r" + nasal + "j"' },
  ],
  ru: [
    { text: 'Здравствуйте, как ваши дела?', focus: 'grupos de consoantes' },
    { text: 'Я люблю читать русские книги.', focus: 'palatalização + "ы"' },
    { text: 'Мы быстро шли через большой мост.', focus: '"ы" + "ш" + clusters' },
    { text: 'Она живёт в красивом городе.', focus: '"ё" + palatalização' },
    { text: 'Сегодня очень холодная погода.', focus: 'redução о→а + "ч"' },
  ],
}

/** Frases de diagnóstico para um idioma (vazio quando não há set — a UI usa uma frase da sessão). */
export function diagnosticSet(lang: string): DiagnosticItem[] {
  return DIAGNOSTIC_SETS[baseLang(lang)] ?? []
}

/** Há um conjunto de diagnóstico para o idioma? */
export function hasDiagnosticSet(lang: string): boolean {
  return diagnosticSet(lang).length > 0
}
