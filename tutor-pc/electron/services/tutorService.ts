import { CredentialsService } from './credentialsService'
import { SettingsService } from './settingsService'
import { buildSystemPrompt, buildLookupPrompt, buildVariationsPrompt } from '../lib/tutorPrompt.js'
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
  englishText?: string   // English translation (only when content is not English)
  translation?: string   // Brazilian Portuguese translation of the whole sentence
  vocab: VocabItem[]
  tip: string
  contentLanguage: string
}

export interface WordLookup {
  word: string
  romanization?: string
  meanings: string[]
  note?: string
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
  constructor(
    private credentials: CredentialsService,
    private settings: SettingsService,
  ) {}

  async analyze(transcript: string, detectedLanguage: string): Promise<TutorAnalysis> {
    const { activeAiProvider } = this.settings.getAll()
    const apiKey = this.credentials.get(activeAiProvider)

    if (!apiKey) {
      throw new Error(`Nenhuma chave configurada para "${activeAiProvider}".`)
    }

    const raw = await this.callProvider(activeAiProvider, apiKey, transcript, detectedLanguage)

    try {
      const parsed = JSON.parse(raw) as { vocab?: VocabItem[]; tip?: string; romanization?: string; englishText?: string; translation?: string }
      return {
        transcript,
        romanization: parsed.romanization,
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
    const { activeAiProvider } = this.settings.getAll()
    const apiKey = this.credentials.get(activeAiProvider)
    if (!apiKey) throw new Error(`Nenhuma chave configurada para "${activeAiProvider}".`)

    const raw = await this.dispatch(activeAiProvider, apiKey, sentence, buildVariationsPrompt(sentence, lang))
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
    const { activeAiProvider } = this.settings.getAll()
    const apiKey = this.credentials.get(activeAiProvider)
    if (!apiKey) throw new Error(`Nenhuma chave configurada para "${activeAiProvider}".`)

    const prompt = buildLookupPrompt(word, context, lang)
    const raw = await this.dispatch(activeAiProvider, apiKey, word, prompt)

    try {
      const parsed = JSON.parse(raw) as { romanization?: string; meanings?: string[]; note?: string }
      return {
        word,
        romanization: parsed.romanization,
        meanings: parsed.meanings ?? [],
        note: parsed.note || undefined,
      }
    } catch {
      return { word, meanings: [] }
    }
  }

  private async callProvider(provider: string, apiKey: string, transcript: string, lang: string): Promise<string> {
    return this.dispatch(provider, apiKey, transcript, buildSystemPrompt(lang))
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
