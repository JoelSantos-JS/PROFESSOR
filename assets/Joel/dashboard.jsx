/* Dashboard — home / progress. → window.Dashboard */

const dashCSS = `
.dash { display:flex; height:100%; }
.dash-side { width:62px; flex:0 0 62px; background:var(--surface-2); border-right:1px solid var(--border); display:flex; flex-direction:column; align-items:center; padding:14px 0; gap:6px; }
.dash-logo { width:38px;height:38px;border-radius:12px;background:var(--brand);color:#fff;display:grid;place-items:center;font-family:var(--font-display);font-weight:600;font-size:21px;margin-bottom:8px; }
.side-btn { width:42px;height:42px;border:none;border-radius:12px;background:transparent;color:var(--muted);display:grid;place-items:center;transition:background .14s,color .14s; }
.side-btn:hover { background:var(--border); color:var(--ink); }
.side-btn.on { background:var(--brand-soft); color:var(--brand-ink); }

.dash-main { flex:1; overflow:auto; padding:30px 34px 40px; }
.dash-greet { font-family:var(--font-display); font-size:30px; font-weight:600; letter-spacing:-.015em; margin:0 0 3px; }
.dash-sub { color:var(--muted); font-size:15px; margin-bottom:26px; }

.stat-row { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:30px; }
.stat { padding:18px 20px; }
.stat .v { font-family:var(--font-display); font-size:34px; font-weight:600; line-height:1; letter-spacing:-.02em; }
.stat .l { color:var(--muted); font-size:13px; font-weight:600; margin-top:7px; display:flex; align-items:center; gap:6px; }
.stat.streak .v { color:var(--brand); }

.sec-title { font-family:var(--font-display); font-size:19px; font-weight:600; margin:0 0 14px; letter-spacing:-.01em; }
.lang-chips { display:flex; flex-wrap:wrap; gap:12px; margin-bottom:14px; }
.lang-chip { display:flex; align-items:center; gap:12px; padding:13px 16px; border-radius:var(--r-md); border:1px solid var(--border); background:var(--raised); box-shadow:var(--sh-1); min-width:188px; transition:transform .14s, box-shadow .14s, border-color .14s; text-align:left; }
.lang-chip:hover:not(.disabled) { transform:translateY(-2px); box-shadow:var(--sh-2); border-color:var(--brand); }
.lang-chip.disabled { opacity:.5; cursor:default; }
.lang-chip .fl { font-size:26px; }
.lang-chip .nm { font-weight:600; font-size:15px; }
.lang-chip .mt { color:var(--muted); font-size:12.5px; }
.lang-chip .due { margin-left:auto; background:var(--brand); color:#fff; font-weight:700; font-size:12px; border-radius:999px; padding:3px 9px; }
.lang-chip.disabled .due { background:var(--border-strong); color:var(--muted); }

.dash-cols { display:grid; grid-template-columns:1fr 1fr; gap:22px; margin-top:30px; }
.mistake-row { display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid var(--border); }
.mistake-row:last-child { border-bottom:none; }
.mistake-row .w { font-family:var(--font-display); font-size:16px; font-weight:500; }
.mistake-row .fl { font-size:15px; }
.mistake-row .ct { margin-left:auto; color:var(--bad); font-weight:700; font-size:13px; background:#f4dcda; border-radius:999px; padding:2px 9px; }
.recent-row { display:flex; align-items:center; gap:12px; padding:11px 0; border-bottom:1px solid var(--border); }
.recent-row:last-child { border-bottom:none; }
.recent-row .ti { font-weight:600; font-size:14px; }
.recent-row .wn { color:var(--muted); font-size:12px; }
.recent-row .ln { margin-left:auto; color:var(--ink-2); font-size:12.5px; font-weight:600; }
`;

function Dashboard({ onOpenReview, onNav }) {
  const I = window.Icon;
  const D = window.DATA;
  const totalDue = D.languages.reduce((s, l) => s + l.due, 0);
  return (
    <div className="dash">
      <style>{dashCSS}</style>
      <div className="dash-side">
        <div className="dash-logo">P</div>
        <button className="side-btn on"><I.home size={20} /></button>
        <button className="side-btn" onClick={() => onNav("review")}><I.brain size={20} /></button>
        <button className="side-btn" onClick={() => onNav("board")}><I.book size={20} /></button>
        <div style={{ flex:1 }} />
        <button className="side-btn" onClick={() => onNav("settings")}><I.settings size={20} /></button>
      </div>
      <div className="dash-main scroll">
        <h1 className="dash-greet">Bem-vindo de volta 👋</h1>
        <div className="dash-sub">Pronto para praticar hoje? Você tem <b style={{color:"var(--brand-ink)"}}>{totalDue} frases</b> para revisar.</div>

        <div className="stat-row">
          <div className="stat card"><div className="v">{D.stats.sessions}</div><div className="l"><I.activity size={14}/> Sessões</div></div>
          <div className="stat card"><div className="v">{D.stats.phrases}</div><div className="l"><I.layers size={14}/> Frases</div></div>
          <div className="stat card streak"><div className="v">{D.stats.streak} 🔥</div><div className="l"><I.flame size={14}/> Sequência (dias)</div></div>
        </div>

        <h3 className="sec-title">Revisar por idioma</h3>
        <div className="lang-chips">
          {D.languages.map((l) => (
            <button key={l.lang} className={"lang-chip" + (l.due===0?" disabled":"")} onClick={() => l.due>0 && onOpenReview(l.lang)}>
              <span className="fl">{l.flag}</span>
              <div>
                <div className="nm">{l.name}</div>
                <div className="mt">{l.total} frases</div>
              </div>
              <span className="due">{l.due>0 ? l.due+" a revisar" : "em dia"}</span>
            </button>
          ))}
        </div>
        <button className="btn btn-primary" onClick={() => onOpenReview("ko")}>
          <I.brain size={16} /> Revisar tudo ({totalDue} pendentes)
        </button>

        <div className="dash-cols">
          <div className="card" style={{ padding:"18px 20px" }}>
            <h3 className="sec-title" style={{ display:"flex", alignItems:"center", gap:8 }}><I.activity size={17}/> Palavras que mais erro</h3>
            {D.mistakes.map((m,i)=>(
              <div className="mistake-row" key={i}>
                <span className="fl">{m.lang==="ko"?"🇰🇷":"🇬🇧"}</span>
                <span className="w">{m.word}</span>
                <span className="ct">{m.count}×</span>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding:"18px 20px" }}>
            <h3 className="sec-title">Sessões recentes</h3>
            {D.recent.map((r,i)=>(
              <div className="recent-row" key={i}>
                <span className="fl" style={{fontSize:18}}>{r.lang}</span>
                <div>
                  <div className="ti">{r.title}</div>
                  <div className="wn">{r.when}</div>
                </div>
                <span className="ln">{r.lines} frases</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
window.Dashboard = Dashboard;
