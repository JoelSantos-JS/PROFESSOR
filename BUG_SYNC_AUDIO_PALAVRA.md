# Bug em investigação — Áudio original por palavra (word slicing)

> Resumo do problema que estamos enfrentando, o que já foi descoberto/testado, e os
> próximos passos. Documento de continuidade.

---

## 🎯 O que estamos tentando fazer

No **Tutor Board**, ao clicar numa palavra individual da transcrição, o popover do
dicionário tem um botão **"Original"** que deveria tocar **apenas o áudio daquela
palavra** (a voz do ator, recortada do clipe da cena). Hoje ele toca a **frase inteira**.

Para recortar a palavra precisamos dos **timestamps por palavra** (`word cues`):
`{ part, start, end }` em ms. Eles vêm do Whisper (Groq) quando pedimos
`timestamp_granularities[]: word`.

Fluxo esperado:
1. Captura de áudio do sistema → `MediaRecorder` (WebM/Opus).
2. Envia ao Groq Whisper → recebe `text` **+ `words[]`** (timestamps).
3. `words` → cues `{part,start,end}` → salvos na entrada (`originalCues`).
4. Clica numa palavra → `findWordCue(cues, palavra)` acha o cue → toca o slice `[start,end]`.

---

## 🔴 A dificuldade / causa raiz

**O Whisper retorna o TEXTO, mas `words` vem VAZIO (`cues=0`) para o áudio capturado.**

Confirmado pelos logs do processo principal:
```
[audio] transcribed (en) cues=0: Things that we do in Brazil...
[tutor] analyze "Things that we do..." cues=0
```

Sem cues → `findWordCue` retorna `undefined` → cai no fallback que toca a frase inteira.

### O que foi TESTADO direto na API do Groq (todos retornam `words`):
| Entrada | `words` retornados |
|---|---|
| MP3 (edge-tts) | ✅ 5 |
| MP3 + prompt | ✅ 5 |
| **WebM criado por ffmpeg** | ✅ 6 |
| WebM (ffmpeg) + prompt | ✅ 6 |
| **WebM do MediaRecorder (real)** | ❌ **0** |

**Conclusão:** o problema é específico do **WebM "streaming" do `MediaRecorder`** — ele
não grava a **duração no cabeçalho do container** (Segment Info), então o Whisper
consegue decodificar o áudio (sai o texto) mas **não consegue gerar os timestamps por
palavra**. (Esse mesmo defeito causou antes o `audio.duration = Infinity` no `<audio>`.)

### O que NÃO é a causa (descartado por teste):
- ❌ O `prompt` que eu havia adicionado (testado: não quebra os cues).
- ❌ O provedor (está em **Groq**, correto, que suporta word timestamps).
- ❌ O matching `findWordCue` (testado e robusto, inclusive contrações "You're").
- ❌ O formato WebM em si (ffmpeg WebM funciona).

---

## 🔧 Correção em andamento (tentativa atual)

**Re-encodar o áudio capturado para WAV** antes de enviar ao Groq. WAV tem cabeçalho
RIFF + duração explícita → deveria restaurar os timestamps.

Implementado:
- `src/lib/wav.ts` — `encodeWav(channels, sampleRate)` (PCM 16-bit). **8 testes passando.**
- `src/lib/decodeAudio.ts` — `decodeBufferToMono(arrayBuffer)` (decodifica o WebM → samples).
- `src/windows/FloatingBar.tsx` — `toWavOrRaw(blob)`: decodifica o WebM e re-encoda em WAV
  antes de `transcribe()` (fallback para os bytes crus se o decode falhar).
- `electron/services/audioService.ts` — detecta WAV vs WebM pelos magic bytes (`RIFF`) e
  rotula o arquivo certo no upload.

### ⚠️ Status: AINDA `cues=0` após o WAV
Mesmo com a conversão, o log ainda mostra `cues=0`. Duas hipóteses a confirmar com o
**novo log** `[audio] received format=...`:
1. **`decodeBufferToMono` está falhando** (não consegue decodificar o WebM do
   MediaRecorder) → cai no fallback e envia WebM cru → `cues=0`.
   → O log mostraria `format=audio.webm`.
2. O WAV está sendo enviado (`format=audio.wav`) mas o Groq ainda não retorna `words`
   → problema mais profundo (talvez o WAV gerado esteja com algo errado, ou as capturas
   sendo testadas são run-ons muito longos).

**Próximo passo imediato:** capturar uma frase e ler `[audio] received format=...` no log
para saber qual hipótese é a verdadeira.

---

## 🟡 Observações importantes

- Todas as capturas de teste recentes foram **frases longas / run-on** ("Things that we
  do in Brazil that are not normal everywhere else..."). Vale testar com uma **frase
  curta e isolada** para descartar efeito do tamanho.
- A **reprodução** do slice já está robusta: `playSlice()` usa Web Audio
  (`decodeAudioData` + `AudioBufferSourceNode.start(0, início, duração)`) — toca o range
  exato sem depender de seek do WebM. **Só falta os cues chegarem.**
- A versão commitada no git (`532bfd4`) tinha o **mesmo** `audioService` (mesma requisição
  de word timestamps) → provavelmente sofria do mesmo problema de forma intermitente.

---

## 🧭 Próximos caminhos se o WAV não resolver

1. **Confirmar via log** se o WebM está sendo decodificado (format=wav?) ou caindo no
   fallback (format=webm). Se cair no fallback, investigar por que `decodeAudioData`
   falha no WebM do system-audio (vs o do microfone, que decodifica no comparador de
   entonação).
2. **Corrigir a duração do WebM** com a lib `fix-webm-duration` (patch do container) em
   vez de re-encodar — mais barato, mantém compressão.
3. **Re-transcrever sob demanda**: ao clicar numa palavra, se não houver cues, re-enviar o
   clipe (já como WAV) só para obter os timestamps daquela frase.
4. **Gravar em formato com duração**: investigar `MediaRecorder` com `audio/ogg` ou
   timeslices, ou usar `AudioWorklet` para capturar PCM direto (sem container streaming).

---

## ✅ Estado dos testes
**382 testes passando** (inclui `wav` 8, `findWordCue` com contrações, `playbackProgress`,
sincronia karaokê end-to-end, etc.). O type-check está limpo. O bug é de **runtime/dados**
(cues vazios), não de lógica testável.
