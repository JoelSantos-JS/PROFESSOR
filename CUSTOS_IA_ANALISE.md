# Análise de Custos de IA — Soaken

> Análise feita em **2026-06-19**. O pico de gasto foi em **2026-06-18 (ontem)**.
> Fontes: dashboards do Groq e do Google AI (Gemini) + registro interno do app (`store.json`, `tokenUsage`).

---

## ⚠️ Ressalva importante (medição imprecisa)
1. **A chave Gemini foi usada em DOIS apps de transcrição/IA**, não só o Soaken. Logo, o **R$12,49 da fatura do Gemini NÃO é todo do Soaken** — parte é do outro app. O número limpo só dá pra saber medindo por app (ver "Plano", fix #1).
2. **O medidor interno do app é não-confiável.** Ele estima tokens por `tamanho/4` (chute). Para o dia 18 ele registrou **~US$0,06** de Gemini, enquanto a fatura real do dia foi **~R$6,2 (~US$1,10)** — diferença de **~16-18×**. **Confiar na fatura do provedor, não no painel do app** (até o fix #1).

---

## 💸 Os números (período 23/mai – 19/jun, "28 dias")

### Groq — transcrição (whisper-large-v3)
- **Custo total: US$0,52** · pico dia 18: **US$0,22**.
- Transcrição é **barata**. Não é o problema.
- Observado: muitas requisições + ~700 erros **429 (TooManyRequests)** no dia 18 → rajada da **transcrição ao vivo** batendo no rate-limit do free tier. Funcional (o fallback segura o texto), mas mostra frequência alta.

### Gemini — análise + lookup (gemini-2.5-flash)
- **Custo total: R$12,49** (inclui o OUTRO app — ver ressalva) · pico dia 18: **~R$6,2** (metade do mês num dia).
- **Teto mensal configurado: R$50** (estava em ~R$10). Rede de segurança ok.
- **Este é o custo que importa.**

### Registro interno do app — dia 18 (por feature)
| Feature | Provider | Modelo | Chamadas | Tokens (estim.) |
|---|---|---|---|---|
| transcription | groq | whisper-large-v3 | **633** | ~4.407 s de áudio |
| analysis | gemini | gemini-2.5-flash | **122** | ~32k in / ~20k out |
| lookup | gemini | gemini-2.5-flash | **17** | ~3,5k in / ~0,8k out |
| professor | (?) | (?) | 1 | — |

Comparado ao dia 17: análise **13 → 122** (~9×); transcrição **13 → 633** (~48×).

---

## 🔍 Por que o dia 18 explodiu (3 causas)
1. **Dia atípico de desenvolvimento** — relaunches e sessões de vídeo o dia inteiro pra validar features. Boa parte do gasto foi **teste**, não uso real.
2. **Fix da fila de transcrição** — o app parou de descartar frases; agora **TODA** frase capturada é **auto-analisada no Gemini em background**, mesmo as que o usuário não olha. (maior vazamento estrutural)
3. **Transcrição ao vivo** — re-transcreve a frase em andamento a cada ~0,85s → 3-5× mais chamadas Groq por frase (explica os 5K req + 429). Custo $ baixo (Groq), mas alto em volume.
4. **Possível "thinking" do Gemini** inflando o custo por chamada (~16× acima da estimativa). A confirmar com a medição real.

---

## 📈 Projeção em escala (50 usuários)
Premissa: uso moderado ~30 min/dia → ~150 frases/sessão → 150 análises automáticas.

| Cenário | Conta | Por mês |
|---|---|---|
| **Hoje (auto-analisa tudo)** | 50 × 150 × 30 × ~R$0,045 | **~R$10.000/mês** ❌ inviável |
| Se for "thinking" e desligar (÷16) | — | ~R$630/mês |
| **+ análise sob demanda** (~15% das frases) | — | **~R$100/mês** ✅ |

Conclusão: do jeito atual, **IA gerenciada não fecha margem**. Com os fixes, vira viável.

---

## ✅ Quanto custa VALIDAR o produto

### Caminho 1 — BYOK (recomendado) = **~R$0 pra você**
O app já é BYOK: cada usuário traz a **própria chave** (Gemini/Groq têm free tier).
- **Custo de IA pra você: zero.** Cada um paga/usa o próprio free tier.
- Atrito: criar uma chave grátis (~2 min). Aceitável p/ early-adopter.
- Valida product-market fit sem gastar nada.

### Caminho 2 — IA gerenciada (você paga, menos atrito)
~20 usuários/mês, uso moderado:
| Setup | Por usuário/mês | 20 usuários |
|---|---|---|
| Hoje | R$9 – R$135* | R$180 – R$2.700 |
| Pós-fixes | R$1 – R$5 | **R$30 – R$100** |

\* faixa larga porque o medidor está quebrado (pode ser thinking ×16). Fix #1 resolve a incerteza.

---

## 🛠️ Plano de correção (ordem que derruba o custo)
1. **Medir tokens REAIS** — ler `usageMetadata` (Gemini: `promptTokenCount`/`candidatesTokenCount`/`thoughtsTokenCount`; OpenAI: `usage`). Faz o painel bater com a fatura **e** revela se há "thinking" escondido. *(seguro; só melhora precisão)*
2. **Análise sob demanda** — só analisar a frase quando o usuário **abre/clica** no Tutor Board, não toda frase em background. *(maior corte de custo)*
3. **Cache + pular trivial** — não re-analisar frases repetidas; frases muito curtas não vão pro Gemini.
4. *(futuro)* Medir custo **por usuário** no tier gerenciado → base pra precificar o Pro-Managed.

> Relacionado: [monetization-model] (Free-BYOK / Pro-BYOK / Pro-Managed). O custo de IA só é problema **seu** no tier gerenciado; no BYOK é R$0.

---

## TL;DR
- **Transcrição (Groq) é barata** (US$0,52). O custo é **análise no Gemini**.
- O **R$12,49 não é só do Soaken** (chave usada em 2 apps) e o medidor do app é impreciso → confiar na fatura do provedor.
- O pico do dia 18 foi **teste de dev + auto-análise de toda frase**.
- **Pra validar: use BYOK → ~R$0.** Otimização de custo só importa pro tier gerenciado.
- **Próximo passo técnico:** medir tokens reais (#1) + análise sob demanda (#2).
