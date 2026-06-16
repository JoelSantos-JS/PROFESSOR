# Correção: áudio original por palavra

## Problema

No Tutor Board, o botão **Original** dentro do popover de uma palavra deveria tocar só a pronúncia daquela palavra na voz original do vídeo. O comportamento inicial era ruim por etapas:

- primeiro tocava a frase inteira;
- depois ficou mudo em alguns casos;
- depois tocava sempre o mesmo trecho para palavras diferentes;
- depois ainda ficava impreciso porque usava uma estimativa de tempo.

O sintoma mais importante no terminal era:

```text
[audio] transcribed (...) cues=0
```

Sem `cues` por palavra, o app não sabe onde cada palavra começa e termina no áudio original.

## Causa

A causa principal foi o fluxo de transcrição cair no **Gemini** em algumas sessões. O Gemini transcreve o áudio, mas no nosso fluxo ele não retorna timestamps por palavra. Por isso `originalCues` chegava vazio.

Também havia problemas secundários:

- o fallback tocava a frase inteira quando não achava timestamp;
- o clique da palavra guardava o índice errado, então várias palavras usavam o mesmo recorte;
- o WebM do `MediaRecorder` podia não ter duração confiável para seek/corte;
- o VAD cortava frases cedo demais, criando áudios muito curtos ou quebrados.

## Solução aplicada

### 1. Forçar Groq para transcrição com timestamps

Em `electron/services/audioService.ts`, quando o provider ativo de transcrição está como Gemini mas existe chave do Groq, o app troca automaticamente para Groq:

```text
[audio] transcription override: gemini -> groq for word timestamps
```

Motivo: Groq/Whisper suporta timestamps por palavra; Gemini não entrega isso no nosso fluxo.

### 2. Pedir timestamps corretamente ao Groq

O request para Groq agora usa:

```text
response_format=verbose_json
timestamp_granularities[]=segment
timestamp_granularities[]=word
temperature=0
language=en
```

Também foram adicionados logs seguros para confirmar se vieram timestamps:

```text
[audio] groq response keys=... topWords=... segments=... segmentWords=...
[audio] groq timings exactWords=... cues=...
```

### 3. Parser mais robusto para timestamps

Em `electron/lib/whisperWords.ts`, o app agora aceita timestamps em dois formatos:

- `json.words`
- `json.segments[].words`

Se não vier palavra exata, ele ainda consegue estimar por segmento, o que é melhor do que estimar pela frase inteira.

### 4. Áudio original salvo como WAV limpo

Em `src/windows/FloatingBar.tsx`, o áudio capturado é convertido para WAV quando possível antes de enviar para transcrição e antes de salvar como áudio original.

Isso evita problemas de duração/seek do WebM gerado pelo `MediaRecorder`.

Arquivos envolvidos:

- `src/lib/decodeAudio.ts`
- `src/lib/wav.ts`
- `src/windows/FloatingBar.tsx`

### 5. Player de recorte mais confiável

Em `src/lib/playClip.ts`, o recorte da palavra passou a usar Web Audio (`AudioBufferSourceNode.start`) quando há timestamp exato.

Quando não há timestamp, ele usa um fallback curto e proporcional, mas sem tocar a frase inteira.

### 6. Correção do índice da palavra clicada

Em `src/windows/TutorBoard.tsx`, cada palavra agora congela seu próprio `clickedIndex` ao renderizar. Antes, o clique podia ler o índice final do loop, fazendo palavras diferentes usarem o mesmo trecho.

### 7. VAD menos agressivo

Em `src/windows/FloatingBar.tsx`, o detector de fala foi ajustado para esperar uma pausa mais real antes de fechar a frase:

```text
SILENCE_END_MS = 1450
MIN_SPEECH_MS = 650
MIN_PEAK = 26
VAD_THRESHOLD = 16
VAD_MIN_RATIO = 0.055
```

Isso reduziu cortes prematuros e melhorou a qualidade dos trechos enviados para transcrição.

## Resultado

Depois dessas mudanças:

- o app parou de depender do Gemini para timestamps;
- `cues` passou a vir do Groq quando disponível;
- o botão **Original** deixou de tocar a frase inteira;
- o áudio por palavra ficou muito mais próximo do trecho correto;
- o fluxo ficou mais resistente quando timestamps exatos não vêm.

## Validação

Comandos rodados:

```text
npm run test -- whisperWords
npm run build
```

Ambos passaram.
