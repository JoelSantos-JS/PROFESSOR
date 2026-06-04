/* Review — SM-2 flashcards. → window.Review */

const reviewCSS = `
.review { padding: 22px 26px 32px; display:flex; flex-direction:column; height:100%; }
.rv-tabs { display:flex; gap:8px; margin-bottom:6px; }
.rv-tab { display:inline-flex; align-items:center; gap:8px; padding:8px 14px; border-radius:var(--r-full); border:1px solid var(--border); background:var(--surface); font-weight:600; font-size:13.5px; color:var(--ink-2); }
.rv-tab.on { background:var(--brand); color:#fff; border-color:transparent; }
.rv-tab.empty { opacity:.45; }
.rv-tab .n { background:rgba(0,0,0,.12); border-radius:999px; padding:1px 7px; font-size:11px; }
.rv-tab.on .n { background:rgba(255,255,255,.25); }

.rv-progress { display:flex; align-items:center; gap:10px; margin:14px 2px 16px; color:var(--muted); font-size:13px; font-weight:600; }
.rv-bar { flex:1; height:6px; border-radius:999px; background:var(--border); overflow:hidden; }
.rv-bar i { display:block; height:100%; background:var(--brand); border-radius:999px; transition:width .3s; }

.flash { flex:1; display:flex; align-items:center; justify-content:center; }
.flash-card { width:min(560px,100%); min-height:280px; padding:34px 36px; border-radius:var(--r-xl); background:var(--raised); border:1px solid var(--border); box-shadow:var(--sh-2); display:flex; flex-direction:column; }
.flash-front { font-family:var(--font-display); font-size:34px; line-height:1.35; letter-spacing:-.01em; text-align:center; }
.flash-roman { font-family:var(--font-mono); font-size:14px; color:var(--muted); text-align:center; margin-top:10px; }
.flash-divider { height:1px; background:var(--border); margin:22px 0; }
.flash-answer { text-align:center; }
.flash-pt { font-size:21px; color:var(--ink-2); font-family:var(--font-display); }
.flash-pt .tag { font-size:10px; font-weight:700; letter-spacing:.08em; color:#fff; background:var(--support); border-radius:5px; padding:2px 6px; vertical-align:middle; margin-right:8px; }

.variations { margin-top:18px; border-top:1px dashed var(--border-strong); padding-top:16px; text-align:left; }
.var-row { display:flex; align-items:center; gap:10px; padding:9px 0; }
.var-row .vt { font-family:var(--font-display); font-size:16px; }
.var-row .vp { color:var(--muted); font-size:13px; }

.rv-rate { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-top:18px; }
.rate-btn { padding:13px; border-radius:var(--r-md); border:1.5px solid; background:var(--surface); font-weight:700; font-size:14px; display:flex; flex-direction:column; align-items:center; gap:3px; transition:transform .12s, background .14s; }
.rate-btn:active { transform:translateY(1px); }
.rate-btn .sub { font-size:11px; font-weight:500; opacity:.7; }
.rate-bad { color:var(--bad); border-color:#e8c4c1; } .rate-bad:hover{ background:#f9eceb; }
.rate-mid { color:#9a6a1e; border-color:#e6d3ad; } .rate-mid:hover{ background:#f8f1e2; }
.rate-good{ color:var(--good); border-color:#bfe0cc; } .rate-good:hover{ background:#eaf4ee; }

.rv-empty { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--muted); gap:10px; }
.rv-empty .big { font-size:46px; }
`;

function Review({ initialLang }) {
  const I = window.Icon;
  const D = window.DATA;
  const [lang, setLang] = React.useState(initialLang || "ko");
  const deck = D.decks.find((d) => d.lang === lang) || D.decks[0];
  const [idx, setIdx] = React.useState(0);
  const [revealed, setRevealed] = React.useState(false);
  const [showVar, setShowVar] = React.useState(false);
  const [done, setDone] = React.useState(0);

  React.useEffect(() => { setIdx(0); setRevealed(false); setShowVar(false); setDone(0); }, [lang]);

  const card = deck.cards[idx];
  const next = () => {
    setRevealed(false); setShowVar(false); setDone((d)=>d+1);
    setIdx((i) => (i + 1));
  };
  const finished = !card || idx >= deck.cards.length;

  return (
    <div className="review">
      <style>{reviewCSS}</style>
      <div className="rv-tabs">
        {D.decks.map((d) => (
          <button key={d.lang} className={"rv-tab" + (d.lang===lang?" on":"") + (d.due===0?" empty":"")}
            onClick={() => d.cards.length && setLang(d.lang)}>
            <span style={{fontSize:16}}>{d.flag}</span> {d.name}
            {d.due>0 && <span className="n">{d.due}</span>}
          </button>
        ))}
      </div>

      {!finished && (
        <>
          <div className="rv-progress">
            <span>{idx+1} / {deck.cards.length}</span>
            <div className="rv-bar"><i style={{ width: ((idx)/deck.cards.length*100)+"%" }} /></div>
            <span>{done} revisadas</span>
          </div>

          <div className="flash">
            <div className="flash-card fade-up" key={idx}>
              <div className="flash-front">{card.front}
                <button className="audio-chip audio-tts" style={{ marginLeft:10, verticalAlign:"middle" }}><I.volume size={14}/> TTS</button>
              </div>
              {card.roman && <div className="flash-roman">{card.roman}</div>}

              {!revealed && (
                <button className="btn btn-primary" style={{ alignSelf:"center", marginTop:26 }} onClick={()=>setRevealed(true)}>
                  Mostrar resposta
                </button>
              )}

              {revealed && (
                <div className="fade-up">
                  <div className="flash-divider" />
                  <div className="flash-answer">
                    <div className="flash-pt"><span className="tag">PT</span>{card.pt}</div>
                  </div>
                  {card.variations.length > 0 && (
                    <>
                      {!showVar ? (
                        <button className="btn btn-ghost btn-sm" style={{ marginTop:16 }} onClick={()=>setShowVar(true)}>
                          <I.sparkles size={14}/> Ver variações
                        </button>
                      ) : (
                        <div className="variations fade-up">
                          <span className="label-eyebrow">Outras formas de dizer</span>
                          {card.variations.map((v,i)=>(
                            <div className="var-row" key={i}>
                              <button className="audio-chip audio-tts"><I.volume size={13}/></button>
                              <div><div className="vt">{v.txt}</div><div className="vp">{v.pt}</div></div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  <div className="rv-rate">
                    <button className="rate-btn rate-bad" onClick={next}>Errei<span className="sub">de novo</span></button>
                    <button className="rate-btn rate-mid" onClick={next}>Difícil<span className="sub">em 1 dia</span></button>
                    <button className="rate-btn rate-good" onClick={next}>Fácil<span className="sub">em 4 dias</span></button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {finished && (
        <div className="rv-empty fade-up">
          <div className="big">🎉</div>
          <div style={{ fontFamily:"var(--font-display)", fontSize:22, color:"var(--ink)" }}>Revisão concluída!</div>
          <div>Você revisou {done} frases de {deck.name}. Volte amanhã para manter a sequência.</div>
        </div>
      )}
    </div>
  );
}
window.Review = Review;
