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
`;
