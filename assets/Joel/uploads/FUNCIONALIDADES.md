# PROFESSOR — Documento de Funcionalidades (para redesign)

> Guia completo de tudo que o app faz hoje, janela por janela, fluxo por fluxo.
> Use como base para criar um novo design. Foi escrito para um designer entender
> **o que** o app faz e **quais elementos** precisam existir, sem depender do código.

---

## 1. O conceito

**PROFESSOR** é um tutor de idiomas de **desktop (Electron, Windows)** que fica
**flutuando por cima** de qualquer coisa que você assiste no PC (séries, filmes,
YouTube, Prime, Netflix). Ele:

1. **Escuta o áudio do sistema** (não o microfone) enquanto você assiste;
2. **Transcreve a fala em tempo real** e detecta o idioma automaticamente;
3. **Ensina** com vocabulário, tradução, romanização e dicas;
4. **Faz você praticar** repetindo as frases e avalia sua pronúncia;
5. **Memoriza** o que você aprendeu com repetição espaçada (flashcards).

Filosofia: **aprender com o conteúdo que você já consome**, transformando consumo
passivo em prática ativa de _speaking_.

**Plataforma:** app desktop com **múltiplas janelas independentes** (não é uma SPA
de página única). Cada janela é uma ferramenta. Várias podem estar abertas ao mesmo tempo.

---

## 2. Identidade visual atual (ponto de partida — pode mudar tudo)

- **Tema:** escuro (dark) por padrão.
- **Paleta atual:**
  - Fundo: `#0A0A0A` (quase preto) · Superfícies: `#1A1A1A` / `#242424` · Bordas: `#2A2A2A`
  - Texto: `#F5F5F5` (claro) · Texto secundário/"muted": `#A1A1AA`
  - **Primária (roxo):** `#7C3AED` — botões de ação, destaques, links
  - Sucesso (verde): `#059669` · Aviso (laranja): `#D97706` · Erro/perigo (vermelho): `#DC2626` · Ciano: `#0891B2`
- **Estilo:** cantos arredondados (lg/xl/full), bordas sutis, muito espaço negativo,
  tipografia pequena e densa, ícones lineares (biblioteca **lucide**), fonte mono para
  romanização/códigos.
- **Janelas sem moldura nativa** (frameless): cada uma tem uma **TitleBar própria**
  customizada (arrastar a janela, minimizar, fechar). A barra flutuante é translúcida.

> No redesign você tem liberdade total de paleta, tipografia e layout. O que **precisa
> permanecer** é o conjunto de funcionalidades e estados descritos abaixo.

---

## 3. As janelas

O app tem **5 janelas**. Abaixo, cada uma em detalhe.

### 3.1. 🎈 Barra Flutuante (Floating Bar) — a janela central

É a janela principal de uso. Pequena, fica **sempre no topo**, translúcida, arrastável.
É por onde você controla a escuta e pratica.

**Estrutura:**

- **Topo — Abas + status:**
  - Aba **"Transcrição"** (ícone de microfone)
  - Aba **"Sessão (N)"** — N = nº de tentativas de prática feitas; ícone de pessoa
  - Indicador de status à direita: **"AO VIVO"** (vermelho pulsante) quando escutando,
    ou **"OFF"** quando parado
  - Ícone de engrenagem (abre Configurações) e botão de fechar

- **Corpo (muda conforme a aba):**
  - **Aba Transcrição:** feed rolável das frases transcritas, uma embaixo da outra. A
    última frase em destaque enquanto está sendo processada. Mensagens de erro aparecem aqui.
  - **Aba Sessão:** lista das suas tentativas de prática (detalhada no item 4.4).
  - **Overlay de Auto-treino:** quando o modo auto-treino dispara, este overlay **cobre a
    aba Transcrição** (a aba Sessão continua acessível). Detalhado no item 4.3.

- **Rodapé — Controles:**
  - Botão **"Escutar" / "Parar"** (liga/desliga a captura de áudio) — vermelho quando ativo
  - Botão **"Auto-treino ON/OFF"** (ícone de raio ⚡) — liga o modo de prática automática
  - Botão **"Analisar"** (abre o Tutor Board)

- **Medidor de nível (Audio Meter):** uma barrinha fina no rodapé que mostra o **volume
  captado em tempo real**, com um marcador do "limiar de fala" (verde quando passa do
  limiar = está captando fala; cinza quando abaixo). Ajuda o usuário a saber se o áudio
  está chegando.

**Estados da barra:**
- `Parado` (OFF) — nada sendo captado
- `Escutando` (AO VIVO) — capturando e detectando fala
- `Processando` — transcrevendo um trecho
- `Auto-treino ativo` — overlay de repetição visível

---

### 3.2. 📖 Tutor Board — o quadro de ensino

Janela maior, onde o conteúdo educativo aparece. **Abre automaticamente quando a primeira
frase é transcrita** (não aparece vazia no início). Cada frase capturada vira um **card**.

**Cada card (EntryCard) contém, de cima para baixo:**

1. **Número da frase** (#1, #2, …) à esquerda.
2. **Romanização** (quando aplicável — chinês→Pinyin, japonês→Romaji, coreano, etc.),
   em fonte mono, com rótulo do sistema ("Pinyin", "Romaji", "Romanização", "Transliteração").
   Acompanha o highlight karaokê durante a reprodução.
3. **A frase transcrita** (no idioma original) — **cada palavra é clicável** (abre o
   dicionário, ver item 4.6). Durante a reprodução, a palavra que está tocando fica
   **destacada (karaokê)**.
4. **"Fala natural"** (só para inglês) — linha amarela mostrando a pronúncia conectada:
   linking entre palavras ("in a hat" → "in‿a hat") e reduções ("want to" → "wanna",
   "going to" → "gonna"). Só aparece quando há algo a mostrar.
5. **Tradução em inglês** (rótulo "EN") — quando o conteúdo não é inglês.
6. **Botões de ação** (canto superior direito do card):
   - **"Original"** — toca o **áudio real da cena** daquela frase (a voz do ator),
     com sincronização karaokê palavra por palavra
   - **"TTS"** — toca uma **voz sintetizada** (clara e lenta) da frase, também com karaokê
   - **"Praticar"** — inicia a gravação da sua voz para repetir a frase (3-2-1 → grava → avalia)

7. **Seção de Vocabulário** (📖 "VOCABULÁRIO"): 1-4 palavras/expressões úteis extraídas
   da frase, cada uma como uma "pílula" com a **palavra + tradução em português**. Clicáveis.
8. **Dica do tutor** (💡): uma observação curta em português sobre gramática, pronúncia,
   expressão idiomática ou contexto cultural.
9. **Faixa de erro** (quando a análise da IA falha): aviso vermelho "⚠️ Análise falhou: …"
   com o motivo — mas o card ainda mostra o texto.

**Resultado de prática (aparece no card após gravar):** porcentagem de precisão (verde
≥80%, amarelo ≥50%, vermelho abaixo) + um **diff palavra por palavra** (verde = acertou,
vermelho = faltou/errou, laranja = falou a mais).

**Gerenciamento de memória:** os clipes de áudio ficam só em memória, com teto de 50 MB
(os mais antigos são descartados). O board não acumula infinitamente.

---

### 3.3. 🧠 Revisão (Review) — flashcards de repetição espaçada

Janela de estudo das frases capturadas, usando o algoritmo **SM-2** (repetição espaçada,
estilo Anki). **Treina frases completas** (não palavras soltas).

**Estrutura:**

- **Abas de idioma** (no topo, se houver mais de um idioma): cada idioma estudado é um
  **deck separado** (🇬🇧 Inglês, 🇰🇷 Coreano…), com o número de cards pendentes. O usuário
  pode estar aprendendo vários idiomas sem misturar.
- **Contador de progresso:** "3 / 12" (posição atual / total da fila) e "N revisadas".
- **Card central (flashcard):**
  - **Frente:** a frase no idioma original + botão de ouvir (TTS) + romanização (se houver)
  - **Botão "Mostrar resposta"**
  - **Verso (após revelar):** a **tradução em português** da frase
  - **Botão "Ver variações"** → pede à IA **2-3 formas alternativas** de dizer a mesma
    frase (paráfrases), cada uma com tradução e botão de ouvir. (Gerado sob demanda.)
- **Botões de avaliação** (após revelar): **"Errei"** (vermelho), **"Difícil"** (amarelo),
  **"Fácil"** (verde) — alimentam o agendamento SM-2.
- **Estado vazio:** "Revisão concluída! 🎉" ou "Nada para revisar agora".

**Como se chega aqui:** pelo Dashboard (botão "Revisar tudo" ou clicando num idioma
específico), pela navegação lateral, ou pelo atalho.

---

### 3.4. 🏠 Dashboard — a central / início

Janela "home" com visão geral do progresso.

**Estrutura:**

- **Barra lateral (sidebar) à esquerda** com navegação por ícones:
  - Logo "T" (quadrado roxo)
  - **Início** (ativo) · **Revisão** · **Tutor Board** · **Configurações** (no rodapé)
- **Conteúdo principal:**
  - Saudação ("Bem-vindo! Pronto para praticar hoje?")
  - **3 cards de estatística:** **Sessões** (nº de sessões), **Frases** (total de cards),
    **Sequência** (streak de dias seguidos estudando)
  - **"Revisar por idioma":** chips clicáveis, um por idioma estudado (bandeira + nome +
    total + "N a revisar"). Clicar abre a Revisão **direto naquele idioma**. Idiomas sem
    nada pendente ficam desabilitados (acinzentados).
  - **Botão "Revisar tudo (N pendentes)"** — abre a Revisão no idioma com mais pendências.
  - **"Palavras que mais erro":** lista das palavras mais mal-pronunciadas (top mistakes),
    com contagem de erros.
  - **Sessões recentes:** histórico curto das últimas sessões.

---

### 3.5. ⚙️ Configurações (Settings)

Janela de configuração. Modelo **BYOK (Bring Your Own Key)** — o usuário usa as próprias
chaves de API.

**Seções:**

1. **Provedores de IA** ("Sua chave, seus tokens"): lista de provedores — **OpenAI,
   Google Gemini, Anthropic, Groq**. Cada um com: ícone de chave (verde se configurado),
   nome, link "obter chave", botão **+ Adicionar / Editar / remover (lixeira)**. Ao
   adicionar, um campo de senha (com olho para mostrar/ocultar) + botão Salvar. Feedback
   "Salvo ✓" ou erro. As chaves são **criptografadas** no disco (Windows DPAPI), nunca expostas.
2. **Provider Ativo:** dois seletores — **"Tutor AI"** (qual IA faz a análise/vocabulário)
   e **"Transcrição"** (qual faz o speech-to-text; só provedores que suportam). 
3. **Atalhos globais:** tabela de teclas:
   - `Ctrl+Alt+L` — Iniciar/parar escuta
   - `Ctrl+Alt+D` — Abrir Dashboard
   - `Ctrl+Alt+S` — Abrir Configurações
   - `Ctrl+Alt+B` — Abrir Tutor Board
   - `Ctrl+Alt+Space` — Pausar/retomar o player (mídia)
4. **Sobre:** nome + versão.

---

## 4. Fluxos e funcionalidades transversais

### 4.1. Captura e transcrição ao vivo
- Captura o **áudio do sistema** (loopback WASAPI) via `getDisplayMedia` — **não usa o
  microfone** (para não pegar ruído do ambiente).
- **Detecção de voz (VAD):** detecta quando há fala e quando a frase terminou (silêncio),
  recortando trechos por frase.
- **Compressor de áudio** suaviza falas altas/baixas para melhorar a transcrição.
- **Detecção automática de idioma** — o usuário não precisa configurar.
- **Filtro de não-fala (rigoroso):** descarta música, ruído ambiente e alucinações do
  modelo (ex.: "Music", "[Applause]", "Thank you" forçado, texto garbled). Usa sinais de
  confiança do Whisper + blocklist de eventos sonoros. **Trilha sonora não vira transcrição.**

### 4.2. Os três modos de áudio (importante para o design)
Para cada frase/palavra, existem **três fontes de áudio** que o usuário pode comparar:
- 🟢 **Original** — a voz real da cena (o ator falando)
- 🟡 **TTS** — voz sintetizada, clara e lenta (referência de pronúncia)
- 🔵 **Sua voz** — sua gravação de prática

A interface deve deixar claro esse "trio" em vários lugares (cards, prática, comparação).

### 4.3. Modo Auto-treino (overlay "Repita a frase")
Quando ligado, **pausa o vídeo automaticamente** a cada frase falada (controla o player
via mídia do Windows) e mostra um overlay:
- Cabeçalho **"⚡ REPITA A FRASE"**
- A frase + botões **Original** e **TTS**
- Botão **"Gravar"** (você fala) — com contagem 3-2-1 e tempo de gravação proporcional ao
  tamanho da frase
- Após gravar: **% de precisão + diff** + botão **"Minha voz"** (ouvir sua gravação)
- Botões **"Continuar ▶"** (despausa o vídeo e segue) e **"Pular ▶"** (pula sem gravar)
- A tentativa é salva na aba **Sessão**.

### 4.4. Aba Sessão — histórico de tentativas
Cada tentativa de prática vira um card com:
- **Número da tentativa** + **% de precisão** (cor por faixa)
- Botão **"Ouvir"** (sua gravação)
- **"Original"** (o que era pra falar) e **"Você falou"** (o que você falou — transcrito)
- **Diff palavra por palavra** (cores)
- **🔴 "Pronúncia a corrigir"** — painel rigoroso com **as palavras que você errou**, cada
  uma com botão para ouvir a **pronúncia original (voz da cena)** e o **TTS**. Mensagem:
  "Repita cada palavra até acertar — o objetivo é zerar esta lista."
- **"Comparar entonação"** (expansível) — um **gráfico de curva de pitch (entonação)**
  sobrepondo as três vozes (Você 🔵 / Original 🟢 / TTS 🟡), mostrando subidas e descidas do
  tom para ajustar sotaque e melodia + botões para tocar os três lado a lado.

### 4.5. Pronúncia / Speaking (rigoroso)
- A avaliação compara palavra por palavra (match exato, não fuzzy) — erros sutis aparecem.
- Palavras erradas são registradas como "mistakes" (alimentam o Dashboard).
- Foco em treinar _speaking_ de verdade: ouvir original + TTS, gravar, ver o que errou,
  e comparar a entonação.

### 4.6. Dicionário interativo (clique na palavra)
Clicar em **qualquer palavra** (na transcrição ou no Tutor Board) abre um **popover** com:
- A palavra + romanização
- Botões **"Original"** (corta e toca só aquela palavra no áudio da cena) e **"TTS"**
- **Significados** (1-4 traduções/sentidos, o mais relevante primeiro)
- **Nota de uso** (nuance, registro, falso cognato) quando relevante
- Botão **"Praticar"** — treinar a pronúncia daquela palavra isolada

### 4.7. Repetição espaçada (SRS) por frase + variações
- Cada frase capturada vira um flashcard (SM-2).
- Decks **separados por idioma**.
- Variações geradas pela IA sob demanda na revisão.

### 4.8. Separação por idioma (multi-idioma)
- O idioma é detectado e normalizado automaticamente (ex.: "korean"→ko, "ko-KR"→ko).
- Frases, decks e estatísticas **não se misturam** entre idiomas.
- O usuário escolhe qual idioma revisar.

---

## 5. Estados e casos de borda que o design precisa cobrir

- **Vazio:** sem áudio ainda / sem frases / nada para revisar / nenhum provider configurado.
- **Carregando:** transcrevendo / analisando (IA) / gerando variações / analisando entonação.
- **Erro:** análise da IA falhou (mostrar motivo no card), áudio desconectado, sem chave de API.
- **Gravando:** contagem 3-2-1, "gravando agora", avaliando.
- **Tocando áudio:** estado de "ouvindo" (a escuta pausa durante a reprodução para não
  capturar o próprio som).
- **Multi-idioma:** abas/decks; idiomas sem pendência desabilitados.
- **Resultado de prática:** faixas de cor por score (verde/amarelo/vermelho).
- **Idiomas ruído:** pode aparecer um idioma com 1 card (mis-detecção) — design deve tolerar.

---

## 6. Modelo de dados (o que existe por trás, para informar a UI)

- **Frase/Card (vocab):** texto original, romanização, tradução PT, idioma, campos SM-2
  (facilidade, intervalo, repetições, vencimento, lapsos).
- **Sessão:** id, início, nº de linhas.
- **Erros (mistakes):** palavra, idioma, contagem, último erro.
- **Streak:** sequência de dias + última data ativa.
- **Tentativa (attempt):** frase original, o que foi falado, score, diff, áudio do usuário,
  áudio original, cues (tempos por palavra), idioma.
- **Análise do tutor:** transcrição, romanização, tradução EN, tradução PT, vocabulário,
  dica, idioma, áudio original + cues.
- **Estatísticas:** nº de sessões, nº de frases, pendentes, streak, idiomas (com contagem),
  sessões recentes, top erros.

---

## 7. Idiomas suportados (detecção + voz + romanização)

Inglês, Espanhol, Português, Francês, Alemão, Italiano, Russo, Árabe, Hindi, Tailandês,
Holandês, Turco, Polonês, Vietnamita, Indonésio, **Chinês** (Pinyin), **Japonês** (Romaji),
**Coreano** (romanização). Cada um tem voz de TTS própria e, quando aplicável, sistema de
romanização específico.

---

## 8. Resumo das telas a desenhar

| Janela | Função | Elementos-chave |
|---|---|---|
| **Barra Flutuante** | Controle + transcrição ao vivo + prática | abas Transcrição/Sessão, Escutar, Auto-treino, medidor, overlay de repetição |
| **Tutor Board** | Ensino por frase | cards com original/TTS/praticar, vocabulário, dica, romanização, fala natural, karaokê |
| **Revisão** | Flashcards SM-2 | abas de idioma, frente/verso, variações, Errei/Difícil/Fácil |
| **Dashboard** | Início + progresso | sidebar, stats, chips de idioma, revisar, top erros |
| **Configurações** | Chaves + provedores + atalhos | provedores BYOK, provider ativo, atalhos, sobre |

---

## 9. Funcionalidades futuras (planejadas — bom prever no design)

- **Modo conversação com IA:** um chat onde a IA conversa com o usuário, dá dicas e treina
  uma conversa baseada nas frases faladas na sessão (treino ativo de _speaking_ com feedback).

---

### Princípios para o novo design
1. **Leveza e foco** — a barra flutuante não pode atrapalhar o vídeo.
2. **O "trio de áudio" (Original / TTS / Você)** deve ser visualmente claro e consistente.
3. **Rigor no speaking** — destacar bem o que o usuário errou e como corrigir.
4. **Multi-idioma sem mistura** — separação clara por idioma.
5. **Estados sempre visíveis** — carregando, erro, vazio, gravando, tocando.
6. **Acessível e legível** — muita informação densa; hierarquia tipográfica importa.
