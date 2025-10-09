export interface NavigationOverlayEffect {
  id: string;
  label: string;
  behavior?: "dvdBounce";
}

export const navigationOverlayEffects: NavigationOverlayEffect[] = [
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

export const navigationOverlayDecorationsMarkup = [
  '  <div class="effect-ornament orbiting-sparks" aria-hidden="true">',
  '    <span class="spark spark-1"></span>',
  '    <span class="spark spark-2"></span>',
  '    <span class="spark spark-3"></span>',
  "  </div>",
].join("\n");

export const navigationOverlayMiniGameMarkup = [
  '      <div class="mini-game" aria-hidden="true">',
  '        <div class="mini-game-court"></div>',
  '        <div class="mini-game-ball"></div>',
  '        <div class="mini-game-paddle left"></div>',
  '        <div class="mini-game-paddle right"></div>',
  "      </div>",
].join("\n");

export const navigationOverlayEffectStyles = String.raw`
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
      opacity: 0.75;
      transform: translate3d(12px, -8px, 22px);
    }
  }

  @keyframes auroraFlow {
    0%, 100% {
      transform: translateX(-40%) skewX(-12deg);
    }
    50% {
      transform: translateX(40%) skewX(-6deg);
    }
  }

  @keyframes mellowWaves {
    0% {
      background-position: 0 0, 0 0;
    }
    100% {
      background-position: 200px 0, -150px 0;
    }
  }

  @keyframes orbit {
    0% {
      transform: rotate(0deg) translateX(var(--radius, 120px));
      opacity: 0;
    }
    10% {
      opacity: 1;
    }
    90% {
      opacity: 1;
    }
    100% {
      transform: rotate(360deg) translateX(var(--radius, 120px));
      opacity: 0;
    }
  }

  @keyframes miniGameBall {
    0% {
      left: 20px;
      top: 12px;
    }
    20% {
      left: calc(100% - 46px);
      top: 8px;
    }
    40% {
      left: calc(100% - 30px);
      top: calc(100% - 32px);
    }
    60% {
      left: 18px;
      top: calc(100% - 20px);
    }
    80% {
      left: calc(50% - 9px);
      top: calc(50% - 8px);
    }
    100% {
      left: 20px;
      top: 12px;
    }
  }

  @keyframes miniPaddleLeft {
    0%, 20% {
      top: calc(50% - 3px);
    }
    40% {
      top: calc(100% - 24px);
    }
    60% {
      top: 12px;
    }
    100% {
      top: calc(50% - 3px);
    }
  }

  @keyframes miniPaddleRight {
    0%, 40% {
      top: 12px;
    }
    60% {
      top: calc(100% - 24px);
    }
    100% {
      top: 14px;
    }
  }

  #serve-llm-overlay.effect-wobble-drop .liquidGlass-wrapper {
    animation: dropMorph 3.4s ease-in-out infinite;
  }

  #serve-llm-overlay.effect-wobble-drop .serve-llm-hint {
    color: rgba(71, 85, 105, 0.78);
  }

  #serve-llm-overlay.effect-breathe .liquidGlass-wrapper {
    animation: breathe 7s ease-in-out infinite;
  }

  #serve-llm-overlay.effect-breathe .serve-llm-hint,
  #serve-llm-overlay.effect-lantern-sway .serve-llm-hint,
  #serve-llm-overlay.effect-parallax-tilt .serve-llm-hint {
    color: rgba(71, 85, 105, 0.82);
  }

  #serve-llm-overlay.effect-spin-cycle .liquidGlass-wrapper {
    animation: spinCycle 5s ease-in-out infinite;
    transform-origin: center;
  }

  #serve-llm-overlay.effect-mini-game .mini-game {
    display: block;
  }

  #serve-llm-overlay.effect-mini-game .serve-llm-hint {
    color: rgba(71, 85, 105, 0.7);
  }

  #serve-llm-overlay.effect-mini-game .serve-llm-pulse {
    animation-duration: 2s;
  }

  #serve-llm-overlay.effect-dvd-bounce {
    justify-content: flex-start;
    align-items: flex-start;
  }

  #serve-llm-overlay.effect-dvd-bounce .liquidGlass-wrapper {
    position: absolute;
    top: 0;
    left: 0;
    box-shadow: 0 18px 38px rgba(15, 23, 42, 0.55), 0 0 24px rgba(59, 130, 246, 0.18);
  }

  #serve-llm-overlay.effect-lantern-sway .liquidGlass-wrapper {
    transform-origin: top center;
    animation: lanternSway 6.6s ease-in-out infinite;
  }

  #serve-llm-overlay.effect-parallax-tilt .serve-llm-stage {
    transform-style: preserve-3d;
    animation: parallaxTilt 8.5s ease-in-out infinite;
  }

  #serve-llm-overlay.effect-parallax-tilt .liquidGlass-shine {
    animation: parallaxGlow 8.5s ease-in-out infinite;
  }

  #serve-llm-overlay.effect-parallax-tilt .serve-llm-spinner {
    animation-duration: 0.9s;
  }

  #serve-llm-overlay.effect-orbiting-sparks .effect-ornament {
    opacity: 1;
  }

  #serve-llm-overlay.effect-orbiting-sparks .orbiting-sparks {
    display: block;
  }

  #serve-llm-overlay.effect-orbiting-sparks .spark {
    animation: orbit var(--duration, 9s) linear infinite;
  }

  #serve-llm-overlay.effect-aurora-sweep .liquidGlass-wrapper::before {
    content: "";
    position: absolute;
    inset: -20% -40%;
    background: linear-gradient(120deg, rgba(59, 130, 246, 0.35), rgba(56, 189, 248, 0.2), rgba(59, 130, 246, 0.35));
    mix-blend-mode: screen;
    filter: blur(40px);
    opacity: 0.55;
    animation: auroraFlow 9s ease-in-out infinite;
  }

  #serve-llm-overlay.effect-aurora-sweep .liquidGlass-wrapper {
    border-color: rgba(148, 197, 253, 0.5);
  }

  #serve-llm-overlay.effect-chill-waves .liquidGlass-wrapper::after {
    content: "";
    position: absolute;
    inset: 0;
    opacity: 0.4;
    background:
      repeating-linear-gradient(90deg, rgba(59, 130, 246, 0.14) 0px, rgba(59, 130, 246, 0.14) 2px, transparent 2px, transparent 22px),
      repeating-linear-gradient(180deg, rgba(99, 102, 241, 0.12) 0px, rgba(99, 102, 241, 0.12) 3px, transparent 3px, transparent 26px);
    mask-image: linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.95) 28%, rgba(0, 0, 0, 0.95) 72%, transparent 100%);
    animation: mellowWaves 9s linear infinite;
  }

  #serve-llm-overlay.effect-chill-waves .liquidGlass-wrapper {
    box-shadow: 0 24px 46px rgba(2, 135, 206, 0.22), 0 8px 18px rgba(15, 23, 42, 0.35);
  }
`;
