import { CredentialsService } from './credentialsService'
import { SettingsService } from './settingsService'
import { StoreService, type TokenUsageFeature } from './storeService'
import { chatModelFor, estimateTokens } from '../lib/usageRecording.js'
import { buildSystemPrompt, buildLookupPrompt, buildVariationsPrompt, buildDecomposePrompt } from '../lib/tutorPrompt.js'
import {
  buildProfessorSystemPrompt, parseProfessorTurn, sessionContext, trimHistory,
  type ProfessorMessage, type ProfessorTurn,
} from '../lib/professorPrompt.js'
import { providerFetch } from '../lib/providerFetch.js'

export { buildSystemPrompt } from '../lib/tutorPrompt.js'

export interface VocabItem {
  word: string
  pinyin?: string       // only for Chinese content
  translation: string
  example: string
}

export interface TutorAnalysis {
  transcript: string
  pinyin?: string        // full pinyin of transcript (only for Chinese)
  romanization?: string  // full romanization of the transcript
  reading?: string       // full hiragana reading (only for Japanese — for furigana)
  englishText?: string   // English translation (only when content is not English)
  translation?: string   // Brazilian Portuguese translation of the whole sentence
  vocab: VocabItem[]
  tip: string
  contentLanguage: string
}

export interface WordLookup {
  word: string
  romanization?: string
  reading?: string       // leitura kana (japonês — para o acento tonal)
  pitchAccent?: number   // posição do downstep (0 = heiban) — japonês
  meanings: string[]
  note?: string
}

export interface CharComponent {
  part: string
  meaning: string
  reading?: string
}

export interface CharDecomposition {
  character: string
  meaning: string
  reading?: string
  strokes?: number
  components: CharComponent[]
  mnemonic?: string
}

function formatProviderError(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string; status?: string } }
    const status = parsed.error?.status
    const message = parsed.error?.message
    return [status, message].filter(Boolean).join(': ') || body
  } catch {
    return body
  }
}

export class TutorService {
  private store = new StoreService()

  constructor(
    private credentials: CredentialsService,
    private settings: SettingsService,
  ) {}

  // Registra o gasto estimado de uma chamada de chat (nunca quebra a feature se o tracking falhar).
  private recordUsage(feature: TokenUsageFeature, provider: string, inputText: string, outputText: string, lang?: string): void {
    try {
      const inputTokens = estimateTokens(inputText)
      const outputTokens = estimateTokens(outputText)
      this.store.recordTokenUsage({
        feature, provider, model: chatModelFor(provider), lang,
        inputTokens, outputTokens, totalTokens: inputTokens + outputTokens,
      })
    } catch { /* ignore */ }
  }

  async analyze(transcript: string, detectedLanguage: string): Promise<TutorAnalysis> {
    const { activeAiProvider, nativeLanguage } = this.settings.getAll()
    const apiKey = this.credentials.get(activeAiProvider)

    if (!apiKey) {
      throw new Error(`Nenhuma chave configurada para "${activeAiProvider}".`)
    }

    const prompt = buildSystemPrompt(detectedLanguage, nativeLanguage)
    const raw = await this.dispatch(activeAiProvider, apiKey, transcript, prompt)
    this.recordUsage('analysis', activeAiProvider, prompt + transcript, raw, detectedLanguage)

    try {
      const parsed = JSON.parse(raw) as { vocab?: VocabItem[]; tip?: string; romanization?: string; reading?: string; englishText?: string; translation?: string }
      return {
        transcript,
        romanization: parsed.romanization,
        reading: parsed.reading,
        englishText: parsed.englishText,
        translation: parsed.translation,
        vocab: parsed.vocab ?? [],
        tip: parsed.tip ?? '',
        contentLanguage: detectedLanguage,
      }
    } catch {
      return { transcript, vocab: [], tip: '', contentLanguage: detectedLanguage }
    }
  }

  /** On-demand paraphrases of a sentence for varied practice. */
  async variations(sentence: string, lang: string): Promise<Array<{ text: string; translation: string }>> {
    const { activeAiProvider, nativeLanguage } = this.settings.getAll()
    const apiKey = this.credentials.get(activeAiProvider)
    if (!apiKey) throw new Error(`Nenhuma chave configurada para "${activeAiProvider}".`)

    const vprompt = buildVariationsPrompt(sentence, lang, nativeLanguage)
    const raw = await this.dispatch(activeAiProvider, apiKey, sentence, vprompt)
    this.recordUsage('variations', activeAiProvider, vprompt + sentence, raw, lang)
    try {
      const parsed = JSON.parse(raw) as { variations?: Array<{ text?: string; translation?: string }> }
      return (parsed.variations ?? [])
        .filter(v => v?.text?.trim())
        .map(v => ({ text: v.text!.trim(), translation: (v.translation ?? '').trim() }))
    } catch {
      return []
    }
  }

  async lookup(word: string, context: string, lang: string): Promise<WordLookup> {
    const { activeAiProvider, nativeLanguage } = this.settings.getAll()
    const apiKey = this.credentials.get(activeAiProvider)
    if (!apiKey) throw new Error(`Nenhuma chave configurada para "${activeAiProvider}".`)

    const prompt = buildLookupPrompt(word, context, lang, nativeLanguage)
    const raw = await this.dispatch(activeAiProvider, apiKey, word, prompt)
    this.recordUsage('lookup', activeAiProvider, prompt + word, raw, lang)

    try {
      const parsed = JSON.parse(raw) as { romanization?: string; reading?: string; pitchAccent?: number; meanings?: string[]; note?: string }
      return {
        word,
        romanization: parsed.romanization,
        reading: parsed.reading,
        pitchAccent: typeof parsed.pitchAccent === 'number' ? parsed.pitchAccent : undefined,
        meanings: parsed.meanings ?? [],
        note: parsed.note || undefined,
      }
    } catch {
      return { word, meanings: [] }
    }
  }

  /** Decompõe um caractere Han em componentes/radicais + mnemônico (sob demanda). */
  async decompose(char: string, lang: string): Promise<CharDecomposition> {
    const { activeAiProvider, nativeLanguage } = this.settings.getAll()
    const apiKey = this.credentials.get(activeAiProvider)
    if (!apiKey) throw new Error(`Nenhuma chave configurada para "${activeAiProvider}".`)

    const dprompt = buildDecomposePrompt(char, lang, nativeLanguage)
    const raw = await this.dispatch(activeAiProvider, apiKey, char, dprompt)
    this.recordUsage('decompose', activeAiProvider, dprompt + char, raw, lang)
    try {
      const parsed = JSON.parse(raw) as Partial<CharDecomposition>
      const components = Array.isArray(parsed.components)
        ? parsed.components
            .filter((c): c is CharComponent => !!c && typeof c.part === 'string' && c.part.length > 0)
            .map(c => ({ part: c.part, meaning: c.meaning ?? '', reading: c.reading || undefined }))
        : []
      return {
        character: char,
        meaning: parsed.meaning ?? '',
        reading: parsed.reading || undefined,
        strokes: typeof parsed.strokes === 'number' && parsed.strokes > 0 ? parsed.strokes : undefined,
        components,
        mnemonic: parsed.mnemonic || undefined,
      }
    } catch {
      return { character: char, meaning: '', components: [] }
    }
  }

  /**
   * Professor-IA de conversa ("language parent"): dado o contexto da sessão + histórico,
   * devolve a próxima pergunta + feedback estruturado da última resposta do aluno.
   */
  async converse(opts: {
    lang: string
    level?: string
    context: string[]
    history: ProfessorMessage[]
    userMessage: string
  }): Promise<ProfessorTurn> {
    const { activeAiProvider, nativeLanguage } = this.settings.getAll()
    const apiKey = this.credentials.get(activeAiProvider)
    if (!apiKey) throw new Error(`Nenhuma chave configurada para "${activeAiProvider}".`)

    const system = buildProfessorSystemPrompt({
      lang: opts.lang,
      native: nativeLanguage,
      level: opts.level,
      context: sessionContext(opts.context),
      history: trimHistory(opts.history),
    })
    // Primeira jogada (sem fala do aluno) → dispara a 1ª pergunta.
    const userText = opts.userMessage?.trim() || 'Start the conversation: ask your first question about the context.'
    const raw = await this.dispatch(activeAiProvider, apiKey, userText, system)
    return parseProfessorTurn(raw)
  }

  private async dispatch(provider: string, apiKey: string, userText: string, prompt: string): Promise<string> {
    switch (provider) {
      case 'gemini':    return this.callGemini(apiKey, userText, prompt)
      case 'openai':    return this.callOpenAI(apiKey, userText, prompt)
      case 'anthropic': return this.callAnthropic(apiKey, userText, prompt)
      case 'groq':      return this.callGroq(apiKey, userText, prompt)
      default: throw new Error(`Provider "${provider}" não suportado para chat.`)
    }
  }

  private async callGemini(apiKey: string, transcript: string, systemPrompt: string): Promise<string> {
    const res = await providerFetch(
      'Gemini tutor',
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: transcript }] }],
          generationConfig: {
            thinkingConfig: { thinkingBudget: 0 },
            responseMimeType: 'application/json',
          },
        }),
      },
    )
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${formatProviderError(await res.text())}`)
    const json = await res.json() as { candidates: { content: { parts: { text: string }[] } }[] }
    return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
  }

  private async callOpenAI(apiKey: string, transcript: string, systemPrompt: string): Promise<string> {
    const res = await providerFetch('OpenAI tutor', 'https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: transcript },
        ],
      }),
    })
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`)
    const json = await res.json() as { choices: { message: { content: string } }[] }
    return json.choices?.[0]?.message?.content ?? '{}'
  }

  private async callAnthropic(apiKey: string, transcript: string, systemPrompt: string): Promise<string> {
    const res = await providerFetch('Anthropic tutor', 'https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: 'user', content: transcript }],
      }),
    })
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`)
    const json = await res.json() as { content: { text: string }[] }
    return json.content?.[0]?.text ?? '{}'
  }

  private async callGroq(apiKey: string, transcript: string, systemPrompt: string): Promise<string> {
    const res = await providerFetch('Groq tutor', 'https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',  // higher quality than 8b for tutor analysis
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: transcript },
        ],
      }),
    })
    if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`)
    const json = await res.json() as { choices: { message: { content: string } }[] }
    return json.choices?.[0]?.message?.content ?? '{}'
  }
}
