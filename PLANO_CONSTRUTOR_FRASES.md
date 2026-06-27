# Plano — Construtor de Frases (produção de fala) + Cache global de palavras

> **Norte do app:** Soaken é pra **melhorar speaking + accent + comunicação**. Toda feature aqui
> é amarrada nisso: a pessoa **FALA** (não só digita), treinando produção **e** recebendo o feedback
> de pronúncia/accent que o app já faz.
>
> Origem: método de poliglota (escada de produção) — parte de uma palavra e **constrói**:
> `laranja → eu gosto de laranja → why do you like orange? → because orange is my favorite fruit`.
> Aplicado de forma abrangente: a pessoa assiste uma série, captura ~10 frases, **pratica falando** e
> também **cria versões novas** com as palavras-chave; a IA **mapeia as palavras-chave do contexto** e
> dá **exemplos + sugestões**, avaliando o que a pessoa produziu.

---

## 0. Decisões rápidas
- **Aba separada?** SIM. É uma atividade distinta (produção ativa), diferente do Tutor Board (análise/
  reconhecimento). Vira um modo/aba **"Produzir"** (ou dentro da Revisão). Mantém o foco em speaking.
- **Kokoro:** local, roda no PC do usuário, **baixa na 1ª vez** (não embutido). Sem servidor nosso.
- **Custo:** esta feature é **sob demanda** (a pessoa pratica ativamente) → já nasce barata, ao contrário
  da auto-análise de toda frase. Mesmo assim, usar o **cache global** (§3) pra mapeamento/exemplos repetidos.

---

## 1. A feature: Construtor de Frases
### Fluxo do usuário
1. Pessoa assistiu e **capturou N frases** (já existe — vão pro deck/sessão).
2. Abre a aba **Produzir**. Escolhe uma frase capturada (ou uma palavra-chave dela).
3. A **IA mapeia 2-4 palavras-chave** daquele contexto (palavras de conteúdo úteis).
4. Pra cada palavra, desafio em **escada** (método poliglota):
   - **Afirmar** → "I like orange"
   - **Perguntar** → "Why do you like orange?"
   - **Justificar/expandir** → "Because orange is my favorite fruit"
   - Bônus: **reformular** a frase original com as palavras-chave.
5. A pessoa **FALA** a frase dela → Whisper transcreve.
6. A IA **avalia**: correta? natural? + **correção** + **2-3 exemplos** de uso (em escada).
7. Em paralelo, a fala passa pelo **score de pronúncia/accent** que já temos (diff, perfil, comparador).
8. Marca a palavra como **"sei usar"** (nova camada de PRODUÇÃO, acima de "reconheço").

### Por que é forte
- É o lado de **OUTPUT** que falta (hoje o app é forte em input). Fluência vem da produção.
- Junta **speaking** (falar frases próprias) + **accent** (feedback de pronúncia) + **comunicação**.
- Diferencial real — quase nenhum app de idioma faz produção guiada com avaliação por IA.

---

## 2. Dissecando a implementação (camadas)
### 2.1 Núcleo puro (testável) — `electron/lib/tutorPrompt.ts`
- `buildKeywordsPrompt(sentence, lang, native)` → IA devolve `{ keywords: ["...", ...] }` (2-4 palavras
  de conteúdo da frase; pula trivial). *(pode reusar o vocab da análise se já existir → 0 IA)*.
- `buildSentenceCoachPrompt(word, context, userSentence, lang, native)` → IA devolve:
  ```json
  {
    "ok": true|false|null,                 // null = só pedindo exemplos (sem frase do usuário)
    "feedback": "curto, no idioma nativo: o que está bom / o que corrigir",
    "corrected": "versão mais natural em <lang> (vazio se já perfeito)",
    "examples": ["afirmação", "pergunta", "justificativa"]   // escada, em <lang>
  }
  ```
  Um único prompt cobre os dois casos (sem userSentence → desafio+exemplos; com → avalia).

### 2.2 Serviço — `electron/services/tutorService.ts`
- `keywords(sentence, lang)` e `sentenceCoach(word, context, userSentence, lang)`.
- **Registrar uso real de tokens** (ver fix de custo) e passar pelo **cache global** (§3) quando aplicável.

### 2.3 IPC + ponte — `tutor:keywords`, `tutor:sentence-coach` (+ preload, electron.ts, types).

### 2.4 Captura da fala (reuso)
- `usePractice` (mic → Whisper) já existe → captura a frase falada do usuário.
- O texto falado vai pro `sentenceCoach`; o áudio vai pro **score de pronúncia** já existente.

### 2.5 UI — aba/modo "Produzir"
- Lista das frases capturadas → seleciona uma.
- Mostra as **palavras-chave** (chips). Toca a palavra → card de produção:
  - desafio ("Faça uma afirmação com *orange*"), botão **Falar** (grava), transcreve.
  - mostra **feedback + correção + exemplos** + o **score de pronúncia**.
- Progressão em escada (afirmar → perguntar → justificar) por palavra.

### 2.6 Camada de PRODUÇÃO (novo dado)
- `store`: por palavra/idioma, marcar `produced` (a pessoa formou frase correta com ela) — separado de
  `known` (reconhece). Métrica: "X palavras que você sabe USAR".
- Núcleo puro testável p/ decidir quando promover a palavra a "produzida".

---

## 3. Cache global de palavras por idioma (anti-gasto de token)
> Hoje o lookup de palavra é cacheado só **em memória, por sessão**. A MESMA palavra ("orange/en") é
> re-consultada na IA toda sessão → gasto repetido. Pior em escala (50 usuários repetindo as mesmas
> palavras comuns). Solução: cache **persistente** e, idealmente, **compartilhado entre usuários**.

### 3.1 Dois níveis
1. **Local persistente** (por usuário): guarda `lang:word → data` no store (ou arquivo) → sobrevive a
   sessões. Some o custo das repetições do MESMO usuário.
2. **Global compartilhado** (entre usuários) — via **Supabase** (já temos pra auth):
   - Tabela `word_cache(lang, word, kind, data jsonb, created_at)` — `kind` = lookup | keywords | examples.
   - Fluxo: ao precisar → **lê Supabase**; HIT → retorna (IA **R$0**). MISS → chama IA → **grava no
     Supabase + local**. O **1º usuário** que consulta "orange/en" popula pra **todos**.
   - Aplica bem a: **lookup de palavra**, **keywords**, **exemplos** (altamente repetíveis). A análise de
     frase inteira é menos cacheável (cada frase é única) — fica fora por enquanto.
3. **TTS** já tem cache em disco (por voz+texto) — manter.

### 3.2 Impacto
- As ~1000 palavras comuns de cada idioma são consultadas **uma vez no total** (não por usuário/sessão).
- Em escala, derruba o custo de lookup/keywords pra perto de **zero** depois do "aquecimento".

### 3.3 Implementação (camadas)
- Núcleo puro: `cacheKey(lang, word, kind)` + política (TTL? versão do prompt?).
- Serviço `wordCache`: get/set local + (opcional) Supabase. Wrapper em volta de `lookup`/`keywords`.
- Migração: o cache em memória atual vira leitura do cache persistente.

---

## 4. Revisão do que já temos (estado do projeto — 1º usuário a bordo)
**Captura/transcrição:** sistema dock + barra flutuante; VAD; **gravador overlap** (sem buraco);
**fila** (não descarta); **transcrição ao vivo** + typewriter; **trava de idioma** da sessão;
**retry no 429**; normalização de áudio; filtro anti-alucinação.
**Tutor/aprendizado:** análise por frase (vocab/tip/tradução **idiomática**), lookup de palavra,
SRS, perfil de pronúncia **por sessão**, **pronúncia nativa** (Wikimedia/Forvo) + TTS sotaques.
**App/distribuição:** ícone + splash; instalador NSIS (`npm run dist`); i18n pt/en.
**Pendências/known:**
- **Custo:** medir **tokens reais** (medidor mente ~16×) + **análise sob demanda** (vazamento principal).
- **Cache global** (este doc).
- **Kokoro** baixa na 1ª vez (avisar usuários).
- Reverter `MIN_SENTENCES_FOR_PROFESSOR` 10→50 (lembrete antigo).
- Build **Mac** só via macOS/CI (GitHub Actions) — não dá no Windows.

---

## 5. Ordem sugerida
1. **Cache global de palavras** (§3) — derruba custo JÁ, e a feature de produção se beneficia dele.
2. **Construtor de Frases MVP** (§1-2) — núcleo (prompts) → serviço/IPC → aba "Produzir" → camada de produção.
3. **Fix de custo** (medir token real + análise sob demanda) — fundação pro tier gerenciado.
4. Evoluções: reformular a frase, histórico de produção, programa de 30 dias.

> Relacionado: [[ai-conversation-coach]], [[monetization-model]].
