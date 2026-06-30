# Ideias novas — backlog (capturado em 2026-06-30)

Lote de ideias trazidas pelo Joel (3 do texto + 3 de prints de referência de outros apps).
Aqui é só **catálogo** — nada implementado ainda. Cada item tem: **o que é**, **por que vale**,
**como caberia no Soaken** e a **referência**.

Índice:
1. [Categorizar sessões por série ou tópico](#1-categorizar-sessões-por-série-ou-tópico)
2. [Resumir uma sessão (com IA)](#2-resumir-uma-sessão-com-ia)
3. [Detalhe de tradução em camadas (mental → literal → natural → casual)](#3-detalhe-de-tradução-em-camadas)
4. [Configuração de provedores de IA (cards multi-provedor)](#4-configuração-de-provedores-de-ia-cards-multi-provedor)
5. [Escolha de modelo de transcrição por tarefa](#5-escolha-de-modelo-de-transcrição-por-tarefa)
6. [Whisper local (offline, download de modelos)](#6-whisper-local-offline-download-de-modelos)

---

## 1. Categorizar sessões por série ou tópico

**O que é:** agrupar as sessões por **série/conteúdo** (ex.: *Crash Landing on You · ep.4*) ou por
**tópico** (ex.: "viagem", "trabalho", "namoro"), em vez de só uma lista cronológica.

**Por que vale:**
- Continuar de onde parou numa série ("ep.5" depois do "ep.4").
- Revisar uma **série inteira** (todo o vocabulário/frases daquele show).
- Ver progresso **por conteúdo** ("já fiz 4 episódios de CLOY").
- Dá identidade ao histórico — a pessoa lembra do contexto pelo nome da série.

**Como caberia no Soaken:**
- As sessões **já têm título/fonte** (o Dashboard mostra "Crash Landing on You · ep.4"). Falta um
  campo de **série** + **tópico/tag** e uma visão agrupada.
- Tela "Sessões recentes" → agrupar por série (accordion) + filtro por tópico.
- A IA pode **sugerir o tópico** automaticamente a partir das frases da sessão.

**Referência:** pedido do Joel + o nome de sessão que já aparece no Dashboard.

---

## 2. Resumir uma sessão (com IA)

**O que é:** ao finalizar uma sessão, gerar um **resumo** dela: principais frases, vocabulário novo,
pontos de gramática, e "o que praticar".

**Por que vale:**
- Fecha o ciclo da sessão com um **cartão revisável** (estágio de retenção).
- A pessoa bate o olho e relembra a sessão inteira sem reler tudo.
- Vira material de **revisão** e alimenta o SRS.

**Como caberia no Soaken:**
- Botão "Resumir sessão" (ou automático no fim) → IA gera: 3–5 frases-chave, 5–10 palavras novas,
  1–2 notas de gramática, e 1 "foco de prática".
- Salva junto da sessão; aparece em "Sessões recentes" e na Revisão.
- Conecta com a [ideia 1](#1-categorizar-sessões-por-série-ou-tópico) (resumo por episódio) e com o
  Professor-IA (conversar sobre o resumo).

**Referência:** pedido do Joel.

---

## 3. Detalhe de tradução em camadas

**(mental → literal → natural → casual)**

**O que é:** ao explicar uma frase, mostrar **como um pensamento vira o idioma-alvo em níveis**:

```
Português mental:   Eu estou com muita vontade de aprender inglês.
Tradução literal:   I am with much desire to learn English.
Natural:            I really want to learn English.
Mais casual:        I'm really into learning English right now.
```

**Por que vale:**
- Ensina a **NÃO traduzir ao pé da letra** — mostra explicitamente onde a estrutura PT "quebra".
- A camada **literal** expõe a diferença gramatical; a **natural** e a **casual** dão registro real.
- Diferencial pedagógico forte: ataca o erro nº 1 de quem aprende (pensar na língua materna e
  traduzir literal).

**Como caberia no Soaken:**
- Novo formato de "explicação" no Tutor Board / Professor-IA: 4 linhas rotuladas
  (mental · literal · natural · casual), com áudio em cada versão final.
- Pode ser **bidirecional**: parte de um pensamento em PT do aluno → mostra as 4 camadas no alvo.
- Casa com o foco "fala natural" e com a prática de output.

**Referência:** exemplo escrito pelo Joel.

---

## 4. Configuração de provedores de IA (cards multi-provedor)

**O que é:** uma tela de **provedores em cards**, cada um com status **Connected / Not Connected** e
botão de configurar. Provedores do print de referência:
- **ChatGPT Plus** — login na conta ChatGPT Plus/Pro (sem chave de API).
- **OpenAI API** — chave de dev (GPT-4o, etc.).
- **Google Gemini** — chave (Gemini 2.5 Pro/Flash).
- **OpenRouter** — uma conexão → centenas de modelos.
- **Custom API** — endpoint **compatível com OpenAI** (vLLM, LocalAI, self-hosted).

**Por que vale:**
- UX muito mais clara que um formulário de chaves (status visível por provedor).
- **OpenRouter** = acesso a dezenas de modelos sem gerenciar várias chaves.
- **Custom API** = quem roda modelo local/empresa pluga o próprio endpoint.
- **ChatGPT sign-in** = usar a assinatura que a pessoa já paga, sem chave.

**Como caberia no Soaken:**
- Já temos **BYOK multi-provedor** (Groq/OpenAI/Gemini/Anthropic). Isso é um **upgrade de UX**
  (cards + status) + **OpenRouter** + **endpoint custom** + **login ChatGPT**.
- Encaixa nos tiers: BYOK (cards) vs Gerenciado (a gente fornece) — ver `monetization-model`.

**Referência:** print 1 (ChatGPT Plus / OpenAI API / Gemini / OpenRouter / Custom API).

---

## 5. Escolha de modelo de transcrição por tarefa

**O que é:** separar a configuração por **tarefa** (abas **Transcription / Analysis / Translation**) e,
na transcrição, **escolher o modelo**:
- **OpenAI**: *GPT Realtime Whisper* (baixa latência), *GPT-4o Transcribe* (mais preciso),
  *GPT-4o Mini Transcribe* (mais barato/rápido).
- **Gemini**: transcrição multilíngue.
- Trava: **"pare a transcrição para trocar o modelo"**.

**Por que vale:**
- Cada tarefa tem trade-off diferente (latência vs precisão vs custo) — deixar o usuário escolher.
- Transparência: a pessoa entende qual modelo faz o quê.

**Como caberia no Soaken:**
- Já temos fonte de transcrição configurável; isto é um **seletor de modelo mais rico**, organizado
  por tarefa (transcrição, análise, tradução).
- A trava "pare pra trocar" evita trocar modelo no meio de uma captura ao vivo.

**Referência:** print 2 (abas Transcription/Analysis/Translation + cards OpenAI/Gemini).

---

## 6. Whisper local (offline, download de modelos)

**O que é:** transcrição **local com Whisper** — sem chave, offline, privado. Baixar modelos sob
demanda e escolher qual usar:
- **Whisper Large v3** (~2.9 GiB · ~4.7 GB RAM) — maior precisão local.
- **Whisper Large v3 Turbo** (~1.5 GB · ~3 GB RAM) — turbo, fallback rápido.
- Toggle **aceleração GPU (Vulkan)**.
- Mostrar **SELECTED / DOWNLOADED / GPU / STORAGE**.

**Por que vale:**
- **Sem custo e sem chave** → transcrição gratuita de verdade (ótimo pro tier Free).
- **Privacidade/offline** — nada sai da máquina.
- Combina com a estratégia que já seguimos: **Kokoro local** (voz) embutido. Whisper local fecha o
  par "fala + escuta" 100% offline.

**Como caberia no Soaken:**
- Engine de transcrição local opcional (download gerenciado dos modelos, igual fazemos com o Kokoro).
- GPU Vulkan opcional pra acelerar; fallback CPU.
- Reforça o **tier Free totalmente offline** (Kokoro + Whisper local, sem BYOK).

**Referência:** print 3 (Whisper Transcription, download Large v3 / v3 Turbo, GPU Vulkan).

---

## Como esses itens se conectam

- **1 + 2** = organização e retenção do histórico (séries → resumo → revisão).
- **3** = qualidade pedagógica do ensino (fala natural, anti-tradução-literal).
- **4 + 5 + 6** = infra de IA (mais provedores, escolha de modelo, **e a opção 100% offline/grátis**).
- **6** casa direto com o `monetization-model`: Kokoro local + Whisper local = um **Free offline real**.

> Próximo passo sugerido: priorizar 1–3 desses pro próximo ciclo. Os de **maior impacto/menor custo**
> tendem a ser **#2 (resumo)** e **#3 (camadas de tradução)** — reaproveitam a IA que já chamamos.
