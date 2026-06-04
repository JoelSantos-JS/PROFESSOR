/* Window chrome, desktop scene, dock, audio trio. → window.* */

function useDrag(initial, ref) {
  const [pos, setPos] = React.useState(initial);
  const drag = React.useRef(null);
  const onDown = (e) => {
    if (e.target.closest(".tb-btn")) return;
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
    const move = (ev) => {
      if (!drag.current) return;
      setPos({
        x: Math.max(-40, drag.current.ox + ev.clientX - drag.current.sx),
        y: Math.max(0, drag.current.oy + ev.clientY - drag.current.sy),
      });
    };
    const up = () => { drag.current = null; window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };
  return [pos, onDown, setPos];
}

function Window({ id, title, sub, icon, tint, w, h, x, y, focused, onFocus, onClose, children, bodyClass }) {
  const [pos, onDown] = useDrag({ x, y });
  const I = window.Icon;
  return (
    <div
      className={"win fade-up" + (focused ? " focused" : "")}
      style={{ left: pos.x, top: pos.y, width: w, height: h }}
      onMouseDown={onFocus}
    >
      <div className="titlebar" onMouseDown={onDown}>
        <span className="tb-dot" style={{ background: tint }}>{icon}</span>
        <span className="tb-title">{title}{sub && <span className="tb-sub">· {sub}</span>}</span>
        <div className="tb-actions">
          <button className="tb-btn"><I.minus size={16} /></button>
          <button className="tb-btn close" onClick={(e) => { e.stopPropagation(); onClose(id); }}><I.x size={16} /></button>
        </div>
      </div>
      <div className={"win-body scroll " + (bodyClass || "")}>{children}</div>
    </div>
  );
}

function AudioTrio({ which = ["orig", "tts", "you"], size = "", onPlay, playing }) {
  const I = window.Icon;
  const map = {
    orig: { cls: "audio-orig", label: "Original" },
    tts: { cls: "audio-tts", label: "TTS" },
    you: { cls: "audio-you", label: "Você" },
  };
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {which.map((k) => (
        <button key={k} className={"audio-chip " + map[k].cls + " " + size}
          onClick={() => onPlay && onPlay(k)}>
          {playing === k ? <I.pause size={13} /> : <span className="dot" />}
          {map[k].label}
        </button>
      ))}
    </div>
  );
}

/* Desktop scene — a calm simulated "now playing" video */
function DesktopScene() {
  return (
    <div className="scene">
      <div className="scene-hills">
        <span style={{ left: "-10%", bottom: "8%", width: "55%", height: "44%", background: "rgba(40,70,75,.55)" }} />
        <span style={{ right: "-8%", bottom: "6%", width: "60%", height: "52%", background: "rgba(30,55,60,.6)" }} />
        <span style={{ left: "30%", bottom: "10%", width: "45%", height: "60%", background: "rgba(22,42,48,.7)" }} />
        <span style={{ left: "62%", top: "14%", width: "90px", height: "90px", borderRadius: "50%", background: "radial-gradient(circle at 38% 38%, #ffe6bd, #f4b15e)", boxShadow: "0 0 80px 30px rgba(255,200,140,.35)" }} />
      </div>
      <div className="scene-sub">우리 다시 시작할 수 있을까?</div>
      <div className="scene-player">
        <span className="t">38:12</span>
        <div className="bar"><i /></div>
        <span className="t">52:40</span>
        <span style={{ opacity: .85 }}>{React.createElement(window.Icon.volume, { size: 18 })}</span>
      </div>
    </div>
  );
}

function Dock({ openMap, onToggle, listening }) {
  const I = window.Icon;
  const items = [
    { id: "dashboard", icon: <I.home size={22} />, label: "Início" },
    { id: "board", icon: <I.book size={22} />, label: "Tutor Board" },
    { id: "review", icon: <I.brain size={22} />, label: "Revisão" },
  ];
  return (
    <div className="dock">
      <div className="dock-btn" style={{ cursor: "default" }}>
        <div style={{ width: 34, height: 34, borderRadius: 11, background: "var(--brand)", display: "grid", placeItems: "center", color: "#fff", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 20, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.18)" }}>P</div>
      </div>
      <div className="dock-sep" />
      {items.map((it) => (
        <button key={it.id} className={"dock-btn" + (openMap[it.id] ? " active" : "")} onClick={() => onToggle(it.id)}>
          <span className="tip">{it.label}</span>
          {it.icon}
        </button>
      ))}
      <div className="dock-sep" />
      <button className={"dock-btn" + (openMap.settings ? " active" : "")} onClick={() => onToggle("settings")}>
        <span className="tip">Configurações</span>
        <I.settings size={22} />
      </button>
    </div>
  );
}

Object.assign(window, { useDrag, Window, AudioTrio, DesktopScene, Dock });
