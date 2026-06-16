// Lógica pura do fluxo de onboarding (1º acesso). Determinística e testável — a UI só
// navega entre os passos e renderiza o conteúdo de cada um.

export type OnboardingLevel = 'beginner' | 'knows-script' | 'intermediate' | 'advanced'

export const ONBOARDING_STEPS = ['welcome', 'apiKey', 'resources', 'done'] as const
export type OnboardingStep = typeof ONBOARDING_STEPS[number]

export interface LevelOption {
  id: OnboardingLevel
  label: string
  desc: string
}

export const LEVELS: LevelOption[] = [
  { id: 'beginner',     label: 'Começando do zero',      desc: 'Ainda não leio o sistema de escrita.' },
  { id: 'knows-script', label: 'Já leio a escrita',      desc: 'Sei o alfabeto/kana/pinyin, quero imergir.' },
  { id: 'intermediate', label: 'Intermediário',          desc: 'Entendo bastante; quero ganhar fluência.' },
  { id: 'advanced',     label: 'Avançado / conversação', desc: 'Quero treinar produção, pronúncia e conversa.' },
]

export function stepIndex(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step)
}

export function nextStep(step: OnboardingStep): OnboardingStep {
  const i = stepIndex(step)
  return ONBOARDING_STEPS[Math.min(i + 1, ONBOARDING_STEPS.length - 1)]
}

export function prevStep(step: OnboardingStep): OnboardingStep {
  const i = stepIndex(step)
  return ONBOARDING_STEPS[Math.max(i - 1, 0)]
}

export function isLastStep(step: OnboardingStep): boolean {
  return step === ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1]
}

/** Quantos passos navegáveis (exclui o 'done', que é o fim). */
export const TOTAL_NAV_STEPS = ONBOARDING_STEPS.length - 1

export type ResourceSection = 'writing' | 'channels' | 'practice'

/**
 * Seções de recursos a mostrar no passo 'resources', conforme o nível:
 * - iniciante:        primer do sistema de escrita + canais de imersão.
 * - já lê a escrita:  só canais (começar a imergir).
 * - intermediário:    foco em produção/prática + canais.
 * - avançado:         só produção/conversação (não precisa de recursos de iniciante).
 */
export function resourceSectionsFor(level: OnboardingLevel): ResourceSection[] {
  switch (level) {
    case 'beginner':     return ['writing', 'channels']
    case 'knows-script': return ['channels']
    case 'intermediate': return ['practice', 'channels']
    case 'advanced':     return ['practice']
  }
}

export const DEFAULT_LEVEL: OnboardingLevel = 'beginner'

const LEVEL_IDS = new Set<string>(LEVELS.map(l => l.id))

/** Serializa níveis por idioma na ordem dada: { zh:'beginner', en:'advanced' } → "zh:beginner,en:advanced". */
export function serializeLevels(levels: Record<string, OnboardingLevel>, order: string[]): string {
  return order.filter(l => levels[l]).map(l => `${l}:${levels[l]}`).join(',')
}

/** Faz o parse de "zh:beginner,en:advanced" → { zh:'beginner', en:'advanced' } (ignora entradas inválidas). */
export function parseLevels(csv: string): Record<string, OnboardingLevel> {
  const out: Record<string, OnboardingLevel> = {}
  for (const part of (csv || '').split(',')) {
    const [lang, lvl] = part.split(':').map(s => s?.trim())
    if (lang && lvl && LEVEL_IDS.has(lvl)) out[lang] = lvl as OnboardingLevel
  }
  return out
}
