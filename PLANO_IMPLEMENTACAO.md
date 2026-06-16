# PROFESSOR — Plano de Implementação (consolidado da pesquisa)

> Plano de ação derivado das pesquisas (técnicas asiáticas, jornada do iniciante, método
> Lonsdale) e da avaliação de 100 usuários. Documentos-fonte:
> [PESQUISA_IDIOMAS_ASIATICOS.md](PESQUISA_IDIOMAS_ASIATICOS.md),
> [INICIANTE_IDIOMAS_ASIATICOS.md](INICIANTE_IDIOMAS_ASIATICOS.md),
> [FUNCIONALIDADES.md](FUNCIONALIDADES.md). A feature do Professor-IA tem doc próprio:
> [PROFESSOR_IA_CONVERSA.md](PROFESSOR_IA_CONVERSA.md).
> Sessão do usuário e medidor de contexto/tokens:
> [PLANO_SESSAO_USUARIO_TOKENS.md](PLANO_SESSAO_USUARIO_TOKENS.md).

---

## 1. Diagnóstico (o "porquê" do plano)

**O motor é raro e poderoso; a jornada do usuário é o gargalo.** Hoje o app converte bem só o
imersor intermediário tech-savvy (~6–12 de 100). As perdas grandes são **todas corrigíveis**:

- 🔴 **Atrito de entrada** (BYOK + áudio do sistema) → metade cai no setup.
- 🔴 **Progresso invisível** → intermediário desiste no platô.
- 🔴 **Sem andaime de iniciante** → ~25/100 (iniciantes zero) não conseguem usar.

**Insight central:** o app já é excelente na **imersão (Estágio 2 do Refold)**. Falta
**(a) medir/mostrar progresso** e **(b) o professor-IA que conversa** — exatamente o que a
pesquisa E o método Lonsdale apontam.

---

## 2. Princípios que guiam o plano (validados por pesquisa)

1. **Comprehensible input + i+1** — conteúdo relevante, 1 palavra nova por vez. (Krashen/Lonsdale)
2. **Tornar o progresso mensurável e visível** — dopamina → hábito → retenção. (gamificação)
3. **Treino fisiológico** — ouvir + boca (pitch/tom + shadowing). (Lonsdale princípio 4)
4. **"Language parent"** — alguém paciente que conversa e te entende. (Lonsdale ação 5 → Professor-IA)
5. **Reaproveitar o que já temos** — pitch (`pitch.ts`), padrão "Fala natural" (`connectedSpeech`), SRS.

---

## 3. Roadmap priorizado

### 🔴 FASE 1 — Sensação de progresso + Professor-IA (maior retorno)

#### 1.1. Rastreio de palavras conhecidas + % de compreensão ⭐ MAIOR ALAVANCA
- **O que:** marcar cada palavra como `conhecida / aprendendo / ignorar` (persiste por idioma).
  Colorir a transcrição por status. Calcular **% de compreensão** por frase e por sessão.
  Mostrar contador "**X palavras conhecidas (+N esta semana)**" com marcos (100 = 50% cobertura).
- **Por que:** progresso visível = anti-desistência; habilita o "i+1"; é o "núcleo de alta
  frequência" do Lonsdale; valida o que a avaliação de 100 usuários apontou como #1 de retenção.
- **Como:** estende o modelo de dados atual (`store.json`: vocab/mistakes já existem por idioma).
  Novo conjunto `knownWords` por idioma. Lógica pura: `comprehensionPct(words, known)` →
  testável. UI: spans coloridos no Tutor Board (já temos `segmentText`), badge de %.
- **Esforço:** Médio-alto. **Lógica pura testável** (cálculo de %, +1, marcos).

#### 1.2. Frases "+1" (destaque do nível ideal)
- **O que:** marcar frases com exatamente 1 palavra desconhecida como "ideais para aprender";
  filtro/badge no Tutor Board e prioridade no SRS.
- **Como:** deriva de 1.1 (`unknownCount(sentence, known) === 1`). Função pura, testável.
- **Esforço:** Baixo (depende de 1.1).

#### 1.3. Meta diária + marcos (streak já existe)
- **O que:** meta pequena ("capture 5 frases / revise 10"); barra de progresso do dia; marcos
  de palavras conhecidas (100/500/1000).
- **Como:** contadores em `store.json` (sessão/dia). Reusa o streak.
- **Esforço:** Baixo.

#### 1.4. Professor-IA ("Professor substituto" / language parent) ⭐ DIFERENCIAL
- Spec completa em **[PROFESSOR_IA_CONVERSA.md](PROFESSOR_IA_CONVERSA.md)**.
- Modo IELTS Speaking planejado em **[PLANO_PROFESSOR_IELTS_SPEAKING.md](PLANO_PROFESSOR_IELTS_SPEAKING.md)**.
- Resumo: chat onde a IA **só pergunta** com base no contexto da sessão do Tutor Board, e dá
  **formas melhores de responder** + **como responder em situação similar**.
- **Esforço:** Médio (UI de chat + prompt; reusa providers e o trio de áudio).

---

### 🟠 FASE 2 — Pronúncia asiática (aproveita o pitch + "Fala natural")

#### 2.1. "Pronúncia real" (sandhi / batchim / linking) ⭐ puro e testável
- **O que:** linha mostrando como a frase é **realmente falada** (não como é escrita):
  - 🇨🇳 **Tone sandhi**: `你好 nǐ hǎo → ní hǎo`; regras do `不`/`一`; sequência de 3º tons.
  - 🇰🇷 **Batchim/linking**: `한국어 → han-gu-geo`; assimilação de consoantes.
- **Por que:** soar natural é o maior salto de qualidade; "treino fisiológico" do Lonsdale.
- **Como:** funções puras por idioma, **igual ao `connectedSpeech.ts`** (que já existe pro
  inglês). Entrada Pinyin/Hangul → saída "como se fala". **Bateria de testes** como já fizemos.
- **Esforço:** Médio. **100% puro/testável.**

#### 2.2. Anotação de tom / pitch accent sobre a curva
- **O que:** 🇨🇳 marcar o **tom (1-4)** em cada sílaba do Pinyin + desenhar a **forma esperada
  do tom** atrás da sua curva; 🇯🇵 **pitch accent** (heiban/atamadaka/…) sobre o Romaji/kana.
- **Como:** reaproveita `pitch.ts` + o comparador. Forma do tom = curva-alvo simples.
- **Esforço:** Médio.

#### 2.3. DTW no comparador de entonação
- **O que:** alinhar a sua curva de pitch com a do nativo via **Dynamic Time Warping** →
  score de tom **objetivo** (GOT) e alinhamento visual ponto-a-ponto.
- **Como:** algoritmo clássico (~30 linhas), **puro/testável**, sobre `pitch.ts`.
- **Esforço:** Médio. **Puro/testável.**

---

### 🟡 FASE 3 — Iniciante + engajamento

#### 3.1. Onboarding do iniciante
- **O que:** "qual idioma/nível?"; se zero → mini-curso/links do **sistema de escrita**
  (Hangul/Kana/Pinyin+tons) antes da imersão; **recomendar canais de comprehensible input**
  (Comprehensible Japanese, Billy Korean, Lazy Chinese).
- **Por que:** recupera os ~25/100 iniciantes hoje perdidos.
- **Esforço:** Médio (conteúdo + telas).

#### 3.2. Reduzir atrito do BYOK
- **O que:** onboarding guiado da chave de API (passo a passo por provider) e/ou opção
  gerenciada/free-tier. Detectar "sem chave" e guiar.
- **Por que:** maior filtro do funil (metade cai no setup).
- **Esforço:** Baixo–Médio (UX) / Alto (se for plano gerenciado).

---

### 🟢 FASE 4 — Features maiores

#### 4.1. Modo Loop/Chorus
- Repetir um trecho curto (palavra/frase) em loop N vezes. Reaproveita `playSlice`. **Baixo.**

#### 4.2. Furigana (kana sobre kanji) — japonês
- `<ruby>` com kuroshiro/kuromoji (dicionário alguns MB). Toggle furigana/romaji/nada. **Médio.**

#### 4.3. Decomposição de Hanzi/Kanji + deck de caracteres
- Componentes/radicais + mnemônico (IA) + SRS de caracteres (estilo WaniKani). Datasets abertos
  de decomposição CJK. **Alto.**

---

## 4. Tabela-resumo

| Fase | Item | Idiomas | Reaproveita | Esforço | Testável puro |
|---|---|---|---|---|---|
| 🔴 1 | Palavras conhecidas + % compreensão | Todos | vocab/SRS | Médio-alto | ✅ (cálculo) |
| 🔴 1 | Frases "+1" | Todos | 1.1 | Baixo | ✅ |
| 🔴 1 | Meta diária + marcos | Todos | streak | Baixo | parcial |
| 🔴 1 | **Professor-IA** (doc próprio) | Todos | providers, áudio | Médio | parcial |
| 🟠 2 | "Pronúncia real" (sandhi/batchim) | CN, KR, JP | `connectedSpeech` | Médio | ✅ |
| 🟠 2 | Anotação de tom/pitch | CN, JP | `pitch.ts` | Médio | parcial |
| 🟠 2 | DTW no comparador | Todos | `pitch.ts` | Médio | ✅ |
| 🟡 3 | Onboarding iniciante | Todos | — | Médio | — |
| 🟡 3 | Atrito BYOK | Todos | settings | Baixo-Médio | — |
| 🟢 4 | Loop/Chorus | Todos | `playSlice` | Baixo | — |
| 🟢 4 | Furigana | JP | romanização | Médio | parcial |
| 🟢 4 | Hanzi/Kanji decomposição | CN, JP | SRS + IA | Alto | parcial |

---

## 5. Métricas de sucesso (golden set / KPIs do funil)

Acompanhar a evolução com números (estilo "golden set eval"):

- **Funil:** instalou → configurou chave → 1ª captura → 1 semana → 1 mês → power user.
- **Retenção D1/D7/D30.**
- **Sensação de progresso:** % de usuários que veem a "% compreensão" subir semana a semana.
- **Engajamento:** frases capturadas/dia, revisões/dia, dias de streak médios.
- **Qualidade do core (golden set):** por provider — acertos de transcrição, cues!=0, tokens,
  tempo, custo (a tabela do print).
- **Meta da Fase 1:** dobrar a retenção D30 (de ~13/100 para ~25+/100).

---

## 6. Ordem recomendada de execução

1. **1.1 Palavras conhecidas + % compreensão** (maior retorno de retenção; habilita 1.2/3.1).
2. **1.4 Professor-IA** (maior diferencial; doc próprio pronto).
3. **2.1 "Pronúncia real"** (maior salto de qualidade asiática; baixo risco, testável).
4. **2.3 DTW** + **2.2 tom/pitch** (fecham a pronúncia tonal).
5. **3.x onboarding/BYOK** (alarga o topo do funil).
6. **Fase 4** conforme demanda.

---

## 7. Seguranca do projeto

Toda feature nova que tocar chaves, audio, transcricao, dados do usuario, IPC, IA, backend,
pagamento, sync ou deploy precisa passar pelo checklist:

- [PLANO_SEGURANCA_PROJETO.md](PLANO_SEGURANCA_PROJETO.md)
- [PLANO_AUTENTICACAO.md](PLANO_AUTENTICACAO.md), quando a feature envolver conta, login,
  plano, assinatura ou permissao.

Regra de release: se o checklist marcar algum item como `corrigir` ou `bloqueia release`, a
feature nao deve ir para producao ate resolver.
