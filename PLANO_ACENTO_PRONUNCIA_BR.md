# PROFESSOR - Plano Futuro: Acento e Pronuncia para Brasileiros

> Objetivo: criar um modulo do Professor para ajudar brasileiros a reduzir marcas de sotaque
> que atrapalham a inteligibilidade, sem vender a promessa falsa de "zerar o sotaque". O foco
> e falar de forma mais clara, natural e confiavel.

---

## Atualizacao 2026-06-06 - impacto da implementacao nova

A direcao do plano continua correta, mas a implementacao recente antecipou varias bases que
antes estavam como trabalho futuro. O Accent Coach agora nao precisa comecar por infraestrutura;
ele pode comecar direto por **diagnostico de sotaque brasileiro**.

Ja temos no app:

- **Auto-practice**: o app pausa o video, captura a frase e abre pratica automaticamente.
- **Loop/Chorus**: repete o audio original 3 vezes, com velocidade progressiva e gap para eco.
- **Pitch/DTW**: compara a curva de entonacao do usuario com Original/TTS e gera score.
- **Audio original por palavra/frase**: permite comparar o som real com o que o aluno falou.
- **TTS local/cacheado**: Kokoro/Edge para gerar referencia alternativa.
- **Historico de tentativas**: cada tentativa tem original, fala do usuario, score, diff e audio.
- **Mistakes store**: ja existe persistencia de palavras problemáticas.

Isso muda a ordem:

1. Antes: criar infraestrutura de pratica, comparacao e visual feedback.
2. Agora: criar uma camada de **classificacao de problemas de sotaque** em cima do que ja existe.

Novo primeiro MVP:

- usar o resultado do `Praticar` e do `Auto-practice`;
- detectar 1 ou 2 marcas provaveis de sotaque;
- mostrar feedback curto no card da tentativa;
- salvar contagem por problema no perfil do usuario.

---

## 1. Diagnostico

Brasileiros normalmente nao erram pronuncia por falta de esforco. O problema e que o corpo
usa automaticamente os habitos do portugues:

- colocar uma vogal extra no fim ou no meio: `stop` -> `stopi`, `black` -> `bleki`;
- trocar ou suavizar consoantes finais: `world`, `asked`, `months`;
- confundir sons que nao existem no portugues: `th`, `r` americano, `dark L`;
- falar com ritmo silabado demais, quando o ingles usa reducao, schwa e stress;
- pronunciar pela escrita, nao pelo som real: `comfortable`, `vegetable`, `would you`;
- manter entonacao de portugues em perguntas, enfase e frases longas.

Para o app, isso pede um sistema em 3 camadas:

1. Percepcao: o aluno precisa ouvir a diferenca.
2. Boca: o aluno precisa saber o que mover.
3. Feedback: o app precisa mostrar onde a fala dele desviou do modelo.

---

## 2. Principio do modulo

O Professor nao deve mostrar apenas "certo/errado". Ele deve responder:

- "Qual parte do seu sotaque apareceu aqui?"
- "Isso atrapalha entender ou e so sotaque aceitavel?"
- "O que voce deve mudar na boca?"
- "Qual micro-drill resolve esse caso?"

Essa distincao e importante: sotaque nao e defeito. O produto deve atacar primeiro o que reduz
compreensibilidade.

---

## 3. Fase A - Detector de marcas do portugues

### A1. Checklist de erros previsiveis por palavra/frase

Criar um analisador que, dado:

- frase original;
- transcricao do usuario;
- audio do usuario;
- audio original/TTS;

detecta marcas comuns de brasileiro:

| Categoria | Exemplo | Sinal detectavel |
|---|---|---|
| Vogal extra final | `stop` -> `stopi` | ASR retorna silaba extra ou audio tem vogal depois da consoante |
| Consoante final fraca | `world`, `asked` | palavra transcrita sem final ou com final alterado |
| TH | `think`, `this` | ASR confunde com `t`, `d`, `f`, `s`, `z` |
| R americano | `red`, `car`, `world` | ASR confunde ou curva/formante distante do modelo |
| Dark L | `feel`, `people`, `world` | final vira `w` ou desaparece |
| Schwa/reducao | `about`, `to`, `of`, `can` | vogal plena onde deveria reduzir |
| Word stress | `record`, `comfortable` | pico de energia/pitch na silaba errada |
| Ritmo | frase toda silabada | duracoes uniformes demais, sem reducoes |

Saida esperada:

```json
{
  "issue": "extra_final_vowel",
  "severity": "medium",
  "target": "stop",
  "heardLike": "stopi",
  "feedback": "Feche em /p/. Nao solte um 'i' depois.",
  "drill": "stop, stop, stop it, I stop here"
}
```

### A2. Comecar por regras simples

Nao precisa modelo grande no inicio. Comecar combinando:

- diff entre texto original e ASR da fala do usuario;
- lista de palavras alvo com sons dificeis;
- duracao aproximada por palavra;
- pitch/energia ja existentes;
- comparacao com TTS/original quando houver audio.

---

## 4. Fase B - Score de sotaque util

Criar 3 scores separados, nao um score unico confuso:

1. **Clareza**: a frase foi entendida pelo ASR?
2. **Som alvo**: os fonemas criticos sairam proximos?
3. **Naturalidade**: ritmo, stress e reducao parecem naturais?

Exemplo de UI:

```text
Clareza        84%
Som alvo       62%   TH em "think" saiu como T
Naturalidade   55%   voce pronunciou todas as vogais cheias
```

Regra de produto:

- se clareza alta e naturalidade baixa: "voce foi entendido, agora vamos soar mais natural";
- se clareza baixa: corrigir primeiro os sons que impedem compreensao;
- se som alvo baixo: abrir drill especifico.

---

## 5. Fase C - Drills personalizados

Ao detectar um problema, o app deve gerar um treino curto de 30-60 segundos.

### C1. Minimal pairs

Para sons confundidos:

- `think / sink / tink`;
- `three / tree`;
- `ship / sheep`;
- `live / leave`;
- `bad / bed`;
- `world / word`;
- `light / right`.

Fluxo:

1. App toca A/B com vozes diferentes.
2. Usuario escolhe o que ouviu.
3. Usuario repete.
4. App mostra se a fala caiu mais perto de A ou B.

### C2. Drill de consoante final

Para brasileiros, isso e grande.

Exemplo:

```text
stop
stop now
I stop now
I don't stop now
```

O app verifica se a palavra termina seca, sem `i`.

### C3. Drill de ritmo

Usar shadowing curto:

1. tocar original;
2. mostrar texto com stress e reducoes;
3. usuario grava imitando;
4. DTW compara curva de energia/pitch/duracao;
5. app diz: "voce deu peso demais em TO e OF".

---

## 6. Fase D - Visual feedback

O Professor ja tem partes para isso:

- `pitch.ts`: curva de pitch;
- `dtw.ts`: alinhamento de curvas;
- audio original por palavra;
- TTS local/cacheado;
- pratica com gravacao.

Adicionar visualizacoes:

### D1. Linha de ritmo

Mostrar barras de duracao por palavra:

```text
I   want   to   go
|   ||||   .    ||
```

Onde `to` deveria ser reduzido, mas o usuario falou forte.

### D2. Stress da palavra

Para palavras longas:

```text
comfortable
COMF-tuh-bul
^ stress aqui
```

### D3. Boca/posicao

Feedback textual simples, sem video:

- TH: "ponta da lingua entre os dentes, ar continuo";
- R: "lingua nao toca o ceu da boca";
- dark L: "levante o fundo da lingua no final";
- final consonant: "feche a consoante e pare, sem vogal extra".

---

## 7. Fase E - Perfil de sotaque do usuario

Criar um "Accent Profile" por idioma:

```json
{
  "nativeLanguage": "pt-BR",
  "targetLanguage": "en",
  "topIssues": [
    { "id": "extra_final_vowel", "count": 18, "trend": "down" },
    { "id": "th_to_t", "count": 9, "trend": "flat" },
    { "id": "word_stress", "count": 7, "trend": "up" }
  ]
}
```

Na UI:

- "Seu foco da semana: consoantes finais";
- "Voce reduziu vogal extra em 32% esta semana";
- "Proximo som: TH em palavras frequentes".

Isso conversa diretamente com a Fase 1 do produto: progresso visivel.

---

## 8. Ordem recomendada de implementacao

### Sprint 0 - Base ja implementada

- Auto-practice para frases capturadas.
- Loop/Chorus com repeticao e gap de eco.
- Comparador de entonacao com `pitch.ts` + `dtw.ts`.
- Audio original/TTS/minha voz no historico de sessao.
- Pratica por palavra com hint de transcricao.

Esses itens nao precisam mais ser planejados como futuro; agora sao alavancas para o coach.

### Sprint 1 - Detector simples de sotaque brasileiro

- Criar `accentProfile` no store.
- Criar taxonomia de problemas: `extra_final_vowel`, `th_to_t`, `final_consonant_drop`,
  `r_portuguese_transfer`, `dark_l_to_w`, `word_stress`, `rhythm_syllable_timed`.
- Criar funcoes puras para detectar problemas pelo diff texto original vs ASR.
- UI no resultado do "Praticar": mostrar 1 ou 2 problemas mais provaveis.

### Sprint 2 - Feedback no card da tentativa

- Em cada tentativa, mostrar:
  - clareza: score atual de palavra/frase;
  - entonacao: score DTW ja existente;
  - sotaque provavel: problema detectado + dica curta.
- Exemplo:
  - "Clareza 86%, Entonacao 61%, Sotaque: possivel vogal extra no final de `stop`."
- Salvar esses eventos no `accentProfile`.

### Sprint 3 - Drills de consoante final e TH

- Comecar com os dois maiores problemas para brasileiros.
- Gerar lista de frases curtas.
- Comparar ASR e audio.
- Salvar historico por problema.

### Sprint 4 - Ritmo e reducao

- Usar `dtw.ts` + pitch/energia.
- Mostrar palavras fortes/fracas.
- Detectar excesso de vogal plena em palavras funcionais: `to`, `of`, `for`, `can`, `and`.

### Sprint 5 - Perfil semanal

- Dashboard pequeno: top 3 marcas de sotaque.
- Tendencia: melhorando / estavel / piorando.
- Meta semanal: 5 minutos em 1 som.

### Sprint 6 - Professor-IA como coach de sotaque

Integrar com o Professor-IA:

- aluno fala;
- app detecta problema;
- IA explica em portugues simples;
- IA cria 3 frases personalizadas;
- aluno repete ate melhorar.

---

## 9. MVP ideal

O MVP nao precisa resolver tudo. O primeiro modulo deve responder muito bem a:

1. "Estou colocando um `i` no final?"
2. "Estou engolindo consoante final?"
3. "Meu TH esta virando T/D/F?"
4. "Estou falando palavra por palavra, sem ritmo natural?"

Se isso funcionar, ja resolve uma dor enorme para brasileiros.

---

## 10. Fontes e referencias

- Revisao sobre feedback visual em Computer-Assisted Pronunciation Training:
  https://pmc.ncbi.nlm.nih.gov/articles/PMC8276941/
- High Variability Pronunciation Training e treino perceptivo:
  https://www.iastatedigitalpress.com/psllt/article/id/15695/
- Estudo sobre feedback visual comparativo em pronuncia:
  https://docs.lib.purdue.edu/lcpubs/18/
- PTeacher, sistema de treino personalizado com feedback corretivo:
  https://arxiv.org/abs/2105.05182
- Dificuldades comuns de falantes de portugues em ingles:
  https://pronunciationstudio.com/portuguese-speakers-english-pronunciation-errors/
  https://blog.talk.edu/learn-english/common-pronunciation-errors-portuguese-speakers/
