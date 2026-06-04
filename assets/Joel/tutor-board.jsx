/* Tutor Board — teaching cards. → window.TutorBoard */

const boardCSS = `
.board { padding: 22px 24px 40px; max-width: 720px; margin: 0 auto; }
.board-hd { display:flex; align-items:baseline; gap:10px; margin-bottom:18px; }
.board-hd h2 { font-family: var(--font-display); font-weight:600; font-size:24px; margin:0; color:var(--ink); letter-spacing:-.01em; }
.board-hd span { color: var(--muted); font-size:13.5px; }

.entry { padding: 20px 22px; margin-bottom: 16px; position: relative; }
.entry-top { display:flex; align-items:flex-start; gap:14px; }
.entry-num { font-family: var(--font-display); font-size:15px; font-weight:600; color:var(--muted); padding-top:2px; min-width:24px; }
.entry-main { flex:1; min-width:0; }
.entry-actions { display:flex; gap:6px; flex-wrap:wrap; }

.roman { font-family: var(--font-mono); font-size:13px; color: var(--ink-2); margin-bottom:5px; letter-spacing:.01em; }
.roman .label { font-size:10px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); margin-right:8px; }
.sentence { font-family: var(--font-display); font-size:25px; line-height:1.42; color:var(--ink); letter-spacing:-.005em; }
.natural { margin-top:8px; font-size:13.5px; color:#9a6a1e; background:var(--tts-soft); border-radius:9px; padding:7px 11px; display:inline-flex; align-items:center; gap:8px; font-weight:500; }
.translation { margin-top:10px; font-size:15px; color:var(--ink-2); display:flex; gap:8px; align-items:baseline; }
.translation .tag { font-size:10px; font-weight:700; letter-spacing:.08em; color:#fff; background:var(--ink-2); border-radius:5px; padding:2px 6px; }

.vocab-wrap { margin-top:16px; border-top:1px dashed var(--border-strong); padding-top:14px; }
.vocab-pills { display:flex; flex-wrap:wrap; gap:8px; margin-top:9px; }
.vocab-pill { display:inline-flex; align-items:center; gap:8px; padding:7px 12px; border-radius:var(--r-full); background:var(--surface-2); border:1px solid var(--border); font-size:13.5px; cursor:pointer; transition:border-color .14s, background .14s; }
.vocab-pill:hover { border-color:var(--brand); background:var(--brand-soft); }
.vocab-pill b { font-weight:600; color:var(--ink); }
.vocab-pill span { color:var(--muted); }

.tip { margin-top:14px; display:flex; gap:11px; background:var(--brand-soft); border-radius:var(--r-md); padding:12px 14px; font-size:13.5px; line-height:1.5; color:var(--brand-ink); }
.tip svg { flex:0 0 auto; margin-top:1px; }

.practice-result { margin-top:14px; border-radius:var(--r-md); border:1px solid var(--border); padding:13px 15px; background:var(--surface-2); }
.practice-result .pr-top { display:flex; align-items:center; gap:10px; margin-bottom:8px; }

/* word dictionary popover */
.wordpop { position:fixed; z-index:120; width:280px; background:var(--raised); border:1px solid var(--border); border-radius:var(--r-md); box-shadow:var(--sh-3); padding:15px; }
.wordpop h4 { margin:0 0 2px; font-family:var(--font-display); font-size:22px; font-weight:600; }
.wordpop .wp-roman { font-family:var(--font-mono); font-size:12px; color:var(--muted); margin-bottom:10px; }
.wordpop .wp-mean { font-size:13.5px; color:var(--ink-2); margin:6px 0; padding-left:14px; position:relative; }
.wordpop .wp-mean::before { content:""; position:absolute; left:2px; top:8px; width:4px; height:4px; border-radius:50%; background:var(--brand); }
.wordpop .wp-note { font-size:12.5px; color:var(--muted); background:var(--surface-2); border-radius:8px; padding:8px 10px; margin-top:8px; }
`;

const WORD_DICT = {
  "있을까?": { roman: "isseulkka", means: ["será que existe / será que dá", "(aqui) será que conseguimos"], note: "Forma reflexiva e gentil de perguntar possibilidade." },
  "시작할": { roman: "sijakhal", means: ["começar (forma que precede 수 있다)"], note: "Raiz 시작하다 = começar." },
  "다시": { roman: "dasi", means: ["de novo", "outra vez"] },
  "잘못이": { roman: "jalmoshi", means: ["culpa / erro (+ partícula 이)"], note: "잘못 = falha; 이 marca o sujeito." },
  "coming": { roman: null, means: ["chegando, vindo", "(see ... coming) prever algo"], note: "Em “see it coming”, ideia de antecipar." },
  "didn't": { roman: null, means: ["não (passado de do)"], note: "Na fala vira “dint”, quase sem o “t”." },
};

function WordPopover({ data, rect, onClose }) {
  const I = window.Icon;
  if (!data || !rect) return null;
  const top = Math.min(rect.bottom + 8, window.innerHeight - 220);
  const left = Math.min(Math.max(12, rect.left - 40), window.innerWidth - 296);
  return (
    <>
      <div style={{ position:"fixed", inset:0, zIndex:115 }} onClick={onClose} />
      <div className="wordpop pop-in" style={{ top, left }}>
        <h4>{data.word}</h4>
        {data.info.roman && <div className="wp-roman">{data.info.roman}</div>}
        <window.AudioTrio which={["orig","tts"]} size="" />
        <div style={{ marginTop:10 }}>
          {data.info.means.map((m,i)=><div key={i} className="wp-mean">{m}</div>)}
        </div>
        {data.info.note && <div className="wp-note">{data.info.note}</div>}
        <button className="btn btn-soft btn-sm" style={{ marginTop:11, width:"100%", justifyContent:"center" }}>
          <I.mic size={14} /> Praticar palavra
        </button>
      </div>
    </>
  );
}

function Sentence({ words, activeIdx, onWord }) {
  return (
    <div className="sentence">
      {words.map((w, i) => (
        <span key={i}
          className={"word" + (activeIdx === i ? " active" : "")}
          onClick={(e) => onWord(w, e.currentTarget.getBoundingClientRect())}
        >{w}{i < words.length - 1 ? " " : ""}</span>
      ))}
    </div>
  );
}

function EntryCard({ e, idx }) {
  const I = window.Icon;
  const [playing, setPlaying] = React.useState(null); // orig|tts|null
  const [active, setActive] = React.useState(-1);
  const [pop, setPop] = React.useState(null);
  const [practice, setPractice] = React.useState(e.practice);
  const [recState, setRecState] = React.useState("idle");
  const timer = React.useRef(null);

  const play = (k) => {
    if (k === "you") { return; }
    if (playing) { clearInterval(timer.current); setPlaying(null); setActive(-1); return; }
    setPlaying(k); setActive(0);
    let i = 0;
    timer.current = setInterval(() => {
      i += 1;
      if (i >= e.words.length) { clearInterval(timer.current); setPlaying(null); setActive(-1); }
      else setActive(i);
    }, 360);
  };

  const doPractice = () => {
    setRecState("count");
    setTimeout(() => setRecState("rec"), 1600);
    setTimeout(() => { setRecState("idle"); setPractice({ score: 78, diff: e.words.map((w,i)=>[w, i===e.words.length-1?"miss":"hit"]) }); }, 3600);
  };

  const onWord = (w, rect) => {
    const info = WORD_DICT[w] || { roman: null, means: ["(tradução da palavra)"], note: null };
    setPop({ word: w, info, rect });
  };

  return (
    <div className="entry card fade-up" style={{ animationDelay: idx*60+"ms" }}>
      <div className="entry-top">
        <div className="entry-num">#{e.id}</div>
        <div className="entry-main">
          {e.roman && <div className="roman"><span className="label">{e.romanLabel}</span>{e.roman}</div>}
          <Sentence words={e.words} activeIdx={active} onWord={onWord} />
          {e.natural && <div className="natural"><I.activity size={14} /> {e.natural}</div>}
          {e.translation && <div className="translation"><span className="tag">EN</span>{e.translation}</div>}
        </div>
        <div className="entry-actions">
          <button className={"audio-chip audio-orig"} onClick={() => play("orig")}>
            {playing==="orig" ? <I.pause size={13}/> : <span className="dot"/>}Original
          </button>
          <button className={"audio-chip audio-tts"} onClick={() => play("tts")}>
            {playing==="tts" ? <I.pause size={13}/> : <span className="dot"/>}TTS
          </button>
          <button className="btn btn-soft btn-sm" onClick={doPractice} disabled={recState!=="idle"}>
            <I.mic size={13} /> {recState==="idle" ? "Praticar" : recState==="count" ? "3·2·1…" : "Gravando…"}
          </button>
        </div>
      </div>

      <div className="vocab-wrap">
        <span className="label-eyebrow" style={{ display:"inline-flex", gap:7, alignItems:"center" }}><I.book size={13} /> Vocabulário</span>
        <div className="vocab-pills">
          {e.vocab.map((v, i) => (
            <span key={i} className="vocab-pill" onClick={(ev)=>onWord(v.w, ev.currentTarget.getBoundingClientRect())}>
              <b>{v.w}</b><span>{v.pt}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="tip"><I.sparkles size={16} /> <div>{e.tip}</div></div>

      {practice && (
        <div className="practice-result fade-up">
          <div className="pr-top">
            <span className="label-eyebrow">Sua prática</span>
            <span className={"score " + (practice.score>=80?"good":practice.score>=50?"ok":"bad")}>{practice.score}%</span>
            <div style={{ marginLeft:"auto" }}><window.AudioTrio which={["you","orig","tts"]} /></div>
          </div>
          <div className="diff" style={{ fontFamily:"var(--font-display)", fontSize:18 }}>
            {practice.diff.map((d,i)=><span key={i} className={d[1]}>{d[0]}</span>)}
          </div>
        </div>
      )}

      {pop && <WordPopover data={pop} rect={pop.rect} onClose={()=>setPop(null)} />}
    </div>
  );
}

function TutorBoard() {
  const D = window.DATA;
  return (
    <div className="board">
      <style>{boardCSS}</style>
      <div className="board-hd">
        <h2>Tutor Board</h2>
        <span>{D.entries.length} frases capturadas desta cena</span>
      </div>
      {D.entries.map((e, i) => <EntryCard key={e.id} e={e} idx={i} />)}
    </div>
  );
}

Object.assign(window, { TutorBoard, EntryCard, WordPopover });
