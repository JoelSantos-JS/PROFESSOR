import { createContext, useContext, type ReactNode } from 'react'
import { uiText, type AppLanguage, type UiKey } from './uiLanguage'

// Contexto leve de idioma da UI para telas com muitos subcomponentes (ex.: TutorBoard).
// Evita threadar `uiLang` por prop em cada componente. Default 'pt' p/ compat com testes existentes.
const UiLangContext = createContext<AppLanguage>('pt')

export function UiLangProvider({ value, children }: { value: AppLanguage; children: ReactNode }) {
  return <UiLangContext.Provider value={value}>{children}</UiLangContext.Provider>
}

/** Idioma da UI atual (do contexto). */
export function useUiLang(): AppLanguage {
  return useContext(UiLangContext)
}

/** Tradutor ligado ao contexto: `const t = useT(); t('key')`. */
export function useT(): (key: UiKey) => string {
  const lang = useContext(UiLangContext)
  return (key: UiKey) => uiText(lang, key)
}
