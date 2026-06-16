# Ideias do Utell.ai para o PROFESSOR (análise competitiva + features "roubáveis")

> O Utell é um *middleware de voz em tempo real* (accent conversion + tradução ao vivo + noise
> cancel) pra COMUNICAÇÃO (Zoom/Teams/Meet). NÃO é app de aprendizado. Mas tem features de voz
> que, **reposicionadas para PEDAGOGIA**, encaixam muito bem no nosso produto.
> Princípio: o Utell **esconde** o sotaque; o PROFESSOR **ensina a produzir** o idioma. Roubamos a
> tecnologia, mantendo o viés de *aprendizado*, não cosmético.

## Inventário do Utell
1. Accent conversion em tempo real (<100ms), preservando a voz (neural voice modeling + phoneme harmonization).
2. Live Translator (→ inglês padrão).
3. Noise cancellation (90%) + sound enhancement.
4. Meeting Assistant (conversão + transcrição).
5. **Accent Oracle**: grava 5s → score de clareza + classificação do sotaque + comparação com nativo + padrões fonéticos (vogais/consoantes/ritmo/entonação) + dicas. ~15s, sem cadastro.
6. Audio Translator (upload de áudio → transcreve + traduz).

---

## Ideias mapeadas para o PROFESSOR (priorizadas)

| # | Ideia (origem Utell) | O que faríamos (viés de aprendizado) | Reaproveita | Esforço | Valor |
|---|---|---|---|---|---|
| 1 | **Voz própria em outro idioma** (voice clone) ⭐ | Ouvir a frase-alvo / a "forma melhor" / a tradução **na SUA voz**. Shadowing com o próprio timbre; "ouça você falando certo". | gravações já capturadas (referência) + TTS | Médio-Alto | ⭐⭐⭐ |
| 2 | **Diagnóstico de pronúncia** (Accent Oracle) | "Leia esta frase" → grava → **score de pronúncia/entonação** + onde você desvia (por palavra/som) + dicas. Onboarding + check recorrente. | `pitch.ts`, `dtw.ts`, `diffWords`/`scoreFromDiff`, `PronunciationCompare` | Baixo-Médio | ⭐⭐⭐ |
| 3 | **Perfil de pontos fracos de pronúncia** | Acumular onde a pessoa erra (sons/tons/batchim) → lista personalizada "seus sons a treinar" (estilo `topMistakes`, mas fonético). | mistakes/store, pitch/diff | Médio | ⭐⭐ |
| 4 | **Espelho de pronúncia ao vivo** | Ver a curva de pitch se formando vs a alvo **enquanto fala** (hoje é pós-gravação). | `pitch.ts`, comparador | Médio | ⭐⭐ |
| 5 | **Importar arquivo de áudio/vídeo** (Audio Translator) | Arrastar um arquivo → transcreve + vira aula (além da captura ao vivo). | pipeline de transcrição existente | Baixo-Médio | ⭐⭐ |
| 6 | **Card compartilhável de progresso** | "Entendo X% / N palavras em 🇰🇷" → crescimento/viral. | comprehension/known-words | Baixo | ⭐ |
| 7 | **Limpeza de áudio na captura** (noise cancel) | Melhorar a transcrição de áudio ruidoso (já temos compressor leve). | FloatingBar audio graph | Baixo | ⭐ |

---

## ⭐ Deep dive: "minha voz em outro idioma" (voice clone cross-lingual)

**O que o usuário quer:** falar no idioma dele e ouvir a tradução **na mesma voz**, em outro idioma.
**Reposicionamento pedagógico (o pulo do gato):** em vez de só "tradução com sua voz", usar isso para:
- **Shadowing com o próprio timbre** — ouvir a frase-alvo correta *na sua voz* é muito mais fácil/motivador de imitar ("sou eu falando coreano certo").
- **"Sua fala, corrigida"** — pegar a sua gravação e devolver a **versão correta na sua própria voz/sotaque-alvo** (exatamente a sacada do Utell, mas para APRENDER, não para mascarar).
- **Tradução na sua voz** — falar em PT → ouvir em KR/JP/ZH com seu timbre (imersivo e divertido).

**Já temos a matéria-prima:** o app grava a voz do usuário nas práticas → temos **áudio de referência** para clonar (ética: só clonar a própria voz).

**Opções técnicas (TTS com voice cloning):**
| Opção | Tipo | Prós | Contras |
|---|---|---|---|
| **ElevenLabs** | nuvem (BYOK) | melhor qualidade, clone instantâneo, multilíngue | pago; manda áudio pra nuvem |
| **XTTS‑v2 (Coqui)** | local | cross-lingual, roda offline (como o Kokoro) | modelo grande, latência maior |
| **OpenVoice v2** | local | clona timbre + controla estilo, leve-ish | pipeline em 2 passos |
| **F5‑TTS / GPT‑SoVITS** | local | qualidade alta | setup mais pesado |

**Recomendação:** MVP via **ElevenLabs (BYOK)** — encaixa no nosso modelo "sua chave", rápido de integrar (mais um provider de TTS ao lado de Kokoro/Edge). Depois, opção **local (XTTS/OpenVoice)** para privacidade/offline.
**Decisão necessária:** nuvem-BYOK (rápido) **ou** local (privado/offline) primeiro.

---

## Sugestão de ordem
1. **#2 Diagnóstico de pronúncia** (reaproveita quase tudo, baixo risco, alto valor, on-brand) — bom primeiro passo.
2. **#1 Voz própria** (o "wow" pedido) — depois de decidir provider.
3. #3/#4 (perfil + espelho ao vivo) evoluem do #2.
4. #5/#6/#7 conforme demanda.

---

## A diferença é quase filosófica

> **Autoria desta análise e das novas ideias abaixo:** Codex (GPT-5), em conversa com Joel, 2026-06-10.

| Dimensão | Utell AI | PROFESSOR (nosso) |
|---|---|---|
| Objetivo | Soar mais claro agora, mascarando/convertendo sotaque em tempo real | Aprender e adquirir o idioma ao longo do tempo |
| Quando age | Durante a chamada toda | Quando existe input + prática deliberada + revisão |
| Fonte | A fala do usuário em reuniões | Qualquer áudio do PC: dramas, vídeos, podcasts, aulas e conversas |
| Interação | Passiva: filtro de áudio no pipeline | Ativa: shadowing, gravação, pontuação, marcação de palavras e conversa |
| Pedagogia | Nenhuma; é um filtro de comunicação | Input compreensível + repetição + SRS + professor/language parent |
| Progresso | Não rastreia aprendizado | Mede compreensão, palavras conhecidas, streak, sessões, erros e evolução |
| Sotaque | Esconde ou suaviza para comunicação imediata | Ensina a corrigir o que atrapalha entendimento |
| Forma | Serviço em nuvem no meio das chamadas | App Electron BYOK que captura áudio do sistema e transforma em aula |

**Resumo:** o Utell trabalha a favor de esconder o sotaque para comunicação imediata; o PROFESSOR trabalha a favor de produzir o idioma de verdade. A oportunidade não é copiar "accent conversion", mas transformar isso em **accent learning**: diagnóstico, prática, correção e evolução acumulada.

## Novas ideias de implementação — autoria Codex

1. **Accent Learning Mode**
   - Modo específico para ensinar o usuário a perceber e corrigir o próprio sotaque.
   - Diferencia "sotaque aceitável" de "pronúncia que atrapalha entendimento".
   - Deve evitar promessa falsa de zerar sotaque; o foco é inteligibilidade.

2. **Diagnóstico rápido de pronúncia**
   - Usuário lê uma frase curta, grava 5-10 segundos e recebe score geral.
   - Avalia clareza, ritmo, entonação, palavras problemáticas e 1-3 dicas práticas.
   - Pode virar onboarding: "seu nível de pronúncia hoje".

3. **Sua fala corrigida**
   - O usuário fala uma frase e o app devolve uma versão natural/correta.
   - Exemplo: "Você tentou dizer X. Uma forma mais natural seria Y."
   - Depois pode tocar essa versão em TTS e, no futuro, na própria voz do usuário.

4. **Comparação original vs usuário vs professor**
   - Para cada frase, mostrar lado a lado: áudio original, gravação do usuário e versão modelo.
   - Comparar texto, ritmo e curva de entonação.
   - Reaproveita `PronunciationCompare`, `pitch.ts`, `dtw.ts`, `diffWords` e TTS.

5. **Perfil de sotaque do usuário**
   - Acumular padrões de erro por idioma.
   - Exemplos: apagar consoante final, trocar TH por D/T, ritmo muito silábico, vogal reduzida ausente, entonação que sobe/baixa no ponto errado.
   - Mostrar top 3 pontos fracos no Dashboard e treinos sugeridos.

6. **Treino personalizado por erro**
   - Quando o app detecta que o usuário erra sempre o mesmo som, cria mini exercícios focados.
   - O treino deve usar frases reais e curtas, não listas artificiais demais.
   - Reaproveita SRS, `WordDrill` e histórico de mistakes.

7. **Professor coach de pronúncia**
   - O professor não apenas conversa; ele também observa pronúncia, entonação, naturalidade e clareza.
   - Após a resposta do usuário, entrega feedback curto: conteúdo, gramática, pronúncia e uma forma melhor de responder.
   - Deve seguir a lógica IELTS/conversação séria: perguntar, ouvir, corrigir e puxar uma nova resposta.

8. **Replay pedagógico**
   - Depois da tentativa, permitir ouvir: original, minha gravação, modelo correto e forma melhor de responder.
   - Ajuda o usuário a perceber a diferença sem depender só de texto.

9. **Modo IELTS/conversação séria**
   - Professor faz perguntas como examinador.
   - Avalia fluência, coerência, vocabulário, gramática, pronúncia e capacidade de sustentar resposta.
   - Útil para transformar a conversa em treino mensurável.

10. **Noise cleanup antes da transcrição**
    - Reduz ruído e silêncio antes de mandar para STT.
    - Melhora transcrição e análise de fala, principalmente quando o áudio do PC/microfone está poluído.

11. **Importar áudio/vídeo**
    - Usuário arrasta um arquivo de áudio/vídeo para o app.
    - O app transcreve, segmenta, cria frases, vocabulário, prática e revisão.
    - Transforma conteúdo salvo em aula reaproveitável.

12. **Voz própria em outro idioma**
    - Ouvir a frase correta na própria voz do usuário.
    - Feature "wow", mas depende de provider/modelo de clonagem de voz e exige cuidado ético.
    - Deve ser tratada como fase futura, depois do diagnóstico e perfil de pronúncia.

**Ordem recomendada por Codex:**
1. Diagnóstico rápido de pronúncia.
2. Perfil de sotaque.
3. Professor coach de pronúncia.
4. Sua fala corrigida.
5. Importar áudio/vídeo.
6. Voz própria em outro idioma.

---

# Planos de implementação detalhados

> Padrão de cada feature: **núcleo puro (testável)** → **serviço/IPC** → **UI** → **bateria de testes**.
> Estado de partida (o que já existe e reaproveitamos): `pitch.ts` (`detectPitch`/`pitchContour`/
> `normalizeContour`), `dtw.ts` (`pitchShapeScore`), `text.ts` (`diffWords`/`scoreFromDiff`/`segmentText`),
> `usePractice` (gravar→Whisper), `PronunciationCompare`, `DiffView`, `WordDrill`, `ttsService` (Kokoro/Edge),
> `storeService` (mistakes/`topMistakes`, known words), analisadores `pinyinTone`/`hangulPhonology`/`pitchAccent`/`cjk`,
> `comprehension`/`useKnownWords`.

## Plano #2 — Diagnóstico de pronúncia ("Oracle" pedagógico) ⭐ primeiro
**Objetivo:** "Leia esta frase" → grava → **score** (palavra + entonação) + **onde desviou** + **dicas**.
Serve de onboarding ("seu nível de pronúncia hoje") e check recorrente; salva histórico de score.

**Núcleo puro (novo):**
- `src/lib/diagnosticSentences.ts`: `diagnosticSet(lang, level?)` → 3-5 frases foneticamente ricas por idioma
  (ex.: 🇰🇷 batchim/ㄹ; 🇨🇳 os 4 tons; 🇯🇵 vogais longas/ー; 🇬🇧 th/r). Dados puros + fallback.
- `src/lib/pronunciationDiagnosis.ts`:
  - `diagnoseReading({ reference, spoken, userContour, refContour })` →
    `{ overall, wordScore, intonationScore, diff: DiffToken[], weakWords: string[] }`.
    `wordScore` = `scoreFromDiff(diffWords(ref, spoken))`; `intonationScore` = `pitchShapeScore(user, ref)`;
    `overall` = média ponderada (ex.: 0.6 palavra + 0.4 entonação); `weakWords` = tokens `missing`/`extra`.
  - `pronunciationTips(lang, weakWords)` → 1-3 dicas curadas por idioma + pelas palavras erradas
    (reusa `pinyinTone`/`hangulPhonology` p/ apontar tom/batchim específico quando possível).
- **Testes:** `diagnosticSet` (cobre idiomas + fallback, frases não vazias); `diagnoseReading`
  (acerto total→100, erros→weakWords certos, pesos, entonação 0 quando sem contorno); `pronunciationTips`
  (idioma certo, dica por palavra).

**Serviço/IPC:** nada novo de provider (reusa `audioAPI.transcribe` + TTS p/ a referência). Persistência:
- `storeService`: `recordDiagnostic(lang, score)` + `diagnosticHistory(lang)` (últimos N). IPC `store:record-diagnostic`/`store:diagnostic-history` + preload/electron/types. **Testes** (mock electron, como `storeService.knownWords.test.ts`).

**UI (novo `src/components/PronunciationDiagnostic.tsx`):** mostra a frase-alvo (com TTS "ouvir o modelo"),
botão **Falar** (reusa `usePractice`), e o **card de resultado**: score grande + `DiffView` (palavra por palavra)
+ curva de entonação (reusa o SVG do `PronunciationCompare`) + dicas. Ponto de entrada: card no Dashboard
("Testar minha pronúncia") e/ou no Tutor Board. **Testes (jsdom):** fluxo ler→gravar(mock)→score+diff+dicas.

**Esforço:** Baixo-Médio. **Risco:** baixo. **Reusa:** ~80% já existe.

---

## Plano #1 — Minha voz em outro idioma (voice clone) ⭐ "wow" (provider a decidir)
**Objetivo:** ouvir a frase-alvo / a "forma melhor" / a tradução **na voz do próprio usuário**.
**Pedagógico:** shadowing com o próprio timbre; **"sua fala corrigida"** (devolver a versão certa na sua voz).

**Pré-requisito — calibrar a voz:**
- `settingsService`: `voiceSampleUrl` (data URL/caminho da amostra de referência) + flag `voiceCloneEnabled`.
- Fluxo "Calibrar minha voz": grava ~6-10s lendo uma frase neutra → salva como referência.
  (Já capturamos voz nas práticas; podemos reusar a melhor gravação como referência inicial.)

**Núcleo puro (novo, testável independ. do provider):**
- `electron/lib/voiceCloneProbe.ts`: `buildCloneRequest(provider, { text, lang, refAudio, apiKey })` →
  `{ url, headers, body }` por provider (ElevenLabs agora; XTTS local depois). Igual ao padrão `providerTestProbe`.
- **Testes:** monta URL/headers/body certos por provider; chave/idioma embutidos; provider desconhecido→undefined.

**Serviço/IPC:** `ttsService.cloneSpeak(text, lang, refAudio)` → novo branch de provider (cloud BYOK
ElevenLabs **ou** worker local XTTS — **decisão pendente**). IPC `tts:clone-speak`. Credenciais p/ ElevenLabs
(reusa `credentialsService` + as melhorias de BYOK).

**UI:** botão **"🔊 na minha voz"** ao lado de TTS/Original (WordPopover, TutorBoard, ProfessorChat);
modo **"Sua fala corrigida"** após uma prática (sintetiza a frase certa na voz do usuário).

**Esforço:** Médio-Alto. **Risco:** dependência de provider (custo/nuvem) ou peso do modelo local; **ética**
(clonar só a própria voz — bloquear amostra de terceiros). **Decisão:** nuvem-BYOK vs local primeiro.

---

## Plano #3 — Perfil de pontos fracos de pronúncia
**Objetivo:** acumular onde a pessoa erra (palavras/sons) → lista personalizada "seus sons a treinar".
**Já temos os dados:** `storeService` grava `mistakes` (por `lang:word`, com `count`) das práticas → é a base.

**Núcleo puro (novo):**
- `src/lib/pronunciationProfile.ts`: `pronunciationProfile(lang, mistakes)` → agrupa as palavras erradas por
  **traço fonético do idioma**: 🇨🇳 por tom (usa `syllableTones`/`pinyinTone`), 🇰🇷 por tipo de batchim
  (usa `hangulPhonology`/`decompose`), 🇯🇵 por mora/vogal longa, 🇬🇧 por padrão (th/r). Saída:
  `{ groups: [{ key, label, words[], count }], top: [...] }`.
- **Testes:** agrupa por tom/batchim corretamente; ordena por frequência; idioma sem analisador → grupo "geral".

**UI:** seção "Seu perfil de pronúncia" no Dashboard: top sons/erros + botão **Treinar** (reusa `WordDrill`).
**Esforço:** Médio. **Reusa:** mistakes + analisadores existentes.

---

## Plano #4 — Espelho de pronúncia ao vivo
**Objetivo:** ver a curva de pitch se formando **enquanto fala** (hoje é só pós-gravação).

**Núcleo puro (novo):**
- `src/lib/liveContour.ts`: buffer rolante de pitch — `pushFrame(state, hz, maxLen)` → estado;
  `contourPoints(state)` → série normalizada p/ desenhar. (A detecção por frame reusa `detectPitch`.)
- **Testes:** janela máxima respeitada (descarta antigos), normalização, frames não-vozeados (0) viram gap.

**UI/Serviço:** um modo no treino que liga o analyser do mic (reusa o grafo de áudio do FloatingBar),
roda `detectPitch` por frame em RAF e desenha a curva ao vivo + a curva-alvo por trás.
**Esforço:** Médio. **Risco:** performance (RAF) — `detectPitch` é O(n·lags); usar frame ~30ms é viável.

---

## Plano #5 — Importar arquivo de áudio/vídeo
**Objetivo:** arrastar um arquivo → transcreve → vira aula (além da captura ao vivo).

**Núcleo puro (novo):**
- `src/lib/audioChunking.ts`: `planChunks(durationMs, { maxChunkMs, overlapMs })` → lista de janelas
  (controla nº de chamadas/custo). **Testes:** cobre toda a duração, sem buraco, overlap correto, curto→1 chunk.

**Serviço/UI:** file-picker/drag-drop no renderer → decodifica (Web Audio) → corta em chunks →
`audioAPI.transcribe` por chunk → emite `tutor:analysis` (mesmo caminho do ao vivo). Vídeo: extrair faixa de
áudio via Web Audio/ffmpeg.
**Esforço:** Médio. **Risco:** arquivos longos = muitas chamadas (custo) + extração de áudio de vídeo.

---

## Plano #6 — Card compartilhável de progresso
**Objetivo:** "Entendo X% / N palavras em 🇰🇷" → motivação/viral.
**Núcleo puro:** `shareCardText(lang, knownCount, coverage)` (reusa `estimatedCoverage`). **Testes:** texto/idioma.
**UI:** componente de card bonito + exportar imagem (html→canvas). **Esforço:** Baixo.

---

## Plano #7 — Limpeza de áudio na captura (transcrição melhor)
**Objetivo:** reduzir ruído antes do Whisper (hoje só há um compressor leve no FloatingBar).
**Núcleo puro:** `src/lib/noiseGate.ts`: `noiseGate(samples, { thresholdRms, frame })` → zera frames abaixo do
gate. **Testes:** silêncio→0, fala preservada, gate relativo. **UI/Serviço:** aplicar no caminho de captura
(opcional, toggle nas Configurações). **Esforço:** Baixo-Médio.

---

## Resumo de prioridade (recomendado)
1. ✅ **#2 Diagnóstico de pronúncia** — IMPLEMENTADO (núcleo + UI + 22 testes).
2. **#3 Perfil de pronúncia** (evolui do #2, usa dados que já gravamos) — próximo.
3. **#1 Voz própria** (após decidir provider de clonagem).
4. **#4 Espelho ao vivo** / **#5 Importar arquivo** / **#6 Card** / **#7 Noise gate** — conforme demanda.

### ✅ #2 Diagnóstico — entregue
- Núcleo puro: `src/lib/diagnosticSentences.ts` (frases por idioma; 4 testes) +
  `src/lib/pronunciationDiagnosis.ts` (`diagnoseReading` = palavra 65% + entonação DTW 35%, `weakWords`,
  `pronunciationTips`, `scoreLabel`; 10 testes).
- UI: `src/components/PronunciationDiagnostic.tsx` (modal "leia esta frase" → grava → score + DiffView +
  dicas + ouvir modelo + próxima frase; 8 testes). Entrada: card "Testar minha pronúncia" no Dashboard.
- **925 testes no total, type-check limpo.**
