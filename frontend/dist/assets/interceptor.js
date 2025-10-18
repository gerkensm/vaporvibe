const T=[{id:"wobble-drop",label:"Wobbly drop morph"},{id:"dvd-bounce",label:"DVD screensaver drift",behavior:"dvdBounce"},{id:"breathe",label:"Gentle breathe"},{id:"spin-cycle",label:"Spin cycle burst"},{id:"mini-game",label:"Mini rally (auto)"},{id:"lantern-sway",label:"Lantern sway"},{id:"parallax-tilt",label:"Parallax tilt"},{id:"orbiting-sparks",label:"Orbiting sparks"},{id:"aurora-sweep",label:"Aurora sweep"},{id:"chill-waves",label:"Chill waves"}],F=['  <div class="effect-ornament orbiting-sparks" aria-hidden="true">','    <span class="spark spark-1"></span>','    <span class="spark spark-2"></span>','    <span class="spark spark-3"></span>',"  </div>"].join(`
`),I=['      <div class="mini-game" aria-hidden="true">','        <div class="mini-game-court"></div>','        <div class="mini-game-ball"></div>','        <div class="mini-game-paddle left"></div>','        <div class="mini-game-paddle right"></div>',"      </div>"].join(`
`),N=String.raw`
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
`,O="/rest_api/mutation/",U="/rest_api/query/";function b(l){return l.startsWith(O)||l.startsWith(U)}function y(l,p){if(l)try{const w=new CustomEvent("serve-llm:rest-api-request",{bubbles:!0,detail:p});l.dispatchEvent(w)}catch{}}const W=T.map(l=>`effect-${l.id}`),B=["<style>","  :root { --accent:#1d4ed8; --muted:#475569; --subtle:#64748b; }","  @keyframes serve-llm-spin { to { transform: rotate(360deg); } }","  @keyframes serve-llm-pulse { 0%,100%{ transform: scale(0.92); opacity: 0.6;} 50%{ transform: scale(1); opacity: 1;} }","  .liquidGlass-wrapper { position: relative; overflow: hidden; box-shadow: 0 6px 6px rgba(0,0,0,0.2), 0 0 20px rgba(0,0,0,0.1); border: 1px solid rgba(148,163,184,0.35); }","  .liquidGlass-wrapper, .liquidGlass-wrapper > div { border-radius: 22px; }","  .liquidGlass-effect { position: absolute; inset: 0; z-index: 0; backdrop-filter: blur(7px); filter: url(#glass-distortion); overflow:hidden; }","  .liquidGlass-tint { position: absolute; inset: 0; z-index: 1; background: rgba(255,255,255,0.50); }","  .liquidGlass-shine { position: absolute; inset: 0; z-index: 2; box-shadow: inset 2px 2px 1px 0 rgba(255,255,255,0.5), inset -1px -1px 1px 1px rgba(255,255,255,0.5); }","  .serve-llm-stage { position: relative; z-index: 4; display: grid; place-items: center; gap: 12px; text-align: center; max-width: 520px; width: calc(100% - 32px); padding: 18px; }","  .serve-llm-pulse { width: 96px; height: 96px; border-radius: 50%; background: radial-gradient(circle, rgba(29, 78, 216, 0.28), rgba(29, 78, 216, 0)); display:grid; place-items:center; animation: serve-llm-pulse 2.4s ease-in-out infinite; }","  .serve-llm-spinner { width: 72px; height: 72px; border-radius: 50%; border: 6px solid rgba(29, 78, 216, 0.2); border-top-color: var(--accent); animation: serve-llm-spin 1.1s linear infinite; }","  .serve-llm-title { font: 600 1.1rem/1.3 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color:#0f172a; }","  .serve-llm-status { font: 400 0.95rem/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: var(--muted); min-height:1.2em; }","  .serve-llm-hint { font: 400 0.9rem/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: var(--subtle); }",N.split(`
`).map(l=>l?`  ${l}`:"").join(`
`),"</style>",'<div class="liquidGlass-wrapper">',F,'  <div class="liquidGlass-effect"></div>','  <div class="liquidGlass-tint"></div>','  <div class="liquidGlass-shine"></div>','  <div class="serve-llm-stage">','    <div class="serve-llm-pulse"><div class="serve-llm-spinner" role="status" aria-live="polite" aria-label="Generating the next view"></div></div>','    <div class="serve-llm-title">Generating your next view</div>','    <div class="serve-llm-status" data-serve-llm-status></div>','    <div class="serve-llm-hint">Hold tight—we ask your configured model to compose a fresh canvas.</div>',I,"  </div>","</div>",'<svg style="position:absolute; width:0; height:0; overflow:hidden">','  <filter id="glass-distortion" x="0%" y="0%" width="100%" height="100%" filterUnits="objectBoundingBox">','    <feTurbulence type="fractalNoise" baseFrequency="0.008 0.008" numOctaves="1" seed="12" result="turbulence" />','    <feGaussianBlur in="turbulence" stdDeviation="5" result="softMap" />','    <feSpecularLighting in="softMap" surfaceScale="3.5" specularConstant="0.9" specularExponent="85" lighting-color="white" result="specLight">','      <fePointLight x="-160" y="-180" z="260" />',"    </feSpecularLighting>",'    <feComposite in="specLight" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="litImage" />','    <feDisplacementMap in="SourceGraphic" in2="softMap" scale="50" xChannelSelector="R" yChannelSelector="G" />',"  </filter>","</svg>"].join(`
`),H=["Reticulating creative splines","Searching the web for inspo","Sketching wireframes in thin air","Procrastinating... productively","Auditing color palettes against vibes","Consulting the prompt whisperer","Coaxing latent space into a moodboard","Sampling temperature curves for witty tooltips","Polishing edge cases in the instruction buffer"];(()=>{const l=window;if(l.serveLlmInterceptorAttached)return;l.serveLlmInterceptorAttached=!0;const p=T,w="serve-llm-interceptor-script",k=document.currentScript;k&&!k.id&&(k.id=w);let i=null,u=null,E=null,c=null,f=null;const n={x:0,y:0,vx:.2,vy:.18};let m=null,v=null;function g(){return i?((!u||!i.contains(u))&&(u=i.querySelector(".liquidGlass-wrapper")),u):null}function S(){c!=null&&cancelAnimationFrame(c),c=null,f=null}function M(t){const e=g();if(!i||!e||!i.classList.contains("effect-dvd-bounce")){e&&(e.style.transform=""),S();return}if(f===null){f=t,c=requestAnimationFrame(M);return}const a=t-f;f=t;const r=i.clientWidth,s=i.clientHeight,o=e.offsetWidth,d=e.offsetHeight,h=Math.max(r-o,0),x=Math.max(s-d,0);n.x+=n.vx*a,n.y+=n.vy*a,n.x<=0?(n.x=0,n.vx=Math.abs(n.vx)):n.x>=h&&(n.x=h,n.vx=-Math.abs(n.vx)),n.y<=0?(n.y=0,n.vy=Math.abs(n.vy)):n.y>=x&&(n.y=x,n.vy=-Math.abs(n.vy)),e.style.transform=`translate3d(${n.x.toFixed(2)}px,${n.y.toFixed(2)}px,0)`,c=requestAnimationFrame(M)}function L(){const t=g();if(!i||!t)return;S();const e=i.clientWidth,a=i.clientHeight,r=t.offsetWidth,s=t.offsetHeight,o=Math.max(e-r,0),d=Math.max(a-s,0);n.x=o>0?Math.random()*o:0,n.y=d>0?Math.random()*d:0,n.vx=(Math.random()>.5?1:-1)*(.18+Math.random()*.08),n.vy=(Math.random()>.5?1:-1)*(.16+Math.random()*.07),f=null,t.style.transform=`translate3d(${n.x.toFixed(2)}px,${n.y.toFixed(2)}px,0)`,c=requestAnimationFrame(M)}function C(){if(!i)return;W.forEach(e=>{i==null||i.classList.remove(e)});const t=g();t&&(t.style.transform=""),i.removeAttribute("data-serve-llm-effect"),S(),E=null}function G(t){if(!p.length||!i||(C(),!t))return;const e=p.find(a=>a.id===t);if(e){if(i.classList.add(`effect-${e.id}`),i.setAttribute("data-serve-llm-effect",e.id),E=e.id,typeof console<"u"&&typeof console.debug=="function")try{console.debug("serve-llm overlay effect",e.id)}catch(a){console.debug("serve-llm overlay effect",e.id,a)}e.behavior==="dvdBounce"&&L()}}function _(){if(!p.length){G(null);return}if(Math.random()>.3){G(null);return}const e=p[Math.floor(Math.random()*p.length)];G(e?e.id:null)}function A(){document.getElementById("serve-llm-overlay")||(i=document.createElement("div"),i.id="serve-llm-overlay",Object.assign(i.style,{position:"fixed",top:"0",left:"0",width:"100%",height:"100%",backgroundColor:"rgba(255, 255, 255, 0.08)",zIndex:"2147483647",display:"flex",justifyContent:"center",alignItems:"center",opacity:"0",transition:"opacity 0.2s ease-in-out",pointerEvents:"none"}),i.innerHTML=B,u=i.querySelector(".liquidGlass-wrapper"),document.body.appendChild(i))}function P(t){const e=[...t];for(let a=e.length-1;a>0;a-=1){const r=Math.floor(Math.random()*(a+1)),s=e[a];e[a]=e[r],e[r]=s}return e}function q(){if((!i||!document.getElementById("serve-llm-overlay"))&&A(),!!i){i.style.pointerEvents="auto",g(),_(),setTimeout(()=>{i&&(i.style.opacity="1")},10);try{const t="Summoning your adaptive canvas…",e=P(H);m&&(clearTimeout(m),m=null),v&&(clearInterval(v),v=null);const a=i.querySelector("[data-serve-llm-status]");let r=0;a&&(a.textContent=e[0]??t,m=window.setTimeout(()=>{r=(r+1)%e.length,a.textContent=e[r]??t,m=null},900),v=window.setInterval(()=>{r=(r+1)%e.length,a.textContent=e[r]??t},3500))}catch{}}}function D(t){try{const e=t instanceof URL?t:new URL(String(t),window.location.origin);return e.searchParams.set("__serve-llm","interceptor"),e}catch{return t}}try{const t=new URL(window.location.href);t.searchParams.get("__serve-llm")==="interceptor"&&(t.searchParams.delete("__serve-llm"),history.replaceState(null,"",t.toString()))}catch{}function R(t,e){const a=t instanceof URL?t:new URL(t,window.location.origin);if(b(a.pathname)){y(document.body??null,{method:e.method,url:a.href});return}if(a.pathname.startsWith("/serve-llm")||a.pathname.startsWith("/__setup")){window.location.href=a.href;return}q();try{const r=D(a);typeof console<"u"&&typeof console.debug=="function"&&console.debug("serve-llm navigation via interceptor",r.toString()),window.location.assign(r.toString())}catch(r){console.error("serve-llm navigation failed:",r),window.location.href=a.href}}window.addEventListener("resize",()=>{E==="dvd-bounce"&&L()}),document.addEventListener("click",t=>{if(t.button!==0||t.ctrlKey||t.metaKey||t.altKey||t.shiftKey)return;let e=t.target;for(;e&&e.nodeType!==Node.ELEMENT_NODE;)e=e.parentNode;const a=e,r=(a==null?void 0:a.closest("a"))??null;if(r&&!(r.target==="_blank"||r.hasAttribute("download"))&&!(!r.href||r.href.startsWith("javascript:"))&&r.origin===window.location.origin){try{const s=new URL(r.href);if(s.pathname===window.location.pathname&&s.search===window.location.search&&s.hash)return;if(b(s.pathname)){t.preventDefault(),y(r,{method:"GET",url:s.href});return}}catch{}t.preventDefault(),R(new URL(r.href),{method:"GET"})}},!0),document.addEventListener("submit",t=>{let e=t.target;for(;e&&e.nodeType!==Node.ELEMENT_NODE;)e=e.parentNode;const a=(e==null?void 0:e.closest("form"))??null;if(!a||a.target==="_blank"||t.defaultPrevented)return;const r=(a.getAttribute("method")||"GET").toUpperCase();if(r==="GET"){t.preventDefault();const s=new URL(a.action||window.location.href);try{const o=t.submitter;let d;try{d=o?new FormData(a,o):new FormData(a)}catch{d=new FormData(a),o&&o.name&&d.append(o.name,o.value)}d.forEach((h,x)=>{h instanceof File||s.searchParams.append(x,String(h))})}catch(o){console.warn("serve-llm form encoding failed:",o)}if(b(s.pathname)){y(a,{method:"GET",url:s.href});return}R(s,{method:"GET"})}else{t.preventDefault();const s=new URL(a.action||window.location.href);if(b(s.pathname)){y(a,{method:r,url:s.href});return}try{const o=document.createElement("input");o.type="hidden",o.name="__serve-llm",o.value="interceptor",a.appendChild(o)}catch{}q(),a.submit()}}),window.addEventListener("popstate",()=>{window.location.reload()})})();
