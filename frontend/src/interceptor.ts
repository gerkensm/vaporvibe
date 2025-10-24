(() => {
  type NavigationOverlayEffect = {
    id: string;
    label: string;
    behavior?: "dvdBounce";
  };

  const overlayEffectsConfig: NavigationOverlayEffect[] = [
    { id: "wobble-drop", label: "Wobbly drop morph" },
    { id: "dvd-bounce", label: "DVD screensaver drift", behavior: "dvdBounce" },
    { id: "breathe", label: "Gentle breathe" },
    { id: "spin-cycle", label: "Spin cycle burst" },
    { id: "mini-game", label: "Mini rally (auto)" },
    { id: "lantern-sway", label: "Lantern sway" },
    { id: "parallax-tilt", label: "Parallax tilt" },
    { id: "orbiting-sparks", label: "Orbiting sparks" },
    { id: "aurora-sweep", label: "Aurora sweep" },
    { id: "chill-waves", label: "Chill waves" },
  ];

  const navigationOverlayDecorationsMarkup = [
    '  <div class="effect-ornament orbiting-sparks" aria-hidden="true">',
    '    <span class="spark spark-1"></span>',
    '    <span class="spark spark-2"></span>',
    '    <span class="spark spark-3"></span>',
    "  </div>",
  ].join("\n");

  const navigationOverlayMiniGameMarkup = [
    '      <div class="mini-game" aria-hidden="true">',
    '        <div class="mini-game-court"></div>',
    '        <div class="mini-game-ball"></div>',
    '        <div class="mini-game-paddle left"></div>',
    '        <div class="mini-game-paddle right"></div>',
    "      </div>",
  ].join("\n");

  const navigationOverlayEffectStyles = String.raw`
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
      top: 50px;
    }
  }

  @keyframes auroraSweep {
    0%, 100% {
      opacity: 0.65;
      transform: translate3d(-20px, 0, 0) skewX(-8deg);
    }
    50% {
      opacity: 1;
      transform: translate3d(20px, 0, 0) skewX(8deg);
    }
  }

  @keyframes chillWaves {
    0% {
      transform: translate3d(-12px, 0, 0);
    }
    50% {
      transform: translate3d(12px, 0, 0);
    }
    100% {
      transform: translate3d(-12px, 0, 0);
    }
  }

  .effect-wobble-drop .liquidGlass-wrapper {
    animation: dropMorph 8s ease-in-out infinite;
  }

  .effect-dvd-bounce .effect-ornament {
    opacity: 0.6;
  }

  .effect-dvd-bounce .mini-game {
    display: block;
  }

  .effect-breathe .liquidGlass-pulse {
    animation: breathe 5.5s ease-in-out infinite;
  }

  .effect-spin-cycle .vaporvibe-pulse {
    animation: spinCycle 7.5s ease-in-out infinite;
  }

  .effect-mini-game .mini-game {
    display: block;
  }

  .effect-lantern-sway .liquidGlass-wrapper {
    transform-origin: center top;
    animation: lanternSway 6.2s ease-in-out infinite;
  }

  .effect-parallax-tilt .liquidGlass-wrapper {
    transform-style: preserve-3d;
    animation: parallaxTilt 9s ease-in-out infinite;
  }

  .effect-parallax-tilt .liquidGlass-effect::before {
    content: "";
    position: absolute;
    inset: 20px;
    border-radius: 28px;
    background: radial-gradient(
      circle at 30% 30%,
      rgba(125, 211, 252, 0.35),
      transparent 62%
    );
    animation: parallaxGlow 7s ease-in-out infinite;
  }

  .effect-parallax-tilt .liquidGlass-shine::after {
    content: "";
    position: absolute;
    inset: 12px;
    border-radius: 20px;
    background: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.45),
      rgba(59, 130, 246, 0.28)
    );
    opacity: 0.35;
    animation: parallaxShine 7s ease-in-out infinite;
  }

  .effect-orbiting-sparks .effect-ornament {
    display: block;
    opacity: 1;
  }

  .effect-orbiting-sparks .spark-1 {
    animation: orbitSpark var(--duration) linear infinite;
  }

  .effect-orbiting-sparks .spark-2 {
    animation: orbitSpark var(--duration) linear infinite reverse;
  }

  .effect-orbiting-sparks .spark-3 {
    animation: orbitSpark var(--duration) linear infinite;
  }

  .effect-aurora-sweep .liquidGlass-tint {
    background: linear-gradient(
      120deg,
      rgba(59, 130, 246, 0.25),
      rgba(14, 165, 233, 0.35),
      rgba(139, 92, 246, 0.35)
    );
    animation: auroraSweep 9s ease-in-out infinite;
  }

  .effect-chill-waves .liquidGlass-effect::after {
    content: "";
    position: absolute;
    inset: 6px;
    border-radius: 16px;
    background: repeating-linear-gradient(
      135deg,
      rgba(59, 130, 246, 0.16) 0px,
      rgba(59, 130, 246, 0.16) 12px,
      rgba(148, 163, 184, 0.08) 12px,
      rgba(148, 163, 184, 0.08) 24px
    );
    opacity: 0.8;
    animation: chillWaves 12s ease-in-out infinite;
  }
`;

  const REST_MUTATION_PREFIX = "/rest_api/mutation/";
  const REST_QUERY_PREFIX = "/rest_api/query/";

  function isRestApiPath(pathname: string): boolean {
    return (
      pathname.startsWith(REST_MUTATION_PREFIX) ||
      pathname.startsWith(REST_QUERY_PREFIX)
    );
  }

  function emitRestApiEvent(
    target: Element | null,
    detail: { method: string; url: string }
  ): void {
    if (!target) return;
    try {
      const event = new CustomEvent("vaporvibe:rest-api-request", {
        bubbles: true,
        detail,
      });
      target.dispatchEvent(event);
    } catch {
      // ignore dispatch failures
    }
  }

  const overlayEffectClassNames = overlayEffectsConfig.map(
    (effect) => `effect-${effect.id}`
  );

  const overlayMarkup = [
    "<style>",
    "  :root { --accent:#1d4ed8; --muted:#475569; --subtle:#64748b; }",
    "  @keyframes vaporvibe-spin { to { transform: rotate(360deg); } }",
    "  @keyframes vaporvibe-pulse { 0%,100%{ transform: scale(0.92); opacity: 0.6;} 50%{ transform: scale(1); opacity: 1;} }",
    "  .liquidGlass-wrapper { position: relative; overflow: hidden; box-shadow: 0 6px 6px rgba(0,0,0,0.2), 0 0 20px rgba(0,0,0,0.1); border: 1px solid rgba(148,163,184,0.35); }",
    "  .liquidGlass-wrapper, .liquidGlass-wrapper > div { border-radius: 22px; }",
    "  .liquidGlass-effect { position: absolute; inset: 0; z-index: 0; backdrop-filter: blur(7px); filter: url(#glass-distortion); overflow:hidden; }",
    "  .liquidGlass-tint { position: absolute; inset: 0; z-index: 1; background: rgba(255,255,255,0.50); }",
    "  .liquidGlass-shine { position: absolute; inset: 0; z-index: 2; box-shadow: inset 2px 2px 1px 0 rgba(255,255,255,0.5), inset -1px -1px 1px 1px rgba(255,255,255,0.5); }",
    "  .vaporvibe-stage { position: relative; z-index: 4; display: grid; place-items: center; gap: 12px; text-align: center; max-width: 520px; width: calc(100% - 32px); padding: 18px; }",
    "  .vaporvibe-pulse { width: 96px; height: 96px; border-radius: 50%; background: radial-gradient(circle, rgba(29, 78, 216, 0.28), rgba(29, 78, 216, 0)); display:grid; place-items:center; animation: vaporvibe-pulse 2.4s ease-in-out infinite; }",
    "  .vaporvibe-spinner { width: 72px; height: 72px; border-radius: 50%; border: 6px solid rgba(29, 78, 216, 0.2); border-top-color: var(--accent); animation: vaporvibe-spin 1.1s linear infinite; }",
    "  .vaporvibe-title { font: 600 1.1rem/1.3 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color:#0f172a; }",
    "  .vaporvibe-status { font: 400 0.95rem/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: var(--muted); min-height:1.2em; }",
    "  .vaporvibe-hint { font: 400 0.9rem/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: var(--subtle); }",
    navigationOverlayEffectStyles
      .split("\n")
      .map((line) => (line ? `  ${line}` : ""))
      .join("\n"),
    "</style>",
    '<div class="liquidGlass-wrapper">',
    navigationOverlayDecorationsMarkup,
    '  <div class="liquidGlass-effect"></div>',
    '  <div class="liquidGlass-tint"></div>',
    '  <div class="liquidGlass-shine"></div>',
    '  <div class="vaporvibe-stage">',
    '    <div class="vaporvibe-pulse"><div class="vaporvibe-spinner" role="status" aria-live="polite" aria-label="Generating the next view"></div></div>',
    '    <div class="vaporvibe-title">Generating your next view</div>',
    '    <div class="vaporvibe-status" data-vaporvibe-status></div>',
    '    <div class="vaporvibe-hint">Hold tight—we ask your configured model to compose a fresh canvas.</div>',
    navigationOverlayMiniGameMarkup,
    "  </div>",
    "</div>",
    '<svg style="position:absolute; width:0; height:0; overflow:hidden">',
    '  <filter id="glass-distortion" x="0%" y="0%" width="100%" height="100%" filterUnits="objectBoundingBox">',
    '    <feTurbulence type="fractalNoise" baseFrequency="0.008 0.008" numOctaves="1" seed="12" result="turbulence" />',
    '    <feGaussianBlur in="turbulence" stdDeviation="5" result="softMap" />',
    '    <feSpecularLighting in="softMap" surfaceScale="3.5" specularConstant="0.9" specularExponent="85" lighting-color="white" result="specLight">',
    '      <fePointLight x="-160" y="-180" z="260" />',
    "    </feSpecularLighting>",
    '    <feComposite in="specLight" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="litImage" />',
    '    <feDisplacementMap in="SourceGraphic" in2="softMap" scale="50" xChannelSelector="R" yChannelSelector="G" />',
    "  </filter>",
    "</svg>",
  ].join("\n");

  const globalScope = window as Window & {
    vaporVibeInterceptorAttached?: boolean;
    __vaporVibeStatusMessages?: unknown;
  };

  const fallbackStatusMessages = [
    "Reticulating creative splines",
    "Searching the web for inspo",
    "Sketching wireframes in thin air",
    "Procrastinating... productively",
    "Auditing color palettes against vibes",
    "Consulting the prompt whisperer",
    "Coaxing latent space into a moodboard",
    "Sampling temperature curves for witty tooltips",
    "Polishing edge cases in the instruction buffer",
  ];

  const statusMessages = (() => {
    const provided = Array.isArray(globalScope.__vaporVibeStatusMessages)
      ? (globalScope.__vaporVibeStatusMessages as unknown[]).filter(
          (item): item is string =>
            typeof item === "string" && item.trim().length > 0
        )
      : [];
    return provided.length > 0 ? provided : fallbackStatusMessages;
  })();

  if (globalScope.vaporVibeInterceptorAttached) return;
  globalScope.vaporVibeInterceptorAttached = true;

  const LOG_PREFIX = "vaporvibe interceptor:";
  const logDebug = (...args: unknown[]): void => {
    if (typeof console !== "undefined" && typeof console.debug === "function") {
      console.debug(LOG_PREFIX, ...args);
    }
  };

  const interceptorScriptId = "vaporvibe-interceptor-script";
  const currentScript = document.currentScript as HTMLScriptElement | null;
  if (currentScript && !currentScript.id) {
    currentScript.id = interceptorScriptId;
  }

  let overlay: HTMLElement | null = null;
  let overlayMotionNode: HTMLElement | null = null;
  let currentOverlayEffect: string | null = null;
  let lastOverlayEffectId: string | null = null;
  let dvdFrameRef: number | null = null;
  let dvdLastTick: number | null = null;
  const dvdPosition = { x: 0, y: 0, vx: 0.2, vy: 0.18 };
  let overlayStatusTimeout: number | null = null;
  let overlayStatusInterval: number | null = null;

  function ensureOverlayMotionNode(): HTMLElement | null {
    if (!overlay) return null;
    if (!overlayMotionNode || !overlay.contains(overlayMotionNode)) {
      overlayMotionNode = overlay.querySelector<HTMLElement>(
        ".liquidGlass-wrapper"
      );
    }
    return overlayMotionNode;
  }

  function stopDvdAnimation(): void {
    if (dvdFrameRef != null) cancelAnimationFrame(dvdFrameRef);
    dvdFrameRef = null;
    dvdLastTick = null;
  }

  function dvdFrame(timestamp: number): void {
    const motionNode = ensureOverlayMotionNode();
    if (
      !overlay ||
      !motionNode ||
      !overlay.classList.contains("effect-dvd-bounce")
    ) {
      if (motionNode) motionNode.style.transform = "";
      stopDvdAnimation();
      return;
    }

    if (dvdLastTick === null) {
      dvdLastTick = timestamp;
      dvdFrameRef = requestAnimationFrame(dvdFrame);
      return;
    }

    const delta = timestamp - dvdLastTick;
    dvdLastTick = timestamp;

    const boundsWidth = overlay.clientWidth;
    const boundsHeight = overlay.clientHeight;
    const nodeWidth = motionNode.offsetWidth;
    const nodeHeight = motionNode.offsetHeight;
    const maxX = Math.max(boundsWidth - nodeWidth, 0);
    const maxY = Math.max(boundsHeight - nodeHeight, 0);

    dvdPosition.x += dvdPosition.vx * delta;
    dvdPosition.y += dvdPosition.vy * delta;

    if (dvdPosition.x <= 0) {
      dvdPosition.x = 0;
      dvdPosition.vx = Math.abs(dvdPosition.vx);
    } else if (dvdPosition.x >= maxX) {
      dvdPosition.x = maxX;
      dvdPosition.vx = -Math.abs(dvdPosition.vx);
    }

    if (dvdPosition.y <= 0) {
      dvdPosition.y = 0;
      dvdPosition.vy = Math.abs(dvdPosition.vy);
    } else if (dvdPosition.y >= maxY) {
      dvdPosition.y = maxY;
      dvdPosition.vy = -Math.abs(dvdPosition.vy);
    }

    motionNode.style.transform = `translate3d(${dvdPosition.x.toFixed(
      2
    )}px,${dvdPosition.y.toFixed(2)}px,0)`;
    dvdFrameRef = requestAnimationFrame(dvdFrame);
  }

  function startDvdAnimation(): void {
    const motionNode = ensureOverlayMotionNode();
    if (!overlay || !motionNode) return;

    stopDvdAnimation();

    const boundsWidth = overlay.clientWidth;
    const boundsHeight = overlay.clientHeight;
    const nodeWidth = motionNode.offsetWidth;
    const nodeHeight = motionNode.offsetHeight;
    const maxX = Math.max(boundsWidth - nodeWidth, 0);
    const maxY = Math.max(boundsHeight - nodeHeight, 0);

    dvdPosition.x = maxX > 0 ? Math.random() * maxX : 0;
    dvdPosition.y = maxY > 0 ? Math.random() * maxY : 0;
    dvdPosition.vx =
      (Math.random() > 0.5 ? 1 : -1) * (0.18 + Math.random() * 0.08);
    dvdPosition.vy =
      (Math.random() > 0.5 ? 1 : -1) * (0.16 + Math.random() * 0.07);
    dvdLastTick = null;

    motionNode.style.transform = `translate3d(${dvdPosition.x.toFixed(
      2
    )}px,${dvdPosition.y.toFixed(2)}px,0)`;
    dvdFrameRef = requestAnimationFrame(dvdFrame);
  }

  function clearOverlayEffect(): void {
    if (!overlay) return;

    overlayEffectClassNames.forEach((className) => {
      overlay?.classList.remove(className);
    });

    const motionNode = ensureOverlayMotionNode();
    if (motionNode) motionNode.style.transform = "";

    overlay.removeAttribute("data-vaporvibe-effect");

    stopDvdAnimation();
    currentOverlayEffect = null;
  }

  function applyOverlayEffectById(effectId: string | null): void {
    if (!overlayEffectsConfig.length || !overlay) return;

    clearOverlayEffect();
    if (!effectId) {
      try {
        console.info("vaporvibe overlay effect", "none");
      } catch (error) {
        console.info("vaporvibe overlay effect", "none", error);
      }
      return;
    }

    const effect = overlayEffectsConfig.find(
      (candidate) => candidate.id === effectId
    );
    if (!effect) return;

    overlay.classList.add(`effect-${effect.id}`);
    overlay.setAttribute("data-vaporvibe-effect", effect.id);
    currentOverlayEffect = effect.id;
    lastOverlayEffectId = effect.id;

    try {
      console.info("vaporvibe overlay effect", effect.id);
    } catch (error) {
      console.info("vaporvibe overlay effect", effect.id, error);
    }

    if (effect.behavior === "dvdBounce") startDvdAnimation();
  }

  function maybeApplyRandomEffect(): void {
    if (!overlayEffectsConfig.length) {
      applyOverlayEffectById(null);
      return;
    }

    const chance = 0.3;

    if (Math.random() > chance) {
      applyOverlayEffectById(null);
      return;
    }

    let chosen: NavigationOverlayEffect | undefined;
    const maxAttempts = overlayEffectsConfig.length;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const candidate =
        overlayEffectsConfig[
          Math.floor(Math.random() * overlayEffectsConfig.length)
        ];
      if (
        !candidate ||
        (overlayEffectsConfig.length > 1 && candidate.id === lastOverlayEffectId)
      ) {
        continue;
      }
      chosen = candidate;
      break;
    }

    if (!chosen) {
      chosen = overlayEffectsConfig[
        Math.floor(Math.random() * overlayEffectsConfig.length)
      ];
    }
    applyOverlayEffectById(chosen ? chosen.id : null);
  }

  function createOverlay(): void {
    if (document.getElementById("vaporvibe-overlay")) return;

    overlay = document.createElement("div");
    overlay.id = "vaporvibe-overlay";
    Object.assign(overlay.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      backgroundColor: "rgba(255, 255, 255, 0.08)",
      zIndex: "2147483647",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      opacity: "0",
      transition: "opacity 0.2s ease-in-out",
      pointerEvents: "none",
    } satisfies Partial<CSSStyleDeclaration>);
    overlay.innerHTML = overlayMarkup;
    overlayMotionNode = overlay.querySelector<HTMLElement>(
      ".liquidGlass-wrapper"
    );
    document.body.appendChild(overlay);
  }

  function shuffleStatuses(messages: string[]): string[] {
    const scrambled = [...messages];
    for (let i = scrambled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = scrambled[i];
      scrambled[i] = scrambled[j];
      scrambled[j] = temp;
    }
    return scrambled;
  }

  function showOverlay(message?: string): void {
    logDebug("showOverlay", message ?? "<default>");
    if (!overlay || !document.getElementById("vaporvibe-overlay")) {
      createOverlay();
    }
    if (!overlay) return;

    overlay.style.pointerEvents = "auto";
    ensureOverlayMotionNode();
    maybeApplyRandomEffect();
    setTimeout(() => {
      if (overlay) overlay.style.opacity = "1";
    }, 10);

    try {
      const base =
        message && message.trim().length > 0
          ? message
          : "Summoning your adaptive canvas…";
      const statuses = shuffleStatuses(statusMessages);
      statuses.unshift(base);

      if (overlayStatusTimeout) {
        clearTimeout(overlayStatusTimeout);
        overlayStatusTimeout = null;
      }
      if (overlayStatusInterval) {
        clearInterval(overlayStatusInterval);
        overlayStatusInterval = null;
      }

      const target = overlay.querySelector<HTMLElement>(
        "[data-vaporvibe-status]"
      );
      let idx = 0;
      if (target) {
        target.textContent = statuses[0] ?? base;
        overlayStatusTimeout = window.setTimeout(() => {
          idx = (idx + 1) % statuses.length;
          target.textContent = statuses[idx] ?? base;
          overlayStatusTimeout = null;
        }, 900);
        overlayStatusInterval = window.setInterval(() => {
          idx = (idx + 1) % statuses.length;
          target.textContent = statuses[idx] ?? base;
        }, 3500);
      }
    } catch {
      // ignore status update failures
    }
  }

  function hideOverlay(): void {
    logDebug("hideOverlay");
    if (!overlay) return;

    overlay.style.pointerEvents = "none";
    overlay.style.opacity = "0";
    if (overlayStatusTimeout) {
      clearTimeout(overlayStatusTimeout);
      overlayStatusTimeout = null;
    }
    if (overlayStatusInterval) {
      clearInterval(overlayStatusInterval);
      overlayStatusInterval = null;
    }
    stopDvdAnimation();
  }

  function addBypassParam(u: string | URL): URL | string {
    try {
      const url =
        u instanceof URL ? u : new URL(String(u), window.location.origin);
      url.searchParams.set("__vaporvibe", "interceptor");
      return url;
    } catch {
      return u;
    }
  }

  try {
    const current = new URL(window.location.href);
    if (current.searchParams.get("__vaporvibe") === "interceptor") {
      current.searchParams.delete("__vaporvibe");
      history.replaceState(null, "", current.toString());
    }
  } catch {
    // ignore URL parsing errors
  }

  function handleRequest(url: URL | string, options: { method: string }): void {
    const destination =
      url instanceof URL ? url : new URL(url, window.location.origin);
    if (isRestApiPath(destination.pathname)) {
      emitRestApiEvent(document.body ?? null, {
        method: options.method,
        url: destination.href,
      });
      return;
    }

    if (
      destination.pathname.startsWith("/vaporvibe") ||
      destination.pathname.startsWith("/__setup")
    ) {
      window.location.href = destination.href;
      return;
    }

    showOverlay();
    try {
      const nav = addBypassParam(destination);
      if (
        typeof console !== "undefined" &&
        typeof console.debug === "function"
      ) {
        console.debug("vaporvibe navigation via interceptor", nav.toString());
      }
      window.location.assign(nav.toString());
    } catch (error) {
      console.error("vaporvibe navigation failed:", error);
      window.location.href = destination.href;
    }
  }

  window.addEventListener("resize", () => {
    if (currentOverlayEffect === "dvd-bounce") startDvdAnimation();
  });

  document.addEventListener(
    "click",
    (event) => {
      if (
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey
      )
        return;

      let node = event.target as Node | null;
      while (node && node.nodeType !== Node.ELEMENT_NODE) {
        node = node.parentNode;
      }
      const el = node as HTMLElement | null;
      const anchor = el?.closest<HTMLAnchorElement>("a") ?? null;
      if (!anchor) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      if (!anchor.href || anchor.href.startsWith("javascript:")) return;
      if (anchor.origin !== window.location.origin) return;

      try {
        const parsed = new URL(anchor.href);
        if (
          parsed.pathname === window.location.pathname &&
          parsed.search === window.location.search &&
          parsed.hash
        )
          return;

        if (isRestApiPath(parsed.pathname)) {
          event.preventDefault();
          emitRestApiEvent(anchor, { method: "GET", url: parsed.href });
          return;
        }
      } catch {
        // ignore malformed URLs
      }

      event.preventDefault();
      handleRequest(new URL(anchor.href), { method: "GET" });
    },
    true
  );

  document.addEventListener("submit", (event) => {
    let node = event.target as Node | null;
    while (node && node.nodeType !== Node.ELEMENT_NODE) node = node.parentNode;
    const form =
      (node as HTMLElement | null)?.closest<HTMLFormElement>("form") ?? null;
    if (!form || form.target === "_blank") return;

    if (event.defaultPrevented) return;

    const method = (form.getAttribute("method") || "GET").toUpperCase();
    const destination = new URL(form.action || window.location.href);

    if (isRestApiPath(destination.pathname)) {
      event.preventDefault();
      emitRestApiEvent(form, { method, url: destination.href });
      return;
    }

    if (method === "GET") {
      event.preventDefault();
      showOverlay();

      const url = new URL(destination.toString());
      try {
        const submitter = (event as SubmitEvent).submitter as
          | HTMLButtonElement
          | HTMLInputElement
          | null;
        let formData: FormData;
        try {
          formData = submitter
            ? new FormData(form, submitter)
            : new FormData(form);
        } catch {
          formData = new FormData(form);
          if (submitter && submitter.name) {
            formData.append(submitter.name, submitter.value);
          }
        }
        formData.forEach((value, key) => {
          if (value instanceof File) return;
          url.searchParams.append(key, String(value));
        });
      } catch (error) {
        console.warn("vaporvibe form encoding failed:", error);
      }
      handleRequest(url, { method: "GET" });
      return;
    }

    showOverlay();
    const existingMarker = form.querySelector<HTMLInputElement>(
      'input[name="__vaporvibe"][value="interceptor"]'
    );
    if (!existingMarker) {
      const marker = document.createElement("input");
      marker.type = "hidden";
      marker.name = "__vaporvibe";
      marker.value = "interceptor";
      form.appendChild(marker);
    }
  });

  window.addEventListener("popstate", () => {
    logDebug("popstate triggered", window.location.href);
    showOverlay("Loading previous view…");
    window.setTimeout(() => {
      const target = addBypassParam(window.location.href);
      const href = typeof target === "string" ? target : target.toString();
      logDebug("popstate navigation", href);
      try {
        window.location.replace(href);
      } catch {
        logDebug("popstate replace failed, fallback to href assignment");
        window.location.href = href;
      }
    }, 0);
  });

  window.addEventListener("pageshow", () => {
    logDebug("pageshow event");
    hideOverlay();
  });

  if (document.readyState === "complete") {
    logDebug("document already complete, hiding overlay immediately");
    hideOverlay();
  } else {
    window.addEventListener("load", hideOverlay, { once: true });
  }
})();
