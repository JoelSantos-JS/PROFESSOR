# Tutor PC — Documento Base do Produto

> App desktop separado do Evolution mobile.
> Este arquivo consolida a ideia, posicionamento, concorrência, arquitetura técnica e plano de construção.

---

## 1. Ideia Central

Um app desktop para PC que transforma qualquer áudio do computador em treino ativo de idiomas.

O usuário assiste Netflix, YouTube, aulas, podcasts, cursos ou vídeos locais. O app escuta o áudio do sistema, identifica frases úteis, pausa o conteúdo, pede para o usuário repetir falando e abre uma mini lousa explicando exatamente o que ele errou.

Não é só legenda.
Não é só tradução.
Não é só shadowing.
Não é só assistente de IA.

É um professor flutuante de speaking em cima do PC.

Loop principal:

```txt
conteúdo tocando no PC
→ captura áudio do sistema
→ transcreve em tempo real
→ detecta fim de frase
→ pausa o player
→ mostra frase + tradução + explicação
→ usuário repete falando
→ app avalia pronúncia/fluência
→ mini lousa explica erros
→ usuário tenta de novo
→ app libera o vídeo
→ erros viram revisão
```

Promessa inicial:

> Aprenda inglês assistindo qualquer coisa no PC. O app pausa as frases, corrige sua fala e mostra uma mini lousa explicando seus erros.

Visão futura:

> Aprenda qualquer idioma com qualquer áudio do seu computador.

---

## 2. Escopo Estratégico

### Produto separado

Este app não é uma feature dentro do Evolution mobile. Ele é um produto desktop independente.

O Evolution mobile continua sendo:

```txt
app mobile de conversa, shadowing, leitura e treino guiado
```

O Tutor PC será:

```txt
app desktop que atua sobre conteúdo externo do usuário
```

### Foco inicial

```txt
Plataforma: Windows
Idioma inicial: inglês
Público inicial: brasileiros aprendendo inglês com Netflix, YouTube, aulas e cursos no PC
```

### Expansão futura

```txt
Fase 2: espanhol, francês, alemão
Fase 3: coreano, japonês
Fase 4: mandarim com análise específica de tons
```

O app deve nascer multi-idioma na arquitetura, mas o MVP deve ser inglês primeiro.

---

## 3. Diferencial

A ideia fica fraca se for:

```txt
legenda dupla + pausar + repetir + score
```

Isso já existe em vários concorrentes.

A ideia fica forte se for:

```txt
tutor desktop vivo
→ captura áudio real do PC
→ funciona sobre Netflix, YouTube, VLC, aulas e cursos
→ pausa automaticamente
→ corrige speaking
→ abre uma lousa ensinando o erro
→ faz repetir até melhorar
→ salva erros para revisão
```

O diferencial central é:

> A lousa pedagógica que aparece quando o usuário erra.

Exemplo:

```txt
Original:
I should have told you earlier.

Você disse:
I should told you earlier.

Erro principal:
Você pulou o "have".

Por que importa:
"should have + particípio" fala de arrependimento ou algo que deveria ter acontecido no passado.

Pronúncia:
"should have" vira "should've" na fala natural.

Treino:
1. should've
2. should've told
3. I should've told you earlier

[Tentar de novo] [Continuar]
```

---

## 4. Concorrência

### Concorrentes diretos/adjascentes

#### LanguageShadow

Chrome extension para YouTube com legenda dupla, pausa linha por linha e AI pronunciation scoring.

Fonte: https://languageshadow.com/

Diferença:

```txt
LanguageShadow = YouTube extension
Tutor PC = desktop inteiro + Netflix/aulas/VLC + lousa pedagógica
```

#### GoShadowing / ShadowStudio Desktop

Desktop para Mac/Windows. Baixa vídeos, transcreve com WhisperX, faz shadowing frase por frase e score de pronúncia.

Fonte: https://www.goshadowing.com/shadowstudio

Diferença:

```txt
GoShadowing = importar/baixar vídeo e estudar dentro do app
Tutor PC = capturar o conteúdo enquanto o usuário assiste no app original
```

#### SubX Player

Player/app de aprendizado com vídeos reais, legendas duplas, AI subtitles offline, auto-pause, auto-repeat, shadowing e sentence mining.

Fonte: https://www.subx.app/

Diferença:

```txt
SubX = player de estudo
Tutor PC = overlay sobre qualquer player do PC
```

#### Language Reactor, LingoPause, Lingopie, FlixFluent, Lingo Layer, Lingosive

Extensões/plataformas para aprender com Netflix/YouTube: legenda dupla, dicionário, tradução, salvar vocabulário e algumas features de prática.

Diferença:

```txt
eles focam compreensão/vocabulário/subtitle workflow
nós focamos speaking loop + correção + mini lousa ativa
```

#### ELSA, Speakerly, Ask Maya, JayTalk, Baolingo, Kkobi

Apps de pronúncia/conversação/IA.

Diferença:

```txt
eles treinam dentro do app
nós treinamos em cima do conteúdo que o usuário já está consumindo
```

### Conclusão competitiva

Não construir "mais um app de shadowing".

Construir:

> O professor flutuante que pausa qualquer conteúdo e transforma a frase em aula de speaking.

---

## 5. Referência Perssua / Hades

O Perssua serve como referência visual e de formato:

```txt
desktop app
overlay flutuante
atalhos globais
captura de áudio
settings avançadas
providers de IA
barra compacta sempre no topo
```

Como o código do Perssua é proprietário, a referência prática será o Hades Agent, que é um projeto público inspirado no Perssua.

Fonte Hades:

```txt
https://github.com/euvictorldev/hades-agent
```

O Hades implementa:

```txt
Electron + React + TypeScript + Vite
janelas transparentes/flutuantes
globalShortcut
WindowManager centralizado
preload com contextBridge
IPC bridge seguro
captura de áudio do sistema via desktop capture
AudioWorklet para PCM
streaming para Gemini Live API
settings e shortcuts
tray app
setContentProtection para stealth mode no Windows
```

### O que aprender do Hades

Usar como exemplo de arquitetura, não como produto.

Padrões úteis:

```txt
main.js como orquestrador
electron/windows/windowManager.js para lifecycle de janelas
electron/windows/windowConfigs.js como fonte única das janelas
electron/shortcuts.js para atalhos globais
preload.js para expor API segura ao renderer
electron/ipc/* dividido por domínio
src/services/electron.ts como wrapper tipado do IPC
src/hooks/useAudioRecorder.ts para pipeline de AudioContext/AudioWorklet/PCM
electron/services/geminiLiveService.js para streaming de chunks
electron/store/jsonStore.js como persistência simples inicial
```

### O que NÃO copiar

```txt
produto de entrevista/produtividade
stealth mode como proposta central
memória "dreaming" como prioridade
web search como feature principal
assistente geral
task scheduler
```

Para o Tutor PC, o núcleo é:

```txt
áudio do sistema
segmentação de frase
controle do player
speaking attempt
pronunciation scoring
mini lousa pedagógica
revisão de erros
```

---

## 6. Stack Recomendada

### App desktop

```txt
Electron
React
TypeScript
Vite
```

### UI

```txt
Tailwind CSS ou CSS Modules
Lucide React
Framer Motion opcional
CSS variables para tema
```

### Estado

```txt
Zustand ou store reativa simples
React Query opcional para chamadas async
```

### Banco local

```txt
SQLite
better-sqlite3
Drizzle ORM opcional
```

MVP pode começar com JSON store para velocidade, mas SQLite deve ser o destino final por causa de histórico, tentativas, erros e revisão.

### Empacotamento

```txt
electron-builder
targets Windows: nsis + portable + zip
```

### Áudio

MVP:

```txt
Electron desktopCapturer/getUserMedia
AudioContext
AudioWorklet
PCM 16kHz
base64 chunks via IPC
```

Produção Windows:

```txt
Rust sidecar com WASAPI loopback
microfone separado
mix/ducking opcional
```

### STT

MVP:

```txt
Gemini Live API ou OpenAI Realtime para transcrição streaming
```

Futuro local:

```txt
whisper.cpp
faster-whisper
WhisperX para alinhamento/timestamps
```

### Pronunciation scoring

MVP inglês:

```txt
Azure Speech Pronunciation Assessment
ou Gemini multimodal/audio + prompt rigoroso
```

Futuro:

```txt
motor híbrido:
- STT da tentativa
- alinhamento original vs tentativa
- LLM para explicação pedagógica
- modelos específicos por idioma
```

### IA explicadora

```txt
Gemini Flash / OpenAI mini para explicações rápidas
modelo mais forte apenas quando necessário
```

---

## 7. Arquitetura Geral

```txt
Electron App
│
├── Main Process
│   ├── WindowManager
│   ├── OverlayManager
│   ├── ShortcutService
│   ├── AudioCaptureService
│   ├── PlayerControlService
│   ├── DatabaseService
│   ├── SecureSettingsService
│   └── IPC Router
│
├── Native Sidecar
│   ├── WindowsAudioCapture WASAPI
│   ├── MediaKeyController
│   └── OptionalLocalSTT
│
├── AI Pipeline
│   ├── VAD / silence detection
│   ├── STT streaming
│   ├── SentenceSegmenter
│   ├── TutorExplainer
│   ├── PronunciationScorer
│   └── ReviewGenerator
│
└── Renderer React
    ├── Main Dashboard
    ├── Floating Control Bar
    ├── Tutor Board Overlay
    ├── Practice Modal
    ├── Review Library
    └── Settings
```

---

## 8. Estrutura de Pastas Sugerida

```txt
tutor-pc/
├── electron/
│   ├── main.ts
│   ├── preload.ts
│   ├── windows/
│   │   ├── windowManager.ts
│   │   └── windowConfigs.ts
│   ├── ipc/
│   │   ├── index.ts
│   │   ├── audioHandlers.ts
│   │   ├── tutorHandlers.ts
│   │   ├── settingsHandlers.ts
│   │   ├── shortcutHandlers.ts
│   │   └── playerHandlers.ts
│   ├── services/
│   │   ├── audioCaptureService.ts
│   │   ├── sttService.ts
│   │   ├── pronunciationService.ts
│   │   ├── tutorBoardService.ts
│   │   ├── playerControlService.ts
│   │   ├── reviewService.ts
│   │   └── secureStore.ts
│   └── db/
│       ├── schema.ts
│       ├── migrations/
│       └── database.ts
│
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   └── router.tsx
│   ├── windows/
│   │   ├── FloatingBar.tsx
│   │   ├── TutorBoard.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Settings.tsx
│   │   └── Review.tsx
│   ├── components/
│   │   ├── PhraseCard.tsx
│   │   ├── AttemptPanel.tsx
│   │   ├── ErrorBoard.tsx
│   │   ├── ScoreRing.tsx
│   │   └── ShortcutKey.tsx
│   ├── hooks/
│   │   ├── useSystemAudio.ts
│   │   ├── useMicrophoneAttempt.ts
│   │   ├── useTutorSession.ts
│   │   └── useSettings.ts
│   ├── services/
│   │   └── electron.ts
│   ├── theme/
│   │   ├── colors.ts
│   │   └── tokens.css
│   └── types/
│       ├── tutor.ts
│       ├── language.ts
│       └── electron.ts
│
├── native/
│   └── windows-audio-capture/
│
├── package.json
├── vite.config.ts
└── electron-builder.yml
```

---

## 9. Janelas do App

### Main Dashboard

Janela normal para:

```txt
histórico
frases salvas
erros recorrentes
revisões pendentes
estatísticas
configurações rápidas
```

### Floating Bar

Barra compacta estilo Perssua/Hades.

Estados:

```txt
Idle
Listening
Phrase Detected
Paused
Practice
Feedback
Review Due
```

Controles:

```txt
Start Listening
Pause/Resume
Practice Current Phrase
Open Board
Settings
```

### Tutor Board

Mini lousa principal.

Conteúdo:

```txt
frase original
tradução
transcrição da tentativa
score
erros principais
explicação curta
treino em blocos
botões: tentar de novo, continuar, salvar, revisar depois
```

### Settings

Seções:

```txt
AI Providers
Models
Audio & Screen
Languages
Practice
Shortcuts
Privacy
Subscription
Help
```

### Review

Sessão de revisão dos erros:

```txt
repetir frase
completar lacuna
traduzir falando
ditado
mini conversa usando a estrutura
```

---

## 10. Tema Visual

Usar a identidade do Evolution mobile:

```txt
primary:      #7C6FF7
secondary:    #5ED4C4
danger:       #F45B69
warning:      #FFAD3B
success:      #2DC98E
text:         #1C1B2E
textMid:      #4A4867
textSub:      #9896B0
```

Versão desktop dark:

```txt
background:   #08070D
surface:      #12111A
card:         #191826
cardHover:    #211F31
border:       rgba(236,234,245,0.12)
primary:      #7C6FF7
primarySoft:  rgba(124,111,247,0.18)
secondary:    #5ED4C4
danger:       #F45B69
warning:      #FFAD3B
success:      #2DC98E
text:         #F8F7FC
textMid:      #C7C3DA
textSub:      #9896B0
```

Direção:

```txt
escuro
limpo
profissional
menos "hacker"
mais "sala de aula moderna"
cards compactos
border radius 8px
atalhos visíveis
ícones Lucide
```

---

## 11. Pipeline de Áudio

### Captura do sistema

MVP inspirado no Hades:

```txt
desktopCapturer.getSources()
→ escolher screen/source
→ getUserMedia com chromeMediaSource: desktop
→ parar tracks de vídeo
→ manter track de áudio
→ AudioContext
→ AudioWorklet
→ Float32Array
→ RMS para detectar silêncio
→ converter para PCM 16-bit
→ base64
→ IPC para Main
→ STT streaming
```

### Captura do microfone

Separada da captura do sistema:

```txt
getUserMedia({ audio: true })
→ gravar tentativa do usuário
→ enviar para pronunciation scoring
```

### VAD simples

Critérios iniciais:

```txt
RMS abaixo de threshold
silêncio entre 700ms e 1200ms
frase com mínimo de 3 palavras
limite máximo de 8s por frase no MVP
```

### VAD futuro

```txt
WebRTC VAD
Silero VAD
segmentação por pontuação do STT
alinhamento com timestamps
```

---

## 12. Pipeline de Ensino

```txt
System audio chunk
→ STT partial
→ transcript buffer
→ sentence segmentation
→ phrase candidate
→ optional translation
→ pause player
→ open tutor board
→ record user attempt
→ score pronunciation
→ generate teaching board
→ repeat / continue
→ persist mistakes
```

### SentenceSegmenter

Entrada:

```ts
type TranscriptDelta = {
  text: string;
  isFinal: boolean;
  startedAt: number;
  endedAt?: number;
  source: 'system-audio';
};
```

Saída:

```ts
type SentenceCandidate = {
  id: string;
  text: string;
  language: string;
  confidence: number;
  startMs?: number;
  endMs?: number;
  reason: 'silence' | 'punctuation' | 'max-duration' | 'manual';
};
```

### PracticeAttempt

```ts
type PracticeAttempt = {
  id: string;
  sentenceId: string;
  spokenText: string;
  score: number;
  wordAccuracy: number;
  phonemeAccuracy?: number;
  fluency?: number;
  rhythm?: number;
  issues: PronunciationIssue[];
  createdAt: string;
};
```

### PronunciationIssue

```ts
type PronunciationIssue = {
  target: string;
  heard?: string;
  type:
    | 'missing-word'
    | 'wrong-word'
    | 'phoneme'
    | 'stress'
    | 'rhythm'
    | 'intonation'
    | 'grammar'
    | 'tone'
    | 'linking';
  severity: 'low' | 'medium' | 'high';
  explanationPtBr: string;
  correctionSteps: string[];
};
```

---

## 13. Controle do Player

MVP:

```txt
enviar tecla MediaPlayPause
fallback: Space
atalho manual para continuar
```

Funciona em:

```txt
YouTube
Netflix
VLC
players web
cursos online
podcasts
```

Limitações:

```txt
alguns players podem não responder a Space
se o foco não estiver no player, pode falhar
DRM pode bloquear captura visual, mas não impede captura de áudio do sistema
```

Futuro:

```txt
detectar app ativo
profiles por app: Netflix, Chrome, Edge, VLC
browser extension auxiliar opcional
controle por media session quando disponível
```

---

## 14. Banco de Dados

Usar SQLite local.

### Tables

```txt
sessions
sentences
attempts
mistakes
reviews
settings
language_profiles
```

### Schema conceitual

```ts
type Session = {
  id: string;
  sourceApp: string;
  sourceTitle?: string;
  language: string;
  startedAt: string;
  endedAt?: string;
};

type Sentence = {
  id: string;
  sessionId?: string;
  originalText: string;
  translation?: string;
  explanation?: string;
  language: string;
  sourceApp?: string;
  sourceTitle?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  createdAt: string;
};

type Attempt = {
  id: string;
  sentenceId: string;
  spokenText: string;
  score: number;
  wordAccuracy: number;
  phonemeAccuracy?: number;
  feedbackJson: string;
  createdAt: string;
};

type Mistake = {
  id: string;
  sentenceId: string;
  type: string;
  target: string;
  heard?: string;
  explanationPtBr: string;
  correctionStepsJson: string;
  count: number;
  createdAt: string;
  updatedAt: string;
};

type Review = {
  id: string;
  mistakeId: string;
  nextReviewAt: string;
  intervalDays: number;
  easeFactor: number;
  status: 'pending' | 'done' | 'skipped';
};
```

---

## 15. Multi-Idioma

Arquitetura desde o início:

```ts
type LanguageProfile = {
  id: 'en' | 'es' | 'fr' | 'de' | 'ko' | 'ja' | 'zh';
  displayName: string;
  nativeName: string;
  script: 'latin' | 'hangul' | 'hanzi' | 'kana' | 'mixed';
  romanization?: 'pinyin' | 'romaja' | 'romaji';
  sttModelHint: string;
  pronunciationDimensions: string[];
  commonIssuesForPtBr: string[];
};
```

### Inglês primeiro

Foco de correção:

```txt
TH
R final
vogais curtas/longas
ED final
word stress
connected speech
reductions: gonna, wanna, should've, would've
intonation
fluency
missing words
```

### Coreano futuro

Foco:

```txt
hangul
batchim
ligações entre sílabas
aspiração
tensão consonantal
formalidade
ritmo natural
romanização auxiliar
```

### Mandarim futuro

Foco:

```txt
tons
pinyin
iniciais/finais
pitch contour
ritmo silábico
hanzi + pinyin + tradução
```

---

## 16. Segurança e Privacidade

Princípios:

```txt
renderer sem nodeIntegration
contextIsolation true
sandbox true
IPC mínimo e tipado
validar payloads com Zod
API keys com safeStorage
dados locais em SQLite
usuário escolhe provider cloud/local
modo privado sem salvar histórico
```

### Captura

O app deve explicar claramente:

```txt
captura áudio do sistema quando Listening está ligado
captura microfone somente durante tentativa
captura de tela é opcional e não necessária para o MVP
```

### Stealth mode

Não deve ser o centro do produto.

Pode existir como opção avançada:

```txt
ocultar overlay de screen shares
útil para privacidade em aulas/calls
não vender como "cola" ou evasão
```

---

## 17. Atalhos Globais

MVP:

```txt
Ctrl+Alt+L: Start/Stop Listening
Ctrl+Alt+B: Open Tutor Board
Ctrl+Alt+P: Practice current phrase
Ctrl+Alt+Space: Pause/Resume content
Ctrl+Alt+S: Settings
Esc: Hide active overlay
```

Todos reconfiguráveis.

---

## 18. Providers

### MVP cloud

```txt
STT streaming: Gemini Live ou OpenAI Realtime
Pronunciation: Azure Speech ou Gemini audio analysis
LLM feedback: Gemini Flash / OpenAI mini
Translation: Gemini Flash / DeepL opcional
```

### Futuro local

```txt
STT local: whisper.cpp / faster-whisper
alignment: WhisperX
LLM local: Ollama / LM Studio
pronunciation local: heurísticas + alignment + modelo futuro
```

### Settings de provider

Inspirado no Perssua/Hades:

```txt
AI Sources
Models
Transcription
Analysis
Translation
Local
Cloud
```

---

## 19. MVP

Objetivo:

> Provar que o app consegue escutar o PC, pausar uma frase, fazer o usuário repetir e ensinar um erro de speaking.

### MVP obrigatório

```txt
Electron + React + TypeScript + Vite
Windows support
Floating Bar
Settings básica
captura áudio do sistema
captura microfone
STT streaming inglês
detecção simples de fim de frase
pause/resume via MediaPlayPause
Tutor Board
pronunciation scoring inglês
explicação pedagógica em PT-BR
histórico local simples
atalhos globais
```

### Fora do MVP

```txt
todos os idiomas
app mobile
player interno
browser extension
Anki export
conta/sync
pagamento
modo local completo
mandarim tons avançado
coreano batchim avançado
captura visual obrigatória
```

---

## 20. Milestones Técnicos

### M0 — Shell desktop

```txt
criar Electron app
criar main/preload/renderer
criar windowManager
criar floating bar
criar settings
criar shortcuts
empacotar Windows portable
```

Critério de pronto:

```txt
abre/fecha overlay com atalho
settings salva preferências
app roda em tray
```

### M1 — Captura e transcrição

```txt
capturar áudio do sistema
converter para PCM
enviar chunks para STT
mostrar transcript parcial/final
detectar silêncio básico
```

Critério de pronto:

```txt
assistindo YouTube/Netflix, app mostra frases em tempo real
```

### M2 — Pausa e Tutor Board

```txt
detectar frase final
pausar player
abrir tutor board
mostrar frase original
mostrar tradução
mostrar explicação simples
continuar vídeo
```

Critério de pronto:

```txt
app pausa depois de uma frase e abre a lousa
```

### M3 — Speaking attempt

```txt
gravar microfone
transcrever tentativa
comparar com frase original
gerar score
exibir erros
permitir tentar de novo
```

Critério de pronto:

```txt
usuário repete frase e recebe feedback acionável
```

### M4 — Persistência e revisão

```txt
SQLite
sentences
attempts
mistakes
review queue
dashboard simples
```

Critério de pronto:

```txt
app mostra erros recorrentes e frases para revisar
```

### M5 — Beta fechado

```txt
installer
logs
crash handling
onboarding
calibração de microfone
config de API key
limites de custo
```

Critério de pronto:

```txt
5 a 20 usuários testando no Windows
```

---

## 21. Riscos

### Risco técnico alto

Captura de áudio do sistema pode variar por Windows/dispositivo.

Mitigação:

```txt
MVP com Electron desktop capture
produção com WASAPI sidecar
fallback para selecionar output device
```

### Risco de latência

Se STT + pausa demorar, a experiência quebra.

Mitigação:

```txt
streaming real-time
frases curtas
buffer inteligente
pausa apenas quando confiança for boa
```

### Risco de interrupção excessiva

Pausar toda frase pode irritar.

Mitigação:

```txt
modo leve: sugere sem pausar
modo frase: pausa frases úteis
modo rígido: só continua após nota mínima
frequência ajustável
```

### Risco concorrencial

Extensões e players já fazem legenda/shadowing.

Mitigação:

```txt
não competir em legenda dupla
focar mini lousa + speaking + desktop inteiro
```

### Risco de custo

STT e scoring podem ficar caros.

Mitigação:

```txt
limites por sessão
modelo barato para feedback
cache de explicações
local STT futuro
usuário pode usar própria API key
```

---

## 22. Métricas de Produto

```txt
frases capturadas por sessão
frases praticadas por sessão
tentativas por frase
score médio inicial
melhora entre tentativa 1 e 2
erros recorrentes corrigidos
tempo até primeira prática
retenção D1/D7
percentual de sessões com revisão
```

Métrica mais importante do MVP:

```txt
% de frases em que o usuário tenta de novo após ver a lousa
```

Se a lousa fizer a pessoa repetir, o produto tem alma.

---

## 23. Naming

Opções:

```txt
LinguaLoop
PhrasePilot
FluentBoard
ShadowDesk
TutorBoard
LoopTutor
SpeakBoard
```

Nome interno recomendado por enquanto:

```txt
Tutor PC
```

Nome de feature principal:

```txt
Lousa Flutuante
Tutor Board
Mini Aula
```

---

## 24. Frases de Venda

Curta:

> Seu professor de inglês flutuante para qualquer áudio do PC.

Mais clara:

> Aprenda inglês assistindo Netflix, YouTube e aulas no PC. O app pausa as frases, corrige sua fala e mostra uma mini lousa explicando seus erros.

Mais emocional:

> Pare de só assistir. Transforme cada cena em uma aula de speaking.

Futura multi-idioma:

> Aprenda idiomas com qualquer áudio do seu computador.

---

## 25. Decisão Atual

Construir um app desktop separado, inspirado tecnicamente no padrão Perssua/Hades, mas com proposta educacional.

MVP:

```txt
Windows
inglês
captura áudio do sistema
pausa em frases
speaking practice
pronunciation feedback
mini lousa pedagógica
histórico local
```

O norte:

> Não ser uma legenda inteligente. Ser o professor que interrompe na hora certa, ensina o erro e faz o usuário falar de novo.
