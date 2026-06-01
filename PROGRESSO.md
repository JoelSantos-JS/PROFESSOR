# PROFESSOR — Progresso do Projeto

> Tutor flutuante de idiomas para áudio do PC. Electron + React + TypeScript.

---

## M0 — Shell Completo ✅

| Arquivo | Descrição |
|---|---|
| `electron/main.ts` | Entry point ESM — cria janelas, registra atalhos globais, broadcast de eventos |
| `electron/windows/windowManager.ts` | Cria, mostra, esconde e faz toggle das janelas pelo nome |
| `electron/windows/windowConfigs.ts` | Configurações de cada janela (tamanho, frame, transparência, etc.) |
| `electron/preload.ts` | Bridge via `contextBridge` — expõe `window.api` para o renderer |
| `electron/ipc/settingsHandlers.ts` | Handlers IPC para `settings:get-all` e `settings:set` |
| `electron/ipc/windowHandlers.ts` | Handlers IPC para minimize / close / hide / show |
| `electron/services/settingsService.ts` | Lê e grava `settings.json` em `userData` |
| `src/windows/Dashboard.tsx` | Janela principal 1100×680 |
| `src/windows/FloatingBar.tsx` | Overlay flutuante 300×56 — transparente, always-on-top |
| `src/windows/Settings.tsx` | Configurações 640×520 — API keys, providers, atalhos |
| `src/components/TitleBar.tsx` | Barra de título customizada (frameless) |
| `scripts/launch-electron.js` | Remove `ELECTRON_RUN_AS_NODE` antes de subir o Electron |

### Atalhos globais

| Atalho | Ação |
|---|---|
| `Ctrl+Alt+L` | Toggle barra flutuante + toggle escuta |
| `Ctrl+Alt+D` | Abrir Dashboard |
| `Ctrl+Alt+S` | Abrir Configurações |
| `Ctrl+Alt+B` | Abrir Tutor Board |

### Problemas resolvidos

**`require('electron')` retornava path do binário npm**
O VSCode define `ELECTRON_RUN_AS_NODE=1`. Solução: `scripts/launch-electron.js` faz `delete env.ELECTRON_RUN_AS_NODE` antes de spawnar.

**`app.getAppPath()` crash no boot**
`preloadPath` era variável de módulo (top-level). Solução: movido para dentro do constructor com `fileURLToPath(import.meta.url)`.

**CJS vs ESM**
Compilar `main.ts` como ESM (`main.mjs`) — Electron 28+ resolve `import { app } from 'electron'` pelo seu loader ESM nativo.

**Build order**
`vite.electron.main.config.ts` roda primeiro com `emptyOutDir: true`, depois `vite.electron.config.ts` com `emptyOutDir: false` (só adiciona o preload).

---

## BYOK — Bring Your Own Key ✅

Modelo igual ao OpenCode: usuário traz suas próprias chaves, o app nunca gasta tokens do desenvolvedor.

| Arquivo | Descrição |
|---|---|
| `electron/services/credentialsService.ts` | Chaves criptografadas via `safeStorage` (Windows DPAPI) |
| `electron/ipc/credentialsHandlers.ts` | `credentials:list/set/get/remove/debug` |
| `src/windows/Settings.tsx` | Cards por provider com inline input + seletor de provider ativo |

### Providers suportados

| Provider | Transcrição | Chat/Tutor |
|---|---|---|
| **OpenAI** | Whisper-1 | GPT-4o-mini |
| **Google Gemini** | Gemini 2.5 Flash | Gemini 2.5 Flash |
| **Anthropic** | — | Claude Haiku |
| **Groq** | Whisper Large v3 | Llama 3.1 8B |

### Segurança
- `safeStorage.encryptString` usa Windows DPAPI — só o mesmo usuário/máquina consegue descriptografar
- Chave nunca sai em plaintext do processo principal
- `credentials:list` retorna apenas `{ id, configured: bool }` — sem valores reais

---

## M1+M2 — Captura de Áudio + Transcrição ✅

### Arquitetura de captura

```
getDisplayMedia({ audio: true, video: true })   ← WASAPI loopback (áudio do sistema)
getUserMedia({ audio: true })                   ← Microfone
        ↓
AudioContext → AnalyserNode → MediaStreamDestination
        ↓
MediaRecorder.start(5000)     ← timeslice: ondataavailable a cada 5s sem parar o recorder
        ↓
AnalyserNode polling (200ms)  ← detecta silêncio por RMS, pula chunk se não há fala
        ↓
chunk[0]: extrair EBML+Tracks header (sem áudio)
chunk[N]: prepend header + cluster = WebM válido standalone
        ↓
audio:transcribe IPC → AudioService → Gemini / Whisper
```

### Detecção de silêncio
- `AnalyserNode.getByteTimeDomainData()` a cada 200ms
- Exige que > 3% das amostras desviem > 18 do ponto de silêncio (128)
- Se não detectado áudio na janela de 5s, chunk é descartado sem chamada de API

### Detecção de idioma automática
- Gemini retorna JSON `{ text, language }` — language é o código ISO 639-1 detectado
- Whisper com `response_format=verbose_json` retorna `language` automaticamente
- O idioma detectado flui para o TutorService sem necessidade de configuração manual

### Problemas resolvidos

**`recorder.stop()` matava o track WASAPI**
Usar `recorder.start(SEGMENT_MS)` (timeslice) em vez de stop/restart. O recorder nunca para durante a sessão.

**Caracteres chineses/garbled no primeiro chunk**
O chunk 0 contém dados de inicialização WebM. Solução: chunk 0 é descartado (só extrai o header EBML+Tracks); transcrição começa no chunk 1.

**Alucinações do Gemini em silêncio**
`thinkingBudget: 0` desabilita o modo raciocínio do Gemini 2.5 Flash que vazava "special instruction: think silently" no output. + AnalyserNode descarta chunks silenciosos antes de chamar a API.

**Header WebM para chunks subsequentes**
`extractWebMHeader()` varre os bytes do chunk 0 buscando o Cluster marker (`0x1F 0x43 0xB6 0x75`) e extrai apenas EBML+Tracks. Cada chunk seguinte recebe esse header → WebM válido com apenas 5s de áudio novo.

---

## M3 — Tutor Board ✅

### Arquitetura

```
FloatingBar transcreve → tutorAPI.analyze(text, detectedLanguage)
        ↓
tutor:analyze IPC → TutorService → Gemini/OpenAI/Anthropic/Groq
        ↓
JSON: { romanization?, vocab[], tip }
        ↓
broadcast tutor:analysis → TutorBoard abre automaticamente
```

### Romanização automática por idioma

O sistema detecta o idioma da transcrição e aplica o sistema de romanização correto:

| Idioma | Sistema | Exemplo |
|---|---|---|
| Chinês (zh) | **Pinyin** com marcas de tom | nǐ hǎo |
| Japonês (ja) | **Romaji** Hepburn | konnichiwa |
| Coreano (ko) | **Romanização** revisada | annyeonghaseyo |
| Tailandês (th) | RTGS | sawatdi |
| Árabe (ar) | ALA-LC | marhaba |
| Russo (ru) | BGN/PCGN | privet |
| Hindi (hi) | IAST | namaste |
| Outras línguas | sem romanização | — |

### TutorBoard UI
- Abre automaticamente quando há nova transcrição
- `Ctrl+Alt+B` abre manualmente
- Cada entrada: romanização (em azul) + texto original + vocabulário clicável + dica contextual em PT-BR
- Histórico scrollável da sessão inteira
- Vocab cards expandem ao clicar para mostrar exemplo de uso

| Arquivo | Descrição |
|---|---|
| `electron/services/tutorService.ts` | Prompt dinâmico por idioma, chama AI provider ativo |
| `electron/ipc/tutorHandlers.ts` | `tutor:analyze` IPC, abre tutor-board, broadcast analysis |
| `src/windows/TutorBoard.tsx` | UI do board com histórico, romanização, vocab, dicas |

---

## Stack de Build

```
vite.electron.main.config.ts   → dist-electron/main.mjs    (ESM)
vite.electron.config.ts        → dist-electron/preload.js  (CJS — obrigatório para contextBridge)
vite.config.ts                 → dist/renderer/            (React + Tailwind v4)
```

```bash
npm run dev     # build electron + renderer, sobe Vite + Electron
npm run build   # build completo para produção
npm run dist    # gera instalador (electron-builder)
```

---

## Próximos Milestones

### M4 — Player de Revisão (Spaced Repetition)
- Banco de dados local (`better-sqlite3` ou JSON estruturado)
- Salvar vocabulário capturado durante sessões
- Algoritmo SM-2 para espaçamento de revisão
- `Ctrl+Alt+Space` → abre/fecha player de flashcards
- Métricas: palavras aprendidas, sequência de dias, acertos/erros

### M5 — Polimento & Distribuição
- Ícone do app (`.ico` para Windows)
- Auto-updater com `electron-updater`
- `npm run dist` gerando instalador NSIS para Windows
- Inicialização com o Windows (`app.setLoginItemSettings`)
- Tela de onboarding para inserir API keys na primeira execução

---

## Arquitetura de Referência

```
PROFESSOR/
└── tutor-pc/
    ├── electron/
    │   ├── main.ts
    │   ├── windows/
    │   │   ├── windowManager.ts
    │   │   └── windowConfigs.ts          ← dashboard, floating-bar, settings, tutor-board
    │   ├── ipc/
    │   │   ├── index.ts
    │   │   ├── audioHandlers.ts          ← setDisplayMediaRequestHandler + audio:transcribe
    │   │   ├── credentialsHandlers.ts
    │   │   ├── settingsHandlers.ts
    │   │   ├── tutorHandlers.ts          ← tutor:analyze → broadcast tutor:analysis
    │   │   └── windowHandlers.ts
    │   ├── services/
    │   │   ├── audioService.ts           ← transcrição + detecção de idioma automática
    │   │   ├── credentialsService.ts     ← safeStorage DPAPI
    │   │   ├── settingsService.ts
    │   │   └── tutorService.ts           ← análise linguística + romanização por idioma
    │   └── preload.ts
    ├── src/
    │   ├── app/App.tsx                   ← roteamento por ?window=nome
    │   ├── components/TitleBar.tsx
    │   ├── services/electron.ts          ← wrapper tipado do window.api
    │   ├── types/index.ts
    │   └── windows/
    │       ├── Dashboard.tsx
    │       ├── FloatingBar.tsx           ← captura áudio, transcreve, envia para tutor
    │       ├── Settings.tsx              ← BYOK, providers, atalhos
    │       └── TutorBoard.tsx            ← histórico, romanização, vocab, dicas
    └── scripts/
        └── launch-electron.js
```
