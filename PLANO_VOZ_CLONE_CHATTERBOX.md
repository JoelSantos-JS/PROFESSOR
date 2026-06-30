# Voz clonada + escolha de engines (Whisper / Kokoro / Chatterbox)

> Análise de **qual motor usar** para cada peça e como montar o fluxo "falo português e sai
> inglês/chinês **na minha voz**". Complementa o [PLANO_VOZ_PROPRIA.md](PLANO_VOZ_PROPRIA.md)
> (que é o plano de implementação, com a decisão de engine **adiada**) — aqui entra o **Chatterbox**
> como candidato forte e a escolha de modelo de **transcrição (Whisper)**. Relacionado:
> [IDEIAS_NOVAS.md](IDEIAS_NOVAS.md) #5 e #6.

---

## 0. A peça que confunde: Whisper ≠ TTS

Na tela do print (Whisper Large v3 / v3 Turbo) você está escolhendo o **modelo de transcrição**
(voz → texto), **não** o de voz. São duas peças diferentes:

| Peça | Função | Motores |
|------|--------|---------|
| **Whisper** | ouvir e escrever (voz → texto) | Whisper Large v3 / v3 Turbo |
| **Kokoro / Chatterbox** | ler e falar (texto → voz) | Kokoro, Chatterbox Turbo, Chatterbox Multilingual V3 |

---

## 1. O fluxo "minha voz em outro idioma"

```
Minha fala em português
        ↓
Whisper transcreve  (voz → texto PT)
        ↓
IA traduz para inglês/chinês  (texto PT → texto EN/ZH)
        ↓
Chatterbox gera a voz traduzida usando MINHA voz como referência
        ↓
Áudio: eu "falando" inglês/chinês no meu timbre
```

Fluxo genérico do voice clone (qualquer frase):
```
Usuário grava uma amostra da própria voz → app salva/gera uma referência vocal
→ usuário digita ou fala uma frase → sistema gera o áudio com aquela voz
```

---

## 2. Transcrição — Whisper Large v3 vs v3 Turbo

- **Large v3 Turbo** = versão podada/fine-tuned do v3: decoder de **32 → 4 camadas** → bem **mais
  rápido**, com **pequena perda** de qualidade. (HF: huggingface.co/openai/whisper-large-v3-turbo)
- A discussão oficial diz: Turbo foi feito pra **ganhar velocidade com degradação mínima**, mas pode
  piorar em **alguns idiomas** (ex.: tailandês, cantonês). (github.com/openai/whisper/discussions/2363)

**Decisão para o Soaken (captura em tempo real):**
- **Modo ao vivo / legenda rápida → Whisper Large v3 Turbo** ✅ (faz mais sentido pro nosso uso)
- **Modo máxima precisão / áudio gravado → Whisper Large v3**

---

## 3. TTS — Kokoro vs Chatterbox Turbo vs Chatterbox Multilingual V3

⚠️ **Pegadinha:** "Chatterbox Turbo" **≠** "Whisper Turbo".

- **Chatterbox Turbo** — TTS de **baixa latência**, ~**350M** params, menos compute/VRAM, foco em
  **agentes de voz em inglês**. (github.com/resemble-ai/chatterbox)
- **Chatterbox Multilingual V3** — ~**500M** params, **23+ idiomas**, melhor **similaridade de
  locutor**, menos alucinação, fala multilíngue mais natural → **ideal p/ PT/EN/ZH e clone entre
  idiomas**. (github.com/resemble-ai/chatterbox)

**Decisão para o Soaken (PT → EN/ZH na sua voz):**
- **NÃO** usar Chatterbox Turbo como principal (é focado em inglês).
- Usar **Whisper Large v3 Turbo** (transcrever) + **Chatterbox Multilingual V3** (gerar voz).

| Motor | Perfil | Melhor para |
|-------|--------|-------------|
| **Kokoro** | rápido, leve | frase curta, flashcard, voz padrão |
| **Chatterbox Multilingual V3** | pesado, mais bonito | voz premium, PT/EN/ZH, **voz clonada** |
| **Chatterbox Turbo** | rápido, inglês | inglês rápido (secundário) |

---

## 4. Latência e streaming (o que mata a experiência)

O que importa não é só o tempo total — é o **tempo até começar a sair o primeiro áudio**
(time-to-first-audio). Depende de CPU/GPU, tamanho da frase, modelo, CUDA/Vulkan/CPU e se o modelo
**já está carregado**.

**Estratégia:**
- **Frase curta** → gera o áudio inteiro e toca.
- **Frase longa** → **quebra em pedaços** e toca em **streaming**.

```
Texto:  "I was thinking about studying while working, but I don't know where to start."
Quebra: 1) "I was thinking about studying while working,"
        2) "but I don't know where to start."
```
Assim o usuário sente resposta mais rápida.

---

## 5. UI proposta (seleção de voz)

```
Voz padrão   — Rápida e leve (Kokoro)
Voz natural  — Mais expressiva (Chatterbox Multilingual V3)
Minha voz    — Use sua própria voz como referência (Chatterbox + amostra do usuário)
```

E a transcrição (ver [IDEIAS_NOVAS.md](IDEIAS_NOVAS.md) #5/#6):
```
Transcrição rápida  — Whisper Large v3 Turbo
Transcrição precisa — Whisper Large v3
```

---

## 6. Ética (regra de produto)

**Não** oferecer "clonar qualquer voz" livre. Enquadrar como:
- **"Grave sua própria voz"**, ou
- **"Envie uma voz que você tem autorização para usar"**.

Protege contra uso indevido e dá cara de **produto sério**. (Mesma regra já no PLANO_VOZ_PROPRIA.md.)

---

## 7. Recomendação consolidada

```
Transcrição:
  - Rápido  → Whisper Large v3 Turbo   (modo ao vivo — padrão do Soaken)
  - Preciso → Whisper Large v3

TTS:
  - Leve            → Kokoro
  - Natural         → Chatterbox Multilingual V3
  - Inglês rápido   → Chatterbox Turbo
  - Voz personalizada → Chatterbox Multilingual V3 + referência da voz do usuário
```

**Resumo brutal:** no modo ao vivo, **Whisper Large v3 Turbo**. Para TTS com voz clonada, **Kokoro**
como leve (default) e **Chatterbox Multilingual V3** como opção premium / voz própria.

> **Impacto no plano existente:** isto resolve a "decisão de provider adiada" do
> [PLANO_VOZ_PROPRIA.md](PLANO_VOZ_PROPRIA.md) — **Chatterbox Multilingual V3 (local)** entra como
> candidato principal no lugar de ElevenLabs/XTTS para o clone, mantendo a base agnóstica
> (`voiceCloneProbe` / `cloneSpeak`) que aquele plano já desenha.
