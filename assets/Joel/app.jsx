/* App — window manager, desktop, floating bar, tweaks. */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "clay",
  "brand": "#C2683F",
  "serifHeadings": true,
  "showScene": true,
  "barMode": "escura"
}/*EDITMODE-END*/;

const WINDOWS = {
  dashboard: { title: "Início", sub: "PROFESSOR", tint: "var(--brand)", w: 860, h: 600, x: 150, y: 70 },
  board:     { title: "Tutor Board", sub: "ensino", tint: "#3E7BB6", w: 680, h: 620, x: 360, y: 50 },
  review:    { title: "Revisão", sub: "flashcards", tint: "#8B6FD4", w: 620, h: 560, x: 420, y: 90 },
};

function App() {
  const [t, setTweak] = window.useTweaks(TWEAK_DEFAULTS);
  const I = window.Icon;

  const [open, setOpen] = React.useState({ dashboard: true, board: true, review: false });
  const [focus, setFocus] = React.useState("board");
  const [mainSection, setMainSection] = React.useState("home"); // home | settings
  const [listening, setListening] = React.useState(true);
  const [autoTrain, setAutoTrain] = React.useState(false);
  const [reviewLang, setReviewLang] = React.useState("ko");

  // apply tweaks to <html>
  React.useEffect(() => {
    const r = document.documentElement;
    r.setAttribute("data-theme", t.theme);
    r.style.setProperty("--brand", t.brand);
    r.style.setProperty("--font-display", t.serifHeadings ? '"Newsreader", Georgia, serif' : '"Hanken Grotesk", sans-serif');
  }, [t.theme, t.brand, t.serifHeadings]);

  const toggle = (id) => {
    setOpen((o) => ({ ...o, [id]: !o[id] }));
    setFocus(id);
  };
  const close = (id) => setOpen((o) => ({ ...o, [id]: false }));
  const openReview = (lang) => { setReviewLang(lang); setOpen((o) => ({ ...o, review: true })); setFocus("review"); };

  // Settings now lives INSIDE the main (Início) window — no separate window.
  const openSettings = () => { setOpen((o) => ({ ...o, dashboard: true })); setFocus("dashboard"); setMainSection("settings"); };
  const goHome = () => { setOpen((o) => ({ ...o, dashboard: true })); setFocus("dashboard"); setMainSection("home"); };
  const nav = (id) => {
    if (id === "settings") return openSettings();
    if (id === "dashboard") return goHome();
    setOpen((o) => ({ ...o, [id]: true })); setFocus(id);
  };
  // Dock: dashboard button = toggle main window (or jump home if showing settings)
  const onDockItem = (id) => {
    if (id === "dashboard") {
      if (open.dashboard && mainSection === "home") setOpen((o) => ({ ...o, dashboard: false }));
      else goHome();
      return;
    }
    toggle(id);
  };

  const content = {
    dashboard: <window.Dashboard onOpenReview={openReview} onNav={nav} section={mainSection} onSection={setMainSection} />,
    board: <window.TutorBoard />,
    review: <window.Review key={reviewLang} initialLang={reviewLang} />,
  };

  return (
    <div className="desktop">
      {t.showScene && <window.DesktopScene />}

      {Object.keys(WINDOWS).map((id) => open[id] && (
        <window.Window key={id} id={id}
          {...WINDOWS[id]}
          title={id==="dashboard" && mainSection==="settings" ? "Configurações" : WINDOWS[id].title}
          sub={id==="dashboard" && mainSection==="settings" ? "BYOK" : WINDOWS[id].sub}
          icon={id==="dashboard"?(mainSection==="settings"?<I.settings size={13}/>:<I.home size={13}/>):id==="board"?<I.book size={13}/>:<I.brain size={13}/>}
          focused={focus===id}
          onFocus={() => setFocus(id)}
          onClose={close}
        >
          {content[id]}
        </window.Window>
      ))}

      <window.FloatingBar
        listening={listening} setListening={setListening}
        autoTrain={autoTrain} setAutoTrain={setAutoTrain}
        onAnalyze={() => nav("board")}
        onOpenSettings={() => nav("settings")}
        barMode={t.barMode}
      />

      <window.Dock openMap={open} onToggle={onDockItem} onSettings={openSettings} settingsActive={open.dashboard && mainSection==="settings"} listening={listening} />

      <window.TweaksPanel title="Tweaks">
        <window.TweakSection label="Tema" />
        <window.TweakSelect label="Paleta" value={t.theme}
          options={["clay","sage","blue","sepia","lavender","ocean"]}
          onChange={(v) => setTweak("theme", v)} />
        <window.TweakColor label="Cor de marca" value={t.brand}
          options={["#C2683F","#4F8268","#3E7BB6","#7C5BC7","#2C8C8C","#A6703C"]}
          onChange={(v) => setTweak("brand", v)} />
        <window.TweakSection label="Barra flutuante" />
        <window.TweakRadio label="Estilo da barra" value={t.barMode}
          options={["escura","clara","marca"]}
          onChange={(v) => setTweak("barMode", v)} />
        <window.TweakSection label="Estilo" />
        <window.TweakToggle label="Serifa nos títulos" value={t.serifHeadings}
          onChange={(v) => setTweak("serifHeadings", v)} />
        <window.TweakToggle label="Mostrar vídeo de fundo" value={t.showScene}
          onChange={(v) => setTweak("showScene", v)} />
      </window.TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
