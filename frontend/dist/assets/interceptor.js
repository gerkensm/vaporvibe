const L=[{id:"wobble-drop",label:"Wobbly drop morph"},{id:"dvd-bounce",label:"DVD screensaver drift",behavior:"dvdBounce"},{id:"breathe",label:"Gentle breathe"},{id:"spin-cycle",label:"Spin cycle burst"},{id:"mini-game",label:"Mini rally (auto)"},{id:"lantern-sway",label:"Lantern sway"},{id:"parallax-tilt",label:"Parallax tilt"},{id:"orbiting-sparks",label:"Orbiting sparks"},{id:"aurora-sweep",label:"Aurora sweep"},{id:"chill-waves",label:"Chill waves"}],N=['  <div class="effect-ornament orbiting-sparks" aria-hidden="true">','    <span class="spark spark-1"></span>','    <span class="spark spark-2"></span>','    <span class="spark spark-3"></span>',"  </div>"].join(`
`),O=['      <div class="mini-game" aria-hidden="true">','        <div class="mini-game-court"></div>','        <div class="mini-game-ball"></div>','        <div class="mini-game-paddle left"></div>','        <div class="mini-game-paddle right"></div>',"      </div>"].join(`
`),T=String.raw`
  .effect-ornament {
    position: absolute;
    inset: 0;
    z-index: 3;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .orbiting-sparks {
    display: none;
  }

  .orbiting-sparks .spark {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 10px;
    height: 10px;
    margin: -5px;
    border-radius: 50%;
    background: rgba(59, 130, 246, 0.9);
    box-shadow: 0 0 12px rgba(59, 130, 246, 0.8);
    opacity: 0;
    transform-origin: 0 0;
  }

  .orbiting-sparks .spark-1 {
    --radius: 120px;
    --duration: 11s;
    background: rgba(56, 189, 248, 0.88);
  }

  .orbiting-sparks .spark-2 {
    --radius: 86px;
    --duration: 8s;
    background: rgba(29, 78, 216, 0.9);
  }

  .orbiting-sparks .spark-3 {
    --radius: 146px;
    --duration: 14s;
    background: rgba(165, 180, 252, 0.9);
  }

  .mini-game {
    display: none;
    width: 200px;
    height: 72px;
    border-radius: 16px;
    background: rgba(15, 23, 42, 0.12);
    border: 1px solid rgba(148, 163, 184, 0.35);
    margin-top: 12px;
    position: relative;
    overflow: hidden;
  }

  .mini-game-court {
    position: absolute;
    inset: 12px;
    border-radius: 12px;
    border: 1px dashed rgba(59, 130, 246, 0.25);
  }

  .mini-game-ball {
    position: absolute;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: rgba(59, 130, 246, 0.95);
    box-shadow: 0 0 12px rgba(59, 130, 246, 0.75);
    animation: miniGameBall 3.4s ease-in-out infinite;
  }

  .mini-game-paddle {
    position: absolute;
    width: 34px;
    height: 6px;
    border-radius: 4px;
    background: rgba(148, 163, 184, 0.75);
  }

  .mini-game-paddle.left {
    left: 10px;
    animation: miniPaddleLeft 3.4s ease-in-out infinite;
  }

  .mini-game-paddle.right {
    right: 10px;
    animation: miniPaddleRight 3.4s ease-in-out infinite;
  }

  @keyframes dropMorph {
    0%, 100% {
      border-radius: 22px;
      transform: translate3d(0, 0, 0) scale(1);
    }
    25% {
      border-radius: 60px 80px 30px 90px / 40px 60px 28px 72px;
      transform: translate3d(0, -6px, 0) rotate(-1.5deg) scale(1.02);
    }
    50% {
      border-radius: 70px 35px 80px 30px / 70px 35px 65px 35px;
      transform: translate3d(0, 5px, 0) rotate(1.4deg) scale(0.98);
    }
    75% {
      border-radius: 32px 65px 28px 65px / 60px 34px 56px 34px;
      transform: translate3d(0, -3px, 0) rotate(-0.9deg) scale(1.01);
    }
  }

  @keyframes breathe {
    0%, 100% {
      transform: scale(0.92);
    }
    50% {
      transform: scale(1.02);
    }
  }

  @keyframes spinCycle {
    0%, 65% {
      transform: rotate(0deg);
    }
    70% {
      transform: rotate(360deg);
    }
    75% {
      transform: rotate(720deg);
    }
    76%, 100% {
      transform: rotate(0deg);
    }
  }

  @keyframes lanternSway {
    0%, 100% {
      transform: rotate(-1.4deg) translateY(-2px);
    }
    50% {
      transform: rotate(1.8deg) translateY(3px);
    }
  }

  @keyframes parallaxTilt {
    0%, 100% {
      transform: rotateX(0deg) rotateY(0deg) translateZ(0);
    }
    25% {
      transform: rotateX(3deg) rotateY(-3deg) translateZ(12px);
    }
    50% {
      transform: rotateX(-2deg) rotateY(3deg) translateZ(16px);
    }
    75% {
      transform: rotateX(2deg) rotateY(2deg) translateZ(8px);
    }
  }

  @keyframes parallaxGlow {
    0%, 100% {
      opacity: 1;
      transform: translate3d(0, 0, 0);
    }
    50% {
      opacity: 0.6;
      transform: translate3d(-4px, 2px, 0);
    }
  }

  @keyframes parallaxShine {
    0%, 100% {
      opacity: 0.35;
      transform: translate3d(0, 0, 0);
    }
    50% {
      opacity: 0.6;
      transform: translate3d(4px, -2px, 0);
    }
  }

  @keyframes orbitSpark {
    0% {
      opacity: 0;
      transform: rotate(0deg) translateX(var(--radius));
    }
    10% {
      opacity: 1;
    }
    80% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: rotate(360deg) translateX(var(--radius));
    }
  }

  @keyframes miniGameBall {
    0%, 100% {
      top: 12px;
      left: 20px;
    }
    25% {
      top: 24px;
      left: 152px;
    }
    50% {
      top: 48px;
      left: 62px;
    }
    75% {
      top: 32px;
      left: 180px;
    }
  }

  @keyframes miniPaddleLeft {
    0%, 100% {
      top: 18px;
    }
    25% {
      top: 42px;
    }
    50% {
      top: 26px;
    }
    75% {
      top: 12px;
    }
  }

  @keyframes miniPaddleRight {
    0%, 100% {
      top: 28px;
    }
    25% {
      top: 12px;
    }
    50% {
      top: 36px;
    }
    75% {
      top: 18px;
    }
  }

  #serve-llm-overlay.effect-wobble-drop .liquidGlass-wrapper {
    animation: dropMorph 3.6s ease-in-out infinite;
  }

  #serve-llm-overlay.effect-breathe .liquidGlass-wrapper {
    animation: breathe 3.8s ease-in-out infinite;
  }

  #serve-llm-overlay.effect-spin-cycle .liquidGlass-wrapper {
    animation: spinCycle 5.2s ease-in-out infinite;
  }

  #serve-llm-overlay.effect-lantern-sway .liquidGlass-wrapper {
    transform-origin: 50% -320px;
    animation: lanternSway 2.8s ease-in-out infinite;
  }

  #serve-llm-overlay.effect-parallax-tilt .liquidGlass-wrapper {
    transform-style: preserve-3d;
    animation: parallaxTilt 6s ease-in-out infinite;
  }

  #serve-llm-overlay.effect-parallax-tilt .liquidGlass-tint {
    animation: parallaxGlow 6s ease-in-out infinite;
  }

  #serve-llm-overlay.effect-parallax-tilt .liquidGlass-shine {
    animation: parallaxShine 6s ease-in-out infinite;
  }

  #serve-llm-overlay.effect-orbiting-sparks .effect-ornament {
    opacity: 1;
  }

  #serve-llm-overlay.effect-orbiting-sparks .orbiting-sparks {
    display: block;
  }

  #serve-llm-overlay.effect-orbiting-sparks .spark-1 {
    animation: orbitSpark var(--duration) linear infinite;
  }

  #serve-llm-overlay.effect-orbiting-sparks .spark-2 {
    animation: orbitSpark var(--duration) linear infinite reverse;
  }

  #serve-llm-overlay.effect-orbiting-sparks .spark-3 {
    animation: orbitSpark calc(var(--duration) * 1.25) linear infinite;
  }

  #serve-llm-overlay.effect-mini-game .mini-game {
    display: block;
  }

  #serve-llm-overlay.effect-dvd-bounce .mini-game {
    display: block;
  }
`,_=L.map(d=>`effect-${d.id}`),I=["<style>","  :root { --accent:#1d4ed8; --muted:#475569; --subtle:#64748b; }","  @keyframes serve-llm-spin { to { transform: rotate(360deg); } }","  @keyframes serve-llm-pulse { 0%,100%{ transform: scale(0.92); opacity: 0.6;} 50%{ transform: scale(1); opacity: 1;} }","  .liquidGlass-wrapper { position: relative; overflow: hidden; box-shadow: 0 6px 6px rgba(0,0,0,0.2), 0 0 20px rgba(0,0,0,0.1); border: 1px solid rgba(148,163,184,0.35); }","  .liquidGlass-wrapper, .liquidGlass-wrapper > div { border-radius: 22px; }","  .liquidGlass-effect { position: absolute; inset: 0; z-index: 0; backdrop-filter: blur(7px); filter: url(#glass-distortion); overflow:hidden; }","  .liquidGlass-tint { position: absolute; inset: 0; z-index: 1; background: rgba(255,255,255,0.50); }","  .liquidGlass-shine { position: absolute; inset: 0; z-index: 2; box-shadow: inset 2px 2px 1px 0 rgba(255,255,255,0.5), inset -1px -1px 1px 1px rgba(255,255,255,0.5); }","  .serve-llm-stage { position: relative; z-index: 4; display: grid; place-items: center; gap: 12px; text-align: center; max-width: 520px; width: calc(100% - 32px); padding: 18px; }","  .serve-llm-pulse { width: 96px; height: 96px; border-radius: 50%; background: radial-gradient(circle, rgba(29, 78, 216, 0.28), rgba(29, 78, 216, 0)); display:grid; place-items:center; animation: serve-llm-pulse 2.4s ease-in-out infinite; }","  .serve-llm-spinner { width: 72px; height: 72px; border-radius: 50%; border: 6px solid rgba(29, 78, 216, 0.2); border-top-color: var(--accent); animation: serve-llm-spin 1.1s linear infinite; }","  .serve-llm-title { font: 600 1.1rem/1.3 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color:#0f172a; }","  .serve-llm-status { font: 400 0.95rem/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: var(--muted); min-height:1.2em; }","  .serve-llm-hint { font: 400 0.9rem/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: var(--subtle); }",T.split(`
`).map(d=>d?`  ${d}`:"").join(`
`),"</style>",'<div class="liquidGlass-wrapper">',N,'  <div class="liquidGlass-effect"></div>','  <div class="liquidGlass-tint"></div>','  <div class="liquidGlass-shine"></div>','  <div class="serve-llm-stage">','    <div class="serve-llm-pulse"><div class="serve-llm-spinner" role="status" aria-live="polite" aria-label="Generating the next view"></div></div>','    <div class="serve-llm-title">Generating your next view</div>','    <div class="serve-llm-status" data-serve-llm-status></div>','    <div class="serve-llm-hint">Hold tight—we ask your configured model to compose a fresh canvas.</div>',O,"  </div>","</div>",'<svg style="position:absolute; width:0; height:0; overflow:hidden">','  <filter id="glass-distortion" x="0%" y="0%" width="100%" height="100%" filterUnits="objectBoundingBox">','    <feTurbulence type="fractalNoise" baseFrequency="0.008 0.008" numOctaves="1" seed="12" result="turbulence" />','    <feGaussianBlur in="turbulence" stdDeviation="5" result="softMap" />','    <feSpecularLighting in="softMap" surfaceScale="3.5" specularConstant="0.9" specularExponent="85" lighting-color="white" result="specLight">','      <fePointLight x="-160" y="-180" z="260" />',"    </feSpecularLighting>",'    <feComposite in="specLight" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="litImage" />','    <feDisplacementMap in="SourceGraphic" in2="softMap" scale="50" xChannelSelector="R" yChannelSelector="G" />',"  </filter>","</svg>"].join(`
`),P=["Reticulating creative splines","Searching the web for inspo","Sketching wireframes in thin air","Procrastinating... productively","Auditing color palettes against vibes","Consulting the prompt whisperer","Coaxing latent space into a moodboard","Sampling temperature curves for witty tooltips","Polishing edge cases in the instruction buffer"];(()=>{const d=window;if(d.serveLlmInterceptorAttached)return;d.serveLlmInterceptorAttached=!0;const f=L,q="serve-llm-interceptor-script",y=document.currentScript;y&&!y.id&&(y.id=q);let i=null,m=null,b=null,p=null,c=null;const r={x:0,y:0,vx:.2,vy:.18};let u=null,g=null;function h(){return i?((!m||!i.contains(m))&&(m=i.querySelector(".liquidGlass-wrapper")),m):null}function w(){p!=null&&cancelAnimationFrame(p),p=null,c=null}function k(t){const e=h();if(!i||!e||!i.classList.contains("effect-dvd-bounce")){e&&(e.style.transform=""),w();return}if(c===null){c=t,p=requestAnimationFrame(k);return}const a=t-c;c=t;const n=i.clientWidth,s=i.clientHeight,o=e.offsetWidth,l=e.offsetHeight,v=Math.max(n-o,0),x=Math.max(s-l,0);r.x+=r.vx*a,r.y+=r.vy*a,r.x<=0?(r.x=0,r.vx=Math.abs(r.vx)):r.x>=v&&(r.x=v,r.vx=-Math.abs(r.vx)),r.y<=0?(r.y=0,r.vy=Math.abs(r.vy)):r.y>=x&&(r.y=x,r.vy=-Math.abs(r.vy)),e.style.transform=`translate3d(${r.x.toFixed(2)}px,${r.y.toFixed(2)}px,0)`,p=requestAnimationFrame(k)}function M(){const t=h();if(!i||!t)return;w();const e=i.clientWidth,a=i.clientHeight,n=t.offsetWidth,s=t.offsetHeight,o=Math.max(e-n,0),l=Math.max(a-s,0);r.x=o>0?Math.random()*o:0,r.y=l>0?Math.random()*l:0,r.vx=(Math.random()>.5?1:-1)*(.18+Math.random()*.08),r.vy=(Math.random()>.5?1:-1)*(.16+Math.random()*.07),c=null,t.style.transform=`translate3d(${r.x.toFixed(2)}px,${r.y.toFixed(2)}px,0)`,p=requestAnimationFrame(k)}function C(){if(!i)return;_.forEach(e=>{i==null||i.classList.remove(e)});const t=h();t&&(t.style.transform=""),i.removeAttribute("data-serve-llm-effect"),w(),b=null}function S(t){if(!f.length||!i||(C(),!t))return;const e=f.find(a=>a.id===t);if(e){if(i.classList.add(`effect-${e.id}`),i.setAttribute("data-serve-llm-effect",e.id),b=e.id,typeof console<"u"&&typeof console.debug=="function")try{console.debug("serve-llm overlay effect",e.id)}catch(a){console.debug("serve-llm overlay effect",e.id,a)}e.behavior==="dvdBounce"&&M()}}function R(){if(!f.length){S(null);return}if(Math.random()>.3){S(null);return}const e=f[Math.floor(Math.random()*f.length)];S(e?e.id:null)}function A(){document.getElementById("serve-llm-overlay")||(i=document.createElement("div"),i.id="serve-llm-overlay",Object.assign(i.style,{position:"fixed",top:"0",left:"0",width:"100%",height:"100%",backgroundColor:"rgba(255, 255, 255, 0.08)",zIndex:"2147483647",display:"flex",justifyContent:"center",alignItems:"center",opacity:"0",transition:"opacity 0.2s ease-in-out",pointerEvents:"none"}),i.innerHTML=I,m=i.querySelector(".liquidGlass-wrapper"),document.body.appendChild(i))}function D(t){const e=[...t];for(let a=e.length-1;a>0;a-=1){const n=Math.floor(Math.random()*(a+1)),s=e[a];e[a]=e[n],e[n]=s}return e}function G(){if((!i||!document.getElementById("serve-llm-overlay"))&&A(),!!i){i.style.pointerEvents="auto",h(),R(),setTimeout(()=>{i&&(i.style.opacity="1")},10);try{const t="Summoning your adaptive canvas…",e=D(P);u&&(clearTimeout(u),u=null),g&&(clearInterval(g),g=null);const a=i.querySelector("[data-serve-llm-status]");let n=0;a&&(a.textContent=e[0]??t,u=window.setTimeout(()=>{n=(n+1)%e.length,a.textContent=e[n]??t,u=null},900),g=window.setInterval(()=>{n=(n+1)%e.length,a.textContent=e[n]??t},3500))}catch{}}}function F(t){try{const e=t instanceof URL?t:new URL(String(t),window.location.origin);return e.searchParams.set("__serve-llm","interceptor"),e}catch{return t}}try{const t=new URL(window.location.href);t.searchParams.get("__serve-llm")==="interceptor"&&(t.searchParams.delete("__serve-llm"),history.replaceState(null,"",t.toString()))}catch{}function E(t,e){const a=t instanceof URL?t:new URL(t,window.location.origin);if(a.pathname.startsWith("/serve-llm")||a.pathname.startsWith("/__setup")){window.location.href=a.href;return}G();try{const n=F(a);typeof console<"u"&&typeof console.debug=="function"&&console.debug("serve-llm navigation via interceptor",n.toString()),window.location.assign(n.toString())}catch(n){console.error("serve-llm navigation failed:",n),window.location.href=a.href}}window.addEventListener("resize",()=>{b==="dvd-bounce"&&M()}),document.addEventListener("click",t=>{if(t.button!==0||t.ctrlKey||t.metaKey||t.altKey||t.shiftKey)return;let e=t.target;for(;e&&e.nodeType!==Node.ELEMENT_NODE;)e=e.parentNode;const a=e,n=(a==null?void 0:a.closest("a"))??null;if(n&&!(n.target==="_blank"||n.hasAttribute("download"))&&!(!n.href||n.href.startsWith("javascript:"))&&n.origin===window.location.origin){try{const s=new URL(n.href);if(s.pathname===window.location.pathname&&s.search===window.location.search&&s.hash)return}catch{}t.preventDefault(),E(new URL(n.href))}},!0),document.addEventListener("submit",t=>{let e=t.target;for(;e&&e.nodeType!==Node.ELEMENT_NODE;)e=e.parentNode;const a=(e==null?void 0:e.closest("form"))??null;if(!a||a.target==="_blank")return;if(t.preventDefault(),(a.getAttribute("method")||"GET").toUpperCase()==="GET"){const s=new URL(a.action||window.location.href);try{const o=t.submitter;let l;try{l=o?new FormData(a,o):new FormData(a)}catch{l=new FormData(a),o&&o.name&&l.append(o.name,o.value)}l.forEach((v,x)=>{v instanceof File||s.searchParams.append(x,String(v))})}catch(o){console.warn("serve-llm form encoding failed:",o)}E(s)}else{try{const s=document.createElement("input");s.type="hidden",s.name="__serve-llm",s.value="interceptor",a.appendChild(s)}catch{}G(),a.submit()}},!0),window.addEventListener("popstate",()=>{window.location.reload()})})();
