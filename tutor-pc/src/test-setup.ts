// Setup global dos testes. Fixa o locale do ambiente jsdom em pt-BR para que o default de idioma
// do app (que agora segue o locale do PC) seja determinístico nos testes de UI existentes. O
// comportamento POR locale é coberto à parte passando o locale explicitamente (uiLanguage.test).
if (typeof navigator !== 'undefined') {
  try {
    Object.defineProperty(navigator, 'language', { value: 'pt-BR', configurable: true })
  } catch { /* ambiente sem navigator (node) — ignora */ }
}
