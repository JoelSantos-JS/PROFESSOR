# Feedback da amiga (1º teste real) — Soaken v0.1.2

Bugs reportados no primeiro uso real (PC em inglês/coreano). Cada item tem **o que aconteceu**,
**o esperado** e a **hipótese de causa** (a confirmar no código).

---

## 1. Configurou as chaves mas ficou preso na tela inicial (onboarding) ✅ CORRIGIDO
- **O que aconteceu:** ela colocou as chaves, mas **continuou na tela de configuração inicial** (onboarding) em vez do programa abrir.
- **Causa:** o onboarding só re-checava as chaves ao trocar de step. Ela abriu **Configurações (outra janela)**, salvou a chave, voltou — e o onboarding **não re-checou** → o botão "Continuar" ficou bloqueado (`disabled={!hasKey}`).
- **Fix:** `credentials:set/remove` faz **broadcast `credentials:changed`**; o onboarding re-checa nesse evento **e** ao receber foco de volta → "Continuar" destrava na hora.
- **Status:** ✅ corrigido

## 2. Idioma veio em PT-BR mesmo com PC em inglês/coreano
- **O que aconteceu:** o app abriu **em português** mesmo com o Windows dela em inglês/coreano. Ela teve que **usar o ChatGPT pra traduzir** e conseguir instalar/configurar.
- **Esperado:** seguir o idioma do PC (inglês/coreano → **inglês**; só PT-BR vira português).
- **Causa:** `DEFAULTS.appLanguage = 'pt'`. Como o `appLanguage(raw)` só cai no locale quando `raw` está **vazio**, o default 'pt' fazia ele **nunca** detectar o locale.
- **Fix:** `appLanguage` e `nativeLanguage` agora têm **default vazio** → seguem o LOCALE do PC (en/ko→**inglês**, pt→pt). As traduções (prompt no main) também resolvem o nativo pelo locale quando vazio.
- **Status:** ✅ corrigido

## 3. Loop, scroll e troca de idioma
- **3a — Botão "Loop" não funciona.** Clicar em Loop não faz o áudio repetir.
- **3b — Scroll pula pro fim.** A lista fica rolando pra a última mensagem da fila sozinha (atrapalha ler/usar itens anteriores).
- **3c — Troca de idioma não é instantânea.** ✅ **CORRIGIDO** — `settings:set` faz broadcast `settings:changed`; todas as janelas (Dashboard, FloatingBar, TutorBoard, Dock, Review) re-renderizam na hora. Sem reiniciar.
- **Status:** 🟡 3a (Loop) e 3b (scroll) abertos · 3c corrigido

## 4. Pronúncia no idioma errado + sem como trocar
- **O que aconteceu:** ela queria testar a pronúncia **em inglês**, mas aparecia em **coreano**. E não tinha como **trocar de idioma** pra testar.
- **Esperado:** testar pronúncia no idioma escolhido, com um seletor pra alternar (EN/KO/...).
- **Hipótese:** a tela de pronúncia usa o `contentLanguage`/idioma travado da sessão (ou o primeiro `learnLanguages`) em vez de deixar escolher; falta um seletor de idioma na prática de pronúncia.
- **Status:** 🔴 aberto

---

## Ordem de ataque sugerida
1. **#2 idioma** (crítico — bloqueia quem não fala PT) — default vazio + locale.
2. **#1 chaves** (bloqueia uso) — re-checar config após salvar.
3. **#3c troca instantânea de idioma** (UX importante).
4. **#3a Loop** + **#4 pronúncia** (idioma + seletor).
5. **#3b scroll** (polish).
