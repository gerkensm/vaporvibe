(() => {
  type NavigationOverlayEffect = {
    id: string;
    label: string;
    behavior?: "dvdBounce";
    intensity?: "subtle" | "medium" | "bold";
  };

  type StatusMessage = {
    id: string;
    headline: string;
    hint?: string;
    mood: string;
    energy: string;
    category: string;
    tags?: string[];
  };

  interface WindowWithWebkitAudioContext extends Window {
    webkitAudioContext?: typeof AudioContext;
  }

  const overlayEffectsConfig: NavigationOverlayEffect[] = [
    { id: "wobble-drop", label: "Wobbly drop morph", intensity: "subtle" },
    {
      id: "dvd-bounce",
      label: "DVD screensaver drift",
      behavior: "dvdBounce",
      intensity: "bold",
    },
    { id: "breathe", label: "Gentle breathe", intensity: "subtle" },
    { id: "spin-cycle", label: "Spin cycle burst", intensity: "bold" },
    { id: "mini-game", label: "Mini rally (auto)", intensity: "bold" },
    { id: "lantern-sway", label: "Lantern sway", intensity: "subtle" },
    { id: "parallax-tilt", label: "Parallax tilt", intensity: "medium" },
    { id: "orbiting-sparks", label: "Orbiting sparks", intensity: "medium" },
    { id: "aurora-sweep", label: "Aurora sweep", intensity: "medium" },
    { id: "chill-waves", label: "Chill waves", intensity: "subtle" },
    { id: "calm-glow", label: "Calm glow aura", intensity: "subtle" },
    { id: "latent-bloom", label: "Latent bloom", intensity: "medium" },
    { id: "prompt-shimmer", label: "Prompt shimmer", intensity: "medium" },
    { id: "neon-trace", label: "Neon trace", intensity: "bold" },
    { id: "signal-wave", label: "Signal wave", intensity: "medium" },
    { id: "prism-shift", label: "Prism shift", intensity: "medium" },
    { id: "data-stream", label: "Data stream drift", intensity: "bold" },
    { id: "deep-focus", label: "Deep focus", intensity: "subtle" },
    { id: "token-rain", label: "Token rain", intensity: "bold" },
    { id: "echo-pulse", label: "Echo pulse", intensity: "medium" },
    { id: "zen-loop", label: "Zen loop", intensity: "subtle" },
    { id: "synth-scan", label: "Synth scan sweep", intensity: "bold" },
    { id: "cosmic-swirl", label: "Cosmic swirl", intensity: "bold" },
    { id: "debug-grid", label: "Debug grid overlay", intensity: "medium" },
    { id: "vibe-halo", label: "Vibe halo", intensity: "subtle" },
    { id: "fractal-drift", label: "Fractal drift", intensity: "medium" },
    { id: "notebook-scroll", label: "Notebook scroll", intensity: "subtle" },
    { id: "holographic-mesh", label: "Holographic mesh", intensity: "bold" },
    {
      id: "ansi-demoscene",
      label: "DOS ANSI scene demo",
      intensity: "bold",
    },
    {
      id: "sneaky-possum",
      label: "Sneaky possum cameo",
      intensity: "bold",
    },
    { id: "quantum-blink", label: "Quantum blink", intensity: "bold" },
    { id: "daydream-orbit", label: "Daydream orbit", intensity: "medium" },
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

  const DEFAULT_HINT =
    "Hold tight—we ask your configured model to compose a fresh canvas.";
  const DEMOSCENE_EFFECT_ID = "ansi-demoscene";
  const demosceneMelodyPattern = [330, 392, 415, 440, 494, 523, 494, 440];
  const demosceneBassPattern = [110, 147, 123, 98];

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
      top: 18px;
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

  @keyframes calmGlow {
    0%, 100% {
      background-position: 0% 50%;
      opacity: 0.75;
    }
    50% {
      background-position: 100% 50%;
      opacity: 0.95;
    }
  }

  .effect-calm-glow .liquidGlass-tint {
    background: linear-gradient(
      120deg,
      rgba(226, 232, 240, 0.55),
      rgba(191, 219, 254, 0.5),
      rgba(248, 250, 252, 0.6)
    );
    background-size: 200% 200%;
    animation: calmGlow 8s ease-in-out infinite;
  }

  @keyframes latentBloom {
    0%, 100% {
      transform: scale(0.78);
      opacity: 0.45;
    }
    50% {
      transform: scale(1.08);
      opacity: 0.72;
    }
  }

  .effect-latent-bloom .liquidGlass-effect::after {
    content: "";
    position: absolute;
    inset: 14px;
    border-radius: 20px;
    background: radial-gradient(
      circle,
      rgba(59, 130, 246, 0.4),
      transparent 70%
    );
    opacity: 0.6;
    animation: latentBloom 7s ease-in-out infinite;
  }

  @keyframes promptShimmer {
    0% {
      background-position: 0% 50%;
    }
    100% {
      background-position: 200% 50%;
    }
  }

  .effect-prompt-shimmer .vaporvibe-title {
    background: linear-gradient(
      120deg,
      #1d4ed8,
      #0ea5e9,
      #6366f1,
      #1d4ed8
    );
    background-size: 200% 200%;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    animation: promptShimmer 4s ease-in-out infinite;
  }

  .effect-prompt-shimmer .vaporvibe-status {
    letter-spacing: 0.4px;
  }

  @keyframes neonTrace {
    0%, 100% {
      box-shadow:
        0 10px 28px rgba(14, 165, 233, 0.3),
        0 0 18px rgba(59, 130, 246, 0.3);
    }
    50% {
      box-shadow:
        0 12px 42px rgba(14, 165, 233, 0.45),
        0 0 32px rgba(99, 102, 241, 0.4);
    }
  }

  .effect-neon-trace .liquidGlass-wrapper {
    animation: neonTrace 6.4s ease-in-out infinite;
    border-color: rgba(59, 130, 246, 0.45);
  }

  .effect-neon-trace .liquidGlass-tint {
    background: rgba(15, 23, 42, 0.12);
  }

  @keyframes signalWave {
    0% {
      transform: translateX(-120%);
      opacity: 0;
    }
    30% {
      opacity: 0.25;
    }
    70% {
      transform: translateX(40%);
      opacity: 0.2;
    }
    100% {
      transform: translateX(120%);
      opacity: 0;
    }
  }

  .effect-signal-wave .liquidGlass-effect::before {
    content: "";
    position: absolute;
    inset: 12px;
    border-radius: 20px;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(59, 130, 246, 0.3),
      rgba(14, 165, 233, 0.25),
      transparent
    );
    animation: signalWave 5.4s ease-in-out infinite;
  }

  @keyframes prismShift {
    0%, 100% {
      opacity: 0.4;
      transform: translate3d(0, 0, 0);
    }
    50% {
      opacity: 0.6;
      transform: translate3d(4px, -6px, 0);
    }
  }

  .effect-prism-shift .liquidGlass-shine {
    background: linear-gradient(
      145deg,
      rgba(255, 255, 255, 0.6),
      rgba(191, 219, 254, 0.35),
      rgba(59, 130, 246, 0.2)
    );
    animation: prismShift 7.8s ease-in-out infinite;
  }

  @keyframes dataStream {
    0% {
      background-position: 0 -60px;
    }
    100% {
      background-position: 0 60px;
    }
  }

  .effect-data-stream .liquidGlass-effect::before {
    content: "";
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      to bottom,
      rgba(59, 130, 246, 0.08) 0px,
      rgba(59, 130, 246, 0.08) 3px,
      transparent 3px,
      transparent 12px
    );
    mix-blend-mode: screen;
    animation: dataStream 3.6s linear infinite;
  }

  @keyframes deepFocus {
    0%, 100% {
      filter: blur(7px);
    }
    50% {
      filter: blur(3px);
    }
  }

  .effect-deep-focus .liquidGlass-effect {
    animation: deepFocus 6.6s ease-in-out infinite;
  }

  @keyframes tokenRain {
    0% {
      transform: translateY(-110%);
      opacity: 0;
    }
    10% {
      opacity: 0.4;
    }
    100% {
      transform: translateY(110%);
      opacity: 0;
    }
  }

  .effect-token-rain .liquidGlass-effect::after {
    content: "";
    position: absolute;
    inset: 8px;
    border-radius: 18px;
    background: linear-gradient(
      180deg,
      rgba(59, 130, 246, 0),
      rgba(59, 130, 246, 0.35),
      rgba(59, 130, 246, 0)
    );
    opacity: 0.6;
    animation: tokenRain 4.2s linear infinite;
  }

  @keyframes echoPulse {
    0%, 100% {
      transform: scale(0.92);
      box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.25);
    }
    50% {
      transform: scale(1.04);
      box-shadow: 0 0 0 18px rgba(59, 130, 246, 0);
    }
  }

  .effect-echo-pulse .vaporvibe-pulse {
    animation: echoPulse 5.2s ease-in-out infinite;
  }

  @keyframes zenLoop {
    0%, 100% {
      transform: rotate(-1.2deg);
    }
    50% {
      transform: rotate(1.2deg);
    }
  }

  .effect-zen-loop .vaporvibe-stage {
    animation: zenLoop 12s ease-in-out infinite;
  }

  @keyframes synthScan {
    0% {
      transform: rotate(0deg);
      opacity: 0.35;
    }
    50% {
      opacity: 0.6;
    }
    100% {
      transform: rotate(360deg);
      opacity: 0.35;
    }
  }

  .effect-synth-scan .vaporvibe-spinner {
    position: relative;
    overflow: hidden;
  }

  .effect-synth-scan .vaporvibe-spinner::after {
    content: "";
    position: absolute;
    inset: -12px;
    border-radius: 50%;
    border: 2px solid rgba(14, 165, 233, 0.4);
    border-top-color: rgba(236, 72, 153, 0.5);
    mix-blend-mode: screen;
    animation: synthScan 3.2s linear infinite;
  }

  @keyframes cosmicSwirl {
    0% {
      transform: rotate(0deg) scale(0.9);
    }
    50% {
      transform: rotate(180deg) scale(1.05);
    }
    100% {
      transform: rotate(360deg) scale(0.9);
    }
  }

  .effect-cosmic-swirl .liquidGlass-effect::before {
    content: "";
    position: absolute;
    inset: -40px;
    border-radius: 50%;
    background: conic-gradient(
      from 0deg,
      rgba(59, 130, 246, 0.1),
      rgba(124, 58, 237, 0.2),
      rgba(14, 165, 233, 0.15),
      rgba(59, 130, 246, 0.1)
    );
    animation: cosmicSwirl 18s linear infinite;
    opacity: 0.4;
  }

  @keyframes debugGrid {
    0% {
      background-position: 0 0, 0 0;
    }
    100% {
      background-position: 32px 0, 0 32px;
    }
  }

  .effect-debug-grid .liquidGlass-effect::after {
    content: "";
    position: absolute;
    inset: 8px;
    border-radius: 18px;
    background-image:
      linear-gradient(rgba(148, 163, 184, 0.25) 1px, transparent 1px),
      linear-gradient(90deg, rgba(148, 163, 184, 0.25) 1px, transparent 1px);
    background-size: 32px 32px, 32px 32px;
    opacity: 0.5;
    animation: debugGrid 10s linear infinite;
  }

  @keyframes vibeHalo {
    0%, 100% {
      transform: scale(0.98);
      opacity: 0.6;
    }
    50% {
      transform: scale(1.08);
      opacity: 0.1;
    }
  }

  @keyframes vibeHaloPulse {
    0%, 100% {
      box-shadow: 0 0 28px rgba(59, 130, 246, 0.25), 0 0 60px rgba(59, 130, 246, 0.22);
    }
    50% {
      box-shadow: 0 0 10px rgba(96, 165, 250, 0.25), 0 0 30px rgba(244, 114, 182, 0.25);
    }
  }

  @keyframes vibeHaloOrbits {
    0% {
      stroke-dashoffset: 0;
    }
    100% {
      stroke-dashoffset: -420;
    }
  }

  .effect-vibe-halo .liquidGlass-wrapper::after {
    content: "";
    position: absolute;
    inset: -12px;
    border-radius: 32px;
    border: 1px solid rgba(59, 130, 246, 0.35);
    box-shadow: 0 0 22px rgba(59, 130, 246, 0.25);
    animation: vibeHalo 7s ease-out infinite;
    pointer-events: none;
  }

  .effect-vibe-halo .liquidGlass-wrapper::before {
    content: "";
    position: absolute;
    inset: 16px;
    border-radius: 26px;
    border: 1px dashed rgba(244, 114, 182, 0.4);
    box-shadow: inset 0 0 18px rgba(244, 114, 182, 0.25);
    animation: vibeHaloPulse 4.5s ease-in-out infinite;
    pointer-events: none;
  }

  .effect-vibe-halo .liquidGlass-effect {
    background: radial-gradient(
        circle at 30% 20%,
        rgba(59, 130, 246, 0.25),
        transparent 55%
      ),
      radial-gradient(
        circle at 70% 70%,
        rgba(244, 114, 182, 0.2),
        transparent 60%
      );
  }

  .effect-vibe-halo .vaporvibe-pulse {
    animation: vibeHaloPulse 4.5s ease-in-out infinite;
  }

  .effect-vibe-halo .vaporvibe-stage::after {
    content: "";
    position: absolute;
    inset: 12px;
    border-radius: 24px;
    border: 1px solid rgba(59, 130, 246, 0.25);
    opacity: 0.6;
    animation: vibeHalo 8s ease-out infinite;
    pointer-events: none;
  }

  .effect-vibe-halo .vaporvibe-stage::before {
    content: "";
    position: absolute;
    inset: 30px;
    border-radius: 50%;
    border: 2px solid transparent;
    background: conic-gradient(
        from 0deg,
        rgba(59, 130, 246, 0),
        rgba(59, 130, 246, 0.5),
        rgba(59, 130, 246, 0)
      )
      border-box;
    mask: linear-gradient(#fff, #fff) padding-box, linear-gradient(#fff, #fff);
    mask-composite: exclude;
    animation: vibeHaloOrbits 14s linear infinite;
    pointer-events: none;
  }

  @keyframes fractalDrift {
    0%, 100% {
      transform: rotateX(0deg) rotateY(0deg);
    }
    50% {
      transform: rotateX(5deg) rotateY(-5deg);
    }
  }

  @keyframes fractalDriftGlow {
    0%, 100% {
      opacity: 0.45;
    }
    50% {
      opacity: 0.75;
    }
  }

  .effect-fractal-drift .liquidGlass-wrapper {
    transform-style: preserve-3d;
    animation: fractalDrift 11s ease-in-out infinite;
  }

  .effect-fractal-drift .liquidGlass-effect::before {
    content: "";
    position: absolute;
    inset: 10px;
    border-radius: 20px;
    background: radial-gradient(
      circle at 20% 30%,
      rgba(14, 165, 233, 0.35),
      transparent 70%
    );
    animation: fractalDriftGlow 6.5s ease-in-out infinite;
  }

  @keyframes notebookScroll {
    0% {
      background-position: 0 0;
    }
    100% {
      background-position: 0 36px;
    }
  }

  .effect-notebook-scroll .liquidGlass-effect::after {
    content: "";
    position: absolute;
    inset: 6px;
    border-radius: 16px;
    background: repeating-linear-gradient(
      to bottom,
      rgba(148, 163, 184, 0.25) 0px,
      rgba(148, 163, 184, 0.25) 2px,
      transparent 2px,
      transparent 18px
    );
    animation: notebookScroll 9s linear infinite;
    opacity: 0.75;
  }

  @keyframes holographicMesh {
    0%, 100% {
      transform: translate3d(-10px, -6px, 0) scale(0.96);
    }
    50% {
      transform: translate3d(12px, 8px, 0) scale(1.04);
    }
  }

  @keyframes holographicMeshGrid {
    0% {
      background-position:
        0 0,
        0 0;
    }
    50% {
      background-position:
        40px 20px,
        -30px -10px;
    }
    100% {
      background-position:
        80px 40px,
        0 0;
    }
  }

  @keyframes holographicSheen {
    0% {
      transform: translateX(-120%) rotate(10deg);
      opacity: 0;
    }
    30% {
      opacity: 0.6;
    }
    50% {
      opacity: 0.2;
    }
    100% {
      transform: translateX(140%) rotate(10deg);
      opacity: 0;
    }
  }

  .effect-holographic-mesh .liquidGlass-effect {
    background:
      radial-gradient(
        circle at 30% 25%,
        rgba(59, 130, 246, 0.25),
        transparent 55%
      ),
      radial-gradient(
        circle at 75% 70%,
        rgba(236, 72, 153, 0.25),
        transparent 60%
      ),
      linear-gradient(
        135deg,
        rgba(14, 165, 233, 0.08),
        rgba(59, 130, 246, 0.05),
        rgba(236, 72, 153, 0.08)
      );
  }

  .effect-holographic-mesh .liquidGlass-effect::after {
    content: "";
    position: absolute;
    inset: 10px;
    border-radius: 22px;
    background-image:
      linear-gradient(
        120deg,
        rgba(255, 255, 255, 0.25) 0%,
        rgba(59, 130, 246, 0.15) 20%,
        rgba(236, 72, 153, 0.2) 60%,
        rgba(255, 255, 255, 0.2) 100%
      ),
      linear-gradient(
        rgba(255, 255, 255, 0.12) 1px,
        transparent 1px
      ),
      linear-gradient(
        90deg,
        rgba(255, 255, 255, 0.12) 1px,
        transparent 1px
      );
    background-size:
      400% 400%,
      32px 32px,
      32px 32px;
    mix-blend-mode: screen;
    animation: holographicMesh 9s ease-in-out infinite,
      holographicMeshGrid 12s linear infinite;
    opacity: 0.75;
  }

  .effect-holographic-mesh .liquidGlass-wrapper::after {
    content: "";
    position: absolute;
    inset: -6px;
    border-radius: 28px;
    box-shadow: 0 0 30px rgba(59, 130, 246, 0.25),
      inset 0 0 40px rgba(236, 72, 153, 0.2);
    pointer-events: none;
  }

  .effect-holographic-mesh .liquidGlass-wrapper::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      rgba(255, 255, 255, 0.55),
      rgba(255, 255, 255, 0)
    );
    border-radius: 24px;
    opacity: 0.35;
    transform: translateX(-120%) rotate(10deg);
    animation: holographicSheen 6.5s ease-in-out infinite;
    pointer-events: none;
  }

  .effect-holographic-mesh .vaporvibe-pulse {
    background: radial-gradient(
      circle,
      rgba(236, 72, 153, 0.35),
      rgba(59, 130, 246, 0)
    );
    box-shadow: 0 0 30px rgba(236, 72, 153, 0.35);
  }

  .effect-holographic-mesh .vaporvibe-title,
  .effect-holographic-mesh .vaporvibe-status,
  .effect-holographic-mesh .vaporvibe-hint {
    color: #020617;
    text-shadow: 0 2px 6px rgba(255, 255, 255, 0.45);
  }

  .effect-holographic-mesh .vaporvibe-stage {
    position: relative;
  }

  .effect-holographic-mesh .vaporvibe-stage::after {
    content: "";
    position: absolute;
    inset: -12px;
    border-radius: 26px;
    border: 1px solid rgba(59, 130, 246, 0.25);
    box-shadow: inset 0 0 30px rgba(59, 130, 246, 0.25);
    opacity: 0.7;
    pointer-events: none;
  }

  .effect-holographic-mesh .vaporvibe-stage::before {
    content: "";
    position: absolute;
    inset: -6px;
    border-radius: 30px;
    background: radial-gradient(
      circle at 20% 20%,
      rgba(255, 255, 255, 0.15),
      transparent 60%
    );
    animation: holographicMesh 9s ease-in-out infinite;
    opacity: 0.8;
    pointer-events: none;
  }

  @keyframes quantumBlink {
    0%, 100% {
      opacity: 0.9;
    }
    45% {
      opacity: 0.55;
    }
    50% {
      opacity: 1;
    }
    55% {
      opacity: 0.55;
    }
    70% {
      opacity: 0.85;
    }
  }

  .effect-quantum-blink .vaporvibe-stage {
    animation: quantumBlink 5.6s ease-in-out infinite;
  }

  @keyframes quantumBlinkGradient {
    0% {
      background-position: 0% 50%;
      filter: hue-rotate(0deg);
    }
    40% {
      background-position: 100% 50%;
      filter: hue-rotate(40deg);
    }
    55% {
      background-position: 0% 50%;
      filter: hue-rotate(-20deg);
    }
    75% {
      background-position: 100% 50%;
      filter: hue-rotate(70deg);
    }
    100% {
      background-position: 0% 50%;
      filter: hue-rotate(0deg);
    }
  }

  @keyframes quantumBlinkGlow {
    0%, 100% {
      box-shadow: 0 0 30px rgba(147, 197, 253, 0.25), 0 0 60px rgba(59, 130, 246, 0.3);
      border-color: rgba(59, 130, 246, 0.5);
    }
    45% {
      box-shadow: 0 0 10px rgba(244, 114, 182, 0.25), 0 0 30px rgba(59, 130, 246, 0.3);
      border-color: rgba(244, 114, 182, 0.45);
    }
    55% {
      box-shadow: 0 0 36px rgba(59, 130, 246, 0.45), 0 0 80px rgba(147, 197, 253, 0.25);
      border-color: rgba(96, 165, 250, 0.6);
    }
  }

  .effect-quantum-blink .liquidGlass-tint {
    background: linear-gradient(
      135deg,
      rgba(96, 165, 250, 0.35),
      rgba(244, 114, 182, 0.25),
      rgba(129, 140, 248, 0.35)
    );
    background-size: 200% 200%;
    animation: quantumBlinkGradient 6s ease-in-out infinite;
  }

  .effect-quantum-blink .vaporvibe-pulse {
    animation: quantumBlinkGlow 2.4s ease-in-out infinite;
  }

  .effect-quantum-blink .vaporvibe-spinner {
    border-top-color: #38bdf8;
    border-right-color: rgba(96, 165, 250, 0.35);
    border-left-color: rgba(236, 72, 153, 0.3);
    animation: quantumBlinkGlow 2.2s ease-in-out infinite;
  }

  .effect-daydream-orbit .effect-ornament {
    display: block;
    opacity: 0.55;
  }

  .effect-daydream-orbit .spark-1 {
    background: rgba(165, 180, 252, 0.85);
    --radius: 150px;
    --duration: 16s;
    animation: orbitSpark var(--duration) linear infinite;
  }

  .effect-daydream-orbit .spark-2 {
    background: rgba(96, 165, 250, 0.7);
    --radius: 110px;
    --duration: 20s;
    animation: orbitSpark var(--duration) linear infinite reverse;
  }

  .effect-daydream-orbit .spark-3 {
    background: rgba(56, 189, 248, 0.6);
    --radius: 180px;
    --duration: 24s;
    animation: orbitSpark var(--duration) linear infinite;
  }

  @keyframes possumPeek {
    0%, 100% {
      transform: translateX(0);
    }
    40% {
      transform: translateX(-4px);
    }
    60% {
      transform: translateX(6px);
    }
  }

  @keyframes possumBlink {
    0%, 42%, 48%, 100% {
      transform: scaleY(1);
    }
    45% {
      transform: scaleY(0.1);
    }
  }

  @keyframes possumTail {
    0%, 100% {
      transform: rotate(18deg);
    }
    50% {
      transform: rotate(-6deg);
    }
  }

  .effect-sneaky-possum .vaporvibe-sidekick {
    display: flex;
    background: rgba(59, 130, 246, 0.08);
    border-color: rgba(59, 130, 246, 0.35);
    box-shadow: inset 0 0 10px rgba(59, 130, 246, 0.16);
  }

  .effect-sneaky-possum .sidekick-line {
    font-weight: 500;
  }

  .effect-sneaky-possum .possum {
    animation: possumPeek 6s ease-in-out infinite;
  }

  .effect-sneaky-possum .possum-eye {
    animation: possumBlink 5s ease-in-out infinite;
  }

  .effect-sneaky-possum .possum-tail {
    animation: possumTail 2.8s ease-in-out infinite;
  }

  .effect-sneaky-possum .vaporvibe-pulse {
    background: radial-gradient(
      circle,
      rgba(59, 130, 246, 0.35),
      rgba(59, 130, 246, 0)
    );
  }

  @keyframes demosceneScan {
    0% {
      transform: translateY(0);
    }
    100% {
      transform: translateY(3px);
    }
  }

  @keyframes demosceneTyping {
    0% {
      max-height: 0;
    }
    60% {
      max-height: 220px;
    }
    100% {
      max-height: 220px;
    }
  }

  @keyframes demosceneTextWobble {
    0% {
      transform: skewX(0deg) scaleY(1);
    }
    25% {
      transform: skewX(2.4deg) scaleY(0.98);
    }
    50% {
      transform: skewX(-2.6deg) scaleY(1.02);
    }
    75% {
      transform: skewX(1.6deg) scaleY(0.99);
    }
    100% {
      transform: skewX(0deg) scaleY(1);
    }
  }

  @keyframes demosceneCrtWarp {
    0%,
    100% {
      transform: perspective(600px) scaleX(1) rotateX(0deg);
    }
    40% {
      transform: perspective(600px) scaleX(0.99) rotateX(0.3deg);
    }
    60% {
      transform: perspective(600px) scaleX(1.01) rotateX(-0.3deg);
    }
  }

  @keyframes crtFlicker {
    0% { opacity: 0.27861; }
    5% { opacity: 0.34769; }
    10% { opacity: 0.23604; }
    15% { opacity: 0.90626; }
    20% { opacity: 0.18128; }
    25% { opacity: 0.83891; }
    30% { opacity: 0.65583; }
    35% { opacity: 0.67807; }
    40% { opacity: 0.26559; }
    45% { opacity: 0.84693; }
    50% { opacity: 0.96019; }
    55% { opacity: 0.08594; }
    60% { opacity: 0.20313; }
    65% { opacity: 0.71988; }
    70% { opacity: 0.53455; }
    75% { opacity: 0.37288; }
    80% { opacity: 0.71428; }
    85% { opacity: 0.70419; }
    90% { opacity: 0.7003; }
    95% { opacity: 0.36108; }
    100% { opacity: 0.24387; }
  }

  @keyframes crtTextShadow {
    0% { text-shadow: 0.44px 0 1px rgba(0,30,255,0.5), -0.44px 0 1px rgba(255,0,80,0.3), 0 0 3px; }
    5% { text-shadow: 2.79px 0 1px rgba(0,30,255,0.5), -2.79px 0 1px rgba(255,0,80,0.3), 0 0 3px; }
    10% { text-shadow: 0.03px 0 1px rgba(0,30,255,0.5), -0.03px 0 1px rgba(255,0,80,0.3), 0 0 3px; }
    15% { text-shadow: 0.4px 0 1px rgba(0,30,255,0.5), -0.4px 0 1px rgba(255,0,80,0.3), 0 0 3px; }
    20% { text-shadow: 3.48px 0 1px rgba(0,30,255,0.5), -3.48px 0 1px rgba(255,0,80,0.3), 0 0 3px; }
    25% { text-shadow: 1.61px 0 1px rgba(0,30,255,0.5), -1.61px 0 1px rgba(255,0,80,0.3), 0 0 3px; }
    30% { text-shadow: 0.7px 0 1px rgba(0,30,255,0.5), -0.7px 0 1px rgba(255,0,80,0.3), 0 0 3px; }
    35% { text-shadow: 3.9px 0 1px rgba(0,30,255,0.5), -3.9px 0 1px rgba(255,0,80,0.3), 0 0 3px; }
    40% { text-shadow: 3.87px 0 1px rgba(0,30,255,0.5), -3.87px 0 1px rgba(255,0,80,0.3), 0 0 3px; }
    45% { text-shadow: 2.23px 0 1px rgba(0,30,255,0.5), -2.23px 0 1px rgba(255,0,80,0.3), 0 0 3px; }
    50% { text-shadow: 0.08px 0 1px rgba(0,30,255,0.5), -0.08px 0 1px rgba(255,0,80,0.3), 0 0 3px; }
    55% { text-shadow: 2.38px 0 1px rgba(0,30,255,0.5), -2.38px 0 1px rgba(255,0,80,0.3), 0 0 3px; }
    60% { text-shadow: 2.2px 0 1px rgba(0,30,255,0.5), -2.2px 0 1px rgba(255,0,80,0.3), 0 0 3px; }
    65% { text-shadow: 2.86px 0 1px rgba(0,30,255,0.5), -2.86px 0 1px rgba(255,0,80,0.3), 0 0 3px; }
    70% { text-shadow: 0.49px 0 1px rgba(0,30,255,0.5), -0.49px 0 1px rgba(255,0,80,0.3), 0 0 3px; }
    75% { text-shadow: 1.89px 0 1px rgba(0,30,255,0.5), -1.89px 0 1px rgba(255,0,80,0.3), 0 0 3px; }
    80% { text-shadow: 0.08px 0 1px rgba(0,30,255,0.5), -0.08px 0 1px rgba(255,0,80,0.3), 0 0 3px; }
    85% { text-shadow: 0.1px 0 1px rgba(0,30,255,0.5), -0.1px 0 1px rgba(255,0,80,0.3), 0 0 3px; }
    90% { text-shadow: 3.44px 0 1px rgba(0,30,255,0.5), -3.44px 0 1px rgba(255,0,80,0.3), 0 0 3px; }
    95% { text-shadow: 2.18px 0 1px rgba(0,30,255,0.5), -2.18px 0 1px rgba(255,0,80,0.3), 0 0 3px; }
    100% { text-shadow: 2.62px 0 1px rgba(0,30,255,0.5), -2.62px 0 1px rgba(255,0,80,0.3), 0 0 3px; }
  }

  .effect-ansi-demoscene .vaporvibe-demoscene {
    display: flex;
    flex-wrap: wrap;
    background: rgba(15, 23, 42, 0.06);
    border-color: rgba(56, 189, 248, 0.3);
    box-shadow: inset 0 0 20px rgba(56, 189, 248, 0.15);
  }

  .effect-ansi-demoscene .vaporvibe-status {
    color: #f8fafc;
    text-shadow:
      0 0 6px rgba(8, 47, 73, 0.9),
      0 0 18px rgba(15, 23, 42, 0.75),
      2px 0 2px rgba(255, 0, 80, 0.25),
      -2px 0 2px rgba(0, 30, 255, 0.35);
  }

  .effect-ansi-demoscene .vaporvibe-hint {
    color: rgba(226, 232, 240, 0.92);
    text-shadow: 0 0 10px rgba(2, 6, 23, 0.65);
  }

  .effect-ansi-demoscene .vaporvibe-pulse {
    background: radial-gradient(circle, rgba(56, 189, 248, 0.4), rgba(15, 23, 42, 0));
    box-shadow: 0 0 30px rgba(56, 189, 248, 0.3);
  }

  .effect-ansi-demoscene .crt-terminal {
    animation-play-state: running;
  }

  .effect-ansi-demoscene .demoscene-screen {
    flex: 0 0 auto;
    width: min(320px, 90vw);
    aspect-ratio: 4 / 3;
    animation: demosceneCrtWarp 8s ease-in-out infinite;
    box-shadow: 0 25px 45px rgba(2, 6, 23, 0.6),
      inset 0 0 40px rgba(56, 189, 248, 0.25);
  }

  .effect-ansi-demoscene .demoscene-screen::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 18px;
    background:
      repeating-linear-gradient(
        to bottom,
        rgba(18, 16, 16, 0) 0px,
        rgba(18, 16, 16, 0) 1px,
        rgba(0, 0, 0, 0.6) 1px,
        rgba(0, 0, 0, 0.6) 2px
      ),
      repeating-linear-gradient(
        90deg,
        rgba(255, 0, 0, 0.18) 0px,
        rgba(255, 0, 0, 0.18) 1px,
        rgba(0, 255, 0, 0.12) 1px,
        rgba(0, 255, 0, 0.12) 2px,
        rgba(0, 0, 255, 0.18) 2px,
        rgba(0, 0, 255, 0.18) 3px
      );
    mix-blend-mode: screen;
    opacity: 0.95;
    pointer-events: none;
  }

  .effect-ansi-demoscene .demoscene-screen::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 18px;
    background: rgba(18, 16, 16, 0.12);
    pointer-events: none;
    animation: crtFlicker 0.15s infinite;
    mix-blend-mode: multiply;
  }

  .effect-ansi-demoscene .crt-terminal.crt-terminal--wobble {
    animation: demosceneTextWobble 4.8s ease-in-out infinite,
      crtTextShadow 1.6s linear infinite;
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
    "  .vaporvibe-sidekick { display: none; align-items: center; gap: 12px; margin-top: 12px; padding: 10px 14px; border-radius: 18px; background: rgba(15, 23, 42, 0.04); border: 1px solid rgba(148, 163, 184, 0.35); color: #1e293b; font-size: 0.88rem; line-height: 1.4; }",
    "  .vaporvibe-sidekick p { margin: 0; }",
    "  .vaporvibe-sidekick .possum { position: relative; width: 70px; height: 48px; border-radius: 28px; background: linear-gradient(135deg, #e2e8f0, #cbd5f5); box-shadow: inset -6px -4px 10px rgba(15, 23, 42, 0.15); }",
    "  .possum-face { position: absolute; inset: 8px 8px 12px; border-radius: 22px; background: #f8fafc; display: flex; align-items: center; justify-content: center; gap: 8px; }",
    "  .possum-ear { position: absolute; top: -8px; width: 18px; height: 18px; border-radius: 50%; background: #cbd5f5; box-shadow: inset -3px -2px 4px rgba(15, 23, 42, 0.2); }",
    "  .possum-ear.left { left: 8px; }",
    "  .possum-ear.right { right: 8px; }",
    "  .possum-eye { width: 8px; height: 8px; border-radius: 50%; background: #0f172a; transform-origin: center; }",
    "  .possum-nose { width: 10px; height: 8px; border-radius: 8px; background: #fb7185; }",
    "  .possum-tail { position: absolute; right: -20px; top: 16px; width: 28px; height: 14px; border-radius: 40px; border: 3px solid #c4b5fd; border-left-color: transparent; border-bottom-color: transparent; transform-origin: left center; }",
    "  .vaporvibe-demoscene { display: none; width: 100%; margin-top: 14px; padding: 14px; border-radius: 20px; border: 1px solid rgba(15, 23, 42, 0.08); background: rgba(15, 23, 42, 0.02); color: #0f172a; gap: 16px; align-items: center; }",
    "  .vaporvibe-demoscene .demoscene-screen { position: relative; flex: 0 0 auto; width: min(320px, 92vw); aspect-ratio: 4 / 3; border-radius: 18px; background: #020617; border: 2px solid #38bdf8; box-shadow: 0 12px 30px rgba(2, 6, 23, 0.45); padding: 16px; overflow: hidden; }",
    "  .vaporvibe-demoscene .crt-scanlines { position: absolute; inset: 0; background-image: linear-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px); background-size: 100% 3px; mix-blend-mode: overlay; animation: demosceneScan 4s linear infinite; pointer-events: none; }",
    "  .vaporvibe-demoscene .crt-content { position: relative; z-index: 1; font-family: 'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace; font-size: 0.72rem; line-height: 1.4; color: #e0f2fe; text-align: left; }",
    "  .vaporvibe-demoscene .crt-header { color: #fde047; margin-bottom: 8px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 600; }",
    "  .vaporvibe-demoscene .crt-terminal { margin: 0; white-space: pre-wrap; color: #7dd3fc; text-shadow: 0 0 8px rgba(59, 130, 246, 0.8); overflow: hidden; max-height: 0; }",
    "  .vaporvibe-demoscene .crt-terminal.crt-terminal--typing { animation: demosceneTyping 12s steps(40) 1 forwards; }",
    "  .vaporvibe-demoscene .crt-terminal.crt-terminal--open { max-height: 260px; }",
    "  .vaporvibe-demoscene .crt-terminal.crt-terminal--wobble { animation: demosceneTextWobble 6.5s ease-in-out infinite; }",
    "  .vaporvibe-demoscene .crt-terminal .crt-starfield { color: #c084fc; }",
    "  .vaporvibe-demoscene .crt-terminal .crt-prompt { color: #34d399; }",
    "  .vaporvibe-demoscene .demoscene-controls { display: flex; flex-direction: column; gap: 10px; max-width: 220px; }",
    "  .vaporvibe-demoscene .demoscene-controls p { margin: 0; font-size: 0.85rem; color: #475569; }",
    "  .vaporvibe-demoscene .demoscene-controls button { align-self: flex-start; border-radius: 999px; background: #38bdf8; color: #081229; border: none; padding: 8px 16px; font-weight: 600; font-size: 0.85rem; cursor: pointer; box-shadow: 0 8px 20px rgba(56, 189, 248, 0.35); }",
    "  .vaporvibe-demoscene .demoscene-controls button:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }",
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
    `    <div class="vaporvibe-hint" data-vaporvibe-hint>${DEFAULT_HINT}</div>`,
    '    <div class="vaporvibe-sidekick" aria-hidden="true">',
    '      <div class="possum">',
    '        <div class="possum-ear left"></div>',
    '        <div class="possum-ear right"></div>',
    '        <div class="possum-face">',
    '          <span class="possum-eye left"></span>',
    '          <span class="possum-nose"></span>',
    '          <span class="possum-eye right"></span>',
    "        </div>",
    '        <div class="possum-tail"></div>',
    "      </div>",
    '      <p class="sidekick-line">Debug possum is nibbling latency cables so you do not have to.</p>',
    "    </div>",
    '    <div class="vaporvibe-demoscene" data-demoscene-panel>',
    '      <div class="demoscene-screen">',
    '        <div class="crt-scanlines"></div>',
    '        <div class="crt-content">',
    '          <div class="crt-header">VAPORVIBE ANSI DEMO // µTRACKER</div>',
    '          <pre class="crt-terminal" data-demoscene-terminal>RUN SCENE.EXE\nLOADING ███▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒\n<span class="crt-prompt">vector_dreams()</span> initializing...\n<span class="crt-starfield">✦ · · · ✦  orbit shimmer online</span>\n╔═ demo 0001: cyberscape ═╗\n║ ▓▓▓▓▓▓   ☆     ··       ║\n║ ░░░░░░  /\\/\\     ~~~    ║\n╚═════════════════════════╝\nPRESS [UNMUTE] FOR µTRACKER</pre>',
    "        </div>",
    "      </div>",
    '      <div class="demoscene-controls">',
    "        <p data-demoscene-line>Muted by default so you can keep vibing.</p>",
    '        <button type="button" data-demoscene-audio="toggle">Unmute µTracker</button>',
    "      </div>",
    "    </div>",
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

  const isStatusMessage = (value: unknown): value is StatusMessage => {
    if (!value || typeof value !== "object") return false;
    const record = value as Record<string, unknown>;
    const requiredKeys: (keyof StatusMessage)[] = [
      "id",
      "headline",
      "mood",
      "energy",
      "category",
    ];
    const hasRequired = requiredKeys.every((key) => {
      const raw = record[key as string];
      return typeof raw === "string" && raw.trim().length > 0;
    });
    if (!hasRequired) return false;
    if (
      Object.prototype.hasOwnProperty.call(record, "hint") &&
      record.hint !== undefined &&
      typeof record.hint !== "string"
    ) {
      return false;
    }
    if (
      Object.prototype.hasOwnProperty.call(record, "tags") &&
      record.tags !== undefined
    ) {
      if (!Array.isArray(record.tags)) return false;
      if (!record.tags.every((tag) => typeof tag === "string")) return false;
    }
    return true;
  };

  const globalScope = window as Window & {
    vaporVibeInterceptorAttached?: boolean;
    __vaporVibeStatusMessages?: unknown;
    __vaporvibeOverlayEffects?: NavigationOverlayEffect[];
    vaporvibeOverlayDebug?: {
      show: (options?: { effectId?: string | null; message?: string }) => void;
      hide: () => void;
    };
  };

  const statusMessages: StatusMessage[] = (() => {
    const provided = Array.isArray(globalScope.__vaporVibeStatusMessages)
      ? (globalScope.__vaporVibeStatusMessages as unknown[]).filter(
          (item): item is StatusMessage => isStatusMessage(item)
        )
      : [];
    return provided.length > 0 ? provided : [];
  })();

  const overlayEffectsForExport = overlayEffectsConfig.map((effect) => ({
    id: effect.id,
    label: effect.label,
    intensity: effect.intensity ?? "subtle",
  }));
  globalScope.__vaporvibeOverlayEffects = overlayEffectsForExport;
  try {
    window.dispatchEvent(
      new CustomEvent("vaporvibe:overlay-effects-ready", {
        detail: { effects: overlayEffectsForExport },
      })
    );
  } catch {
    // ignore diagnostics transport failures
  }

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
  const hasDemosceneAudioSupport = Boolean(
    window.AudioContext ||
      (window as WindowWithWebkitAudioContext).webkitAudioContext
  );
  let demosceneAudioContext: AudioContext | null = null;
  let demosceneGainNode: GainNode | null = null;
  let demosceneOscillators: OscillatorNode[] = [];
  let demoscenePatternTimer: number | null = null;
  let demosceneUnmuted = false;
  let demosceneToggleButton: HTMLButtonElement | null = null;
  let demosceneStatusLine: HTMLElement | null = null;
  let demosceneTerminalNode: HTMLElement | null = null;

  function ensureDemosceneAudioNodes(): boolean {
    if (!hasDemosceneAudioSupport) {
      return false;
    }
    if (!demosceneAudioContext) {
      const AudioCtor =
        window.AudioContext ||
        (window as WindowWithWebkitAudioContext).webkitAudioContext;
      if (!AudioCtor) {
        return false;
      }
      demosceneAudioContext = new AudioCtor();
    }
    if (!demosceneGainNode && demosceneAudioContext) {
      demosceneGainNode = demosceneAudioContext.createGain();
      demosceneGainNode.gain.value = 0.08;
      demosceneGainNode.connect(demosceneAudioContext.destination);
    }
    return Boolean(demosceneAudioContext && demosceneGainNode);
  }

  function startDemosceneAudio(): void {
    if (
      !demosceneUnmuted ||
      currentOverlayEffect !== DEMOSCENE_EFFECT_ID ||
      !ensureDemosceneAudioNodes() ||
      !demosceneAudioContext ||
      !demosceneGainNode ||
      demosceneOscillators.length > 0
    ) {
      return;
    }
    try {
      if (typeof demosceneAudioContext.resume === "function") {
        void demosceneAudioContext.resume();
      }
    } catch {
      // ignore resume errors
    }
    const melody = demosceneAudioContext.createOscillator();
    melody.type = "square";
    melody.frequency.setValueAtTime(
      demosceneMelodyPattern[0],
      demosceneAudioContext.currentTime
    );
    const bass = demosceneAudioContext.createOscillator();
    bass.type = "triangle";
    bass.frequency.setValueAtTime(
      demosceneBassPattern[0],
      demosceneAudioContext.currentTime
    );
    melody.connect(demosceneGainNode);
    bass.connect(demosceneGainNode);
    melody.start();
    bass.start();
    demosceneOscillators = [melody, bass];
    let melodyStep = 0;
    let bassStep = 0;
    demoscenePatternTimer = window.setInterval(() => {
      if (!demosceneAudioContext) return;
      const melodyNote =
        demosceneMelodyPattern[melodyStep % demosceneMelodyPattern.length];
      melody.frequency.setValueAtTime(
        melodyNote,
        demosceneAudioContext.currentTime
      );
      const bassNote =
        demosceneBassPattern[bassStep % demosceneBassPattern.length];
      bass.frequency.setValueAtTime(
        bassNote,
        demosceneAudioContext.currentTime
      );
      melodyStep += 1;
      if (melodyStep % 2 === 0) {
        bassStep += 1;
      }
    }, 320);
  }

  function stopDemosceneAudio(): void {
    if (demoscenePatternTimer != null) {
      clearInterval(demoscenePatternTimer);
      demoscenePatternTimer = null;
    }
    if (demosceneOscillators.length > 0) {
      demosceneOscillators.forEach((osc) => {
        try {
          osc.stop();
        } catch {
          // ignore stop failures
        }
        try {
          osc.disconnect();
        } catch {
          // ignore disconnect failures
        }
      });
      demosceneOscillators = [];
    }
  }

  function updateDemosceneUi(): void {
    if (demosceneToggleButton) {
      if (!hasDemosceneAudioSupport) {
        demosceneToggleButton.disabled = true;
        demosceneToggleButton.textContent = "Audio unavailable";
      } else {
        demosceneToggleButton.disabled = false;
        demosceneToggleButton.textContent = demosceneUnmuted
          ? "Mute µTracker"
          : "Unmute µTracker";
      }
    }
    if (demosceneStatusLine) {
      if (!hasDemosceneAudioSupport) {
        demosceneStatusLine.textContent =
          "Your browser skipped WebAudio; imagine crunchy tracker vibes.";
      } else if (
        demosceneUnmuted &&
        currentOverlayEffect === DEMOSCENE_EFFECT_ID
      ) {
        demosceneStatusLine.textContent =
          "µTracker riffing ANSI breakbeats—tap to hush.";
      } else if (demosceneUnmuted) {
        demosceneStatusLine.textContent =
          "Sound armed. Waiting for the next ANSI overlay...";
      } else {
        demosceneStatusLine.textContent =
          "Muted by default so you can keep vibing.";
      }
    }
  }

  function syncDemosceneAudioState(): void {
    if (currentOverlayEffect === DEMOSCENE_EFFECT_ID && demosceneUnmuted) {
      startDemosceneAudio();
    } else {
      stopDemosceneAudio();
    }
    updateDemosceneUi();
  }

  function toggleDemosceneAudioPreference(): void {
    if (!hasDemosceneAudioSupport) return;
    demosceneUnmuted = !demosceneUnmuted;
    syncDemosceneAudioState();
  }

  function clearDemosceneTerminalClasses(): void {
    if (!demosceneTerminalNode) return;
    demosceneTerminalNode.classList.remove(
      "crt-terminal--typing",
      "crt-terminal--open",
      "crt-terminal--wobble"
    );
  }

  function triggerDemosceneTerminalSequence(): void {
    if (!demosceneTerminalNode) return;
    clearDemosceneTerminalClasses();
    // force reflow so the typing animation restarts
    void demosceneTerminalNode.offsetWidth;
    demosceneTerminalNode.classList.add("crt-terminal--typing");
    const onAnimationEnd = () => {
      demosceneTerminalNode?.classList.remove("crt-terminal--typing");
      demosceneTerminalNode?.classList.add(
        "crt-terminal--open",
        "crt-terminal--wobble"
      );
    };
    demosceneTerminalNode.addEventListener("animationend", onAnimationEnd, {
      once: true,
    });
  }

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
    clearDemosceneTerminalClasses();
    currentOverlayEffect = null;
    syncDemosceneAudioState();
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
    syncDemosceneAudioState();

    try {
      console.info("vaporvibe overlay effect", effect.id);
    } catch (error) {
      console.info("vaporvibe overlay effect", effect.id, error);
    }

    if (effect.behavior === "dvdBounce") startDvdAnimation();
    if (effect.id === DEMOSCENE_EFFECT_ID) {
      triggerDemosceneTerminalSequence();
    } else {
      clearDemosceneTerminalClasses();
    }
  }

  function maybeApplyRandomEffect(forceEffectId?: string | null): void {
    if (!overlayEffectsConfig.length) {
      applyOverlayEffectById(null);
      return;
    }

    if (forceEffectId) {
      const forced = overlayEffectsConfig.find(
        (effect) => effect.id === forceEffectId
      );
      applyOverlayEffectById(forced ? forced.id : null);
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
        (overlayEffectsConfig.length > 1 &&
          candidate.id === lastOverlayEffectId)
      ) {
        continue;
      }
      chosen = candidate;
      break;
    }

    if (!chosen) {
      chosen =
        overlayEffectsConfig[
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
    demosceneToggleButton = overlay.querySelector<HTMLButtonElement>(
      '[data-demoscene-audio="toggle"]'
    );
    demosceneStatusLine = overlay.querySelector<HTMLElement>(
      "[data-demoscene-line]"
    );
    demosceneTerminalNode = overlay.querySelector<HTMLElement>(
      "[data-demoscene-terminal]"
    );
    if (demosceneToggleButton) {
      demosceneToggleButton.addEventListener("click", (event) => {
        event.preventDefault();
        toggleDemosceneAudioPreference();
      });
    }
    updateDemosceneUi();
  }

  function shuffleStatuses(messages: StatusMessage[]): StatusMessage[] {
    const scrambled = [...messages];
    for (let i = scrambled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = scrambled[i];
      scrambled[i] = scrambled[j];
      scrambled[j] = temp;
    }
    return scrambled;
  }

  function showOverlay(
    message?: string,
    options?: { effectId?: string | null }
  ): void {
    logDebug("showOverlay", message ?? "<default>");
    if (!overlay || !document.getElementById("vaporvibe-overlay")) {
      createOverlay();
    }
    if (!overlay) return;

    overlay.style.pointerEvents = "auto";
    ensureOverlayMotionNode();
    maybeApplyRandomEffect(options?.effectId ?? null);
    setTimeout(() => {
      if (overlay) overlay.style.opacity = "1";
    }, 10);

    try {
      const base =
        message && message.trim().length > 0
          ? message
          : "Summoning your adaptive canvas…";
      const statuses = shuffleStatuses(statusMessages).map(
        (status) => status.headline
      );
      const queue = [base, ...statuses];

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
      const applyCurrentStatus = () => {
        if (target) {
          target.textContent = queue[idx] ?? base;
        }
      };
      applyCurrentStatus();
      overlayStatusTimeout = window.setTimeout(() => {
        idx = (idx + 1) % queue.length;
        applyCurrentStatus();
        overlayStatusTimeout = null;
      }, 900);
      overlayStatusInterval = window.setInterval(() => {
        idx = (idx + 1) % queue.length;
        applyCurrentStatus();
      }, 3500);
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
    stopDemosceneAudio();
    clearDemosceneTerminalClasses();
    updateDemosceneUi();
  }

  type OverlayDebugPayload = {
    effectId?: string | null;
    message?: string;
  };

  globalScope.vaporvibeOverlayDebug = {
    show: (payload?: OverlayDebugPayload) => {
      const effectId =
        payload && typeof payload.effectId === "string" && payload.effectId
          ? payload.effectId
          : null;
      const message =
        payload && typeof payload.message === "string"
          ? payload.message
          : undefined;
      showOverlay(message, { effectId });
    },
    hide: () => {
      hideOverlay();
    },
  };

  window.addEventListener("vaporvibe:preview-overlay", (event) => {
    const custom =
      event instanceof CustomEvent
        ? (event as CustomEvent<OverlayDebugPayload>)
        : null;
    const detail = custom?.detail;
    const effectId =
      detail && typeof detail.effectId === "string" && detail.effectId
        ? detail.effectId
        : null;
    const message =
      detail && typeof detail.message === "string" ? detail.message : undefined;
    showOverlay(message, { effectId });
  });

  window.addEventListener("vaporvibe:hide-overlay", () => {
    hideOverlay();
  });

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
