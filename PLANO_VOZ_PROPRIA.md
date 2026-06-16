# Plano #1 — Minha voz em outro idioma (voice clone) — modo B (TTS com sua voz)

> Ideia "wow" do utell, no nosso viés pedagógico: o usuário grava **uma amostra** da própria voz
> uma vez; depois o app sintetiza **qualquer frase, em qualquer idioma, no timbre dele**. Usos:
> **shadowing com a própria voz** ("você falando coreano certo"), **"sua fala corrigida"** (a versão
> certa na sua voz) e **tradução na sua voz**. Spec base: [IDEIAS_UTELL.md](IDEIAS_UTELL.md) Plano #1.
>
> **Escopo honesto:** NÃO é conversão de fala ao vivo (<100ms, speech-to-speech, o que o utell faz) —
> isso é pesado e fica fora. É **TTS com clonagem** (texto → áudio na sua voz), que é o que dá pra
> fazer bem e cobre todos os usos pedagógicos.
>
> **Decisão de provider:** adiada — montamos a **base agnóstica** agora e plugamos o motor depois.
> Candidatos: **ElevenLabs** (nuvem, BYOK — qualidade, clone instantâneo) ou **XTTS-v2** (local, offline,
> como o Kokoro). Ética: clonar **só a própria voz** (amostra gravada na hora).

Padrão de sempre: **núcleo puro testável → serviço/IPC → UI → bateria de testes**.

## O que reaproveitamos
- `providerTestProbe.ts` (padrão de "montar requisição pura por provider") → espelhamos em `voiceCloneProbe.ts`.
- `credentialsService` (BYOK) — chave do ElevenLabs entra como mais um provider quando decidir.
- `usePractice`/captura de áudio — para gravar a amostra de calibração (já gravamos voz nas práticas).
- `ttsService` (Kokoro/Edge) — `cloneSpeak` entra como mais um branch de provider.
- `settingsService` — guarda o estado da voz clonada.

---

## ✅ BASE (decisão-independente) — implementar agora

### Inc. 1 — Núcleo puro `electron/lib/voiceCloneProbe.ts`
Monta as requisições por provider (puro, sem rede), igual ao `providerTestProbe`:
- `buildVoiceEnrollRequest(provider, { name, apiKey })` → spec de upload da amostra (ElevenLabs
  `POST /v1/voices/add`, multipart: campo `files`) → daí sai o `voiceId`.
- `buildCloneSynthesisRequest(provider, { text, lang, voiceId, apiKey, stability?, similarity? })` →
  spec JSON do TTS (`POST /v1/text-to-speech/{voiceId}`, `model_id: eleven_multilingual_v2`).
- `xtts` (local) → `undefined` nas duas (não é HTTP; vai por worker depois).
**Testes:** URL/headers/body certos pra ElevenLabs; chave/voiceId/idioma embutidos; faltando chave/voiceId/
texto → `undefined`; provider desconhecido → `undefined`; multilíngue (mesmo `model_id` p/ qualquer `lang`).

### Inc. 2 — Núcleo puro `src/lib/voiceSample.ts`
Valida/normaliza a amostra de calibração (qualidade + ética), independente de provider:
- `validateVoiceSample({ durationMs, mimeType? })` → `{ ok, reason? }` (mín. ~6s, máx. ~30s, mime aceito).
- `voiceCalibrationPrompt(appLang)` → frase neutra pra ler na calibração (pt/en).
**Testes:** curto demais/longo demais/ok; mime inválido; prompt por idioma + fallback.

### Inc. 3 — Estado em `settingsService`
Campos novos (default `''`): `voiceCloneProvider` (`'' | 'elevenlabs' | 'xtts'`) e `voiceCloneVoiceId`.
(Habilitado = tem provider + voiceId.) **Testes:** default vazio; set/get persiste.

---

## ⏳ DEPENDE DO PROVIDER — fazer após a decisão
- **Inc. 4 — Calibração (UI+serviço):** "Calibrar minha voz" nas Configurações — grava ~8s lendo o prompt,
  valida (`validateVoiceSample`), faz enroll (`buildVoiceEnrollRequest`) ou salva a amostra p/ XTTS, guarda
  `voiceCloneVoiceId`.
- **Inc. 5 — `ttsService.cloneSpeak(text, lang)`** + IPC `tts:clone-speak` (ElevenLabs via `buildCloneSynthesisRequest`
  **ou** worker XTTS local).
- **Inc. 6 — UI "🔊 na minha voz"** ao lado do TTS (TutorBoard/WordPopover/ProfessorChat) + modo
  **"Sua fala corrigida"** depois de uma prática.

## Progresso
- [x] **Inc. 1 — voiceCloneProbe (núcleo)** ✅ `electron/lib/voiceCloneProbe.ts` (11 testes): enroll + síntese
  ElevenLabs (URL/headers/body, voiceId encoded, voice_settings com clamp, multilíngue), xtts→undefined,
  guardas de campo faltando.
- [x] **Inc. 2 — voiceSample (núcleo)** ✅ `src/lib/voiceSample.ts` (8 testes): `validateVoiceSample`
  (6–30s, mime, bordas, NaN) + `voiceCalibrationPrompt` (pt/en + fallback).
- [x] **Inc. 3 — settings** ✅ `voiceCloneProvider` + `voiceCloneVoiceId` (default ''), `settingsService.test.ts`
  (3 testes: default vazio, persiste, ignora chave desconhecida).
- [ ] **Inc. 4–6 — após decidir ElevenLabs vs XTTS** (calibração UI/serviço, `cloneSpeak`+IPC, botões "na minha voz").

> **Base pronta** — 981 testes no total, type-check limpo. Falta só **a decisão de provider** pra plugar a
> calibração real, o `cloneSpeak` e os botões "🔊 na minha voz".
