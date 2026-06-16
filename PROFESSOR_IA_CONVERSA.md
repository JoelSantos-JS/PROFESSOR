# Feature: Professor-IA (Professor substituto / "Language Parent")

> Especificação para implementação futura. Um modo de **conversa com IA** que age como um
> professor que **só pergunta e conversa**, usando como contexto a **transcrição da sessão do
> Tutor Board**, e dá **formas melhores de responder** + **como responder em situação similar**.
>
> Parte do plano: [PLANO_IMPLEMENTACAO.md](PLANO_IMPLEMENTACAO.md) §3 Fase 1.
> Modo de preparacao IELTS Speaking: [PLANO_PROFESSOR_IELTS_SPEAKING.md](PLANO_PROFESSOR_IELTS_SPEAKING.md).

---

## 1. Conceito

Um **professor substituto** que transforma a transcrição passiva em uma **conversa guiada de
prática**. Validado pela pesquisa: o método Lonsdale chama isso de **"language parent"** — alguém
paciente que conversa com você no seu nível, te entende mesmo com erros, e te puxa pra frente.
É a **ação nº 5** das 7 ações do "How to learn any language in 6 months".

**Em uma frase:** a IA é um professor que **só faz perguntas e conversa** sobre o que você
acabou de assistir, e te ensina **respondendo melhor por você**.

---

## 2. Comportamento da IA (regras)

A IA **NÃO dá aula expositiva**. Ela:

1. **Usa só o contexto da sessão** — as frases que apareceram no Tutor Board daquela sessão.
   Fica "dentro do assunto" do que o usuário assistiu.
2. **Só pergunta e conversa** — faz perguntas relacionadas ao contexto e puxa a conversa, como
   um professor substituto que quer ouvir o aluno falar.
3. **Espera a resposta do aluno** (idealmente **falada** → treino de speaking).
4. **Dá feedback de professor** depois de cada resposta:
   - **Forma melhor de responder:** reformula a resposta do aluno de um jeito mais
     natural/correto no idioma-alvo.
   - **Como responder em situação similar:** dá 1–2 **modelos de resposta** para situações
     parecidas (transferência).
   - Corrige com gentileza; mantém o tom de professor que ensina **pela conversa**.
5. **Faz a próxima pergunta** e mantém a conversa fluindo (sem virar lição).

**Nível adaptativo:** ajusta a dificuldade ao nível do aluno (idealmente usando as "palavras
conhecidas" da Fase 1) — mantém o **i+1** também na conversa.

---

## 3. Fluxo de uso

1. Usuário assiste algo → frases vão para o Tutor Board (contexto da sessão).
2. Abre o modo conversa (ponto de entrada: botão no Tutor Board — "Conversar sobre esta sessão").
3. A IA puxa o contexto e **faz a 1ª pergunta** relacionada.
4. Usuário **responde** (fala ou escreve).
5. IA dá feedback (melhor forma + modelos) → **próxima pergunta**.
6. Loop até o usuário encerrar; opção de salvar a conversa / frases boas no SRS.

---

## 4. UI/UX

- **Painel de chat** (bolhas), com distinção visual clara entre:
  - 🟦 **Pergunta da IA**
  - 🟩 **Resposta do usuário**
  - 🟨 **Feedback/correção** (melhor forma + modelos de resposta)
- **Entrada por voz** (reusa o gravador/Whisper) — a resposta falada pode ser **transcrita e
  pontuada** (reusa diff/score de pronúncia já existentes).
- **Trio de áudio** reaproveitado: ouvir a "forma melhor" da IA em TTS; comparar com a sua.
- Deixar **evidente que a IA está CONVERSANDO**, não dando aula.
- Mostrar o **contexto** (chip "baseado em N frases desta sessão").

---

## 5. Integração técnica

- **Provider:** reaproveita o `activeAiProvider` (Gemini/OpenAI/Anthropic/Groq) já configurado.
- **Prompt (design):**
  - *System:* "Você é um professor substituto de [idioma]. Converse com o aluno (nível X) sobre
    o CONTEXTO abaixo. **Só faça perguntas e converse** — não dê aula. Após cada resposta do
    aluno: (1) reformule a resposta dele de forma mais natural, (2) dê 1–2 modelos de resposta
    para situações similares, (3) faça a próxima pergunta. Responda em [idioma-alvo] no nível do
    aluno, com tradução PT quando útil."
  - *Context:* as frases da sessão (transcrição) + (Fase 1) lista de palavras conhecidas para
    calibrar o nível.
  - *Histórico:* manter a conversa (turnos anteriores) no contexto.
  - **Saída estruturada** sugerida (JSON): `{ question, feedback?: { better, models[] } }` para
    renderizar as bolhas separadas.
- **Reuso:** gravador de voz (`usePractice`), TTS (`ttsAPI`), score de fala (`diffWords`/pitch),
  SRS (salvar frases boas da conversa).
- **Custo:** conversa = várias chamadas; considerar limite de turnos / resumo do contexto para
  não estourar tokens (a transcrição da sessão pode ser longa → resumir/seriar).

---

## 6. Fases de implementação (interno da feature)

1. **MVP texto:** chat simples, contexto = transcrição da sessão, prompt "só pergunta + feedback",
   bolhas separadas. (sem voz)
2. **Voz:** resposta falada → transcreve → pontua → IA responde.
3. **Calibragem por nível:** usar "palavras conhecidas" (Fase 1) para o i+1 na conversa.
4. **Persistência:** salvar conversa; mandar frases/modelos bons pro SRS; histórico por idioma.

---

## 7. Métricas de sucesso da feature

- % de usuários que abrem a conversa após uma sessão.
- Turnos médios por conversa (engajamento).
- Frases salvas no SRS a partir da conversa.
- Retenção dos que usam a conversa vs. os que não usam (esperado: maior — é o "momento aha").

---

## 8. Riscos / cuidados

- **Token/custo:** transcrição de sessão longa → resumir o contexto.
- **Não virar aula:** reforçar no prompt o "só pergunta e conversa"; testar que a saída mantém o
  formato pergunta→feedback→pergunta.
- **Multi-idioma:** a conversa deve ser no idioma-alvo da sessão (usa `contentLanguage`), com
  tradução PT de apoio conforme o nível.
- **Nível:** sem a Fase 1 (palavras conhecidas), calibrar pelo `targetLanguage`/heurística até
  ter o dado real.

---

## 9. Fonte/validação

- Lonsdale, *"How to learn any language in six months"* (TEDx) — princípios 1–5 e as 7 ações,
  em especial a **ação 5 ("language parent")** que descreve quase exatamente esta feature.
  Ver mapeamento em [PLANO_IMPLEMENTACAO.md](PLANO_IMPLEMENTACAO.md) §2.
