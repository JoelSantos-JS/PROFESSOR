# PROFESSOR - Plano de sessao do usuario e janela de contexto/tokens

> Plano futuro para adicionar duas features parecidas com a referencia da imagem:
>
> 1. **Sessao do usuario:** um painel vivo da sessao atual de estudo/conversa.
> 2. **Contexto e tokens:** uma janela mostrando quanto contexto foi usado, quantas mensagens
>    estao na sessao e quanto a API propria do usuario esta gastando.
>
> Observacao: este plano nao e o mesmo que autenticacao/login. Autenticacao esta em
> [PLANO_AUTENTICACAO.md](PLANO_AUTENTICACAO.md). Aqui falamos da sessao de uso dentro do app.

---

## 1. Objetivo

Dar ao usuario consciencia do que esta acontecendo na sessao:

- quantas frases/transcricoes foram capturadas;
- quantas mensagens foram trocadas com o professor;
- quanto contexto esta sendo enviado para o modelo;
- quanto falta antes do contexto ficar cheio;
- quanto ele esta gastando usando a propria chave de API;
- quando vale compactar/resumir a sessao para economizar tokens.

Resumo: o app deve deixar claro que "memoria de sessao" e "gasto de API" existem, sem assustar o
usuario iniciante.

---

## 2. Feature A - Sessao do usuario

### 2.1. O que aparece na UI

Criar uma aba/painel **Sessao** com:

- horario de inicio da sessao;
- tempo ativo;
- idioma detectado/idioma de estudo;
- frases capturadas;
- frases praticadas;
- tentativas de pronuncia;
- professor aberto ou nao;
- mensagens com o professor;
- palavras novas encontradas;
- palavras marcadas como `Conheco`, `Aprendendo`, `Ignorar`;
- resumo curto da sessao.

### 2.2. Estado minimo da sessao

Modelo sugerido:

```ts
interface UserStudySession {
  id: string
  startedAt: number
  endedAt?: number
  activeLang?: string
  capturedPhraseIds: string[]
  practiceAttemptIds: string[]
  professorMessageIds: string[]
  knownWordsAdded: number
  learningWordsAdded: number
  ignoredWordsAdded: number
  summary?: string
}
```

### 2.3. Onde salvar

MVP:

- salvar localmente no `store.json`;
- manter somente as sessoes recentes completas;
- salvar resumo das sessoes antigas para nao crescer sem limite.

Depois:

- sincronizar com conta do usuario quando autenticacao/back-end existir;
- permitir buscar sessoes antigas por data/idioma/topico.

### 2.4. UI recomendada

No Dashboard:

- card "Sessao atual";
- botao "Ver sessao";
- contador de frases, tentativas e tempo.

Na Floating Bar:

- badge pequeno tipo `00:03:14`;
- indicador se a sessao esta gravando/capturando;
- botao para abrir painel de sessao.

No Tutor Board:

- aba "Sessao";
- historico das frases capturadas;
- tentativas feitas;
- professor relacionado aquela sessao.

---

## 3. Feature B - Janela de contexto/tokens

### 3.1. O que o usuario ve

Painel parecido com:

- **Contexto usado:** `3.678 / 50.000 (7%)`
- **Mensagens na sessao:** `63`
- **Custo estimado:** `$0.013`
- **Provider ativo:** `Gemini / OpenAI / Groq / Anthropic`
- botao **Compactar agora**
- aviso quando passar de 70%, 85% e 95%

### 3.2. Diferenca entre tokens e dinheiro

Mostrar dois niveis:

- **Tokens de contexto:** quanto cabe na janela do modelo antes de precisar resumir.
- **Custo de API:** quanto o usuario provavelmente gastou com a propria chave.

Importante: no modelo BYOK, o custo real fica na conta do usuario no provider. O app consegue
mostrar uma estimativa local, e quando o provider retornar `usage`, mostrar algo mais preciso.

---

## 4. Como medir tokens

### 4.1. Quando o provider retorna usage

Usar o valor oficial retornado pela API:

```ts
interface ProviderUsage {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  cachedInputTokens?: number
}
```

Salvar isso em cada chamada:

```ts
interface AiCallUsage {
  id: string
  sessionId: string
  provider: ProviderId
  model: string
  feature: 'analysis' | 'lookup' | 'professor' | 'tts' | 'transcription'
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cachedInputTokens?: number
  estimated: boolean
  costUsd?: number
  createdAt: number
}
```

### 4.2. Quando o provider nao retorna usage

Usar estimativa local:

- texto latino: aproximar `chars / 4`;
- CJK/coreano/japones/chines: usar estimativa mais conservadora, por exemplo `chars / 2`;
- mensagens estruturadas: somar system prompt + historico + contexto + resposta esperada.

Isso deve ser marcado como `estimated: true`.

### 4.3. Onde calcular

Criar um modulo puro:

- `src/lib/tokenEstimate.ts`
- `src/lib/tokenBudget.ts`
- testes em `src/lib/tokenEstimate.test.ts`

Exemplo:

```ts
estimateTokens(text, lang)
contextPercent(used, limit)
shouldWarnContext(percent)
```

---

## 5. Como calcular custo

### 5.1. Tabela local de precos

Criar tabela por provider/modelo:

```ts
interface ModelPricing {
  provider: ProviderId
  model: string
  inputPer1M: number
  outputPer1M: number
  cachedInputPer1M?: number
  currency: 'USD'
  updatedAt: string
}
```

Arquivo sugerido:

- `src/lib/modelPricing.ts`

### 5.2. Aviso de precisao

Mostrar no app:

- "Estimativa local. Confira o valor final no painel do provider."

Isso e importante porque:

- precos mudam;
- alguns providers aplicam cache/desconto;
- chamadas podem falhar e nao cobrar;
- algumas APIs retornam usage de formas diferentes.

### 5.3. BYOK: usando a chave do proprio usuario

Como o usuario usa a propria API:

- nunca enviar a chave para nosso servidor no modo local;
- calcular custo no desktop;
- salvar usage localmente;
- mostrar link para o dashboard do provider;
- permitir resetar estatisticas locais.

---

## 6. Compactacao de contexto

### 6.1. Quando compactar

Regras sugeridas:

- 70%: aviso suave;
- 85%: recomendar compactar;
- 95%: compactar automaticamente antes da proxima chamada pesada;
- professor com muitas mensagens: resumir historico antigo.

### 6.2. Como compactar

Criar resumo da sessao:

```ts
interface SessionCompaction {
  id: string
  sessionId: string
  beforeMessageCount: number
  afterMessageCount: number
  beforeTokens: number
  afterTokens: number
  summary: string
  createdAt: number
}
```

Resumo deve preservar:

- idioma;
- nivel do usuario;
- topicos conversados;
- palavras novas;
- erros recorrentes;
- pronuncias problemáticas;
- preferencias do usuario;
- objetivo atual da sessao.

### 6.3. Prompt de compactacao

O prompt deve pedir resumo curto, estruturado e reutilizavel:

```text
Resuma a sessao para continuar uma conversa de estudo de idioma.
Preserve fatos do usuario, erros recorrentes, palavras novas, nivel, idioma,
objetivos e o que o professor deve perguntar em seguida.
Nao inclua dados sensiveis desnecessarios.
```

---

## 7. Arquitetura sugerida

### 7.1. Electron main

Novos servicos:

- `electron/services/sessionService.ts`
- `electron/services/usageService.ts`
- `electron/ipc/sessionHandlers.ts`
- `electron/ipc/usageHandlers.ts`

Responsabilidades:

- criar/encerrar sessao;
- registrar chamadas de IA;
- registrar mensagens do professor;
- calcular totais por sessao;
- persistir no store;
- expor dados seguros para o renderer.

### 7.2. Renderer

Novos componentes:

- `src/components/SessionContextPanel.tsx`
- `src/components/TokenBudgetMeter.tsx`
- `src/components/UsageCostBadge.tsx`
- `src/components/CompactContextButton.tsx`

Possiveis telas:

- Floating Bar: badge pequeno de tempo + tokens.
- Tutor Board: aba Sessao.
- Professor Chat: medidor de contexto no topo.
- Settings: configuracao de limite/alertas.

### 7.3. Tipos

Adicionar em `src/types/index.ts`:

```ts
interface SessionUsageSummary {
  sessionId: string
  contextUsed: number
  contextLimit: number
  contextPct: number
  messageCount: number
  estimatedCostUsd: number
  byFeature: Record<string, number>
  byProvider: Record<string, number>
}
```

---

## 8. MVP recomendado

### Fase 1 - Medidor visual sem custo real

- criar `TokenBudgetMeter`;
- estimar tokens localmente;
- mostrar `Contexto usado X / Y`;
- contar mensagens da sessao;
- botao visual "Compactar agora" ainda desabilitado ou mockado;
- testes das funcoes puras.

### Fase 2 - Usage real por provider

- capturar `usage` das respostas do Gemini/OpenAI/Groq/Anthropic quando disponivel;
- armazenar por chamada;
- mostrar total por sessao;
- separar estimado vs oficial.

### Fase 3 - Custo estimado

- criar tabela de precos por modelo;
- calcular custo por chamada;
- painel "gasto estimado hoje/sessao/mes";
- aviso BYOK.

### Fase 4 - Compactacao real

- gerar resumo da sessao;
- substituir historico antigo por resumo;
- mostrar antes/depois dos tokens;
- permitir desfazer apenas enquanto a sessao esta aberta.

### Fase 5 - Historico de sessoes

- listar sessoes antigas;
- abrir resumo;
- exportar Markdown/JSON;
- usar resumo antigo como contexto do Professor.

---

## 9. Testes necessarios

### Testes unitarios

- estimativa de tokens para texto latino;
- estimativa de tokens para CJK;
- porcentagem de contexto;
- gatilhos de alerta 70/85/95;
- custo por input/output/cached;
- soma por provider;
- soma por feature.

### Testes de integracao

- chamada de tutor salva usage;
- professor salva mensagens e usage;
- compactacao reduz tokens;
- app nao quebra quando provider nao retorna usage;
- custo estimado aparece como estimado.

### Testes de seguranca/privacidade

- chave BYOK nao aparece no renderer alem do necessario;
- logs nao salvam API key;
- usage nao salva prompt completo quando nao precisa;
- exportacao nao inclui segredos;
- reset de estatisticas remove usage local.

---

## 10. Riscos e decisoes

### Risco: custo estimado errado

Mitigacao:

- marcar como estimativa;
- salvar `updatedAt` da tabela de precos;
- permitir editar/desativar precos no Settings.

### Risco: assustar usuario iniciante

Mitigacao:

- mostrar o medidor de forma compacta;
- esconder detalhes avancados atras de um clique;
- texto simples: "Contexto usado" e "Estimativa de custo".

### Risco: salvar dados demais

Mitigacao:

- salvar usage numerico por padrao;
- salvar resumos, nao prompts inteiros;
- permitir apagar historico;
- futura criptografia/sync segura.

### Risco: compactacao perder informacao importante

Mitigacao:

- prompt estruturado;
- guardar resumo anterior;
- compactar apenas historico antigo;
- preservar ultimas mensagens completas.

---

## 11. Ordem recomendada para implementar

1. Criar tipos de sessao e usage.
2. Criar funcoes puras de token/custo.
3. Adicionar painel visual simples no Professor/Floating Bar.
4. Registrar usage estimado por chamada.
5. Ler usage real dos providers.
6. Mostrar custo estimado.
7. Implementar compactacao manual.
8. Implementar compactacao automatica por limite.
9. Adicionar historico de sessoes.

---

## 12. Resultado esperado

O usuario deve conseguir responder rapidamente:

- "Quanto contexto eu ja usei?"
- "Quantas mensagens tem essa sessao?"
- "Quanto isso esta me custando?"
- "Quando preciso compactar?"
- "O que aconteceu nessa sessao?"

Essa feature tambem prepara o app para plano pago futuro, porque cria a base de medicao de uso,
limites, custo, sessao e historico.
