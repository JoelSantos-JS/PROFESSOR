# Cobertura de testes — features implementadas (para o Codex)

> Documento-guia para o Codex escrever/ampliar a cobertura de testes das features que implementei nesta leva.
> Tudo abaixo já compila (`npx tsc --noEmit` limpo no renderer) e a suíte atual passa: **723 testes / 39 arquivos** (`npx vitest run`).
> O objetivo deste doc é mapear **contrato → o que já está testado → o que falta**.

## Como rodar
```bash
cd tutor-pc
npm run build                       # build real usado como gate principal
npm test                            # tudo (alias do vitest run --reporter=verbose)
npx vitest run                       # tudo
npx vitest run src/lib/kana.test.ts  # um arquivo
npx tsc --noEmit                     # type-check renderer
npx tsc --noEmit -p tsconfig.node.json   # electron (tem erros PRÉ-EXISTENTES não relacionados)
```

### Status verificado pelo Codex (2026-06-05)
- `npm test`: **642 testes / 31 arquivos**, passando.
- `npm run build`: passando.
- `npx tsc --noEmit`: passando.
- `npx tsc --noEmit -p tsconfig.node.json`: falha atualmente. Nao tratar como gate ate
  alinhar o tsconfig Electron/ESM; alguns erros sao antigos, mas outros refletem codigo novo
  como `ttsService.ts`/worker Kokoro.
- Gate pratico atual recomendado: `npm run build` + `npm test` + `npx tsc --noEmit`.

### Atualização (leva onboarding/BYOK + bateria de UI)
- Suíte agora: **723 testes / 39 arquivos**, passando; `npx tsc --noEmit` (renderer, **inclui os `.tsx` de teste**) limpo.
- jsdom + @testing-library instalados → componentes agora testáveis (ver §6 e a nota de ambiente).

### Notas de ambiente (importante p/ planejar os testes)
- `vite.config.ts` → `test.environment: 'node'` (default global). **jsdom + @testing-library JÁ ESTÃO instalados** (`jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, `@testing-library/jest-dom` como devDeps).
  - ⇒ Para testar **componentes React / hooks**: adicione `// @vitest-environment jsdom` na 1ª linha do arquivo e `import '@testing-library/jest-dom/vitest'`. Padrões prontos para copiar: `src/components/Onboarding.test.tsx`, `src/windows/Settings.test.tsx`, `src/windows/Dashboard.test.tsx` (mock de `../services/electron` via `vi.hoisted` + `userEvent`).
  - Os testes puros continuam em `node` (não precisam do docblock) — mais rápidos.
- Testes de **serviços electron** (`electron/services/*.ts`) que importam `electron` precisam de `vi.mock('electron', …)` com **`vi.hoisted`** (vide armadilha resolvida em `storeService.knownWords.test.ts` — sem `vi.hoisted` o factory içado captura valor vazio e todos os testes vazam para o mesmo arquivo).

---

## 1) Palavras conhecidas + % de compreensão

### Núcleo puro — `src/lib/comprehension.ts`  ✅ já testado (`comprehension.test.ts`, 26)
Contrato (já coberto, só revisar): `normalizeKnownWord`, `comprehensionPct`, `unknownWords`, `unknownCount`, `isPlusOne`, `nextMilestone`, `estimatedCoverage`, `KNOWN_MILESTONES`. `'ignore'` conta como conhecida; `'learning'` NÃO.

### Normalização de idioma — `src/hooks/useKnownWords.tsx` › `baseLang`  ✅ testado (`useKnownWords.test.ts`, 5)
`baseLang('zh-CN') === 'zh'`, caixa, vazio/undefined → `''`.

### Store — `electron/services/storeService.ts`  ✅ parcialmente testado (`storeService.knownWords.test.ts`, 9)
Métodos novos: `getKnownWords(lang)`, `setWordStatus(lang, word, status)`, `knownCount(lang)`. Chave interna `` `${canonicalLang(lang)}:${word}` ``.
**Bug REAL corrigido** (regressão a guardar): `load()` fazia `{ ...EMPTY, ...parsed }`, o que **aliasava** os objetos aninhados compartilhados (`known`/`mistakes`); a 1ª escrita poluía o `EMPTY` do processo inteiro. Agora `load()` constrói o `StoreData` campo a campo.

**Faltam testes (sugestões):**
- [ ] `load()` **não polui** o `EMPTY` entre instâncias quando `store.json` existe **sem** a chave `known`/`mistakes` (regressão do bug acima): criar store, gravar `known`, criar 2ª instância e garantir isolamento — e que `mistakes` também não vaza.
- [ ] `recordMistakes` em arquivo sem `mistakes` não muta estado global (mesma raiz).
- [ ] Migração de idioma legível no `known`? (hoje as chaves de `known` **não** são re-canonicalizadas no `load`, diferente de `vocab`/`mistakes`; decidir se é desejado e cobrir.)

### Provider/Contexto — `src/hooks/useKnownWords.tsx` › `KnownWordsProvider`/`useKnownWords`  ❌ sem teste
Contrato: `ensureLang` (idempotente; só 1 fetch por idioma via `requested` ref), `statusOf`, `statusMap` (Map memoizado por idioma enquanto o record não muda), `setStatus` (otimista + persiste, status `''` remove), `knownCount`.
**Faltam (precisa jsdom + testing-library, mock de `storeAPI`):**
- [ ] `ensureLang` chama `storeAPI.knownWords` 1× por idioma mesmo com múltiplos consumidores.
- [ ] `setStatus` atualiza o Map otimisticamente **antes** da Promise resolver e persiste com a palavra normalizada.
- [ ] `statusMap` retorna a MESMA referência enquanto o record não muda (memo) e nova ref após `setStatus`.

### UI — `TutorBoard.tsx`: `ComprehensionBadge`, `KnownStat`, coloração em `SyncedTranscript`, botões de status no `WordPopover`  ❌ sem teste
**Faltam (jsdom):**
- [ ] `ComprehensionBadge`: 100% (verde), `newWords===1` (âmbar “+1”), faixas ≥60 / <60.
- [ ] `KnownStat`: agrupa idiomas distintos, só mostra os com `count>0`, formata cobertura/próximo marco.
- [ ] `SyncedTranscript`: classe por status (`known`/`ignore` esmaecido, `learning` tracejado âmbar, nova normal) e título por status.
- [ ] `WordPopover`: clicar “Conheço/Aprendendo/Ignorar” chama `onSetStatus(value)`; clicar no já-ativo manda `''` (toggle off).

---

## 2) Japonês — Furigana

### `src/lib/kana.ts`  ✅ testado (`kana.test.ts`, 20)
`isHiragana/isKatakana/isKana/isKanji/isJapanese`, `kataToHira`/`hiraToKata`, `splitMora`/`moraCount`, `kanaToRomaji` (Hepburn determinístico: sokuon っ, っち→tch, ん com apóstrofo, ー).
**Sugestões extras (lacunas conhecidas):**
- [ ] `kanaToRomaji` com を (hoje mapeado a `o`), ぢ/づ (`ji`/`zu`), ゔ (`vu`), e ー no INÍCIO (sem vogal anterior → ignora).
- [ ] `splitMora` com vogais pequenas (ぁぃぅぇぉ/ァ…) combinando; っ no fim de palavra.

### `src/lib/furigana.ts` › `buildFurigana(surface, reading)`  ✅ testado (`furigana.test.ts`, 22)
Retorna `{ segments: {text, reading?, kanji}[], confident, hasKanji }`. Kana ancora; kanji absorve a leitura entre âncoras; `confident=false` quando não fecha (UI cai pro romaji).
**Limitação conhecida a documentar em teste (não é bug):** quando a leitura do kanji TERMINA com a mesma kana do okurigana seguinte, o split greedy pode cortar cedo (ex.: leitura do kanji = `あべ` + okurigana `べ`). Vale um teste que **documente** o comportamento atual.
**Sugestões extras:**
- [ ] Superfície com dígitos/ASCII no meio (`ABCねこ123`) — já há um teste de robustez genérico; adicionar asserções de `confident=false`/segmentos.
- [ ] Leitura em katakana (não hiragana) ainda alinhando via `kataToHira`.

### Pipeline `reading` — `electron/lib/tutorPrompt.ts`  ✅ testado (`tutorPrompt.test.ts`)
`isJapaneseLang`; `buildSystemPrompt('ja')` inclui campo `"reading"` (HIRAGANA, MANDATORY); omitido p/ não-japonês.
**Faltam:**
- [ ] `tutorService.analyze` repassa `reading` do JSON para `TutorAnalysis` e cai p/ `undefined` quando ausente/JSON inválido → **mockar `dispatch`/`callProvider`** (ver §5).

### UI — `src/components/Furigana.tsx`  ❌ sem teste (jsdom)
- [ ] Não renderiza nada quando `!confident` ou `!hasKanji` (retorna `null`).
- [ ] Renderiza `<ruby><rt>` só nos segmentos kanji; `onWordClick` recebe `(seg.text, i, start, end)` com razões por nº de chars.

---

## 3) Japonês — Acento tonal (pitch accent)

### `src/lib/pitchAccent.ts`  ✅ testado (`pitchAccent.test.ts`, 21)
`accentType`, `pitchPattern(moraCount, accent)` → `{ moras: ('H'|'L')[], particleHigh, type, accent, moraCount }`, `pitchForKana`, `accentTypeLabel`. Regras de Tóquio (heiban/atamadaka/nakadaka/odaka); odaka≡heiban nas moras, difere na partícula; clamp de accent.
**Sugestões extras:**
- [ ] Tabela paramétrica para N=1..5 cruzando todos os `accent` (0..N) validando o invariante “mora1≠mora2” e a posição única do downstep.

### Pipeline — `electron/lib/tutorPrompt.ts` › `buildLookupPrompt`  ✅ testado
Para `ja`: pede `"reading"` (hiragana) + `"pitchAccent"` (inteiro, 0=heiban). Omitido p/ outros idiomas.
**Faltam:**
- [ ] `tutorService.lookup` parseia `reading`/`pitchAccent` e **só** aceita `pitchAccent` numérico (string/null → `undefined`). Mockar `dispatch`.

### UI — `src/components/PitchAccent.tsx`  ❌ sem teste (jsdom; geometria SVG)
- [ ] Nº de pontos = nº de moras + 1 (partícula); altura alta/baixa coerente com o padrão; partícula oca alta só no heiban.
- [ ] Considerar extrair o cálculo de pontos (`xOf/yOf/linePath`) para função pura testável sem DOM.

---

## 4) Hanzi/Kanji — Decomposição

### `src/lib/cjk.ts`  ✅ testado (`cjk.test.ts`, 10)
`isHan`, `hasHan`, `hanChars`, `uniqueHanChars`, `hanCharCount`. CJK Unified + Ext A/B + 々〆〇; rejeita kana/latim/pontuação.
**Sugestões extras:**
- [ ] Caracteres de Extensão B (par surrogate, ex. `𠮷`) — garantir que `isHan`/iteração por `for…of` (code points) funciona.

### Pipeline — `electron/lib/tutorPrompt.ts` › `buildDecomposePrompt`  ✅ testado (3)
Pede JSON com `character/meaning/reading/strokes/components[]/mnemonic`, usando a romanização do idioma.
**Faltam (parser):**
- [ ] `tutorService.decompose`: filtra componentes sem `part` válido; ignora `strokes ≤ 0` (→ `undefined`); JSON inválido → `{ character, meaning:'', components:[] }`. **Mockar `dispatch`**.

### UI — `src/components/CharBreakdown.tsx`  ❌ sem teste (jsdom; mock `tutorAPI.decompose`)
- [ ] Renderiza um chip por `uniqueHanChars(word)`; clique busca 1×, faz **cache** local, re-clique no ativo fecha (toggle).
- [ ] Estados `loading`/`error`/sucesso (componentes + mnemônico + traços).

---

## 5) Loop/Chorus (shadowing)

### `src/lib/loopPlan.ts`  ✅ testado (`loopPlan.test.ts`, 18)
`buildLoopPlan(cfg)` → `{ steps: {type:'play'|'gap', index, startMs, durationMs, speed}[], totalMs, repeats }`; `speedForRepeat`, `playDuration`. Cobertos: 0/1 repetição, gap `none`/`echo`/fixo, `trailingGap`, velocidades graduadas, invariantes Σdur=total e startMs cumulativo.

### `src/hooks/useLoopPlayer.ts`  ❌ sem teste (jsdom + fake timers + mock de `Audio`/`listeningAPI`/`stopClip`)
Contrato:
- `start({repeats, gap, speeds})`: toca o clipe N×, `playbackRate = speedForRepeat(speeds, i)`. **Gap `echo` = duração REAL medida** da última reprodução (`performance.now()`), não a declarada (robusto a WebM `duration=Infinity`).
- Pausa `listeningAPI` ao iniciar e **resume** ao parar/desmontar; chama `stopClip()` antes de iniciar.
- Guarda contra avanço duplo (`advanced`) quando `onended` e `onerror`/`play().catch` disparam juntos.
- `stop()` zera estado; cleanup no unmount não deixa timer nem listener pausado.
**Faltam:**
- [ ] Com `Audio` mockado (disparar `onended`), `start({repeats:3, gap:'none'})` toca 3× e para; `repeat`/`phase` evoluem.
- [ ] `gap:'echo'` agenda `setTimeout` com a duração medida (usar `vi.useFakeTimers` + avançar `performance.now`).
- [ ] `onerror` + `play().catch` simultâneos **não** pulam repetição (testar `advanced`).
- [ ] `stop()`/unmount → `listeningAPI.resume` chamado exatamente as vezes certas e timer limpo.
- [ ] `start` com `url` undefined ou `repeats:0` é no-op.

### UI — botão Loop em `TutorBoard.tsx` (`EntryCard`)  ❌ sem teste
- [ ] Só aparece com `entry.originalAudioUrl`; toggle chama `start({repeats:3, gap:'echo', speeds:[0.8,0.9,1]})` / `stop()`; label `2/3` e `·` no `phase==='gap'`.

---

## 6) Onboarding (1º acesso) + redução de fricção do BYOK

### Lógica pura  ✅ testado
- `src/lib/onboarding.ts` (`onboarding.test.ts`, 16): fluxo `welcome→apiKey→resources→done`, `next/prevStep` com clamp, `resourceSectionsFor(level)`, `LEVELS`, `TOTAL_NAV_STEPS`.
- `src/lib/dailyGoal.ts` (`dailyGoal.test.ts`, 11): `goalProgress(done,target)` — pct limitado a 100, `reached`/`remaining`, sanitização (negativos, floor, alvo mínimo 1, valores enormes).
- `src/lib/learnContent.ts` (`learnContent.test.ts`, 6): primer de escrita + canais por idioma (zh/ja/ko + fallback); normaliza variantes (`zh-CN→zh`); todas as URLs `http(s)`.
- `src/lib/apiKeyValidation.ts` (`apiKeyValidation.test.ts`, 27): `validateApiKey` (erro: vazio/espaço interno/URL; aviso: prefixo errado/curta; ok + trim) e `pickActiveProvider` (mantém atual válido / 1º configurado / filtro de elegibilidade). Bordas: tab/CRLF, fronteira do `minLen`, http/https vs ftp, `null`/`undefined`.

### Electron  ✅ testado
- `electron/lib/providerTestProbe.ts` (`providerTestProbe.test.ts`, 7): `buildTestProbe(provider,key)` monta URL+headers por provider (Bearer no OpenAI/Groq; `x-api-key`+`anthropic-version` no Anthropic; chave na query do Gemini; chave embutida sem encode; desconhecido→undefined). **A lógica real do `credentials:test` foi extraída pra cá** — o handler só faz o fetch.
- `electron/services/storeService.ts` › `capturedToday()` (em `storeService.knownWords.test.ts`, +2): soma só sessões de hoje.

### Componentes (jsdom)  ✅ testado
- `src/components/Onboarding.test.tsx` (8): fluxo completo; gate de chave (sem/with key, "Pular"/"Abrir Configurações"→`windowAPI.show('settings')`); recursos por nível (iniciante mostra escrita, intermediário só canais; ja=Kana, ko=Hangul, zh=Pinyin); conclusão persiste `targetLanguage`/`level`/`onboarded` + `onDone`; voltar preserva escolhas.
- `src/windows/Settings.test.tsx` (8): validação ao vivo (URL bloqueia, prefixo errado avisa+permite, vazio desabilita); salvar **normaliza (trim)** + **auto-ativa** o provider (Anthropic NÃO vira transcrição) + **auto-testa** inline; botão Testar; lista os 4 providers.
- `src/windows/Dashboard.test.tsx` (4): gate de onboarding (1º acesso → onboarding); meta diária parcial (`X/5` + "Faltam") e batida ("Meta batida", sem "Faltam").

**Faltam (sugestões):**
- [ ] `Onboarding`: fallback de idioma sem primer (ex. `en`) mostra "Imersão em…" e só canais.
- [ ] `Settings`: `removeKey` chama `credentialsAPI.remove` e re-aponta o provider ativo; persistência de TTS/voz.

---

## Resumo das lacunas priorizadas
1. **Sem dependência nova (pura/electron):** parsers de `tutorService` (`analyze`/`lookup`/`decompose`) via mock de `dispatch`; regressão do `EMPTY` aliasing no `storeService` (`mistakes` também).
2. **Componentes/hooks ainda sem teste (jsdom já disponível):** `Furigana`, `PitchAccent`, `CharBreakdown`, `ComprehensionBadge`, `KnownStat`, status no `WordPopover`/`SyncedTranscript`; hooks `useKnownWords` provider e `useLoopPlayer` (este com `vi.useFakeTimers` + mock de `Audio`).
3. **Refactors que facilitam teste sem DOM (opcional):** extrair geometria do `PitchAccent` e razões do `Furigana` para funções puras.

## Arquivos de teste já existentes desta leva
**Puros/electron:** `comprehension.test.ts` · `useKnownWords.test.ts` · `storeService.knownWords.test.ts` (+`capturedToday`) · `kana.test.ts` · `furigana.test.ts` · `pitchAccent.test.ts` · `cjk.test.ts` · `loopPlan.test.ts` · `tutorPrompt.test.ts` · `onboarding.test.ts` · `dailyGoal.test.ts` · `learnContent.test.ts` · `apiKeyValidation.test.ts` · `providerTestProbe.test.ts`.
**Componentes (jsdom):** `Onboarding.test.tsx` · `Settings.test.tsx` · `Dashboard.test.tsx`.
