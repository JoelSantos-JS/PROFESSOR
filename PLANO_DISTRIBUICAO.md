# Plano — Distribuição ("virar produto"): instalador, ícone, auto-update, login-item

> **Gap:** hoje o app só roda em dev. Já existe `tutor-pc/electron-builder.yml` (NSIS x64) e scripts
> `pack`/`dist`, mas falta: **ícone próprio**, **auto-update**, **abrir ao iniciar**, e o branding está
> inconsistente (`productName: "Tutor PC"` no builder vs `"PROFESSOR"` no package.json). Isto é o que
> separa "projeto em dev" de "app que alguém instala e mantém atualizado".
>
> Padrão de sempre: **núcleo puro testável → serviço/IPC → UI → testes**. O que é infra (builder/CI)
> não tem teste unitário, mas tem **smoke test de build** (`electron-builder --dir`).

## Estado atual (verificado)
- `electron-builder.yml`: `appId: com.evolution.tutor-pc`, `productName: Tutor PC`, target **NSIS x64**,
  `oneClick:false` (instalador com escolha de pasta), atalhos desktop/menu. **Sem `icon`. Sem `publish`.**
- `package.json`: `productName: "PROFESSOR"`, `version: 0.1.0`, scripts `pack` (`--dir`) e `dist`.
- **Sem** `electron-updater` nas deps. **Sem** `app.setLoginItemSettings` no main. **Sem** `resources/` com arte.

---

## Decisões necessárias (bloqueiam parte do plano)
1. **Nome final** (rename em andamento: Lyssen/Audova/Lirien) → define `productName`/`appId`/ícone. *(Inc. 1)*
2. **Host das releases p/ auto-update**: **GitHub Releases** (grátis, integra com electron-updater) é o caminho
   recomendado. Precisa de um repo (público ou privado c/ token). *(Inc. 3)*
3. **Assinatura de código (Windows)**: sem certificado, o SmartScreen mostra aviso "editor desconhecido".
   Certificado OV ~US$200–400/ano (ou EV). **Opcional pro MVP** — documentar e seguir sem assinar primeiro. *(Inc. 4)*

---

## Incremento 1 — Branding & ícone
- Criar `tutor-pc/resources/` com `icon.ico` (Win, 256px multi-size), `icon.png` (512/1024) e `icon.icns` (mac futuro).
- `electron-builder.yml`: alinhar `productName`/`appId` ao nome final + `win.icon: resources/icon.ico` +
  `nsis.installerIcon`/`uninstallerIcon`/`shortcutName`.
- `BrowserWindow({ icon })` no `windowManager`/`windowConfigs` (barra/taskbar em runtime).
- Bump `version` (ex.: `0.1.0` → `0.2.0`).
**Verificação:** `npm run pack` gera `release/*-unpacked` com o ícone certo no .exe e atalhos.
**Depende de:** decisão #1 (nome) + arte do ícone.

## Incremento 2 — Abrir ao iniciar (login-item)
- **Núcleo puro** `electron/lib/loginItem.ts`: `loginItemArgs(enabled, { openAsHidden? })` →
  `{ openAtLogin, args }` (Windows aceita `--hidden` p/ subir minimizado na bandeja). Puro/testável.
- **Serviço/IPC**: aplicar via `app.setLoginItemSettings(loginItemArgs(...))`; persistir flag
  `launchAtLogin` em `settingsService` (novo campo, default `''`). IPC `app:set-login-item` + preload + type.
- **UI**: toggle "Abrir ao iniciar o computador" nas Configurações.
**Testes:** `loginItem.ts` (enabled→openAtLogin true + `--hidden` quando oculto; disabled→false/sem args);
`settingsService.test` (persiste `launchAtLogin`). UI (jsdom): toggle chama IPC com o valor certo.

## Incremento 3 — Auto-update (electron-updater + GitHub Releases)
- Add dep `electron-updater`; `electron-builder.yml` `publish: { provider: github, owner, repo }`.
- **Núcleo puro** `electron/lib/updateState.ts`: `isNewerVersion(current, candidate)` (compara semver, ignora
  build/pre-release simples) + `reduceUpdate(state, event)` → estado da UI
  (`idle|checking|available|downloading(pct)|downloaded|error`). Puro/testável — desacopla a lógica do
  `autoUpdater` real.
- **Serviço**: no `main` (prod só), `autoUpdater.checkForUpdatesAndNotify()` no `ready`; encaminhar eventos
  (`update-available`/`download-progress`/`update-downloaded`/`error`) → `reduceUpdate` → manda pro renderer.
  IPC `update:status` (push) + `update:install` (`quitAndInstall`).
- **UI**: toast/badge discreto "Atualização disponível → baixando… → Reiniciar p/ atualizar".
**Testes:** `isNewerVersion` (maior/menor/igual, pre-release, inválido→false); `reduceUpdate` (cada evento →
estado certo, progresso clamp 0–100, erro). UI (jsdom): mostra os estados e "Reiniciar" chama `update:install`.

## Incremento 4 — Pipeline de release & higiene
- Scripts: `release` = bump + `electron-builder --publish always`. Doc no README de como cortar uma release
  (tag → CI/local build → publica no GitHub → clientes auto-atualizam).
- **CI opcional** (`.github/workflows/release.yml`): em tag `v*`, build Win + `--publish always` (usa
  `GITHUB_TOKEN`).
- **Higiene**: confirmar que modelos pesados (Kokoro ONNX) continuam baixando em runtime p/ `userData`
  (não embutir no instalador); `asarUnpack` se algum binário precisar ficar fora do asar.
- **Assinatura/SmartScreen**: documentar o aviso sem cert + como assinar quando houver certificado.
**Verificação:** `npm run dist` gera o instalador NSIS final; instalar numa VM limpa e validar atalho, ícone,
abrir-ao-iniciar e o ciclo de update (publicar uma versão acima e ver o cliente atualizar).

---

## Fora deste plano (track separado, maior)
Os planos de **autenticação / sessão / segurança** (`PLANO_AUTENTICACAO`, `PLANO_SESSAO_USUARIO_TOKENS`,
`PLANO_SEGURANCA_PROJETO`) são uma frente à parte — necessária se o produto for ter contas/limites, mas
independente de "conseguir instalar e atualizar". Sugiro distribuição primeiro (destrava testers reais),
auth/segurança depois.

## Ordem & progresso
1. **Inc. 1 — Branding & ícone** (após decidir o nome) — `[ ]`
2. **Inc. 2 — Login-item** (não depende de nada) — `[ ]`  ← dá pra começar já
3. **Inc. 3 — Auto-update** (após decidir o repo de releases) — `[ ]`
4. **Inc. 4 — Pipeline & higiene** — `[ ]`
