# PROFESSOR

Tutor de idiomas **desktop (Electron)** que captura o áudio do PC (séries, filmes, vídeos),
transcreve em tempo real e ajuda você a aprender com o que está assistindo — vocabulário,
romanização, tradução, pronúncia e treino ativo de fala.

## ✨ Recursos

- **Transcrição ao vivo** do áudio do sistema (WASAPI loopback) com detecção automática de idioma
- **Tutor Board** — vocabulário, romanização (Pinyin/Romaji/etc.), tradução em inglês e dicas
- **Dicionário interativo** — clique em qualquer palavra para ouvir e ver os significados
- **Sincronização karaokê** — a frase é destacada palavra por palavra junto com o áudio (TTS e original)
- **Modo Auto-treino** — pausa o vídeo a cada frase para você repetir e receber nota
- **Comparador de entonação** — curva de pitch da sua voz vs. original vs. TTS para ajustar o sotaque
- **Repetição espaçada (SM-2)** — flashcards do vocabulário capturado
- **Fala natural** — mostra linking/reduções do inglês ("in a hat" → "in‿a hat", "want to" → "wanna")

## 🧱 Stack

Electron 42 · React 19 · TypeScript · Tailwind CSS v4 · Vite 8 · Vitest

**BYOK (Bring Your Own Key):** Gemini, OpenAI, Groq, Anthropic. A transcrição usa Whisper
(Groq/OpenAI) ou Gemini; a análise usa o provedor de IA escolhido. O TTS usa vozes neurais
gratuitas da Microsoft Edge.

## 🚀 Desenvolvimento

```bash
cd tutor-pc
npm install
npm run dev      # builda main+preload, sobe o Vite e lança o Electron
npm test         # 300+ testes unitários (Vitest)
npm run dist     # empacota o instalador (electron-builder)
```

As chaves de API são guardadas **criptografadas** (Windows DPAPI via `safeStorage`) no
diretório de dados do usuário — nunca no repositório.

## 📂 Estrutura

```
tutor-pc/
  electron/   # processo principal (IPC, serviços, janelas)
  src/        # renderer (React): janelas, libs puras, componentes
```

Veja [tutor-pc/CONTINUIDADE.md](tutor-pc/CONTINUIDADE.md) para a documentação técnica detalhada.
