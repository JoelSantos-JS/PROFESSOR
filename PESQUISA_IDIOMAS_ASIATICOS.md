# Pesquisa — Técnicas de "ultra aprendizado" para idiomas asiáticos no PROFESSOR

> Pesquisa de técnicas comprovadas (Chinês, Japonês, Coreano) e como integrá-las ao
> PROFESSOR, que **já** faz a parte mais difícil: captura áudio nativo, transcreve,
> extrai vocabulário/frases e **já tem detecção de pitch** (curva de entonação). Isso nos
> dá uma vantagem enorme — várias técnicas abaixo são "destravadas" pelo que já existe.

---

## 0. O que já temos (base para construir em cima)

- **Sentence mining automático** do áudio do sistema (séries/vídeos) — exatamente a
  técnica nº 1 recomendada para imersão. Já fazemos sem o usuário precisar minerar manual.
- **Detecção de pitch / curva de entonação** (`pitch.ts`, comparador Você/Original/TTS).
  → É **a mesma tecnologia** que tons do chinês e pitch accent do japonês precisam.
- **Romanização** por idioma (Pinyin/Romaji/Coreano), **vocabulário**, **tradução**, **SRS
  por frase**, **trio de áudio** (Original/TTS/Você), **karaokê**, **"Fala natural"**
  (connected speech do inglês — modelo replicável para outras línguas).

---

## 1. Técnicas universais (valem para CN/JP/KR)

### 1.1. Sentence mining + i+1 (input compreensível)
- Minerar **a frase inteira** (não a palavra solta) dá contexto e uso real — já fazemos.
- **Princípio i+1 / "n+1":** o ideal é uma frase onde você entende ~95–98% e tem **só 1
  palavra nova**. Listening alvo: 90–95% de compreensão.
- **→ Feature:** marcar/destacar frases que são "**+1**" (exatamente 1 palavra desconhecida)
  como **candidatas ideais** para revisão — priorizar essas no SRS. Requer rastrear
  "palavras conhecidas" (1.2).

### 1.2. Rastreamento de palavras conhecidas (estilo Language Reactor / Migaku) ⭐ CRUCIAL
- Marcar cada palavra como **conhecida / aprendendo / ignorar**, e isso **persiste entre
  todas as sessões**. Colorir a transcrição por status. Calcular **% de compreensão** de
  cada frase.
- **→ Feature:** no Tutor Board, palavras coloridas por status (clica pra alternar);
  badge "você conhece 92% desta frase"; filtro "mostrar só frases +1". Encaixa direto no
  nosso modelo de dados (já temos vocab + SRS por idioma).

### 1.3. Shadowing / Chorusing ⭐ CRUCIAL p/ pronúncia
- **Shadowing:** repetir junto com o áudio. Pesquisa: 3–4 sessões de 10–15 min/semana por
  6 semanas melhora fluência e prosódia.
- **Chorusing:** repetir **um trecho curtíssimo (poucos segundos) em loop** muitas vezes —
  relatado como capaz de "apagar o sotaque" mesmo em línguas difíceis.
- **→ Feature:** modo **"Loop/Chorus"** — pega a palavra/frase (já temos o `playSlice`) e
  toca em loop N vezes; e um modo shadowing que toca o original e grava você por cima. Nosso
  auto-treino já é quase shadowing; falta o **loop** e o "tocar+gravar simultâneo".

### 1.4. Feedback de pronúncia por DTW (Dynamic Time Warping) ⭐ melhoria técnica forte
- Estado da arte para comparar pronúncia: alinhar a **curva de pitch do usuário** com a do
  nativo via **DTW** (lida com velocidades diferentes), em vez de normalizar as duas
  independentes. Métricas: GOP (Goodness of Pronunciation) e **GOT (Goodness of Tone)** para
  línguas tonais.
- **→ Feature:** evoluir o **comparador de entonação** atual para usar **DTW** entre a sua
  curva e a Original → score de pronúncia/tom objetivo e alinhamento visual ponto-a-ponto.
  (Reaproveita `pitch.ts`; só adicionar o algoritmo DTW — função pura, testável.)

---

## 2. Chinês (Mandarim) 🇨🇳

### 2.1. Tons + visualização de pitch ⭐ CRUCIAL
- Os 4 tons são **formas de curva de pitch**. Apps líderes (Yutone, MandaTone) mostram sua
  curva **sobreposta à do nativo** em tempo real — "viu exatamente onde o tom subiu tarde
  ou ficou plano". Aprendizado visual >> só ouvir "certo/errado".
- **→ Feature:** já temos a curva. Adicionar: (a) marcar o **número do tom (1-4)** em cada
  sílaba do Pinyin; (b) desenhar a **forma esperada do tom** atrás da sua curva; (c) drill
  de **pares de tons** (a maioria das palavras é bissílaba → tons vêm em pares).

### 2.2. Tone sandhi automático (regras de mudança de tom) ⭐ CRUCIAL e testável
- Os tons **mudam no discurso conectado** mas o Pinyin escrito não muda. Regras principais:
  - **3º + 3º → 2º + 3º** (你好 nǐ hǎo → ní hǎo); em sequência de vários 3º, só o último fica 3º.
  - **不 (bù):** vira 2º tom antes de outro 4º tom.
  - **一 (yī):** muda conforme o tom seguinte.
- **→ Feature:** uma linha **"Pinyin real (falado)"** mostrando os tons **como são
  pronunciados** — exatamente o análogo do nosso "Fala natural" do inglês. **Regra pura,
  100% testável.** Enorme para soar natural.

### 2.3. Hanzi: decomposição em radicais/componentes + mnemônicos
- Caracteres = blocos (radicais/componentes). Decompor + mnemônico + SRS (estilo
  WaniKani/HanziHero) é o método mais eficiente. "Radicais são o alfabeto dos caracteres."
- **→ Feature:** ao clicar num caractere, mostrar **decomposição em componentes** + ordem
  de traços + mnemônico (a IA já pode gerar). Deck de **caracteres** separado do de frases.

---

## 3. Japonês 🇯🇵

### 3.1. Pitch accent (OJAD-style) ⭐ CRUCIAL
- Japonês tem **pitch accent** (heiban, atamadaka, nakadaka, odaka) — onde o tom "cai".
  O **OJAD** (Univ. de Tóquio) mostra o padrão visual de qualquer palavra/frase; estudos
  mostram que a **prosódia visualizada** ensina melhor que só o áudio modelo.
- **→ Feature:** nossa curva de pitch já mostra isso! Adicionar a **anotação do padrão**
  (linha alta/baixa + marca da queda) sobre o Romaji/kana. Opcional: integrar dados do
  OJAD / dicionário de pitch accent para o padrão "ideal".

### 3.2. Furigana (ruby text) ⭐ alto valor, baixo custo
- O jeito padrão de tornar kanji legível: **kana pequeno acima do kanji** via `<ruby>`.
  Mais autêntico que romaji.
- **→ Feature:** renderizar a transcrição com **furigana** (kana sobre kanji) usando libs
  JS (kuroshiro + kuromoji, ou Rakuten MA). Toggle furigana/romaji/nada.

### 3.3. Kanji: decomposição + SRS (igual 2.3 do chinês).

---

## 4. Coreano 🇰🇷

### 4.1. Regras de som do Batchim (linking + assimilação) ⭐ CRUCIAL e testável
- O coreano **muda a pronúncia** no discurso conectado:
  - **Linking:** batchim + vogal seguinte → a consoante "pula" pra sílaba seguinte
    (한국어 → "han-gu-geo").
  - **Assimilação:** consoantes finais mudam conforme a consoante seguinte (pra fluir).
- **Importante:** ensinar pelo **Hangul**, não pela romanização (romanização não
  representa bem o som).
- **→ Feature:** linha **"Pronúncia real"** mostrando o Hangul **como é falado** (com
  linking/assimilação aplicados) — o **análogo coreano do "Fala natural"**. Regra pura,
  testável. Provavelmente o ganho nº 1 para coreano.

### 4.2. Foco em Hangul (de-ênfase na romanização) para pronúncia.

---

## 5. Word segmentation (CN/JP/KR não têm espaços)

- Já usamos `Intl.Segmenter` (bom). Para casos difíceis, libs dedicadas: **kuromoji**
  (japonês), **jieba/SentencePiece** (chinês), morfológicos coreanos. Necessário para
  clicar a "palavra" certa e para o rastreio de palavras conhecidas (1.2).

---

## 6. Roadmap priorizado (do mais crucial ao "nice to have")

| Prioridade | Feature | Idiomas | Reaproveita | Esforço |
|---|---|---|---|---|
| 🔴 1 | **Pronúncia real (sandhi/batchim/linking)** — linha estilo "Fala natural" | CN, KR (e JP kana) | `connectedSpeech` (padrão pronto) | Médio, **puro/testável** |
| 🔴 2 | **Anotação de tom/pitch** sobre a curva (tom 1-4 / pitch accent) | CN, JP | `pitch.ts` + comparador | Médio |
| 🔴 3 | **Rastreio de palavras conhecidas** + % compreensão + frases "+1" | Todos | vocab/SRS atuais | Médio-alto |
| 🟠 4 | **DTW** no comparador de entonação (score de tom objetivo) | Todos | `pitch.ts` | Médio, **puro/testável** |
| 🟠 5 | **Modo Loop/Chorus** (repetir trecho curto N vezes) | Todos | `playSlice` | Baixo |
| 🟠 6 | **Furigana** (ruby) para japonês | JP | romanização | Médio (lib) |
| 🟡 7 | **Decomposição de Hanzi/Kanji** + mnemônico + deck de caracteres | CN, JP | SRS + IA | Alto |
| 🟡 8 | Shadowing "tocar + gravar junto" | Todos | auto-treino | Médio |

**Por que essa ordem:** 1, 2 e 4 são as que mais aproveitam o que **já temos** (pitch +
padrão do "Fala natural") e atacam o **núcleo do ultra-aprendizado asiático**: prosódia
(tons/pitch) e som conectado real. 3 transforma o app num "Language Reactor" com memória de
progresso.

---

## 7. Notas técnicas

- **Sandhi/Batchim:** funções puras de regras (como `connectedSpeech`), com bateria de
  testes — entrada Pinyin/Hangul → saída "como se fala". Baixo risco.
- **DTW:** algoritmo clássico (~30 linhas), puro/testável, sobre as curvas de `pitch.ts`.
  Alinha duas séries de tamanhos diferentes → distância + caminho de alinhamento.
- **Furigana:** `kuroshiro`+`kuromoji` (precisa do dicionário, alguns MB) ou serviço.
- **Pitch accent ideal (JP):** dados do OJAD / dicionário de pitch accent (NHK) para o alvo.
- **Decomposição de caractere:** datasets abertos (CJK decomposition / radicais Kangxi);
  mnemônicos gerados pela IA do tutor.

---

## 8. Fontes

- Sentence mining: [Migaku](https://migaku.com/blog/language-fun/sentence-mining-guide-learn-vocabulary-faster) · [Whisper sentence mining](https://huggingface.co/blog/afmck/whisper-sentence-mining) · [Unseen Japan](https://unseen-japan.com/sentence-mining-japanese-how-to/) · [Hanabira](https://hanabira.org/blog/youtube-immersion-sentence-mining)
- Tons do chinês: [Yutone](https://yutone.app/) · [MandaTone](https://play.google.com/store/apps/details?id=com.ruiyu.mandatone) · [Ka Chinese Tones](https://chinesetones.app/) · [Tone pairs (Talkpal)](https://talkpal.ai/master-chinese-tone-pair-practice-for-perfect-pronunciation/) · [AI gamified feedback](https://aipilotsg.com/blogs/news/mastering-chinese-tones-through-gamified-ai-feedback-a-revolutionary-approach)
- Tone sandhi: [StudyCLI](https://studycli.org/learn-chinese/tone-changes-in-mandarin/) · [AllSet Learning](https://resources.allsetlearning.com/chinese/pronunciation/Tone_change_rules) · [Mandarin Blueprint](https://www.mandarinblueprint.com/blog/tone-change-rules-in-mandarin-chinese/) · [Tone sandhi (Wikipedia)](https://en.wikipedia.org/wiki/Tone_sandhi)
- Pitch accent JP: [OJAD (kanshudo guide)](https://www.kanshudo.com/howto/pitch) · [Migaku pitch accent](https://migaku.com/blog/japanese/japanese-pitch-accent) · [OJAD paper](https://www.researchgate.net/publication/354182736_Development_of_a_web_framework_for_teaching_and_learning_Japanese_prosody_OJAD_online_Japanese_accent_dictionary) · [pitch accent resources](https://github.com/olety/japanese-pitch-accent-resources)
- Furigana / segmentação: [GyanMirai furigana](https://www.gyanmirai.com/tools/furigana-generator) · [awesome-japanese-nlp](https://github.com/taishi-i/awesome-japanese-nlp-resources) · [Tokenize Chinese (Medium)](https://medium.com/the-artificial-impostor/nlp-four-ways-to-tokenize-chinese-documents-f349eb6ba3c3) · [Word segmentation (Medium)](https://medium.com/data-science/word-segmentation-for-languages-without-spaces-between-words-8b100c55124b)
- Kanji/Hanzi radicais + SRS: [Tofugu radicals](https://www.tofugu.com/japanese/kanji-radicals-mnemonic-method/) · [HanziHero](https://hanzihero.com/chinese-wanikani) · [kanji123 SRS](https://kanji123.org/learn-kanji-the-smart-way) · [Migaku mnemonics](https://migaku.com/blog/japanese/kanji-mnemonics)
- Shadowing/chorusing: [Migaku shadowing](https://migaku.com/blog/language-fun/shadowing-how-to-actually-use-it-2026-guide) · [Systematic review (T&F)](https://www.tandfonline.com/doi/full/10.1080/29984475.2025.2546827) · [FluentU](https://www.fluentu.com/blog/learn/language-shadowing/)
- Language Reactor (known words/dual subs): [languagereactor.com](https://www.languagereactor.com/) · [Class Central review](https://www.classcentral.com/report/review-language-reactor/)
- Coreano (batchim): [Talkpal batchim](https://talkpal.ai/mastering-batchim-korean-the-ultimate-guide-to-korean-final-consonants/) · [90 Day Korean](https://www.90daykorean.com/batchim/) · [Advanced rules (Wikibooks)](https://en.wikibooks.org/wiki/Korean/Advanced_Pronunciation_Rules)
- i+1 / input compreensível: [Input hypothesis (Wikipedia)](https://en.wikipedia.org/wiki/Input_hypothesis) · [Krashen P&P (PDF)](https://www.sdkrashen.com/content/books/principles_and_practice.pdf) · [Clozemaster](https://www.clozemaster.com/blog/input-hypothesis-language-learning-explained/)
- DTW / pronunciation scoring: [Automatic Pronunciation Assessment review (arXiv)](https://arxiv.org/html/2310.13974) · [GOP + DTW (IEEE)](https://ieeexplore.ieee.org/document/10042421/) · [AI Mandarin tone training (T&F)](https://www.tandfonline.com/doi/full/10.1080/09588221.2025.2571696)
