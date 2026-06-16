# Professor-IA (conversa) — progresso da implementação

> Diário de implementação da feature de conversa (spec: [PROFESSOR_IA_CONVERSA.md](PROFESSOR_IA_CONVERSA.md)).
> Cada incremento anota **o que foi feito** e **onde parou**. Tudo coberto por testes.

## Plano (fases da spec §6)
1. **MVP texto** — chat, contexto = frases da sessão, prompt "só pergunta + feedback", bolhas separadas. ← em andamento
2. Voz — resposta falada → transcreve → pontua.
3. Calibragem por nível (palavras conhecidas / i+1).
4. Persistência — salvar conversa, mandar frases boas pro SRS.

---

## Incremento 1 — Núcleo puro do prompt + parse ✅
**Arquivos:**
- `electron/lib/professorPrompt.ts` (novo): tipos `ProfessorMessage`/`ProfessorFeedback`/`ProfessorTurn`;
  `sessionContext()` (limita contexto), `trimHistory()` (limita histórico),
  `buildProfessorSystemPrompt()` (regras "language parent": SÓ pergunta + feedback estruturado,
  contexto numerado, diálogo TEACHER/STUDENT, saída JSON `{question, translation, feedback}`),
  `parseProfessorTurn()` (parse tolerante; descarta feedback vazio).
- `electron/lib/nativeLang.ts`: + `languageEnglishName()` e `targetLanguageEnglishName()` (idioma-alvo
  com fallback pro código quando não mapeado, ex.: 'th' → 'TH').

**Testes:** `electron/lib/professorPrompt.test.ts` (16) — contexto/histórico (limites, inválidos),
prompt (só-perguntar, idioma alvo/nativo, alvo desconhecido→código, contexto numerado, histórico,
JSON pedido) e parse (completo, sem-feedback na 1ª pergunta, só-better, filtra models, JSON inválido, trim).

**Parou em:** núcleo puro pronto e testado.

## Incremento 2 — Serviço + IPC + tipos ✅
**Arquivos:**
- `electron/services/tutorService.ts`: método `converse({ lang, level?, context, history, userMessage })`
  → lê `nativeLanguage` das settings, monta o system (contexto+histórico limitados), manda a fala do
  aluno como user (ou trigger de início na 1ª jogada) via `dispatch`, devolve `ProfessorTurn` parseado.
- `electron/ipc/tutorHandlers.ts`: handler `tutor:converse` (retorna `{ok, result?|error}`).
- `electron/preload.ts` + `src/services/electron.ts` (`tutorAPI.converse`) + `src/types/index.ts`
  (`ProfessorMessage`/`ProfessorFeedback`/`ProfessorTurn` + `IpcAPI.tutor.converse`).

**Testes:** `electron/services/tutorService.converse.test.ts` (7, mockando `electron` + `providerFetch`):
turno parseado, erro sem chave, trigger de início + contexto no system, fala do aluno como user,
idioma nativo/alvo aplicados, histórico TEACHER/STUDENT no system, JSON inválido → pergunta vazia.

**Parou em:** backend completo e testado.

## Incremento 3 — UI do chat (MVP texto) ✅
**Arquivos:**
- `src/components/ProfessorChat.tsx` (novo): modal de chat. Ao abrir, faz a 1ª pergunta
  (`converse` com `userMessage:''`). Bolhas distintas: 🟩 resposta do aluno, 🟦 pergunta da IA
  (com tradução + botão ouvir/TTS), 🟨 feedback (forma melhor + modelos). Entrada por texto
  (Enter/Enviar); mantém `history` (p/ a API) e `items` (p/ render); loading/erro com "tentar de novo".
- `src/windows/TutorBoard.tsx`: botão **"Conversar com o professor"** no header (quando há frases);
  abre o `ProfessorChat` com `lang` = idioma do conteúdo mais recente e `context` = todas as frases da sessão.

**Testes:** `src/components/ProfessorChat.test.tsx` (5, jsdom): mostra contexto + 1ª pergunta ao abrir;
enviar resposta → bolha do aluno + feedback + próxima pergunta (e manda histórico/userMessage certos);
não envia vazio; erro mostra "tentar de novo"; fechar chama `onClose`.

**Parou em:** MVP texto pronto (depois substituído por voz no Incremento 4).

## Incremento 4 — SPEAKING (voz) + limite de mensagens ✅
Pedido do usuário: é **speaking**, nada de digitação — o professor FALA e o aluno responde FALANDO;
e **limite de 50 mensagens** por conversa.
**Arquivos:**
- `src/lib/professorChat.ts` (novo): `MAX_CONVERSATION_MESSAGES = 50`, `conversationFull(count)`, `messagesLeft(count)`.
- `src/components/ProfessorChat.tsx` (reescrito): removida a digitação. Botão **"Falar"** reusa o
  `usePractice` (countdown → grava → Whisper transcreve → vira a fala do aluno → próxima pergunta).
  O professor **FALA a pergunta** automaticamente (TTS) e há botão para reouvir. Ao atingir o limite
  (history.length ≥ 50), mostra banner "conversa encerrada" e esconde o mic. `maxMessages` prop (default 50)
  p/ testabilidade. Cleanup do gravador (`cancel`) no unmount.

**Testes:** `src/lib/professorChat.test.ts` (7) — limite/restantes/bordas/customizado.
`src/components/ProfessorChat.test.tsx` (6, jsdom, mockando `usePractice`): sem campo de texto + botão Falar;
1ª pergunta + professor fala (TTS); falar resposta → bolha + feedback + próxima pergunta (history/userMessage certos);
transcrição vazia não envia; limite encerra (banner, sem mic); fechar chama onClose.

**Parou em:** **Fase 1 + Voz COMPLETAS** — 830 testes no total. Conversa 100% por voz, com limite de 50.
**Próximo (Fase 3):** calibrar o nível (i+1) usando `languageLevels`/palavras conhecidas no prompt.
**(Fase 4):** persistir a conversa / mandar frases boas pro SRS; opcional pontuar a fala (diff/pitch).

---

## Continuação Codex - correção do gate de 50 frases

Correção importante: **50 não é limite de mensagens da conversa**. É o mínimo de frases
capturadas na sessão para liberar o Professor.

**Arquivos ajustados:**
- `src/components/ProfessorChat.tsx`: removido o limite interno `maxMessages/conversationFull`.
  O modal de conversa não encerra por contagem de mensagens.
- `src/windows/TutorBoard.tsx`: o botão **Conversar com o professor** agora fica desabilitado
  até a sessão ter 50 frases; antes disso mostra `Professor em X frases`.
- `src/components/ProfessorChat.test.tsx`: teste antigo de limite de mensagens foi trocado para
  garantir que o modal não aplica limite interno.

**Verificado:**
- `npm test -- src/components/ProfessorChat.test.tsx src/lib/professorChat.test.ts electron/lib/professorPrompt.test.ts electron/services/tutorService.converse.test.ts`
- `npx tsc --noEmit`

**Próximo:** calibrar o prompt com nível do aluno (`languageLevels`) e palavras conhecidas; depois
persistência da conversa/SRS.
