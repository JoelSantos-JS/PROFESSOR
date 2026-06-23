# Plano — Ícone do app + Splash screen (Deep Soak)

> **Origem:** `assets/Joel/Icone.html` e `assets/Joel/Splash.html` são **mockups/spec** (não assets prontos).
> Descrevem a arte mas referenciam arquivos que **não existem**: `favicon.svg`, `icon/soaken-{16..512}.png`.
> Este plano transforma a spec em assets reais + os liga ao app (taskbar, bandeja, instalador) e cria a
> janela de splash animada na abertura. Substitui/expande o "Incremento 1" do `PLANO_DISTRIBUICAO.md`.
>
> Padrão de sempre: **núcleo puro testável → serviço/IPC → UI → testes**. Arte/build não têm teste unitário,
> mas têm smoke (geração de PNGs + `electron-builder --dir`); a lógica (lifecycle do splash, status cycling)
> é testável e **será coberta**.

## Spec extraída dos mockups
**Ícone** — squircle (raio 22,3%) no teal Deep Soak, gradiente **#1F8A8A → #16706F**, luz superior +
sombra interna sutil; dentro, uma **gota d'água** (branco levemente esverdeado) guardando um **"S" serifado**
(Newsreader, a fonte dos títulos) em **#16706F**; ondulações suaves na base. Tamanhos: 16/32/48/64/128/180/192/256/512.

**Splash** — janela frameless arredondada **320×400**, fundo radial+linear teal (#2A9D9B→#1F8A8A→#16706F→#0F5957),
ícone com *bob* (flutua), **3 anéis de ripple** concêntricos, **2 ondas** animadas na base, nome "Soaken"
(Newsreader, gradiente branco), tagline "Mergulhe no idioma", **barra de loading** + **status cíclico**
("Iniciando… / Carregando seus idiomas… / …"), rótulo de versão. Respeita `prefers-reduced-motion`.

---

## Decisões técnicas (já recomendadas — sem bloqueio)
1. **"S" do ícone → outline path** (não `<text>`), pra rasterização não depender da Newsreader instalada na máquina de build. (Gero o path da glifa uma vez.)
2. **Rasterização:** devDep **`sharp`** + `scripts/gen-icons.mjs` lê `favicon.svg` → emite todos os PNGs + `resources/icon.ico` (multi-size) via `sharp` + `png-to-ico`. Script idempotente, rodável com `npm run icons`.
3. **Splash = janela Electron** (não tela web dentro do app), porque precisa aparecer **antes** das janelas principais e do React montar — porta o HTML/CSS pra `Splash.tsx`.
4. **Fechar o splash:** quando a 1ª janela real disparar `ready-to-show`, com **tempo mínimo ~1,2s** pra não dar "flash".

---

## Fase 1 — Asset mestre do ícone
- Criar `tutor-pc/public/favicon.svg` (vetor mestre: squircle+gradiente+gota+S-em-path+ondas).
- `scripts/gen-icons.mjs`: gera `tutor-pc/public/icon/soaken-{16,32,48,64,128,180,192,256,512}.png` (favicon/PWA/splash/dev) **e** `tutor-pc/resources/icon.ico` + `resources/icon.png` (512) p/ o builder. Script `"icons": "node scripts/gen-icons.mjs"`.
- `index.html`: trocar/garantir `<link rel="icon" href="/favicon.svg">` + apple-touch.
**Verificação:** `npm run icons` cria os arquivos; abrir `Icone.html` apontando aos PNGs reais bate com a spec.

## Fase 2 — Ícone no runtime e no instalador
- `electron-builder.yml`: `win.icon: resources/icon.ico`, `nsis.installerIcon`/`uninstallerIcon: resources/icon.ico`, `shortcutName: Soaken`. (buildResources já é `resources`.)
- `windowConfigs`/`windowManager`: passar `icon` (path do .ico/.png) no `BrowserWindow` das janelas com taskbar (dashboard, dock) → ícone certo na barra de tarefas.
- **Bandeja:** `windowManager.trayIcon()` passa a carregar `resources/icon.png` (16/32) via `nativeImage.createFromPath`, com **fallback** ao quadrado teal gerado (mantém o atual se o arquivo faltar).
**Verificação:** `npm run pack` → `.exe`/atalho com o ícone Soaken; bandeja mostra a gota.

## Fase 3 — Janela de Splash
- `windowConfigs`: novo `splash` — `320×400, frame:false, transparent:true, resizable:false, center:true, alwaysOnTop:true, skipTaskbar:true, show:false, backgroundColor:'#00000000'`.
- `src/windows/Splash.tsx`: porta o HTML (ondas SVG, anéis, bob, barra, status cíclico) usando `icon/soaken-512.png`; respeita `prefers-reduced-motion`; **núcleo puro** `src/lib/splashStatus.ts` → `nextStatus(steps, i)` (rotação dos textos), testável.
- `App.tsx` (router): `case 'splash' → <Splash/>`. `WindowName` ganha `'splash'`.
- `main.ts`: criar **splash primeiro** no `whenReady`; ao 1º `ready-to-show` da janela real (dashboard/auth/dock), fechar o splash respeitando `MIN_SPLASH_MS`. Helper puro `electron/lib/splashLifecycle.ts` → `shouldCloseSplash(shownAt, now, minMs)`, testável.
**Verificação:** abrir o app → splash anima ~1–2s e some quando a UI sobe.

## Fase 4 — Testes & higiene
- `splashStatus.test.ts` (rotação cicla e faz wrap; lista vazia/1 item).
- `splashLifecycle.test.ts` (antes do mínimo → não fecha; depois → fecha).
- `Splash.test.tsx` (jsdom): renderiza nome/tagline; status muda com timers fake; com `prefers-reduced-motion` não agenda animação.
- `windowConfigs.test` + `windowManager.test`: `splash` existe e fecha quando a janela real fica pronta.
- Smoke: `npm run icons` não quebra; `npm run pack` gera unpacked com ícone (manual).

---

## Ordem & progresso
1. **Fase 1 — Asset mestre (SVG→PNG/ICO)** — `[ ]`
2. **Fase 2 — Ícone runtime + instalador + bandeja** — `[ ]`
3. **Fase 3 — Splash window** — `[ ]`
4. **Fase 4 — Testes & higiene** — `[ ]`

> Depois disto, o `PLANO_DISTRIBUICAO.md` segue com Inc. 2 (abrir-ao-iniciar), Inc. 3 (auto-update) e Inc. 4 (pipeline de release).
