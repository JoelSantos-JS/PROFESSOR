# PROFESSOR — Documento de Continuidade

> Handoff para a próxima sessão (Codex/Claude). Lê isto antes de mexer no projeto.
> Última atualização: 2026-05-29

---

## 1. O que é o PROFESSOR

Tutor de idiomas **desktop (Electron)** que captura o **áudio do PC** (system audio via
WASAPI loopback + microfone), transcreve em tempo real, detecta o idioma automaticamente,
e gera um **Tutor Board** com romanização, vocabulário, dica gramatical, botão **Ouvir**
(TTS) e modo **Praticar** (grava o usuário e pontua a pronúncia).

Caso de uso principal do usuário: **assistir doramas chineses/asiáticos** e aprender com
o áudio em tempo real.

**Idioma da UI:** Português (pt-BR). O usuário fala português.

---

## 2. Stack

- **Electron 42** (ESM — `main.mjs`), **React 19**, **TypeScript 6**, **Tailwind CSS v4**, **Vite 8**
- **Vitest 4** para testes (72 testes passando)
- Build: 3 configs Vite — `vite.electron.main.config.ts` (main), `vite.electron.config.ts`
  (preload), `vite.config.ts` (renderer + config do vitest)
- `npm run dev` → builda main+preload, sobe Vite, lança Electron

### Provedores de IA (BYOK — Bring Your Own Key)
- **Transcrição:** Gemini 2.5 Flash (padrão), OpenAI Whisper, Groq Whisper
- **Tutor (análise):** Gemini, OpenAI, Anthropic, Groq
- **TTS:** `node-edge-tts` (Microsoft Edge, GRÁTIS, sem chave) — voz neural

---

## 3. Arquitetura de janelas

| Janela | Arquivo | Tamanho | Função |
|---|---|---|---|
| `floating-bar` | `src/windows/FloatingBar.tsx` | 400×520 | Janela de transcrição ao vivo (canto sup. direito). Captura áudio, faz VAD, mostra feed de transcrições em cards. |
| `tutor-board` | `src/windows/TutorBoard.tsx` | 680×480 | Análise: romanização, vocab, dica, Ouvir, Praticar. |
| `settings` | `src/windows/Settings.tsx` | 640×520 | Chaves de API, provedores. |
| `dashboard` | — | 1100×680 | (existe no config, pouco usado) |

Ambas as janelas principais têm `transparent: true` + borda CSS (`border border-white/10 rounded-lg`).

---

## 4. Fluxo de áudio (o coração do app)

`FloatingBar.tsx`:
1. `getDisplayMedia({audio,video})` → system audio (WASAPI loopback, captura TUDO do
   mixer do Windows, mesmo abas mutadas). Handler em `electron/ipc/audioHandlers.ts`
   usa `setDisplayMediaRequestHandler` com `audio:'loopback'`.
2. `getUserMedia({audio})` → microfone (mixado junto).
3. Os dois streams → `AudioContext` → `AnalyserNode` → `MediaStreamDestination`.
4. `MediaRecorder.start(150)` — **timeslice de 150ms, NUNCA faz stop/start** (parar mata
   a track WASAPI). Chunks chegam a cada 150ms em `ondataavailable`.
5. **VAD (Voice Activity Detection)** com `isVoiced()` (RMS dos samples time-domain):
   - Mantém um **pre-roll buffer** de 3 chunks (~450ms) de silêncio.
   - Quando detecta voz → começa utterance, prepende o pre-roll (não perde o início).
   - Quando silêncio ≥ 700ms após fala → frase completa → transcreve.
   - Descarta utterances < 400ms; força flush em 20s.
6. **WebM header**: o chunk 0 do MediaRecorder tem o header EBML+Tracks. `extractWebMHeader()`
   extrai só o header (para antes do primeiro Cluster `0x1F43B675`) e prepende a cada
   utterance para que os chunks sejam decodificáveis isoladamente.

Funções puras testáveis: `src/lib/audio.ts` (`extractWebMHeader`, `isVoiced`),
`src/lib/text.ts` (`compareWords`, `scoreAttempt`).

---

## 5. Detecção de idioma + Romanização

- A **transcrição já retorna o idioma detectado** (`{text, language}`). Gemini via
  `systemInstruction` retornando JSON; Whisper via `verbose_json`.
- Idioma flui para o `TutorService`, que monta o prompt com o **sistema de romanização
  correto por idioma** (`ROMANIZATION_SYSTEM` em `electron/services/tutorService.ts`):
  - zh → Pinyin, ja → Romaji (Hepburn), ko → Romanização Revisada, th → RTGS,
    ar → transliteração, ru → BGN/PCGN, hi → IAST.
- **NÃO há seleção manual de idioma** — tudo automático (decisão do usuário).

---

## 6. TTS (Ouvir) — node-edge-tts

- `electron/services/ttsService.ts` → `synthesize(text, lang)` retorna `{audio, cues}`.
  Escreve MP3 + subtítulo `.json` num tmp, lê ambos, deleta.
- ⚠️⚠️ **A VOZ VAI NO CONSTRUTOR**: `new EdgeTTS({ voice, saveSubtitles: true })`.
  O `ttsPromise(text, audioPath)` só aceita **2 args** — passar voz como 3º arg é
  IGNORADO e usa o default `zh-CN-XiaoyiNeural`. Esse foi o bug "voz sempre igual".
- `saveSubtitles: true` gera `<audio>.json` com `[{part, start, end}]` (ms) por palavra
  (WordBoundary). Usado para sincronização karaoke.
- `electron/lib/ttsVoices.ts` → `resolveVoice(lang)` mapeia idioma → voz (módulo PURO,
  separado do service porque `node-edge-tts` puxa deps nativas que quebram no vitest).
- IPC `tts:speak` retorna `{ dataUrl, cues }`. **data URL base64** (`data:audio/mpeg;base64,...`).
  ⚠️ **ArrayBuffer via IPC do Electron não funciona bem** — usa base64/data URL.
- Renderer (`TutorBoard.tsx`): `speak()` toca o áudio e via `audio.ontimeupdate` acha o
  cue ativo (`start <= t < end`) → `SyncedTranscript` destaca a palavra (karaoke).
- timeout do EdgeTTS = 30000 (rate-limit do endpoint Bing é comum em testes seguidos).

### Vozes atuais (femininas alternativas, escolha do usuário 2026-05-29)
zh→Xiaoyi, ja→Nanami, ko→SunHi, th→Premwadee, ar→Salma(EG), hi→Swara, ru→Svetlana,
en→Aria, pt→Thalita, es→Ximena, fr→Eloise, de→Amala, it→Isabella.
⚠️ **ja/ko/th/hi/ru têm só UMA voz feminina no catálogo Edge TTS** — não há alternativa.
Para conferir vozes disponíveis, fetch:
`https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=6A5AA1D4EAFF4E9FB37E23D68491D6F4`

---

## 7. Coordenação entre janelas (pause/resume)

Problema: o loopback captura o áudio do PRÓPRIO app (TTS e gravação de prática),
criando loop de transcrição/alucinação.

Solução: canais IPC `listening:pause` / `listening:resume`
(`electron/ipc/windowHandlers.ts` repassa para a floating-bar). O FloatingBar tem
`pausedRef` que ignora chunks enquanto pausado.

Pausa é acionada em `TutorBoard.tsx`:
- Ao clicar **Ouvir** → pause → TTS toca → `onended` → resume.
- Ao **Praticar** (gravar) → pause → grava → `onstop` → resume.

---

## 8. Bugs resolvidos (não repetir)

| Bug | Causa | Fix |
|---|---|---|
| Credenciais não persistiam | `safeStorage` falhava silenciosamente, sem mkdir | try/catch + base64 fallback + mkdirSync em `credentialsService.ts` |
| Gemini 404 | `1.5-flash`/`2.0-flash` removidos do v1beta | `gemini-2.5-flash` |
| Captura parava após 1-2 ciclos | `recorder.stop()` matava track WASAPI | timeslice mode, nunca para |
| Caracteres chineses no 1º chunk | chunk 0 = init data WebM | pular chunk 0, usar só p/ header |
| Gemini alucinava no silêncio | modelo "thinking" vazando | `thinkingConfig:{thinkingBudget:0}` |
| Idioma errado (coreano em vez de chinês) | Gemini não retornava idioma | transcrição retorna `{text,language}` |
| Gemini ecoava o próprio prompt | instrução no `contents` | mover p/ `systemInstruction` + filtro de eco |
| **Ouvir não tocava som** | **CSP sem `media-src`** bloqueava data URL de áudio | adicionar `media-src 'self' data: blob:` no `index.html` |
| `ieee754 not found` (msedge-tts) | polyfill browser quebrado | trocar para `node-edge-tts` |
| Início de frase cortado | VAD começa após detectar voz | pre-roll buffer de 3 chunks |
| nested `<button>` (hydration) | VocabCard botão dentro de botão | externo virou `<div role=button>` |
| Scrollbar branca | sem estilo | `::-webkit-scrollbar` escuro no `index.css` |
| Janela não movia | header todo `no-drag` | faixa de drag de 20px no topo |
| **Voz sempre a mesma** | voz passada como 3º arg de `ttsPromise` (ignorado) → default | passar voz no **construtor** `new EdgeTTS({voice})` |

### Features adicionadas (2026-05-29, sessão 2)
- **Sincronização karaoke**: TTS retorna cues `{part,start,end}`; `SyncedTranscript`
  destaca a palavra atual conforme toca (azul) e esmaece as já ditas.
- **Tradução em inglês**: `tutorService` gera `englishText` quando o conteúdo NÃO é
  inglês; aparece abaixo do transcript com label "EN".

---

## 9. Estado atual (o que FUNCIONA)

✅ Captura contínua de system audio + mic
✅ VAD com pre-roll, espera frase completa
✅ Transcrição multi-idioma com detecção automática (testado com dorama chinês — preciso)
✅ Tutor Board: romanização correta por idioma, vocab, dica
✅ **Ouvir** (TTS) tocando som real
✅ **Praticar** com pontuação de pronúncia
✅ Pause/resume evita auto-captura do TTS/prática
✅ Design refinado (tabs, badge AO VIVO, cards, borda, scrollbar tematizada)
✅ 72 testes vitest passando

---

## 10. Próximos passos (não feitos)

- [ ] **M4 — Repetição espaçada**: salvar vocab em DB, flashcards, algoritmo SM-2.
- [ ] **M5 — Distribuição**: ícone, instalador NSIS, auto-updater, login item.
- [ ] Consistência de script chinês (Gemini às vezes mistura 简体/繁體 — instruir a manter original).
- [ ] Aumentar pre-roll se ainda cortar início em falas rápidas (testar 5 chunks).
- [ ] Possível opção de voz masculina/feminina nas Settings (hoje é fixo no código).

---

## 11. Comandos úteis

```powershell
npm run dev          # desenvolvimento (builda tudo + Electron)
npm test             # vitest run (72 testes)
npm run build        # build de produção
npm run dist         # electron-builder (instalador)
npx tsc --noEmit     # type-check
```

Matar instâncias + reabrir (Windows):
```powershell
Get-Process | Where-Object { $_.Name -like "*electron*" } | Stop-Process -Force
Start-Process powershell -ArgumentList "-NoExit","-Command","npm run dev"
```

---

## 12. Arquivos-chave (mapa rápido)

```
electron/
  main.ts                       # cria janelas, atalhos globais (Ctrl+Alt+L, Ctrl+Alt+B)
  preload.ts                    # contextBridge → window.api
  ipc/
    audioHandlers.ts            # loopback + audio:transcribe
    tutorHandlers.ts            # tutor:analyze → abre board + broadcast
    ttsHandlers.ts              # tts:speak (retorna data URL)
    windowHandlers.ts           # window:* + listening:pause/resume
    credentialsHandlers.ts settingsHandlers.ts
  services/
    audioService.ts             # Whisper/Gemini transcrição → {text,language}
    tutorService.ts             # prompt dinâmico por idioma + romanização
    ttsService.ts               # node-edge-tts → MP3 buffer
    credentialsService.ts settingsService.ts
  lib/ttsVoices.ts              # resolveVoice() PURO (testável)
  windows/windowConfigs.ts windowManager.ts
src/
  windows/FloatingBar.tsx       # transcrição ao vivo + VAD
  windows/TutorBoard.tsx        # análise + Ouvir + Praticar
  windows/Settings.tsx
  lib/audio.ts lib/text.ts      # funções puras testadas
  lib/*.test.ts                 # testes vitest
  services/electron.ts          # wrappers do window.api
  types/index.ts                # IpcAPI + tipos compartilhados
index.html                      # ⚠️ CSP aqui (media-src!)
```
