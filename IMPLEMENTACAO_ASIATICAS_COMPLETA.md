# Implementação COMPLETA — Idiomas Asiáticos (Mandarim 🇨🇳 · Japonês 🇯🇵 · Coreano 🇰🇷)

> Especificação exaustiva para suporte **total** a um idioma asiático no PROFESSOR — **nada
> pode faltar**. Mandarim é o carro-chefe (detalhe máximo); cada pilar traz o equivalente em
> japonês e coreano. Pensado para ser implementável direto, com estruturas de dados, funções
> puras (testáveis), libs, UI e plano de testes.
>
> Complementa: [PLANO_IMPLEMENTACAO.md](PLANO_IMPLEMENTACAO.md) ·
> [PESQUISA_IDIOMAS_ASIATICOS.md](PESQUISA_IDIOMAS_ASIATICOS.md) ·
> [PROFESSOR_IA_CONVERSA.md](PROFESSOR_IA_CONVERSA.md).

---

## 0. Os 10 pilares (uma língua "completa" precisa de TODOS)

1. **Texto: segmentação + leitura** (sem espaços; romanização; furigana/ruby; trad/simpl)
2. **Pronúncia real** (connected speech: sandhi/batchim/rendaku)
3. **Tom / Pitch accent** (visualização + score)
4. **Caracteres** (decomposição, traços, mnemônico, deck próprio)
5. **SRS + palavras conhecidas + frequência** (HSK/JLPT/TOPIK, % compreensão, +1)
6. **Áudio/Listening** (TTS correto, recorte por palavra, shadowing/loop)
7. **Tutor IA por idioma** (prompts específicos, notas de gramática)
8. **Professor-IA / conversa** (doc próprio)
9. **Onboarding do iniciante** (sistema de escrita + conteúdo)
10. **Dados + testes** (modelo de dados, baterias de teste puras)

---

## 1. Texto: segmentação + leitura

### 1.1. Segmentação de palavras (sem espaços)
- **Já temos** `Intl.Segmenter` (bom baseline para clicar palavras).
- **Completo:** fallback dedicado por idioma para casos difíceis:
  - 🇨🇳 `jieba`/`nodejieba` ou modelo; 🇯🇵 `kuromoji`; 🇰🇷 analisador morfológico (mecab-ko).
- **Função pura testável:** `segment(text, lang) → tokens[]` com `{surface, isWord, start, end}`.

### 1.2. Romanização (obrigatória, nunca vazia)
- 🇨🇳 **Pinyin** com **marcas de tom** (nǐ hǎo) **e** número de tom (ni3 hao3) — guardar os dois.
  - Opção **Zhuyin/Bopomofo** (ㄋㄧˇ ㄏㄠˇ) para público de Taiwan.
- 🇯🇵 **Romaji Hepburn** + leitura em **kana** (necessária pra furigana).
- 🇰🇷 **Romanização Revisada (RR)** — mas **de-enfatizar** (ensinar pelo Hangul).
- **Por caractere:** um caractere pode ter **múltiplas leituras** (kanji on/kun; hanzi 多音字).
  Guardar a leitura **no contexto** (a IA já dá; cachear por caractere+contexto).

### 1.3. Furigana / Ruby (japonês) ⭐
- Renderizar kana **acima** do kanji com `<ruby><rt>`. Libs: `kuroshiro`+`kuromoji`.
- **Toggle:** furigana / romaji / nada. (Iniciante usa furigana; avançado desliga.)

### 1.4. Tradicional vs Simplificado (🇨🇳)
- Detectar/converter `zh-CN` (简) ↔ `zh-TW` (繁). Deck e romanização respeitam a variante.
- Lib: `opencc`/`opencc-js`.

### 1.5. UI de exibição
- Clique em **palavra** (lookup) e clique em **caractere** (decomposição) — dois modos.
- Linhas empilhadas por frase: **Hanzi/Kanji/Hangul** · **Romanização (sync karaokê)** ·
  **Pronúncia real** · **Tradução PT**.

---

## 2. Pronúncia real (connected speech) — "como se fala de verdade"
> Padrão de código: igual ao `connectedSpeech.ts` (inglês). **Funções puras, bateria de testes.**

### 2.1. 🇨🇳 Mandarim — Tone Sandhi (completo)
- **3º + 3º → 2º + 3º** (你好 nǐ hǎo → ní hǎo).
- **Sequência de 3º:** em 3+ terceiros tons, só o **último** fica 3º; os anteriores viram 2º
  (agrupando por unidade rítmica: 我很好 wǒ hěn hǎo → wó hén hǎo).
- **不 (bù):** vira **2º** antes de 4º (不是 bú shì); senão, 4º.
- **一 (yī):** **4º** antes de 1º/2º/3º (一天 yì tiān); **2º** antes de 4º (一个 yí gè); **1º**
  isolado/ordinal (第一 dì yī).
- **啊 (a) sandhi** (assimilação fonética) — opcional/avançado.
- **Neutro (轻声):** marcar sílabas átonas (妈妈 māma → mā·ma).
- **Saída:** `pinyinSpoken(pinyinComToms) → pinyin com tons reais`. Função pura.

### 2.2. 🇰🇷 Coreano — regras do Batchim (completo)
- **Linking (연음):** batchim + vogal → consoante "pula" (한국어 → 한구거 "han-gu-geo").
- **Nasalização (비음화):** ㄱ/ㄷ/ㅂ + ㄴ/ㅁ → ㅇ/ㄴ/ㅁ (학년 → 항년).
- **Aspiração (격음화):** ㅎ + ㄱ/ㄷ/ㅈ/ㅂ → aspiradas (좋다 → 조타).
- **Tensão (경음화):** após ㄱ/ㄷ/ㅂ, a consoante seguinte tensiona (학교 → 학꾜).
- **Palatalização (구개음화):** ㄷ/ㅌ + 이 → ㅈ/ㅊ (같이 → 가치).
- **ㅎ fraco / queda;** **assimilação ㄹ/ㄴ** (신라 → 실라).
- **Saída em Hangul** (não romanização): `hangulSpoken(hangul) → hangul como se fala`.

### 2.3. 🇯🇵 Japonês — fenômenos
- **Rendaku (連濁):** voiceamento da consoante inicial em compostos (te+kami → tegami).
- **Devoicing (無声化):** i/u entre surdas/no fim (です → des).
- **Vogais longas / っ (sokuon) / ん (moraico).**
- (Menos crítico que pitch accent, mas listar.)

---

## 3. Tom / Pitch accent
> Reaproveita `pitch.ts` + o comparador de entonação.

### 3.1. 🇨🇳 Mandarim — tons
- **Número do tom (1-4 + neutro)** em cada sílaba do Pinyin.
- **Forma esperada** desenhada atrás da sua curva: 1=reto alto · 2=sobe · 3=desce-sobe ·
  4=desce · neutro=curto.
- **Sobreposição** da sua curva vs nativo (Você/Original/TTS).
- **Drill de pares de tons** (os ~20 pares; maioria das palavras é bissílaba).
- **Visualizar o sandhi** (mostrar tom citado vs tom real falado).

### 3.2. 🇯🇵 Japonês — pitch accent
- Padrões: **heiban (0)**, **atamadaka (1)**, **nakadaka**, **odaka**. Marcar onde **cai** o tom.
- Linha alta/baixa por mora sobre o kana; marca de núcleo de acento.
- Fonte do padrão "ideal": **OJAD** / dicionário de pitch accent (NHK) — cachear por palavra.

### 3.3. 🇰🇷 Coreano — entonação
- Menos lexical; focar em **entonação de frase** (declarativa/interrogativa) no comparador.

### 3.4. Score objetivo — DTW + Goodness of Tone
- **DTW** (Dynamic Time Warping) alinha sua curva à do nativo (velocidades diferentes) →
  distância → **score de tom/pitch**. Algoritmo puro (~30 linhas), **testável**.
- Feedback por sílaba: "3º tom subiu cedo", "pitch accent caiu na mora errada".

---

## 4. Caracteres (Hanzi 🇨🇳 / Kanji 🇯🇵 / Hangul 🇰🇷)

### 4.1. Decomposição
- 🇨🇳🇯🇵 **Radicais + componentes** (datasets abertos: CJK decomposition, Kangxi 214 radicais,
  `cjk-decomp`, `kanjivg`). Clicar caractere → árvore de componentes + significado de cada.
- 🇰🇷 **Hangul não decompõe em radicais** — mas **mostrar a estrutura silábica** (inicial 초성 +
  medial 중성 + final 종성). Ex.: 한 = ㅎ+ㅏ+ㄴ.

### 4.2. Ordem de traços (animada)
- 🇨🇳🇯🇵 SVG animado de stroke order (`kanjivg` / `hanzi-writer`). Modo "escrever na tela".

### 4.3. Mnemônicos
- IA gera história mnemônica conectando componentes → significado/leitura (estilo WaniKani).

### 4.4. Deck de caracteres (SRS separado das frases)
- Card de **caractere**: forma → significado + leitura(s); SRS próprio.
- Reconhecimento (ver→significar) e produção (significar→escrever) como graus.

---

## 5. SRS + palavras conhecidas + frequência

### 5.1. Palavras conhecidas + % compreensão (Fase 1 do plano)
- `knownWords` por idioma (`conhecida/aprendendo/ignorar`), persiste entre sessões.
- `comprehensionPct(tokens, known)` por frase/sessão. **+1** = `unknownCount === 1`.
- Marcos por nº de palavras conhecidas (100 = ~50% cobertura; 1000 = 70–80%).

### 5.2. Listas de frequência / níveis
- 🇨🇳 **HSK 1–6** (e HSK 3.0); 🇯🇵 **JLPT N5–N1**; 🇰🇷 **TOPIK**.
- Mostrar o nível de cada palavra; priorizar alta frequência; "qual % do HSK1 você já conhece".

### 5.3. Tipos de card
- **Frase** (já temos) · **palavra** · **caractere** · **variações**. SM-2 já implementado.

---

## 6. Áudio / Listening

- **TTS correto por idioma** (já há provider kokoro/edge + voz por idioma) — voz nativa CN/JP/KR.
- **Recorte por palavra** (cues do Whisper) via `playSlice` (já existe).
- **Shadowing** (tocar original + gravar por cima) + **Loop/Chorus** (repetir trecho N vezes).
- **Controle de velocidade** (0.75x/0.5x) para iniciante.
- **Karaokê** sincronizado (já existe) — destaca sílaba/caractere no tempo do áudio.

---

## 7. Tutor IA por idioma (prompts específicos)
> Estende `tutorPrompt.ts` (já tem romanização obrigatória por idioma).

- 🇨🇳 Pinyin **com marcas de tom** obrigatório; campo de **tom real (sandhi)**; nota de
  medida/partícula (了/吗/的); 多音字 no contexto.
- 🇯🇵 leitura em **kana** (pra furigana) + **pitch accent**; on/kun no contexto; partículas
  (は/が/を) e nuance.
- 🇰🇷 **Hangul** + romanização RR; **pronúncia real (batchim)**; partículas (은/는/이/가) e níveis
  de fala (반말/존댓말).
- **Geral:** tradução PT + dica cultural/gramatical no nível do aluno.

---

## 8. Professor-IA / conversa
- Spec completa em **[PROFESSOR_IA_CONVERSA.md](PROFESSOR_IA_CONVERSA.md)** — conversa baseada no
  contexto da sessão, no idioma-alvo, calibrada pelo nível (palavras conhecidas).

---

## 9. Onboarding do iniciante (por idioma)
- 🇰🇷 **Hangul num fim de semana** (mini-curso) → 300–500 palavras → imersão.
- 🇯🇵 **Kana** (hiragana+katakana) → ~1000 palavras + kanji em doses → imersão (furigana ligado).
- 🇨🇳 **Pinyin + TONS primeiro** → HSK1 (~150) → caracteres em doses → imersão.
- **Recomendar comprehensible input:** Lazy Chinese · Comprehensible Japanese · Billy Korean.
- **Placement:** "qual idioma/nível?" define furigana on/off, % alvo, conteúdo sugerido.

---

## 10. Modelo de dados + testes

### 10.1. Acréscimos ao `store.json` / tipos
```ts
// por idioma
knownWords: Record<lang, Record<word, 'known'|'learning'|'ignore'>>
characterCards: VocabCard[]              // deck de caracteres (id, char, leituras, SRS)
// por análise (TutorAnalysis): novos campos
pinyinNumbered?: string                  // ni3 hao3 (além das marcas)
spokenForm?: string                      // pronúncia real (sandhi/batchim) — caching
toneMarks?: number[]                     // tom por sílaba (CN)
pitchAccent?: { mora: number; drop?: number }  // JP
kana?: string                            // pra furigana (JP)
```

### 10.2. Funções puras a criar (todas com bateria de testes, estilo `connectedSpeech`/`tts`)
| Função | Idioma | O que faz |
|---|---|---|
| `pinyinSpoken(pinyin)` | 🇨🇳 | aplica tone sandhi (3-3, 不, 一, seq, neutro) |
| `pinyinNumbersToMarks` / `marksToNumbers` | 🇨🇳 | converte ni3↔nǐ |
| `toneOf(syllable)` | 🇨🇳 | extrai o tom (1-4/0) |
| `toneShape(tone)` | 🇨🇳 | curva-alvo do tom (pra desenhar) |
| `hangulSpoken(hangul)` | 🇰🇷 | linking + assimilação + tensão + aspiração + … |
| `decomposeHangul(syllable)` | 🇰🇷 | 초성/중성/종성 |
| `rendaku`/`devoice` | 🇯🇵 | fenômenos do japonês |
| `comprehensionPct(tokens, known)` | todos | % de palavras conhecidas |
| `unknownCount(tokens, known)` | todos | nº de palavras novas (→ "+1") |
| `dtwDistance(a, b)` + `dtwPath` | todos | alinhamento de curvas de pitch |
| `goodnessOfTone(user, ref)` | 🇨🇳🇯🇵 | score de tom/pitch via DTW |

### 10.3. Plano de testes
- **Sandhi (CN):** todos os casos (3-3, sequências, 不×4 tons, 一×casos, neutro) + "não muda
  quando não deve".
- **Batchim (KR):** linking, nasalização, aspiração, tensão, palatalização, ㄹ/ㄴ.
- **DTW:** monotonicidade, alinhamento de curvas iguais (dist 0), velocidades diferentes.
- **Pinyin conversões:** ida e volta marcas↔números; sílabas com ü/v.
- **comprehension/+1:** 0%, 100%, exatamente 1 nova, dedupe.

---

## 11. Checklist "uma língua 100% completa" (Mandarim como exemplo)

- [ ] Segmentação de palavras + clique (palavra e caractere)
- [ ] Pinyin com marcas **e** números + Zhuyin opcional + Trad/Simpl
- [ ] **Tone sandhi** ("pronúncia real") com testes
- [ ] Número do tom + **forma do tom** atrás da curva
- [ ] Comparador com **DTW + Goodness of Tone**
- [ ] Drill de **pares de tons**
- [ ] **Hanzi**: decomposição + traços + mnemônico + **deck de caracteres** (SRS)
- [ ] **Palavras conhecidas + % compreensão + "+1"**
- [ ] **Frequência HSK** (nível por palavra)
- [ ] TTS nativo + recorte por palavra + **shadowing/loop** + velocidade
- [ ] Prompt do tutor específico (tom real, 多音字, medidas/partículas)
- [ ] **Professor-IA** (conversa no contexto, em mandarim, calibrada)
- [ ] **Onboarding**: Pinyin+tons → HSK1 → caracteres → imersão + canais recomendados
- [ ] Dados + **baterias de teste** de todas as funções puras

> Quando **todos** os itens acima estiverem ✅ para um idioma, ele está "completo". Replicar o
> mesmo checklist trocando: Pinyin→Kana/Furigana+Pitch accent (JP) · →Hangul+Batchim (KR).

---

## 12. Ordem de execução sugerida (para uma língua, do maior valor ao menor)

1. **Palavras conhecidas + % compreensão + "+1"** (retenção; serve a todos os idiomas)
2. **Pronúncia real** (sandhi 🇨🇳 / batchim 🇰🇷) — puro/testável, maior salto de qualidade
3. **Tom/pitch na curva + DTW + Goodness of Tone** (🇨🇳🇯🇵)
4. **Furigana** (🇯🇵) / **Zhuyin/Trad-Simpl** (🇨🇳)
5. **Caracteres** (decomposição + deck + traços + mnemônico)
6. **Frequência (HSK/JLPT/TOPIK)** + drills (pares de tons)
7. **Shadowing/Loop + velocidade**
8. **Professor-IA** + **Onboarding do iniciante**
