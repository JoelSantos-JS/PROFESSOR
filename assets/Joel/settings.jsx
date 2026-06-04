/* Settings — BYOK providers + active provider + shortcuts. → window.Settings */

const setCSS = `
.settings { padding:26px 30px 36px; max-width:640px; margin:0 auto; }
.set-sec { margin-bottom:30px; }
.set-sec > h3 { font-family:var(--font-display); font-size:19px; font-weight:600; margin:0 0 3px; }
.set-sec > .desc { color:var(--muted); font-size:13.5px; margin-bottom:14px; }

.prov { display:flex; align-items:center; gap:13px; padding:14px 16px; border:1px solid var(--border); border-radius:var(--r-md); background:var(--raised); margin-bottom:10px; }
.prov .pk { width:38px;height:38px;border-radius:11px;display:grid;place-items:center; }
.prov .pk.on { background:var(--brand-soft); color:var(--brand-ink); }
.prov .pk.off { background:var(--surface-2); color:var(--muted); }
.prov .nm { font-weight:600; font-size:15px; }
.prov .lk { color:var(--support); font-size:12.5px; text-decoration:none; }
.prov .lk:hover { text-decoration:underline; }
.prov .right { margin-left:auto; display:flex; align-items:center; gap:8px; }
.prov .tag-ok { font-size:11px; font-weight:700; color:var(--good); background:#e3f0e8; border-radius:999px; padding:3px 10px; }

.key-input { display:flex; gap:8px; margin-top:10px; }
.key-input input { flex:1; border:1px solid var(--border-strong); border-radius:10px; padding:9px 12px; font-family:var(--font-mono); font-size:13px; background:var(--surface); color:var(--ink); }
.key-input input:focus { outline:none; border-color:var(--brand); }

.active-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.sel { border:1px solid var(--border-strong); border-radius:var(--r-md); padding:13px 14px; background:var(--raised); }
.sel label { font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); }
.sel select { width:100%; margin-top:7px; border:none; background:transparent; font-family:var(--font-ui); font-size:15px; font-weight:600; color:var(--ink); outline:none; }

.kbd-table { border:1px solid var(--border); border-radius:var(--r-md); overflow:hidden; }
.kbd-row { display:flex; align-items:center; gap:12px; padding:11px 15px; border-bottom:1px solid var(--border); }
.kbd-row:last-child { border-bottom:none; }
.kbd-row:nth-child(even) { background:var(--surface-2); }
.kbd-row .lbl { font-size:14px; }
.kbd-row .keys { margin-left:auto; display:flex; gap:4px; }
.kbd { font-family:var(--font-mono); font-size:11.5px; font-weight:600; background:var(--surface); border:1px solid var(--border-strong); border-bottom-width:2px; border-radius:6px; padding:3px 8px; color:var(--ink-2); }
`;

function Settings() {
  const I = window.Icon;
  const D = window.DATA;
  const [editing, setEditing] = React.useState(null);
  const [show, setShow] = React.useState(false);
  return (
    <div className="settings">
      <style>{setCSS}</style>

      <div className="set-sec">
        <h3>Provedores de IA</h3>
        <div className="desc">Sua chave, seus tokens. As chaves são criptografadas no disco (Windows DPAPI) e nunca expostas.</div>
        {D.providers.map((p) => (
          <div key={p.id}>
            <div className="prov">
              <span className={"pk " + (p.configured?"on":"off")}><I.key size={18} /></span>
              <div>
                <div className="nm">{p.name}</div>
                <a className="lk" href="#" onClick={(e)=>e.preventDefault()}>obter chave · {p.hint}</a>
              </div>
              <div className="right">
                {p.transcribes && <span className="chip" style={{fontSize:11, padding:"3px 9px"}}><I.mic size={12}/> transcreve</span>}
                {p.configured && <span className="tag-ok">configurado ✓</span>}
                {p.configured ? (
                  <button className="btn btn-ghost btn-sm" onClick={()=>setEditing(editing===p.id?null:p.id)}>Editar</button>
                ) : (
                  <button className="btn btn-soft btn-sm" onClick={()=>setEditing(editing===p.id?null:p.id)}><I.plus size={13}/> Adicionar</button>
                )}
                {p.configured && <button className="tb-btn" style={{color:"var(--muted)"}}><I.trash size={15}/></button>}
              </div>
            </div>
            {editing === p.id && (
              <div className="key-input fade-up" style={{ marginBottom:10 }}>
                <input type={show?"text":"password"} placeholder={"sk-…  (chave de " + p.name + ")"} defaultValue={p.configured?"sk-xxxxxxxxxxxxxxxxxxxx":""} />
                <button className="btn btn-ghost btn-icon" onClick={()=>setShow(!show)}><I.eye size={16}/></button>
                <button className="btn btn-primary btn-sm" onClick={()=>setEditing(null)}><I.check size={14}/> Salvar</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="set-sec">
        <h3>Provider ativo</h3>
        <div className="desc">Escolha qual IA faz a análise e qual faz a transcrição.</div>
        <div className="active-grid">
          <div className="sel">
            <label>Tutor AI (análise)</label>
            <select defaultValue="openai"><option value="openai">OpenAI · GPT-4o</option><option value="gemini">Google Gemini</option></select>
          </div>
          <div className="sel">
            <label>Transcrição</label>
            <select defaultValue="openai"><option value="openai">OpenAI · Whisper</option><option value="groq">Groq · Whisper</option><option value="gemini">Gemini</option></select>
          </div>
        </div>
      </div>

      <div className="set-sec">
        <h3>Atalhos globais</h3>
        <div className="desc">Funcionam mesmo com o app em segundo plano.</div>
        <div className="kbd-table">
          {D.shortcuts.map((s,i)=>(
            <div className="kbd-row" key={i}>
              <span className="lbl">{s.label}</span>
              <div className="keys">{s.keys.map((k,j)=><span className="kbd" key={j}>{k}</span>)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="set-sec" style={{ marginBottom:0 }}>
        <h3>Sobre</h3>
        <div className="desc" style={{ marginBottom:0 }}>PROFESSOR · versão 2.0 — Calm Study redesign</div>
      </div>
    </div>
  );
}
window.Settings = Settings;
