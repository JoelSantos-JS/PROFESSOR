# PROFESSOR - Plano futuro: legenda e traducao simultanea

> Ideia baseada no comentario: "um sistema de traducao com legenda simultanea".
> O PROFESSOR ja faz parte disso hoje, mas com foco em estudo. Este documento separa
> uma implementacao futura para transformar essa base em um modo de legenda/traducao
> ao vivo, simples de usar enquanto o usuario assiste qualquer conteudo no PC.

---

## 1. Objetivo

Criar um modo opcional chamado **Legenda ao Vivo**:

- captura o audio do sistema;
- transcreve a fala quase em tempo real;
- mostra a legenda original em uma janela pequena sobre o video;
- mostra a traducao logo abaixo;
- permite clicar em uma palavra/frase para abrir o modo de estudo atual.

Resumo: o usuario assiste normalmente, entende o conteudo com legenda/traducao ao vivo
e, quando quiser estudar, transforma aquele trecho em material do PROFESSOR.

---

## 2. O que o app ja tem hoje

O core necessario ja existe em boa parte:

- captura de audio do sistema;
- VAD para detectar fala e silencio;
- transcricao por provider;
- deteccao de idioma;
- analise/traducao com IA;
- Tutor Board com frases, vocabulario, dica e pratica;
- audio original por frase;
- recorte aproximado por palavra;
- TTS;
- janela flutuante sempre no topo.

Por isso, a feature nao nasce do zero. Ela e uma nova experiencia em cima do motor atual.

---

## 3. Diferenca entre o modo atual e o modo futuro

### Modo atual: estudo

- mostra cards completos;
- explica vocabulario;
- gera dicas;
- treina pronuncia;
- salva frases;
- mede progresso;
- usa o Tutor Board como tela principal.

### Modo futuro: legenda/traducao simultanea

- foco em entender enquanto assiste;
- UI muito menor;
- pouca explicacao na tela;
- baixa interrupcao;
- traducao rapida;
- clique para estudar apenas quando o usuario quiser.

O risco seria misturar os dois e deixar tudo pesado. O ideal e criar um modo separado.

---

## 4. MVP recomendado

### 4.1. Janela "Legenda ao Vivo"

Uma janela pequena, transparente e sempre no topo, independente da Floating Bar.

Elementos:

- linha 1: texto original;
- linha 2: traducao em portugues;
- indicador pequeno de idioma;
- botao de fixar/desfixar;
- botao de pausar legenda;
- botao de enviar frase para o Tutor Board.

Comportamento:

- nao deve crescer muito;
- deve manter no maximo 2 ou 3 linhas visiveis;
- texto antigo desaparece automaticamente;
- usuario pode arrastar e redimensionar;
- pode ficar embaixo do video como legenda comum.

### 4.2. Pipeline rapido

Fluxo:

1. Audio do sistema entra.
2. VAD fecha um trecho de fala.
3. Transcricao retorna texto original.
4. Traducao curta e direta e gerada.
5. Overlay mostra original + traducao.
6. Se o usuario clicar, o trecho vira card de estudo.

No MVP, a traducao pode vir depois da transcricao completa da frase. Nao precisa ser palavra por
palavra em tempo real logo no inicio.

### 4.3. Entrada para estudo

Cada legenda pode ter uma acao discreta:

- "Estudar";
- "Salvar";
- clique na frase;
- atalho global.

Ao acionar:

- abre/adiciona no Tutor Board;
- roda a analise completa;
- salva vocabulario/SRS;
- permite praticar pronuncia.

Assim o modo legenda nao substitui o PROFESSOR. Ele vira a porta de entrada.

---

## 5. Fases de implementacao

### Fase 1 - Overlay de legenda simples

Objetivo: mostrar original + traducao em uma janela limpa.

Tarefas:

- criar nova janela Electron `live-captions`;
- criar componente React `LiveCaptions`;
- reaproveitar o stream de transcricao atual;
- exibir ultima frase original;
- chamar traducao simples;
- controlar tamanho, opacidade e posicao;
- salvar preferencias da janela.

Resultado esperado:

- o usuario consegue assistir YouTube/Netflix/etc. com legenda gerada pelo app.

### Fase 2 - Modo baixo custo

Objetivo: evitar gastar IA em toda frase desnecessariamente.

Tarefas:

- cachear traducoes por texto normalizado + idioma;
- nao traduzir repeticoes iguais;
- permitir modo "original apenas";
- permitir traducao somente quando o usuario passa o mouse/clica;
- limitar chamadas por minuto;
- mostrar aviso quando provider falhar.

Resultado esperado:

- a feature fica usavel por mais tempo sem explodir custo.

### Fase 3 - Latencia menor

Objetivo: fazer a legenda parecer mais ao vivo.

Tarefas:

- mostrar transcricao parcial enquanto a fala ainda acontece;
- atualizar legenda sem piscar;
- finalizar a frase quando o VAD detectar silencio;
- traduzir somente o trecho final estabilizado;
- medir tempo: audio -> texto -> traducao -> tela.

Resultado esperado:

- experiencia mais parecida com legenda simultanea real.

### Fase 4 - Clique para estudar

Objetivo: conectar legenda casual ao modo professor.

Tarefas:

- botao "Estudar esta frase";
- criar card no Tutor Board a partir da legenda;
- preservar audio original e cues quando existirem;
- abrir WordPopover ao clicar em palavra;
- salvar frase no SRS quando o usuario quiser.

Resultado esperado:

- assistir e estudar viram o mesmo fluxo, sem atrito.

### Fase 5 - Legenda bilingue inteligente

Objetivo: adaptar a legenda ao nivel do usuario.

Tarefas:

- usar palavras conhecidas para decidir o que traduzir;
- destacar palavras novas;
- esconder traducao quando a compreensao for alta;
- mostrar traducao apenas de expressoes dificeis;
- sugerir frases +1 para estudo.

Resultado esperado:

- a legenda deixa de ser apenas traducao e vira input compreensivel personalizado.

---

## 6. Arquitetura sugerida

### Main process

- gerencia janela `live-captions`;
- recebe eventos da captura/transcricao;
- envia eventos de legenda para o renderer;
- salva preferencias de posicao/tamanho/opacidade.

### Renderer

- componente visual leve;
- sem cards grandes;
- animacao discreta;
- texto responsivo;
- controles aparecem apenas no hover.

### Servicos

- `captionService`: organiza eventos de legenda;
- `translationCache`: cache por texto normalizado;
- `captionStore`: preferencias de janela;
- reuso do `tutorService` apenas quando for necessario estudar a frase.

---

## 7. Regras de produto

- A legenda nao deve atrapalhar o video.
- A traducao deve ser curta, natural e rapida.
- O modo estudo deve continuar sendo mais rico que a legenda.
- A janela precisa ser movel e redimensionavel.
- O usuario precisa poder pausar legenda sem parar o video.
- O app deve tolerar erro de provider sem quebrar a experiencia.
- Cache e limites sao obrigatorios antes de liberar para uso pesado.

---

## 8. Riscos

- custo alto se traduzir tudo;
- latencia alta se esperar analise completa;
- qualidade ruim se o audio tiver musica/ruido;
- legenda grande demais cobrindo o conteudo;
- usuario confundir modo legenda com modo estudo;
- providers diferentes podem retornar tempos/cues inconsistentes.

Mitigacao:

- cache agressivo;
- traducao curta;
- throttling;
- UI pequena;
- fallback para original apenas;
- separar "Legenda ao Vivo" de "Tutor Board".

---

## 9. Primeiro corte recomendado

Implementar primeiro:

1. janela `LiveCaptions`;
2. original + traducao da ultima frase;
3. cache simples de traducao;
4. botao "Estudar";
5. preferencias de posicao/tamanho.

Nao implementar no primeiro corte:

- traducao palavra por palavra;
- transcricao parcial complexa;
- sincronizacao karaoke na legenda;
- analise completa de vocabulario;
- personalizacao por nivel.

Isso mantem a feature pequena, testavel e util desde a primeira versao.

---

## 10. Visao final

O PROFESSOR pode ter dois modos complementares:

- **Modo assistir:** legenda/traducao simultanea, leve e invisivel.
- **Modo estudar:** Tutor Board, vocabulario, TTS, pronuncia, SRS e Professor-IA.

Essa combinacao e forte porque atende dois momentos reais do usuario:

- quando ele so quer entender o conteudo;
- quando ele quer transformar o conteudo em aprendizado ativo.

