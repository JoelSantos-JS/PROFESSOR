# Plano #3 — Perfil de pontos fracos de pronúncia

> Ideia "roubada" do utell (Accent Oracle), no nosso viés: surfacar **os erros que JÁ gravamos**
> (`store.mistakes`) de forma acionável, agrupando por **traço fonético do idioma** quando dá pra
> derivar, + "Treinar" (reusa `WordDrill`). Spec base: [IDEIAS_UTELL.md](IDEIAS_UTELL.md) Plano #3.
> Padrão: **núcleo puro testável → serviço/IPC → UI → bateria de testes** (cada feature com testes).

## O que já temos
- `store.mistakes`: `{ word, lang, count, lastAt }` por `lang:word` (gravado a cada prática errada).
- Analisadores: `kana` (`splitMora`/`isKana`/`isKanji`), batchim coreano via Unicode (inline).
- `WordDrill` (treino de palavras), Dashboard.

## Limite honesto
- **🇰🇷 coreano**: batchim derivável do hangul (Unicode) → agrupamento real por som final (대표음).
- **🇯🇵 japonês**: vogal longa (ー), sokuon (っ), contraído (ゃゅょ) deriváveis do kana.
- **🇬🇧 inglês**: heurística por grafia (sons "th"/"r" — difíceis pra falante de PT).
- **🇨🇳 chinês**: tons exigiriam o **pinyin** (não guardamos no erro) → sem grupos por tom (só o top).
  *(Enriquecer `mistakes` com romanização é um passo futuro — fora do escopo deste #3.)*
- **Universal**: **top de erros recorrentes** (mais frequentes) — funciona pra todos + "Treinar".

---

## Incremento 1 — Núcleo puro `src/lib/pronunciationProfile.ts`
**API:**
```ts
interface MistakeWord { word: string; count: number }
interface ProfileGroup { key: string; label: string; words: string[]; count: number }
interface PronunciationProfile { total: number; top: MistakeWord[]; groups: ProfileGroup[] }
function pronunciationProfile(lang: string, mistakes: MistakeWord[], topN?: number): PronunciationProfile
```
- `top`: ordena por `count` desc, pega `topN` (default 8).
- `groups` por idioma:
  - **ko**: para cada sílaba com batchim, soma no balde do **som representativo** (ㄱ/ㄴ/ㄷ/ㄹ/ㅁ/ㅂ/ㅇ);
    rótulo "Batchim ㄹ", etc. (extração do jongseong por Unicode: `(code-0xAC00)%28`).
  - **ja**: baldes "Vogal longa (ー)", "Sokuon (っ)", "Som contraído (ゃゅょ)".
  - **en**: baldes "Som 'th'", "Som 'r'".
  - **outros (incl. zh)**: `groups = []`.
  - Ordena grupos por `count` desc; ignora baldes vazios.
**Bateria de testes** (`pronunciationProfile.test.ts`): top ordenado/limitado; ko agrupa por batchim
representativo correto (ex.: 한국어 → ㄴ/ㄱ); ja detecta ー/っ/ゃ; en th/r; zh sem grupos (só top);
entrada vazia; palavra sem traço não entra em grupo.

## Incremento 2 — Store + IPC `getMistakes(lang)`
- `storeService.getMistakes(lang)` → `MistakeRecord[]` (todos do idioma, ordenados por count).
- IPC `store:mistakes` + preload + `storeAPI.mistakes(lang)` + tipo.
**Testes** (`storeService.*.test.ts`, mock electron + `vi.hoisted`): retorna por idioma, ordenado, vazio.

## Incremento 3 — UI no Dashboard
- Card/seção **"Seu perfil de pronúncia"**: para o `targetLanguage`, mostra os **grupos** (chips com
  rótulo + nº) e o **top de erros** (palavras + count). Botão **"Treinar"** abre um drill com essas palavras
  (reusa `WordDrill` num modal, ou manda pra prática).
- Carrega via `storeAPI.mistakes(targetLanguage)` + `pronunciationProfile(...)`.
**Testes (jsdom)**: renderiza grupos + top a partir de mistakes mockados; estado vazio ("sem erros ainda");
botão treinar.

---

## Ordem
1. Incremento 1 (núcleo puro) + testes.
2. Incremento 2 (store/IPC) + testes.
3. Incremento 3 (UI) + testes.

## Progresso
- [x] **Inc. 1 — pronunciationProfile (núcleo)** ✅ `src/lib/pronunciationProfile.ts` (12 testes): top universal +
  grupos ko (batchim 대표음), ja (ー/っ/ゃ), en (th/r); zh/outros só top.
- [x] **Inc. 2 — store getMistakes + IPC** ✅ `storeService.getMistakes(lang)` + `store:mistakes` + preload/
  electron/types (+3 testes mock electron).
- [x] **Inc. 3 — UI no Dashboard** ✅ `src/components/PronunciationProfileCard.tsx` (6 testes): grupos (chips) +
  palavras a treinar (com TTS) + botão "Treinar pronúncia"; plugado no Dashboard com `lang=targetLanguage`.

- [x] **Inc. 4 — Ciclo fechado: "Treinar" usa as palavras fracas** ✅ `wordDrillItems(lang, words)`
  (puro, +6 testes: foco fonético por palavra reusando `classify`, dedup/vazios) → `PronunciationDiagnostic`
  ganhou `items?`/`title?` (+4 testes: usa as palavras dadas, avança, pontua, cai no genérico se vazio) →
  card manda `onTrain(top.words)` → Dashboard monta os itens e abre o diagnóstico em "Treinar suas palavras
  fracas". Agora o botão treina **exatamente** os pontos fracos detectados, não as frases genéricas.

> **Concluído** — 956 testes no total, type-check limpo. (Futuro: enriquecer `mistakes` com romanização
> para grupos por TOM no chinês.)
