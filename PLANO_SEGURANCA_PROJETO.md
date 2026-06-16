# PROFESSOR - Plano geral de seguranca do projeto

> Checklist de seguranca para o projeto inteiro, nao apenas autenticacao.
> O objetivo e evitar vazamento de dados, chaves, audio, transcricoes, tokens, historico de estudo
> e custos indevidos com providers de IA.

---

## 1. Escopo

Este plano cobre:

- app desktop Electron;
- renderer React;
- IPC entre renderer e main process;
- armazenamento local;
- chaves BYOK dos providers;
- logs e erros;
- build/deploy;
- dependencias;
- futuras APIs/backend;
- futura autenticacao;
- futuro pagamento/assinatura;
- futuras features de IA com ferramentas/actions.

Mesmo antes de termos backend, muitas falhas ainda se aplicam: API key no frontend, logs com
segredo, IPC aberto, source maps, dependencias vulneraveis, prompt injection e vazamento no build.

---

## 2. Principio central

Seguranca do PROFESSOR deve seguir estas regras:

- segredo nunca vai para o renderer se nao for estritamente necessario;
- regra de permissao nunca existe apenas no cliente;
- logs nunca carregam token, senha, API key, audio bruto ou transcricao privada;
- toda entrada externa e validada;
- toda feature de IA recebe apenas os dados minimos;
- toda chamada custosa tem limite;
- todo deploy passa por scanner de segredo e dependencia;
- codigo gerado por IA passa por review quando toca auth, storage, IPC, pagamento, banco ou rede.

---

## 3. Dados que precisamos proteger

### Segredos

- API keys OpenAI/Gemini/Anthropic/Groq;
- tokens de sessao futuros;
- refresh tokens futuros;
- secrets de webhook futuros;
- chaves de banco futuras;
- secrets de Stripe/pagamento futuros.

### Dados privados do usuario

- email e conta futura;
- idioma nativo e idiomas estudados;
- frases capturadas;
- transcricoes;
- gravacoes de voz;
- audio original recortado;
- palavras conhecidas;
- historico de erros;
- progresso SRS;
- dados de pagamento futuros.

### Dados sensiveis por custo

- limites de minutos;
- creditos de IA;
- uso mensal;
- chamadas de transcricao;
- chamadas de tutor;
- chamadas de TTS.

---

## 4. Prioridade por momento do projeto

### Agora, mesmo sem backend

- proteger chaves BYOK;
- nao vazar chaves em logs;
- validar IPC;
- evitar arquivos `.env` commitados;
- escanear secrets no repo;
- revisar dependencias;
- evitar source maps publicos em build distribuido;
- garantir que renderer nao leia credenciais diretamente;
- garantir que erros de provider nao exponham segredo;
- revisar prompt injection nas features de IA;
- limitar chamadas repetidas que geram custo.

### Quando entrar autenticacao

- storage seguro de tokens;
- sessao forte;
- logout real;
- reset de senha seguro;
- autorizacao no backend;
- rate limit;
- audit logs;
- modo offline com limite;
- isolamento entre usuarios.

### Quando entrar pagamento/plano

- webhook com assinatura;
- entitlement validado no backend;
- plano nunca liberado so pelo frontend;
- limite mensal resistente a manipulacao local;
- logs de pagamento sem dados sensiveis.

### Quando entrar sync/backend

- userId sempre vem do token;
- impedir IDOR;
- impedir usuario A acessar dados do usuario B;
- policies por owner;
- backup e restore;
- monitoramento/alerta;
- criptografia em transito e repouso.

---

## 5. Checklist principal de vulnerabilidades

Cada item deve ficar com um status quando fizermos auditoria:

- `ok`: validado;
- `nao se aplica`: nao existe essa superficie no momento;
- `corrigir`: precisa ser resolvido antes de deploy;
- `bloqueia release`: risco critico.

### 5.1. Segredos, env e build

1. **Credenciais de banco expostas**
   - Nao se aplica agora se nao houver backend.
   - Quando houver backend, credenciais ficam so no servidor/secret manager.

2. **Arquivos `.env` publicos**
   - `.env*` no `.gitignore`.
   - CI deve falhar se `.env` for commitado.

3. **API keys hardcoded**
   - Proibido em `src`, `electron`, preload, config e docs reais.
   - Usar scanner de segredo.

4. **Build logs vazando segredos**
   - Logs de build nao podem imprimir env vars, tokens ou API keys.

5. **Segredos incluidos no JavaScript frontend**
   - Verificar bundle final.
   - Renderer nao deve conter secrets reais.

6. **Source maps expostos em producao**
   - Build publico/distribuido nao deve publicar source maps sensiveis.

7. **Repos ou historico Git vazados**
   - Scanner no historico antes de abrir repo ou publicar.
   - Segredo vazado deve ser rotacionado.

8. **Dependencias vulneraveis**
   - Rodar auditoria no CI.
   - Bloquear vulnerabilidade critica.

9. **Pacotes desatualizados**
   - Rotina de update mensal.
   - Revisar pacotes que tocam auth, crypto, storage, rede, audio e IA.

10. **Credenciais default**
    - Proibido criar admin/senha padrao em backend futuro.

### 5.2. Autenticacao, autorizacao e usuarios

11. **Autenticacao fraca ou ausente**
    - Quando auth existir, rotas sensiveis exigem token valido.

12. **Sem autorizacao**
    - Backend valida permissao em toda rota sensivel.
    - Frontend nao decide permissao sozinho.

13. **Usuarios acessando dados de outros usuarios**
    - Teste com usuario A e B.
    - Query filtra por userId do token.

14. **Admin routes sem protecao**
    - Admin exige role no backend.
    - Nada de `isAdmin` vindo do cliente.

15. **Client-side-only security checks**
    - Qualquer regra de plano/permissao precisa existir no backend ou main process.

16. **Payment/subscription checks so no frontend**
    - Entitlement validado no backend.
    - Cliente nao libera plano alterando local store.

17. **IDOR**
    - IDs enviados pelo cliente nao autorizam acesso.
    - Backend sempre checa dono do recurso.

18. **API confiando em IDs/roles do usuario**
    - `userId`, `role`, `plan`, `isAdmin` vindos do cliente sao ignorados/rejeitados.

19. **Isolamento ruim entre usuarios**
    - Toda tabela/colecao futura tem owner/tenant.
    - Sync nao mistura contas.

20. **Sessao fraca**
    - Access token curto.
    - Refresh token revogavel.
    - Logout limpa local e revoga servidor.

21. **JWT secret fraco/leaked/reutilizado**
    - Secret forte por ambiente.
    - Rotacao planejada.

22. **Reset de senha quebrado**
    - Token unico, expiravel, uso unico.
    - Resposta nao revela se email existe.

### 5.3. Banco, storage e arquivos

23. **Banco aberto para read/write**
    - Regras negam por padrao.
    - Service role nunca no cliente/app.

24. **Firebase/Supabase/S3 mal configurados**
    - Buckets privados por padrao.
    - Policies com owner check.

25. **Permissao excessiva no usuario do banco**
    - Menor privilegio possivel.
    - Separar app user de migration/admin user.

26. **Dados sensiveis sem criptografia**
    - Segredos locais com DPAPI/safeStorage.
    - TLS em transito.
    - Criptografia em repouso no backend.

27. **Upload inseguro**
    - Se houver upload futuro: validar tipo, tamanho e conteudo.

28. **Path traversal**
    - IPC/servicos nao podem aceitar path arbitrario do renderer.
    - Normalizar path e limitar ao diretorio permitido.

29. **Backup/restore ausente**
    - Backend futuro precisa backup automatico.
    - Testar restore em staging.

### 5.4. APIs, rede e ataques web

30. **Input validation ausente**
    - IPC e APIs com schema.
    - Rejeitar campos extras perigosos.

31. **SQL injection**
    - Query parametrizada/ORM.
    - Testes de payload.

32. **NoSQL injection**
    - Bloquear operadores como `$ne`, `$gt`, `$where`.

33. **XSS**
    - Nao renderizar HTML vindo de IA/transcricao sem sanitizar.
    - Electron renderer com CSP restritiva.

34. **CSRF**
    - Se usar cookies, usar SameSite + CSRF token em mutacoes.

35. **SSRF**
    - Backend nao busca URL arbitraria do usuario.
    - Bloquear IPs internos/metadata.

36. **CORS permissivo**
    - Allowlist por ambiente.
    - Nunca `*` com credenciais.

37. **Rate limit ausente**
    - Login, signup, reset, transcricao, tutor, TTS, AI endpoints e APIs com limite.

38. **Ambientes teste/staging publicos**
    - Staging com auth.
    - Dados fake/anonimizados.

39. **Debug pages em producao**
    - Remover debug/devtools/endpoints internos do build de producao.

40. **Dashboards internos publicos**
    - Admin/monitoramento protegidos.

41. **Headers de seguranca ausentes**
    - CSP, HSTS, X-Content-Type-Options, Referrer-Policy.
    - No Electron, CSP no renderer e preload minimo.

42. **Cookies sem HttpOnly/Secure/SameSite**
    - Se usar cookies, todos os atributos obrigatorios.

43. **Webhooks sem assinatura**
    - Stripe/webhooks validam assinatura, timestamp e replay.

### 5.5. Logs, monitoramento e operacao

44. **Logs contendo dados sensiveis**
    - Nao logar token, senha, API key, email completo, audio bruto ou transcricao completa.

45. **Erros verbosos com stack trace**
    - Usuario ve erro limpo.
    - Stack trace so em log seguro/redigido.

46. **Sem audit logs**
    - Registrar eventos sensiveis sem segredo: login, logout, reset, plano, acesso negado.

47. **Sem monitoramento/alertas**
    - Alertas para erro alto, abuso de IA, login anormal e spikes de custo.

### 5.6. IA e codigo gerado

48. **Prompt injection**
    - Texto/transcricao do usuario nunca pode autorizar acao sensivel.
    - IA nao recebe segredos.
    - Prompt injection testado com frases maliciosas.

49. **AI tools/actions sem permissao**
    - Toda action valida usuario, plano e escopo.
    - IA recebe o minimo necessario.

50. **Confiar demais em codigo gerado por IA**
    - Toda mudanca sensivel passa por review.
    - Testes obrigatorios para auth, pagamento, sync, storage, IPC, secrets e IA.

---

## 6. Checklist especifico do app atual

### Chaves BYOK

- renderer nao deve conseguir ler chave real;
- chave deve ficar criptografada localmente;
- remover chave deve apagar o valor criptografado;
- teste de provider nao deve imprimir chave;
- erros de Gemini/OpenAI/Groq/Anthropic nao devem expor a chave;
- chaves nunca devem ir para backend futuro sem consentimento explicito.

### Electron e IPC

- preload deve expor apenas APIs especificas;
- nenhum IPC generico para ler arquivo, executar comando ou acessar path arbitrario;
- todos os payloads de IPC devem ser validados;
- chamadas sensiveis devem acontecer no main process;
- window/renderer nao deve receber token ou segredo bruto.

### Audio e transcricao

- audio bruto nao deve ser salvo sem motivo;
- gravacoes de voz devem ter retencao clara;
- sync futuro nao deve enviar audio/transcricao sem consentimento;
- logs nao devem conter frase completa se isso puder ser dado privado;
- erros de transcricao devem ser redigidos.

### IA

- prompt do tutor nao deve conter segredo;
- resposta da IA nao deve ser renderizada como HTML cru;
- tools futuras precisam checar permissao;
- cache de TTS/transcricao nao deve misturar usuarios no futuro;
- chamadas de IA precisam de limite para evitar custo indevido.

### Build e deploy

- build nao deve incluir `.env`;
- build nao deve incluir API keys reais;
- build de producao nao deve apontar para staging;
- app distribuido deve ser assinado quando chegar a release publica;
- auto-update futuro precisa validacao de assinatura.

---

## 7. Testes recomendados para o projeto

### Automatizados

- `npm test`;
- `npm run build`;
- TypeScript;
- scanner de segredos;
- auditoria de dependencias;
- testes de IPC com payload invalido;
- testes de redacao de logs;
- testes de permissao/entitlement quando auth existir.

### Manuais antes de release

- procurar `.env` e secrets no repo;
- abrir bundle/build e procurar chaves;
- testar erro de provider e verificar se nao mostra segredo;
- testar logout quando auth existir;
- testar usuario A tentando acessar dados do usuario B quando sync existir;
- testar pagamento/plano pelo backend quando assinatura existir;
- testar prompt injection em Tutor/Professor-IA.

### Ferramentas sugeridas

- Gitleaks ou TruffleHog para secrets;
- Semgrep para SAST;
- `npm audit`, OSV Scanner ou Snyk para dependencias;
- Playwright + Electron para E2E;
- Zod para validar payloads;
- OWASP ZAP quando houver backend web;
- OWASP ASVS/MASVS como checklist manual.

---

## 8. Gate de seguranca para release

Antes de qualquer deploy/release publica:

- scanner de segredos sem achado critico;
- dependencias sem vulnerabilidade critica aberta;
- build sem `.env` ou keys reais;
- logs revisados;
- IPC revisado;
- prompts de IA revisados;
- source maps tratados;
- chaves BYOK protegidas;
- se houver backend: auth, rate limit, CORS, headers e backup verificados;
- se houver pagamento: webhook assinado e plano validado no backend;
- se houver sync: isolamento entre usuarios testado.

---

## 9. Dono do checklist

Toda feature nova deve responder:

- ela toca segredo?
- ela toca dados privados?
- ela aumenta custo de IA?
- ela cria endpoint/API?
- ela cria IPC novo?
- ela salva arquivo?
- ela sincroniza dados?
- ela depende de permissao/plano?

Se a resposta for sim para qualquer item, precisa passar pelo checklist deste documento antes de
entrar em release.

