/* Floating Bar — the central always-on-top window. → window.FloatingBar */

const barCSS = `
.fbar {
  --bar-bg1: rgba(34,44,38,.90);
  --bar-bg2: rgba(28,37,32,.93);
  --bar-bd: rgba(255,255,255,.12);
  --bar-ink: #EAF0EA;
  --bar-soft: rgba(234,240,234,.62);
  --bar-faint: rgba(234,240,234,.45);
  --bar-on: rgba(255,255,255,.12);
  --bar-surf: rgba(255,255,255,.05);
  --bar-surf2: rgba(255,255,255,.10);
  --bar-hair: rgba(255,255,255,.08);
  position: fixed; z-index: 70;
  width: 452px;
  border-radius: 20px;
  background: linear-gradient(180deg, var(--bar-bg1), var(--bar-bg2));
  backdrop-filter: blur(26px) saturate(160%);
  -webkit-backdrop-filter: blur(26px) saturate(160%);
  border: 1px solid var(--bar-bd);
  box-shadow: var(--sh-bar);
  color: var(--bar-ink);
  overflow: hidden;
  font-family: var(--font-ui);
}
/* per-palette tint of the dark bar */
[data-theme="clay"] .fbar     { --bar-bg1: rgba(48,34,26,.91); --bar-bg2: rgba(38,27,21,.94); }
[data-theme="blue"] .fbar     { --bar-bg1: rgba(26,36,48,.91); --bar-bg2: rgba(20,30,42,.94); }
[data-theme="sepia"] .fbar    { --bar-bg1: rgba(48,40,30,.91); --bar-bg2: rgba(38,31,22,.94); }
[data-theme="lavender"] .fbar { --bar-bg1: rgba(40,33,52,.91); --bar-bg2: rgba(30,24,42,.94); }
[data-theme="ocean"] .fbar    { --bar-bg1: rgba(22,42,42,.91); --bar-bg2: rgba(16,32,32,.94); }
/* bar style: light frost (dark text) */
.fbar[data-barmode="clara"] {
  --bar-bg1: rgba(255,255,255,.84);
  --bar-bg2: rgba(247,250,245,.90);
  --bar-bd: var(--border-strong);
  --bar-ink: var(--ink);
  --bar-soft: var(--ink-2);
  --bar-faint: var(--muted);
  --bar-on: var(--brand-soft);
  --bar-surf: var(--surface-2);
  --bar-surf2: var(--border);
  --bar-hair: var(--border);
}
/* bar style: brand-tinted deep */
.fbar[data-barmode="marca"] {
  --bar-bg1: color-mix(in srgb, var(--brand) 80%, #14140f);
  --bar-bg2: color-mix(in srgb, var(--brand) 92%, #0e0e0a);
  --bar-bd: rgba(255,255,255,.18);
}
.fbar-head {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 12px 0 14px;
  cursor: grab; user-select: none;
}
.fbar-head:active { cursor: grabbing; }
.fbar-tab {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 8px 13px; border-radius: 11px; border: none; background: transparent;
  color: var(--bar-soft); font-weight: 600; font-size: 13px;
}
.fbar-tab.on { background: var(--bar-on); color: var(--bar-ink); }
.fbar-tab:hover:not(.on) { color: var(--bar-ink); }
.fbar-status {
  margin-left: auto; display: inline-flex; align-items: center; gap: 7px;
  font-size: 11px; font-weight: 700; letter-spacing: .08em;
  padding: 5px 10px; border-radius: 999px;
}
.fbar-status.live { background: rgba(197,86,79,.20); color: #c5564f; }
.fbar[data-barmode]:not([data-barmode="clara"]) .fbar-status.live { color: #ffb3ad; }
.fbar-status.off  { background: var(--bar-hair); color: var(--bar-faint); }
.fbar-icon { width: 30px; height: 30px; border-radius: 9px; border: none; background: transparent; color: var(--bar-soft); display: grid; place-items: center; }
.fbar-icon:hover { background: var(--bar-surf2); color: var(--bar-ink); }

.fbar-body { position: relative; padding: 12px 14px; min-height: 168px; max-height: 280px; overflow: auto; }
.tline { padding: 9px 12px; border-radius: 12px; margin-bottom: 7px; background: var(--bar-surf); font-size: 14.5px; line-height: 1.4; }
.tline .meta { font-size: 11px; color: var(--bar-faint); font-weight: 600; margin-bottom: 3px; display:flex; gap:8px; align-items:center; }
.tline.live { background: color-mix(in srgb, var(--brand) 20%, transparent); border: 1px solid color-mix(in srgb, var(--brand) 42%, transparent); }
.tline .dots span { display:inline-block; width:5px;height:5px;border-radius:50%;background:var(--bar-soft);margin-right:3px;animation:livePulse 1s infinite; }
.tline .dots span:nth-child(2){animation-delay:.2s} .tline .dots span:nth-child(3){animation-delay:.4s}

.fbar-foot { padding: 10px 14px 13px; border-top: 1px solid var(--bar-hair); }
.meter { height: 6px; border-radius: 999px; background: var(--bar-surf2); position: relative; margin-bottom: 11px; overflow: hidden; }
.meter i { position:absolute; left:0; top:0; bottom:0; border-radius:999px; transition: width .12s linear; }
.meter .thr { position:absolute; top:-3px; bottom:-3px; width:2px; background:var(--bar-soft); border-radius:2px; }
.fbar-controls { display: flex; gap: 8px; }
.fb-btn { flex:1; display:inline-flex; align-items:center; justify-content:center; gap:7px; padding:11px; border-radius:13px; border:1px solid var(--bar-bd); background:var(--bar-surf); color:var(--bar-ink); font-weight:600; font-size:13px; transition: background .14s, border-color .14s; }
.fb-btn:hover { background: var(--bar-surf2); }
.fb-btn.rec { background: var(--bad); border-color: transparent; color:#fff; }
.fb-btn.rec:hover { filter: brightness(1.05); }
.fb-btn.on { background: rgba(201,138,43,.22); border-color: rgba(201,138,43,.5); color:#f4cf93; }
.fb-btn.analyze { background: var(--bar-surf2); }

/* auto-train overlay */
.fb-overlay { position:absolute; inset:0; background: linear-gradient(180deg, var(--bar-bg1), var(--bar-bg2)); backdrop-filter: blur(8px); padding: 16px; display:flex; flex-direction:column; gap:11px; }
.fb-ov-head { display:flex; align-items:center; gap:8px; font-size:11px; font-weight:800; letter-spacing:.12em; color:#f4cf93; }
.fb-ov-phrase { font-size:18px; line-height:1.4; font-weight:600; }
.fb-ov-roman { font-family: var(--font-mono); font-size:12.5px; color: var(--bar-soft); }
.fb-rec-btn { display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;border-radius:13px;border:none;background:var(--bad);color:#fff;font-weight:700;font-size:14px; }
.fb-ov-actions { display:flex; gap:8px; margin-top:auto; }
.count-ring { width:48px;height:48px;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:22px;border:3px solid var(--bar-bd);color:var(--bar-ink); }
`;

function AudioMeter({ active }) {
  const [lvl, setLvl] = React.useState(12);
  React.useEffect(() => {
    if (!active) { setLvl(6); return; }
    const id = setInterval(() => {
      setLvl(20 + Math.random() * Math.random() * 78);
    }, 130);
    return () => clearInterval(id);
  }, [active]);
  const past = lvl > 45;
  return (
    <div className="meter" title="Nível de áudio captado">
      <i style={{ width: lvl + "%", background: past ? "var(--good)" : "rgba(234,240,234,.4)" }} />
      <span className="thr" style={{ left: "45%" }} />
    </div>
  );
}

function FloatingBar({ listening, setListening, autoTrain, setAutoTrain, onAnalyze, onOpenSettings, barMode }) {
  const I = window.Icon;
  const D = window.DATA;
  const [tab, setTab] = React.useState("trans");
  const [pos, onDown] = window.useDrag({ x: window.innerWidth / 2 - 226, y: 24 });

  // auto-train mini state machine
  const [ov, setOv] = React.useState("idle"); // idle | count | rec | done
  const [count, setCount] = React.useState(3);
  React.useEffect(() => {
    if (!autoTrain) { setOv("idle"); return; }
    setOv("ready");
  }, [autoTrain]);
  React.useEffect(() => {
    if (ov !== "count") return;
    setCount(3);
    let c = 3;
    const id = setInterval(() => { c -= 1; if (c <= 0) { clearInterval(id); setOv("rec"); setTimeout(() => setOv("done"), 1900); } else setCount(c); }, 700);
    return () => clearInterval(id);
  }, [ov]);

  const showOverlay = autoTrain && tab === "trans" && ov !== "idle";

  return (
    <div className="fbar" data-barmode={barMode || "escura"} style={{ left: pos.x, top: pos.y }} onMouseDown={(e)=>e.stopPropagation()}>
      <style>{barCSS}</style>
      <div className="fbar-head" onMouseDown={onDown}>
        <button className={"fbar-tab" + (tab === "trans" ? " on" : "")} onClick={() => setTab("trans")}>
          <I.mic size={15} /> Transcrição
        </button>
        <button className={"fbar-tab" + (tab === "sess" ? " on" : "")} onClick={() => setTab("sess")}>
          <I.user size={15} /> Sessão <span style={{ opacity:.7 }}>({D.attempts.length})</span>
        </button>
        <span className={"fbar-status " + (listening ? "live" : "off")}>
          {listening ? <><span className="live-dot" /> AO VIVO</> : "OFF"}
        </span>
        <button className="fbar-icon" onClick={onOpenSettings}><I.settings size={16} /></button>
      </div>

      <div className="fbar-body scroll">
        {tab === "trans" && (
          <>
            {!listening && D.transcript.length === 0 && (
              <div style={{ textAlign:"center", color:"var(--bar-soft)", padding:"34px 10px", fontSize:14 }}>
                <div style={{marginBottom:8, opacity:.7}}><I.waveform size={26} /></div>
                Aperte <b style={{color:"var(--bar-ink)"}}>Escutar</b> e dê play no vídeo.
              </div>
            )}
            {(listening || D.transcript.length > 0) && D.transcript.map((l, i) => (
              <div key={l.id} className={"tline fade-up" + (l.live ? " live" : "")} style={{ animationDelay: i*40+"ms" }}>
                <div className="meta">
                  <span>{l.lang === "ko" ? "🇰🇷 Coreano" : "🇬🇧 Inglês"}</span>
                  {l.live ? <span className="dots"><span/><span/><span/> transcrevendo</span> : <span>{l.t}</span>}
                </div>
                {l.text}
              </div>
            ))}
          </>
        )}
        {tab === "sess" && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {D.attempts.map((a) => (
              <div key={a.n} className="tline" style={{ background:"var(--bar-surf)" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                  <b style={{ fontSize:12, color:"var(--bar-soft)" }}>Tentativa {a.n}</b>
                  <span className={"score " + (a.score>=80?"good":a.score>=50?"ok":"bad")} style={{ fontSize:12, padding:"2px 8px" }}>{a.score}%</span>
                  <button className="fbar-icon" style={{ marginLeft:"auto" }}><I.play size={14} /></button>
                </div>
                <div className="diff" style={{ fontSize:14 }}>
                  {a.diff.map((d,i)=><span key={i} className={d[1]}>{d[0]}</span>)}
                </div>
              </div>
            ))}
          </div>
        )}

        {showOverlay && (
          <div className="fb-overlay pop-in">
            <div className="fb-ov-head"><I.zap size={14} /> REPITA A FRASE</div>
            <div className="fb-ov-phrase">우리 다시 시작할 수 있을까?</div>
            <div className="fb-ov-roman">uri dasi sijakhal su isseulkka?</div>
            <window.AudioTrio which={["orig","tts"]} size="" />
            {ov === "ready" && (
              <button className="fb-rec-btn" onClick={() => setOv("count")}><I.mic size={16} /> Gravar</button>
            )}
            {ov === "count" && (
              <div style={{ display:"grid", placeItems:"center", padding:"4px" }}>
                <div className="count-ring">{count}</div>
              </div>
            )}
            {ov === "rec" && (
              <button className="fb-rec-btn" style={{ background:"rgba(197,86,79,.25)", color:"#c5564f" }}>
                <span className="live-dot" /> Gravando…
              </button>
            )}
            {ov === "done" && (
              <div className="fade-up" style={{ display:"flex", flexDirection:"column", gap:8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span className="score good">86%</span>
                  <window.AudioTrio which={["you"]} />
                </div>
                <div className="diff" style={{ fontSize:15 }}>
                  <span className="hit">우리</span> <span className="hit">다시</span> <span className="hit">시작할</span> <span className="hit">수</span> <span className="miss">있을까</span>
                </div>
              </div>
            )}
            <div className="fb-ov-actions">
              <button className="fb-btn" onClick={() => { setOv("idle"); setTimeout(()=>setOv("ready"),300); }}><I.skip size={15} /> Pular</button>
              <button className="fb-btn analyze" onClick={() => { setOv("idle"); setTimeout(()=>setOv("ready"),300); }}><I.arrowR size={15} /> Continuar</button>
            </div>
          </div>
        )}
      </div>

      <div className="fbar-foot">
        <AudioMeter active={listening} />
        <div className="fbar-controls">
          <button className={"fb-btn" + (listening ? " rec" : "")} onClick={() => setListening(!listening)}>
            {listening ? <><I.pause size={15} /> Parar</> : <><I.mic size={15} /> Escutar</>}
          </button>
          <button className={"fb-btn" + (autoTrain ? " on" : "")} onClick={() => setAutoTrain(!autoTrain)}>
            <I.zap size={15} /> Auto-treino
          </button>
          <button className="fb-btn analyze" onClick={onAnalyze} style={{ flex:"0 0 auto" }}>
            <I.sparkles size={15} /> Analisar
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { FloatingBar, AudioMeter });
