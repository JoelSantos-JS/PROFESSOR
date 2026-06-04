/* Mock data for the PROFESSOR prototype. Exposed on window.DATA */
(function () {
  // Tutor Board entries — each captured sentence becomes a card.
  const entries = [
    {
      id: 1,
      lang: "en",
      flag: "🇬🇧",
      langName: "Inglês",
      words: ["I", "didn't", "see", "that", "coming", "at", "all"],
      roman: null,
      romanLabel: null,
      natural: "I didn‿t see that comin’ at all  ·  didn’t → “dint”",
      translation: null, // english source needs no EN translation
      translationPt: "Eu não esperava por essa de jeito nenhum.",
      vocab: [
        { w: "see ... coming", pt: "prever / esperar algo", },
        { w: "at all", pt: "de jeito nenhum (ênfase)" },
      ],
      tip: "“see it coming” é uma expressão para algo que você previa. Com negação vira surpresa: “I didn’t see that coming”.",
      cues: [0, 0.18, 0.42, 0.66, 0.84, 1.06, 1.22, 1.5],
      practice: null,
    },
    {
      id: 2,
      lang: "ko",
      flag: "🇰🇷",
      langName: "Coreano",
      words: ["우리", "다시", "시작할", "수", "있을까?"],
      roman: "uri dasi sijakhal su isseulkka?",
      romanLabel: "Romanização",
      natural: null,
      translation: "Can we start over?",
      translationPt: "A gente consegue começar de novo?",
      vocab: [
        { w: "다시", pt: "de novo, outra vez" },
        { w: "시작하다", pt: "começar, iniciar" },
        { w: "-ㄹ 수 있다", pt: "conseguir / poder (fazer)" },
      ],
      tip: "“-ㄹ 수 있을까?” é uma forma suave de perguntar “será que dá pra…?”. O “-까?” deixa a pergunta mais gentil e reflexiva.",
      cues: [0, 0.4, 0.78, 1.3, 1.5],
      practice: { score: 86, diff: [["우리","hit"],["다시","hit"],["시작할","hit"],["수","hit"],["있을까","miss"]] },
    },
    {
      id: 3,
      lang: "ko",
      flag: "🇰🇷",
      langName: "Coreano",
      words: ["그건", "네", "잘못이", "아니야"],
      roman: "geugeon ne jalmoshi aniya",
      romanLabel: "Romanização",
      natural: null,
      translation: "That's not your fault.",
      translationPt: "A culpa não é sua.",
      vocab: [
        { w: "잘못", pt: "erro, culpa, falha" },
        { w: "아니야", pt: "não é (informal)" },
      ],
      tip: "“그건” = “그것은” contraído (isso/aquilo + tópico). Coreano coloquial encurta muito as partículas na fala rápida.",
      cues: [0, 0.34, 0.7, 1.15],
      practice: null,
      error: null,
    },
  ];

  // Live transcription feed (floating bar)
  const transcript = [
    { id: 11, text: "We need to talk about what happened.", lang: "en", t: "agora" },
    { id: 12, text: "그건 네 잘못이 아니야.", lang: "ko", t: "agora" },
    { id: 13, text: "우리 다시 시작할 수 있을까?", lang: "ko", t: "processando", live: true },
  ];

  // Session attempts (Sessão tab)
  const attempts = [
    {
      n: 3, score: 86, lang: "ko",
      target: "우리 다시 시작할 수 있을까?",
      said: "우리 다시 시작할 수 있어?",
      diff: [["우리","hit"],["다시","hit"],["시작할","hit"],["수","hit"],["있어","miss"]],
      mistakes: ["있을까"],
    },
    {
      n: 2, score: 64, lang: "ko",
      target: "그건 네 잘못이 아니야.",
      said: "그건 네 잘 못이 아니야.",
      diff: [["그건","hit"],["네","hit"],["잘못이","miss"],["아니야","hit"]],
      mistakes: ["잘못이"],
    },
    {
      n: 1, score: 92, lang: "en",
      target: "I didn't see that coming.",
      said: "I didn't see that coming.",
      diff: [["I","hit"],["didn't","hit"],["see","hit"],["that","hit"],["coming","hit"]],
      mistakes: [],
    },
  ];

  // Review decks (SM-2)
  const decks = [
    {
      lang: "ko", flag: "🇰🇷", name: "Coreano", due: 7,
      cards: [
        { front: "우리 다시 시작할 수 있을까?", roman: "uri dasi sijakhal su isseulkka?", pt: "A gente consegue começar de novo?",
          variations: [
            { txt: "다시 한번 해볼까?", pt: "Vamos tentar de novo?" },
            { txt: "처음부터 다시 할 수 있을까?", pt: "Dá pra começar do início?" },
          ] },
        { front: "그건 네 잘못이 아니야.", roman: "geugeon ne jalmoshi aniya", pt: "A culpa não é sua.", variations: [] },
      ],
    },
    {
      lang: "en", flag: "🇬🇧", name: "Inglês", due: 4,
      cards: [
        { front: "I didn't see that coming.", roman: null, pt: "Eu não esperava por essa.", variations: [] },
      ],
    },
    { lang: "es", flag: "🇪🇸", name: "Espanhol", due: 0, cards: [] },
  ];

  // Dashboard
  const stats = { sessions: 14, phrases: 213, streak: 6 };
  const languages = [
    { lang: "ko", flag: "🇰🇷", name: "Coreano", total: 128, due: 7 },
    { lang: "en", flag: "🇬🇧", name: "Inglês", total: 73, due: 4 },
    { lang: "es", flag: "🇪🇸", name: "Espanhol", total: 12, due: 0 },
  ];
  const mistakes = [
    { word: "있을까", lang: "ko", count: 5 },
    { word: "잘못이", lang: "ko", count: 4 },
    { word: "thoroughly", lang: "en", count: 3 },
    { word: "particularly", lang: "en", count: 2 },
  ];
  const recent = [
    { title: "Crash Landing on You · ep.4", lang: "🇰🇷", lines: 23, when: "hoje, 21:40" },
    { title: "The Bear · ep.2", lang: "🇬🇧", lines: 17, when: "ontem, 22:10" },
    { title: "La Casa de Papel · ep.1", lang: "🇪🇸", lines: 9, when: "seg, 20:05" },
  ];

  // Settings
  const providers = [
    { id: "openai", name: "OpenAI", configured: true, transcribes: true, hint: "platform.openai.com" },
    { id: "gemini", name: "Google Gemini", configured: true, transcribes: true, hint: "aistudio.google.com" },
    { id: "anthropic", name: "Anthropic", configured: false, transcribes: false, hint: "console.anthropic.com" },
    { id: "groq", name: "Groq", configured: false, transcribes: true, hint: "console.groq.com" },
  ];
  const shortcuts = [
    { keys: ["Ctrl","Alt","L"], label: "Iniciar / parar escuta" },
    { keys: ["Ctrl","Alt","D"], label: "Abrir Dashboard" },
    { keys: ["Ctrl","Alt","S"], label: "Abrir Configurações" },
    { keys: ["Ctrl","Alt","B"], label: "Abrir Tutor Board" },
    { keys: ["Ctrl","Alt","Space"], label: "Pausar / retomar o player" },
  ];

  window.DATA = { entries, transcript, attempts, decks, stats, languages, mistakes, recent, providers, shortcuts };
})();
