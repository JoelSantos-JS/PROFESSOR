# PROFESSOR - Plano de implementacao de autenticacao

> Plano futuro para transformar o PROFESSOR de um app desktop local/BYOK em um produto com
> conta de usuario, licenca, assinatura, sincronizacao e controle de acesso.
>
> Estado atual: o app funciona localmente, com chaves de IA do proprio usuario (BYOK). A
> autenticacao deve entrar sem quebrar esse fluxo.
>
> Checklist geral de seguranca do projeto: [PLANO_SEGURANCA_PROJETO.md](PLANO_SEGURANCA_PROJETO.md).

---

## 1. Objetivo

Adicionar autenticacao ao PROFESSOR para permitir:

- login do usuario;
- controle de assinatura/licenca;
- sincronizacao futura entre dispositivos;
- backup seguro dos dados de estudo;
- uso de creditos/limites por conta;
- protecao contra uso indevido;
- base para um plano gerenciado sem depender somente de BYOK.

Resumo: a autenticacao nao deve ser apenas "tela de login". Ela deve preparar o app para virar
produto pago, com conta, plano, limites e dados sincronizados.

---

## 2. Decisao de produto

### Manter BYOK no inicio

No primeiro momento, a autenticacao nao precisa remover o modelo atual de chaves proprias.

Fluxo inicial recomendado:

- usuario cria conta;
- usuario continua podendo usar suas proprias chaves;
- app salva preferencias e progresso localmente;
- conta serve para licenca, identidade e backup futuro.

Isso reduz risco porque o app continua funcionando mesmo antes de termos infraestrutura completa
de IA gerenciada.

### Preparar plano gerenciado

Depois, a conta pode habilitar:

- plano gratuito com limite baixo;
- plano pago com minutos/creditos;
- provider de IA gerenciado pelo servidor;
- historico sincronizado;
- login em mais de um PC.

---

## 3. Requisitos

### Obrigatorios no MVP

- criar conta com email e senha;
- login;
- logout;
- recuperar senha;
- sessao persistente no desktop;
- tela de estado "nao autenticado";
- guardar token com seguranca no sistema operacional;
- validar assinatura/licenca ao abrir o app;
- permitir modo offline temporario para quem ja estava logado.

### Importantes depois do MVP

- login com Google;
- verificacao de email;
- painel de conta;
- trocar email/senha;
- deletar conta;
- sincronizar progresso;
- sincronizar preferencias;
- gerenciar dispositivos;
- controlar plano e limites.

### Nao fazer no primeiro corte

- social login complexo;
- organizacoes/times;
- sistema de convite;
- marketplace;
- administracao avancada;
- migracao completa de todos os dados locais para nuvem.

---

## 4. Arquitetura recomendada

### 4.1. Camadas

Dividir em quatro partes:

- **Auth UI:** telas de login, cadastro, recuperar senha, conta.
- **Auth Service local:** gerencia sessao no Electron/renderer.
- **Backend de auth:** cria usuario, emite tokens, valida sessao.
- **Entitlements:** diz o que o usuario pode usar de acordo com plano/licenca.

### 4.2. No Electron main process

Responsabilidades:

- guardar refresh token ou session secret em storage seguro;
- validar sessao ao iniciar;
- expor IPCs seguros para o renderer;
- bloquear acesso a recursos pagos quando necessario;
- renovar sessao em background;
- limpar credenciais no logout.

Possiveis arquivos:

- `electron/services/authService.ts`
- `electron/ipc/authHandlers.ts`
- `electron/services/entitlementService.ts`
- `electron/services/secureSessionStore.ts`

### 4.3. No renderer React

Responsabilidades:

- mostrar estado autenticado/nao autenticado;
- telas de login/cadastro;
- painel simples de conta;
- avisos de plano/limite;
- rotas/telas bloqueadas quando necessario.

Possiveis arquivos:

- `src/windows/Auth.tsx`
- `src/components/AuthGate.tsx`
- `src/hooks/useAuth.tsx`
- `src/lib/authTypes.ts`

### 4.4. Backend

Responsabilidades:

- cadastrar usuario;
- autenticar;
- enviar email de recuperacao;
- validar token;
- retornar plano atual;
- registrar dispositivos;
- guardar eventos de uso;
- expor API para assinatura/pagamento futuramente.

Endpoints sugeridos:

- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/refresh`
- `POST /auth/password/reset`
- `GET /me`
- `GET /me/entitlements`
- `POST /devices/register`
- `POST /usage/events`

---

## 5. Modelo de dados inicial

### User

- `id`
- `email`
- `emailVerified`
- `createdAt`
- `lastLoginAt`
- `locale`

### Session

- `id`
- `userId`
- `deviceId`
- `createdAt`
- `expiresAt`
- `revokedAt`

### Device

- `id`
- `userId`
- `name`
- `platform`
- `appVersion`
- `lastSeenAt`

### Entitlement

- `userId`
- `plan`
- `status`
- `validUntil`
- `features`
- `limits`

Exemplo de `features`:

- `byok`
- `managedAi`
- `sync`
- `liveCaptions`
- `accentCoach`

Exemplo de `limits`:

- `transcriptionMinutesPerMonth`
- `tutorAnalysesPerMonth`
- `ttsCharsPerMonth`
- `devices`

---

## 6. Fluxo de usuario

### Primeiro uso

1. Usuario abre o app.
2. App mostra onboarding atual.
3. Antes ou depois da chave BYOK, aparece etapa "Criar conta".
4. Usuario cria conta ou entra.
5. App salva sessao localmente.
6. App valida plano/licenca.
7. Usuario continua para configurar idioma/chave.

### Usuario ja logado

1. App abre.
2. AuthService carrega sessao segura.
3. Tenta renovar token.
4. Busca entitlements.
5. Libera recursos.
6. Se falhar por rede, entra em modo offline temporario.

### Logout

1. Usuario clica em sair.
2. App revoga sessao no servidor.
3. Remove tokens locais.
4. Mantem dados locais de estudo no PC, a menos que o usuario escolha apagar.

---

## 7. Modo offline

Como e um app desktop, o login nao pode tornar o produto inutil sem internet.

Regra recomendada:

- se o usuario ja fez login antes, permitir uso offline por 7 dias;
- continuar permitindo recursos locais/BYOK;
- bloquear apenas recursos que exigem servidor;
- quando voltar internet, renovar sessao e sincronizar eventos.

Recursos que podem funcionar offline:

- revisar cards locais;
- consultar historico local;
- usar TTS local Kokoro;
- usar dados ja salvos.

Recursos que exigem internet:

- login/cadastro;
- recuperacao de senha;
- validacao de plano novo;
- sync;
- IA gerenciada;
- pagamento.

---

## 8. Seguranca

### Tokens

- nunca salvar senha no disco;
- salvar refresh token/session secret usando storage seguro do sistema;
- no Windows, usar DPAPI/keytar/electron safeStorage;
- access token deve ser curto;
- refresh token deve poder ser revogado.

### IPC

- renderer nao deve acessar token diretamente;
- renderer chama `window.auth.*`;
- main process decide se a sessao e valida;
- validar payloads de IPC;
- nao expor APIs genericas demais.

### Dados sensiveis

- chaves de provider continuam criptografadas localmente;
- auth nao deve enviar chaves BYOK para o servidor;
- sincronizacao de chaves so deve existir se for uma decisao explicita futura;
- logs nunca devem incluir token, senha, email completo ou API keys.

---

## 9. Fases de implementacao

### Fase 1 - Base local de autenticacao

Objetivo: o app entender "usuario logado" sem mudar a experiencia principal.

Tarefas:

- criar tipos `AuthUser`, `AuthSession`, `Entitlements`;
- criar `authService` no Electron;
- criar IPCs `auth:getSession`, `auth:login`, `auth:signup`, `auth:logout`;
- criar hook `useAuth`;
- criar tela simples de Auth;
- guardar sessao em storage seguro;
- adicionar estado autenticado no Dashboard/Onboarding.
- adicionar testes de seguranca para storage local, IPC e vazamento em logs.

Resultado:

- usuario consegue criar conta, logar e sair.
- app continua funcionando com BYOK.

### Fase 2 - Licenca e plano

Objetivo: validar o que a conta pode usar.

Tarefas:

- criar `entitlementService`;
- buscar plano no login e no start do app;
- cachear entitlements localmente;
- mostrar status do plano nas Configuracoes;
- criar bloqueio leve para features futuras pagas;
- criar estado de erro: plano expirado, pagamento pendente, sessao expirada.

Resultado:

- app passa a ter base para assinatura.

### Fase 3 - Backend minimo

Objetivo: sair de mock/local e usar API real.

Tarefas:

- escolher provider/backend de auth;
- implementar endpoints minimos;
- adicionar refresh token;
- implementar recuperacao de senha;
- implementar verificacao de email;
- registrar dispositivo;
- criar ambiente dev/staging/prod.
- adicionar pipeline de testes de seguranca antes de deploy.

Resultado:

- login real funcionando fora da maquina local.

### Fase 4 - Sincronizacao inicial

Objetivo: sincronizar o que mais importa sem migracao gigante.

Tarefas:

- sincronizar preferencias;
- sincronizar palavras conhecidas;
- sincronizar progresso de SRS;
- resolver conflito por `updatedAt`;
- criar fila local de eventos;
- retry quando voltar internet.
- validar que sync nao envia API keys BYOK nem audio bruto sem consentimento.

Resultado:

- usuario pode trocar de PC sem perder progresso principal.

### Fase 5 - Uso gerenciado e limites

Objetivo: permitir plano com IA do produto.

Tarefas:

- registrar minutos de transcricao;
- registrar analises do tutor;
- registrar caracteres de TTS remoto;
- criar rate limit por usuario;
- retornar erro amigavel quando limite acabar;
- painel simples de uso mensal.

Resultado:

- app pode ter assinatura baseada em uso real.

---

## 10. Ordem recomendada

1. **Auth local + UI**: login/cadastro/logout com storage seguro.
2. **Entitlements mockados**: app ja pergunta "o que essa conta pode usar?".
3. **Backend real**: troca mock por API.
4. **Licenca/plano**: status no app e bloqueios leves.
5. **Sync pequeno**: palavras conhecidas + SRS.
6. **Uso/limites**: minutos, analises e creditos.

---

## 11. Testes necessarios

### Unitarios

- normalizacao de email;
- validacao de senha;
- expiracao de sessao;
- regra de modo offline;
- permissao por entitlement;
- redacao de logs sensiveis.

### Integracao

- login com sucesso;
- login com senha errada;
- refresh token expirado;
- logout limpa credenciais;
- app abre offline com sessao cacheada;
- app bloqueia recurso quando plano nao permite.

### E2E

- primeiro uso -> cria conta -> configura chave -> entra no app;
- usuario logado abre app novamente;
- sessao expirada pede login;
- plano expirado mostra aviso correto;
- logout volta para tela de auth.

### Testes de seguranca e privacidade

Estes testes sao obrigatorios antes de qualquer deploy com autenticacao real. O objetivo e evitar
vazamento de token, senha, email, API key, audio, transcricoes privadas e dados de estudo.

#### 11.1. Testes de armazenamento seguro

- confirmar que senha nunca e salva em disco;
- confirmar que refresh token/session secret fica em storage seguro do sistema;
- confirmar que access token nao fica persistido em arquivo comum;
- confirmar que logout remove tokens locais;
- confirmar que sessao expirada nao continua liberando recursos online;
- confirmar que dados criptografados nao podem ser lidos como texto puro;
- confirmar que migracoes de storage nao imprimem segredo em log;
- confirmar que backup/export nao inclui tokens.

#### 11.2. Testes de chaves BYOK

- confirmar que API keys dos providers nunca sao enviadas ao backend de auth;
- confirmar que API keys nao aparecem em logs do main process;
- confirmar que API keys nao aparecem em logs do renderer/devtools;
- confirmar que API keys nao aparecem em mensagens de erro;
- confirmar que o renderer nao consegue ler a chave diretamente;
- confirmar que a chave so e usada pelo servico autorizado;
- confirmar que remover chave apaga o valor criptografado;
- confirmar que teste de provider nao vaza a chave em URL/log, principalmente Gemini.

#### 11.3. Testes de IPC Electron

- validar payloads de todos os IPCs de auth;
- negar chamadas com tipos inesperados;
- negar chamadas com campos extras perigosos;
- garantir que nenhum IPC retorna token bruto ao renderer;
- garantir que nenhum IPC permite ler arquivos arbitrarios;
- garantir que nenhum IPC permite executar comando arbitrario;
- testar chamadas repetidas/rapidas para evitar race condition;
- testar renderer malicioso tentando chamar canais internos.

#### 11.4. Testes de logs e redacao

- rodar scanner de logs procurando padroes de token;
- rodar scanner de logs procurando email completo;
- rodar scanner de logs procurando API keys;
- garantir redacao de `Authorization`, `Cookie`, `Set-Cookie`, `x-api-key` e query `key=`;
- garantir que erros de provider nao retornam segredo;
- garantir que crash reports nao incluem audio, transcript completo ou token;
- garantir que logs de debug ficam desligados no build de producao.

#### 11.5. Testes de backend auth

- senha errada retorna erro generico;
- email inexistente retorna erro generico;
- refresh token revogado nao renova sessao;
- refresh token de outro device nao funciona;
- token expirado nao acessa `/me`;
- token de usuario A nao acessa dados de usuario B;
- endpoints sensiveis exigem HTTPS;
- CORS aceita apenas origens esperadas;
- rate limit funciona em login, signup e reset de senha;
- brute force bloqueia ou desacelera tentativas;
- reset de senha expira e so pode ser usado uma vez;
- verificacao de email nao permite takeover.

#### 11.6. Testes de autorizacao e entitlements

- usuario sem plano nao acessa feature paga;
- usuario com plano expirado ve aviso correto;
- usuario com plano ativo acessa somente limites permitidos;
- alterar entitlement no cliente nao libera recurso;
- limite mensal nao pode ser burlado reiniciando o app;
- device acima do limite nao ativa automaticamente;
- modo offline respeita o periodo maximo permitido;
- sync nao aceita escrita em conta de outro usuario.

#### 11.7. Testes de rede

- nenhuma chamada de auth usa HTTP sem TLS;
- certificado invalido falha fechado;
- token nao aparece em query string;
- requests usam headers seguros;
- retry nao duplica operacoes criticas como pagamento;
- timeout nao deixa sessao em estado inconsistente;
- erro de rede nao apaga dados locais;
- proxy/interceptacao local nao revela senha em texto puro.

#### 11.8. Testes de dados sincronizados

- sync envia somente campos permitidos;
- sync nao envia audio bruto por padrao;
- sync nao envia gravacoes de voz sem consentimento explicito;
- sync nao envia API keys BYOK;
- conflito entre dispositivos nao mistura contas;
- deletar conta remove dados remotos conforme politica;
- exportacao de dados nao inclui tokens;
- importacao valida schema antes de gravar.

#### 11.9. Testes de privacidade do produto

- onboarding explica quais dados podem ser enviados;
- usuario consegue usar BYOK sem enviar chaves ao servidor;
- usuario consegue apagar conta;
- usuario consegue limpar dados locais;
- dados de voz/transcricao tem politica clara de retencao;
- telemetria deve ser opt-in ou minimizada;
- analytics nao deve conter frase completa, audio, token, email completo ou API key.

#### 11.10. Testes de dependencias e supply chain

- rodar `npm audit` ou ferramenta equivalente no CI;
- bloquear dependencias com vulnerabilidade critica conhecida;
- revisar pacotes novos que tocam auth, crypto, storage ou rede;
- travar versoes no lockfile;
- verificar que build de producao nao usa endpoints de dev;
- assinar o app antes de distribuicao publica;
- validar auto-update para evitar pacote adulterado.

#### 11.11. Testes de abuso

- limitar tentativas de login por IP/conta/device;
- limitar envio de email de reset;
- detectar criacao massiva de contas;
- detectar compartilhamento excessivo de dispositivos;
- bloquear uso anormal de minutos/creditos;
- impedir que usuario burle limite alterando relogio local;
- registrar eventos de seguranca sem registrar segredos.

#### 11.12. Ferramentas recomendadas

- testes unitarios: Vitest;
- testes E2E desktop: Playwright + Electron;
- validacao de schema: Zod ou equivalente;
- scanning de segredo: Gitleaks ou TruffleHog;
- SAST: Semgrep;
- dependencias: `npm audit`, OSV Scanner ou Snyk;
- DAST/backend: OWASP ZAP em staging;
- checklist manual: OWASP ASVS e OWASP MASVS como referencia.

#### 11.13. Gate de release

Antes de liberar autenticacao em producao:

- todos os testes unitarios/integracao/E2E passam;
- scanner de segredo passa;
- scanner de dependencias sem critica aberta;
- nenhum log contem token, senha, email completo ou API key;
- logout e revogacao testados manualmente;
- reset de senha testado manualmente;
- modo offline testado manualmente;
- tentativa de acessar conta de outro usuario bloqueada;
- build aponta para endpoints de producao corretos;
- plano de resposta a incidente documentado.

#### 11.14. Checklist Top 50 de vulnerabilidades para auditar

Esta lista deve ser usada como checklist manual + automatizado antes de qualquer release com
backend, autenticacao, pagamento, sync ou IA gerenciada. Cada item precisa ter um resultado:
`ok`, `nao se aplica`, ou `corrigir antes do deploy`.

1. **Credenciais de banco expostas**
   - Scanner de segredos no repo, CI, logs e build artifacts.
   - Variaveis de banco apenas no backend/infra, nunca no frontend ou app empacotado.

2. **Arquivos `.env` publicos**
   - `.env*` no `.gitignore`.
   - CI falha se encontrar `.env` commitado.
   - Produção usa secret manager ou variaveis protegidas.

3. **API keys hardcoded**
   - Scanner para OpenAI/Gemini/Stripe/Supabase/Firebase/etc.
   - Nenhuma chave em TS/JS, preload, renderer ou bundle.

4. **Autenticacao fraca ou ausente**
   - Rotas sensiveis exigem token valido.
   - Senha com politica minima.
   - Rate limit em login/signup/reset.

5. **Sem checagem de autorizacao**
   - Backend verifica permissao em toda rota sensivel.
   - Frontend nunca e fonte unica de permissao.

6. **Usuario acessando dados de outro usuario**
   - Testes IDOR: usuario A tentando ler/alterar dados do usuario B.
   - Queries sempre filtradas por `userId` do token, nao por `userId` enviado pelo cliente.

7. **Banco aberto para leitura/escrita**
   - Regras de banco negam tudo por padrao.
   - Service role/secret fica apenas no backend.

8. **Firebase/Supabase/S3 mal configurados**
   - Buckets privados por padrao.
   - Policies com owner check.
   - URLs publicas somente para assets realmente publicos.

9. **Rotas admin desprotegidas**
   - Admin exige role no backend.
   - Admin nao pode ser liberado por flag no cliente.

10. **Paginas de debug em producao**
    - Build de producao remove debug/devtools/endpoints internos.
    - `/debug`, `/test`, `/dev`, `/admin-dev` bloqueados.

11. **Build logs vazando segredos**
    - CI mascara secrets.
    - Logs de build passam por scanner.

12. **Erros verbosos vazando stack trace**
    - Producao retorna erro generico.
    - Stack trace fica apenas em log seguro e redigido.

13. **Repos ou historico Git vazados**
    - Repo privado enquanto houver segredo/historico sensivel.
    - Scanner roda no historico antes de abrir/publicar.
    - Segredo vazado deve ser rotacionado, nao apenas removido do commit.

14. **Segredos no JavaScript frontend**
    - Verificar bundle final.
    - Source maps e arquivos gerados passam por scanner.

15. **Seguranca somente no cliente**
    - Toda decisao de plano, permissao, uso e role e validada no backend.
    - Cliente pode esconder botao, mas nao autorizar acao.

16. **Falta de validacao de input**
    - Validar payloads com schema no backend e no IPC Electron.
    - Rejeitar campos extras inesperados.

17. **SQL injection**
    - Usar ORM/query parametrizada.
    - Testar payloads classicos em endpoints de busca/filtro.

18. **NoSQL injection**
    - Bloquear operadores inesperados como `$ne`, `$gt`, `$where`.
    - Validar tipos estritamente.

19. **XSS**
    - Nunca renderizar HTML da IA/transcricao sem sanitizacao.
    - Testar frases/transcricoes contendo `<script>`, links e atributos perigosos.

20. **CSRF**
    - Se usar cookies, exigir SameSite e CSRF token em mutacoes.
    - Se usar Bearer token, nao aceitar auth implicita por cookie sem protecao.

21. **Upload inseguro**
    - Validar tipo, tamanho, extensao e conteudo.
    - Armazenar fora de path publico executavel.
    - Escanear anexos se houver upload futuro.

22. **Path traversal**
    - Nunca confiar em caminho vindo do renderer/usuario.
    - Normalizar e limitar paths ao diretorio permitido.

23. **SSRF**
    - Bloquear backend de buscar URLs arbitrarias do usuario.
    - Denylist/allowlist para IPs internos e metadata endpoints.

24. **Reset de senha quebrado**
    - Token unico, curto, expiravel e de uso unico.
    - Nao revelar se email existe.

25. **Sessao fraca**
    - Refresh token rotacionavel/revogavel.
    - Expiracao curta para access token.
    - Logout revoga no servidor e limpa local.

26. **JWT secret fraco, vazado ou reutilizado**
    - Secret forte em secret manager.
    - Separar secrets por ambiente.
    - Rotacao planejada.

27. **CORS permissivo**
    - Nunca usar `*` com credenciais.
    - Allowlist por ambiente.

28. **Rate limit ausente**
    - Login, signup, reset, APIs, transcricao, tutor, TTS e AI endpoints com limite.
    - Limites por IP, usuario e device quando fizer sentido.

29. **Ambiente teste/staging publico**
    - Staging com auth.
    - Dados fake ou anonimizados.
    - Robots/indexacao desativados quando web.

30. **Credenciais default**
    - Nenhum admin/admin, test/test, password padrao.
    - CI falha se detectar usuario default ativo.

31. **Webhooks sem assinatura**
    - Stripe/pagamento/webhooks validam assinatura.
    - Rejeitar replay e timestamp antigo.

32. **Pagamento/assinatura checado so no frontend**
    - Backend consulta/valida entitlement.
    - Cliente nao libera plano alterando localStorage/store.

33. **IDOR**
    - IDs em URL/body nunca bastam para autorizar.
    - Testes automatizados com dois usuarios.

34. **API confiando em IDs/roles controlados pelo usuario**
    - Role vem do token/servidor, nao do body.
    - `userId`, `plan`, `isAdmin` enviados pelo cliente sao ignorados ou rejeitados.

35. **Logs com tokens, emails, senhas ou dados privados**
    - Redacao obrigatoria.
    - Logs nao guardam audio, transcript completo, API key, token ou senha.

36. **Source maps em producao**
    - Source maps publicos desativados.
    - Se precisar, enviar para ferramenta privada de erro.

37. **Vulnerabilidades de dependencias**
    - `npm audit`/OSV/Snyk no CI.
    - Bloquear criticas e altas em auth/crypto/rede.

38. **Pacotes desatualizados**
    - Rotina mensal de update.
    - Dependabot/Renovate recomendado.

39. **Prompt injection em features de IA**
    - IA nao pode receber segredos.
    - Ferramentas/acoes da IA exigem permissao do backend.
    - Prompt do usuario/transcricao nunca autoriza acao sensivel.

40. **AI tools/actions acessando dados sem permissao**
    - Toda action valida usuario, plano e escopo.
    - IA recebe apenas dados necessarios para a tarefa.

41. **Permissao excessiva no usuario do banco**
    - App usa usuario com menor privilegio possivel.
    - Separar role de leitura/escrita/admin/migracao.

42. **Sem audit logs**
    - Registrar login, logout, reset, troca de plano, falha de permissao e acoes sensiveis.
    - Logs sem dados sensiveis.

43. **Sem monitoramento/alerta**
    - Alertas para erro alto, login anormal, abuso de IA, falha de pagamento e spikes.

44. **Sem backup/restore**
    - Backup automatico do banco.
    - Teste de restauracao em staging.

45. **Dashboards internos publicos**
    - Admin/observabilidade protegidos por SSO/MFA/IP allowlist quando possivel.

46. **Headers de seguranca ausentes**
    - Backend/web com CSP, HSTS, X-Content-Type-Options, Referrer-Policy e frame protections.
    - Electron com CSP restritiva no renderer.

47. **Cookies sem HttpOnly/Secure/SameSite**
    - Se usar cookies: `HttpOnly`, `Secure`, `SameSite=Lax/Strict`.
    - Nao guardar token sensivel em cookie acessivel por JS.

48. **Dados sensiveis sem criptografia**
    - TLS em transito.
    - Criptografia em repouso para segredos e dados sensiveis.
    - DPAPI/safeStorage para segredos locais.

49. **Isolamento ruim entre tenants/usuarios**
    - Todas as tabelas/colecoes com `userId`/tenant.
    - Policies/testes impedem mistura de dados.

50. **Confiar demais em codigo gerado por IA**
    - Toda mudanca sensivel passa por review humano.
    - Testes de seguranca obrigatorios para auth, pagamento, sync, AI tools e storage.
    - Nunca aceitar codigo gerado que mexe com segredo/permissao sem auditoria.

---

## 12. Cuidados de UX

- nao transformar o login em barreira pesada antes do usuario entender o produto;
- explicar por que a conta existe: backup, licenca e sincronizacao;
- deixar claro que chaves BYOK ficam no PC;
- oferecer "continuar configurando" depois de login;
- mostrar erros simples: senha errada, sem internet, email ja usado;
- nao esconder o app inteiro por qualquer falha pequena de rede.

---

## 13. Decisoes em aberto

- Auth proprio ou provider gerenciado?
- Login obrigatorio desde o primeiro uso ou depois de testar?
- Conta gratuita vai permitir quantos minutos?
- BYOK sera sempre gratuito ou parte de um plano?
- Sincronizar chaves BYOK ou manter sempre local?
- Permitir quantos dispositivos por conta?
- Como tratar reembolso/cancelamento/plano vencido?

---

## 14. Primeiro corte recomendado

Criar primeiro uma autenticacao pequena e reversivel:

- tela de login/cadastro;
- auth service local;
- storage seguro;
- entitlements mockados;
- status da conta nas Configuracoes;
- app ainda funcional com BYOK.

Depois disso, conectar backend real e pagamento sem precisar refazer a UI.
