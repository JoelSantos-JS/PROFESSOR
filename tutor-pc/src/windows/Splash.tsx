import { useEffect, useRef, useState } from 'react'
import { SPLASH_STEPS, nextStatusIndex } from '../lib/splashStatus'

// Tela de abertura do Soaken (Deep Soak). A janela é 320×400 frameless/transparente, então o
// root preenche tudo. Animações vêm de um <style> embutido (keyframes custom) e respeitam
// prefers-reduced-motion. O texto de status cicla por timer — desligado em reduced-motion.
const CSS = `
.sk-root{position:relative;width:100vw;height:100vh;border-radius:22px;overflow:hidden;
  background:radial-gradient(130% 80% at 50% -10%, #2A9D9B 0%, transparent 55%),
    linear-gradient(180deg,#1F8A8A 0%, #16706F 52%, #0F5957 100%);
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.10);color:#EAF4F2;
  display:flex;flex-direction:column;align-items:center;
  font-family:var(--font-ui,"Hanken Grotesk",system-ui,sans-serif);}
.sk-root::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.5;
  background-image:radial-gradient(rgba(255,255,255,.05) 1px,transparent 1px);background-size:5px 5px;}
.sk-water{position:absolute;left:0;right:0;bottom:0;height:150px;overflow:hidden;}
.sk-wave{position:absolute;left:-50%;width:200%;height:150px;bottom:0;}
.sk-wave svg{position:absolute;bottom:0;width:100%;height:100%;}
.sk-w1{animation:sk-drift 9s ease-in-out infinite;}
.sk-w2{animation:sk-drift 13s ease-in-out infinite reverse;opacity:.6;}
@keyframes sk-drift{0%,100%{transform:translateX(-4%);}50%{transform:translateX(4%);}}
.sk-rings{position:absolute;top:128px;left:50%;transform:translateX(-50%);width:0;height:0;}
.sk-rings i{position:absolute;left:50%;top:50%;border:1.5px solid rgba(255,255,255,.5);border-radius:50%;
  transform:translate(-50%,-50%);animation:sk-ripple 3.2s ease-out infinite;opacity:0;}
.sk-rings i:nth-child(2){animation-delay:1.06s;}
.sk-rings i:nth-child(3){animation-delay:2.13s;}
@keyframes sk-ripple{0%{width:88px;height:88px;opacity:.55;}80%{opacity:0;}100%{width:240px;height:240px;opacity:0;}}
.sk-brand{margin-top:86px;display:flex;flex-direction:column;align-items:center;z-index:2;}
.sk-iconwrap{animation:sk-bob 4s ease-in-out infinite;filter:drop-shadow(0 16px 30px rgba(6,32,30,.5));}
.sk-iconwrap img{width:88px;height:88px;display:block;}
@keyframes sk-bob{0%,100%{transform:translateY(0);}50%{transform:translateY(-9px);}}
.sk-name{font-family:var(--font-display,"Fraunces",Georgia,serif);font-weight:600;font-size:32px;
  letter-spacing:.01em;margin-top:18px;line-height:1.1;padding:0 6px;white-space:nowrap;
  background:linear-gradient(180deg,#ffffff,#CFEAE7);-webkit-background-clip:text;background-clip:text;color:transparent;}
.sk-tagline{font-size:12.5px;color:rgba(234,244,242,.72);margin-top:3px;letter-spacing:.02em;white-space:nowrap;}
.sk-loading{position:absolute;bottom:42px;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:11px;z-index:2;}
.sk-bar{width:172px;height:5px;border-radius:999px;background:rgba(255,255,255,.16);overflow:hidden;}
/* enche de 0→96% ao longo da abertura (ease-out: rápido e desacelerando, como loading real) */
.sk-bar i{position:relative;display:block;height:100%;width:4%;border-radius:999px;overflow:hidden;
  background:linear-gradient(90deg,rgba(255,255,255,.45),#ffffff);box-shadow:0 0 10px rgba(255,255,255,.45);
  animation:sk-fill 5.4s cubic-bezier(.22,.7,.2,1) forwards;}
/* brilho deslizante por cima da barra → sensação de "vivo/carregando" */
.sk-bar i::after{content:"";position:absolute;inset:0;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.75),transparent);
  animation:sk-shine 1.3s ease-in-out infinite;}
@keyframes sk-fill{0%{width:4%;}100%{width:96%;}}
@keyframes sk-shine{0%{transform:translateX(-120%);}100%{transform:translateX(220%);}}
.sk-status{font-size:11.5px;color:rgba(234,244,242,.6);font-weight:500;min-height:15px;letter-spacing:.02em;transition:opacity .2s;}
.sk-ver{position:absolute;bottom:15px;font-size:10px;color:rgba(234,244,242,.4);letter-spacing:.06em;}
@media (prefers-reduced-motion: reduce){
  .sk-iconwrap,.sk-w1,.sk-w2,.sk-rings i,.sk-bar i,.sk-bar i::after{animation:none;}
  .sk-bar i{width:70%;}
  .sk-bar i::after{display:none;}
}
`

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function Splash() {
  const [stepIdx, setStepIdx] = useState(0)
  const [visible, setVisible] = useState(true)
  const reduced = useRef(prefersReducedMotion())

  useEffect(() => {
    if (reduced.current) return  // reduced-motion: status estático, sem timer
    const id = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setStepIdx(i => nextStatusIndex(SPLASH_STEPS.length, i))
        setVisible(true)
      }, 200)
    }, 1400)
    return () => clearInterval(id)
  }, [])

  return (
    <>
      <style>{CSS}</style>
      <div className="sk-root">
        <div className="sk-rings"><i /><i /><i /></div>

        <div className="sk-brand">
          <div className="sk-iconwrap"><img src="icon/soaken-512.png" alt="Soaken" /></div>
          <div className="sk-name">Soaken</div>
          <div className="sk-tagline">Mergulhe no idioma</div>
        </div>

        <div className="sk-loading">
          <div className="sk-bar"><i /></div>
          <div className="sk-status" style={{ opacity: visible ? 1 : 0 }}>{SPLASH_STEPS[stepIdx]}</div>
        </div>
        <div className="sk-ver">Deep Soak</div>

        <div className="sk-water">
          <div className="sk-wave sk-w1">
            <svg viewBox="0 0 320 150" preserveAspectRatio="none">
              <path d="M0 55 Q80 30 160 55 T320 55 V150 H0 Z" fill="rgba(255,255,255,.06)" />
            </svg>
          </div>
          <div className="sk-wave sk-w2">
            <svg viewBox="0 0 320 150" preserveAspectRatio="none">
              <path d="M0 75 Q80 50 160 75 T320 75 V150 H0 Z" fill="rgba(255,255,255,.05)" />
            </svg>
          </div>
        </div>
      </div>
    </>
  )
}
