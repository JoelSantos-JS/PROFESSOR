# Plano — Melhorias de Listening & Speaking (insights do criador)

> Origem: transcrição de um criador de conteúdo (capturada no app) criticando apps de IA e
> recomendando práticas. As falas dele **validam nosso diferencial** e apontam ganhos concretos.
> Complementa [IDEIAS_UTELL.md](IDEIAS_UTELL.md). Cada item segue o padrão:
> **núcleo puro testável → serviço/IPC → UI → bateria de testes**, anotando progresso.

## As falas → o que tiramos
1. "AI interpreta sua fala como TEXTO, não corrige pronúncia." → reforça nosso #2 (diagnóstico de áudio real).
2. "AI ignora erros e dá elogio falso → você fica confortável errando." → **Professor corretivo** (sem elogio vazio).
3. "Só uso AI pra gerar material de listening/reading (NotebookLM: YouTube→podcast no seu nível)." → #5 importar mídia.
4. "Se tá rápido, reduzo pra **0.8x** (sweet spot) e ouço acompanhando o texto." → **velocidade de playback** + read-along (já temos karaokê).
5. "Comprehension é a base." → nosso pilar (% compreensão / i+1).
6. "Pra FALAR, precisa de gente real (intercâmbio)." → posicionar o Professor-IA como **andaime** (treino ilimitado com correção real).

---

## ⭐ Item 1 — Velocidade de listening (0.8x) [QUICK WIN]
**Objetivo:** ouvir o **Original** e o **TTS** mais devagar (0.8x sweet spot), com a opção de 0.7/0.9/1.0.

**Núcleo puro (novo):** `src/lib/playbackSpeed.ts`
- `PLAYBACK_SPEEDS = [1, 0.9, 0.8, 0.7]`, `DEFAULT_SPEED = 1`.
- `normalizeSpeed(v)` (clampa a um valor válido), `nextSpeed(v)` (cicla 1→0.9→0.8→0.7→1), `speedLabel(v)` ("0.8×").
- **Testes:** clamp, ciclo, rótulo, valores inválidos.

**Persistência:** `settings.playbackSpeed` (string, default '1') — electron `settingsService` DEFAULTS + `AppSettings`
(electron) + `AppSettings` (renderer). Lido na hora de tocar.

**Playback:** `src/lib/playClip.ts` → `PlayOpts.rate?` (additivo): `audio.playbackRate = rate ?? 1`.
`speak()` (TutorBoard/TTS) aceita `rate`. (O Loop já tem velocidade graduada — não muda.)

**UI:** botão de ciclo de velocidade no **TutorBoard** (cabeçalho ou ao lado dos chips de áudio: "1× / 0.9× / 0.8× / 0.7×")
+ aplicar em `handleOriginal`/`handleListen`. Também no **AutoPractice** (FloatingBar) se houver tempo.

**Esforço:** Baixo. **Risco:** baixo (playClip change é additivo).

---

## ⭐ Item 2 — Professor corretivo (sem elogio falso) [QUICK WIN]
**Objetivo:** o Professor **aponta o erro** da resposta do aluno (gentil mas honesto) e **nunca** dá elogio vazio.

**Núcleo puro:** `electron/lib/professorPrompt.ts`
- `ProfessorFeedback` ganha `issue?: string` (o que estava errado; "" quando não há erro).
- Prompt: adicionar `issue` ao JSON + **regras**: "Be honest. If the answer has mistakes, state them clearly and
  kindly in `issue` (the student's native language). NEVER give empty praise. If it's already correct, `issue` = ''
  and say so briefly." `better` continua sendo a forma correta/natural.
- `parseProfessorTurn`: parsear `issue` (trim; só inclui se houver).
- **Testes:** prompt contém a regra anti-elogio + `issue`; parse de `issue` (presente/ausente/trim).

**Tipos + UI:** `src/types/index.ts` `ProfessorFeedback.issue?`; `ProfessorChat.tsx` renderiza o `issue`
(linha "⚠ O que ajustar" antes da "Forma melhor"). **Teste (jsdom):** feedback com `issue` mostra a linha.

**Esforço:** Baixo. **Risco:** baixo (prompt+type aditivos; `ProfessorChat` é co-editado → edição mínima e aditiva).

---

## Item 3 — Diagnóstico de pronúncia (#2 do IDEIAS_UTELL) [médio, depois]
Ver plano detalhado em [IDEIAS_UTELL.md](IDEIAS_UTELL.md) (Plano #2). Reforçado pela fala nº1 do criador:
"a IA que **ouve seu som de verdade**" (pitch/DTW/diff), não só texto. É o nosso moat — priorizar após os quick wins.

## Item 4 — Importar vídeo/link (#5 do IDEIAS_UTELL) [médio, depois]
Workflow NotebookLM dele: subir um vídeo/link → virar material de estudo no nível. Ver Plano #5.

---

## Ordem de execução
1. **Item 1 (velocidade 0.8x)** — agora.
2. **Item 2 (Professor corretivo)** — agora.
3. Item 3 (diagnóstico) → Item 4 (importar) — em seguida.

## Progresso
- [x] **Item 1 — velocidade de listening** ✅ `playbackSpeed.ts` (7 testes) + `playClip.rate` + `speak.rate` +
  botão de ciclo no TutorBoard (1×/0.9×/0.8×/0.7×, persiste em `settings.playbackSpeed`). (Falta opcional: AutoPractice da barra.)
- [x] **Item 2 — Professor corretivo** ✅ `professorPrompt`: campo `issue` + regras "BE HONEST / never give empty
  praise / corrigir a resposta INTEIRA, sem citar errado nem implicar com fragmento" (Codex reforçou); render
  "O que ajustar" no `ProfessorChat`. Testes em `professorPrompt.test.ts` + `ProfessorChat.test.tsx`.
- [ ] Item 3 — diagnóstico de pronúncia
- [ ] Item 4 — importar vídeo/link

> Estado: **903 testes passando**, type-check limpo. Itens 1 e 2 prontos.
