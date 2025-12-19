import { LIB_VERSIONS } from './generated-lib-versions.js';

export interface VaporVibeLibrary {
  id: string;
  filename: string;
  description: string;
  tags: string;
  inject: "always" | "on-request";
  version: string;
}

// Helper to get version or fallback
const v = (key: string) => LIB_VERSIONS[key] || 'unknown';

export const VAPORVIBE_LIBRARIES: VaporVibeLibrary[] = [
  // TIER A: CORE & REACTIVITY
  {
    id: "tailwind",
    filename: "tailwind.js",
    description: "Utility CSS framework (Global: automatically applied via classes)",
    tags: '<script src="/libs/tailwind.js"></script>', // Special case: downloaded to root
    inject: "always",
    version: v('tailwind')
  },
  {
    id: "alpine",
    filename: "alpine.js",
    description: "Lightweight reactivity framework (Global: Alpine, x-data attributes)",
    tags: `<script src="/libs/alpinejs/${v('alpinejs')}/alpine.js" defer></script>`,
    inject: "always",
    version: v('alpinejs')
  },

  // TIER B: FONTS
  {
    id: "font-inter",
    filename: "fonts/inter/index.css",
    description: "Inter variable font (CSS: font-family: 'Inter')",
    tags: `<link rel="stylesheet" href="/libs/inter/${v('inter')}/index.css">`,
    inject: "always",
    version: v('inter')
  },
  {
    id: "font-code",
    filename: "fonts/jetbrains/index.css",
    description: "JetBrains Mono typeface (CSS: font-family: 'JetBrains Mono')",
    tags: `<link rel="stylesheet" href="/libs/jetbrains-mono/${v('jetbrains-mono')}/index.css">`,
    inject: "on-request",
    version: v('jetbrains-mono')
  },
  {
    id: "font-retro",
    filename: "fonts/press-start/index.css",
    description: "8-bit inspired Press Start 2P font (CSS: font-family: 'Press Start 2P')",
    tags: `<link rel="stylesheet" href="/libs/press-start-2p/${v('press-start-2p')}/index.css">`,
    inject: "on-request",
    version: v('press-start-2p')
  },
  {
    id: "font-serif",
    filename: "fonts/playfair/index.css",
    description: "Playfair Display serif font (CSS: font-family: 'Playfair Display')",
    tags: `<link rel="stylesheet" href="/libs/playfair-display/${v('playfair-display')}/index.css">`,
    inject: "on-request",
    version: v('playfair-display')
  },
  {
    id: "font-roboto",
    filename: "fonts/roboto/index.css",
    description: "Roboto font (CSS: font-family: 'Roboto')",
    tags: `<link rel="stylesheet" href="/libs/roboto/${v('roboto')}/index.css">`,
    inject: "on-request",
    version: v('roboto')
  },
  {
    id: "font-poppins",
    filename: "fonts/poppins/index.css",
    description: "Poppins font (CSS: font-family: 'Poppins')",
    tags: `<link rel="stylesheet" href="/libs/poppins/${v('poppins')}/index.css">`,
    inject: "on-request",
    version: v('poppins')
  },
  {
    id: "font-fira-code",
    filename: "fonts/fira-code/index.css",
    description: "Fira Code monospace (CSS: font-family: 'Fira Code')",
    tags: `<link rel="stylesheet" href="/libs/fira-code/${v('fira-code')}/index.css">`,
    inject: "on-request",
    version: v('fira-code')
  },

  // TIER C: ASSET HEAVY & COMPLEX
  {
    id: "leaflet",
    filename: "leaflet.js",
    description: "Interactive maps (Global: L - e.g., L.map('id'))",
    tags: `<link rel="stylesheet" href="/libs/leaflet/${v('leaflet')}/leaflet.css">\n<script src="/libs/leaflet/${v('leaflet')}/leaflet.js"></script>`,
    inject: "on-request",
    version: v('leaflet')
  },
  {
    id: "katex",
    filename: "katex.min.js",
    description: "Fast math typesetting (Global: katex - e.g., katex.render())",
    tags: `<link rel="stylesheet" href="/libs/katex/${v('katex')}/katex.min.css">\n<script src="/libs/katex/${v('katex')}/katex.min.js"></script>`,
    inject: "on-request",
    version: v('katex')
  },
  {
    id: "mermaid",
    filename: "mermaid.min.js",
    description: "Diagrams and charts from text (Global: mermaid.initialize())",
    tags: `<script src="/libs/mermaid/${v('mermaid')}/mermaid.min.js"></script>`,
    inject: "on-request",
    version: v('mermaid')
  },

  // TIER D: UI ELEMENTS & ANIMATIONS
  {
    id: "anime",
    filename: "anime.min.js",
    description: "Powerful animation engine (Global: anime.animate({ targets: ... }))",
    tags: `<script src="/libs/animejs/${v('animejs')}/anime.min.js"></script>`,
    inject: "on-request",
    version: v('animejs')
  },
  {
    id: "aos",
    filename: "aos.js",
    description: "Animate On Scroll library (Global: AOS.init())",
    tags: `<link rel="stylesheet" href="/libs/aos/${v('aos')}/aos.css">\n<script src="/libs/aos/${v('aos')}/aos.js"></script>`,
    inject: "on-request",
    version: v('aos')
  },
  {
    id: "bulma",
    filename: "bulma.min.css",
    description: "Modern CSS framework (Usage: class='button is-primary')",
    tags: `<link rel="stylesheet" href="/libs/bulma/${v('bulma')}/bulma.min.css">`,
    inject: "on-request",
    version: v('bulma')
  },
  {
    id: "cleave",
    filename: "cleave.min.js",
    description: "Format input text content (Global: new Cleave(...))",
    tags: '<script src="/libs/cleave/${v(\'cleave\')}/cleave.min.js"></script>',
    inject: "on-request",
    version: v('cleave')
  },
  {
    id: "confetti",
    filename: "confetti.browser.min.js",
    description: "High-performance confetti effects (Global: confetti())",
    tags: `<script src="/libs/canvas-confetti/${v('canvas-confetti')}/confetti.browser.min.js"></script>`,
    inject: "on-request",
    version: v('canvas-confetti')
  },
  {
    id: "driver",
    filename: "driver.min.js",
    description: "Product tours loops (Global: driver.js.driver())",
    tags: `<link rel="stylesheet" href="/libs/driver/${v('driver')}/driver.min.css">\n<script src="/libs/driver/${v('driver')}/driver.min.js"></script>`,
    inject: "on-request",
    version: v('driver')
  },
  {
    id: "hint",
    filename: "hint.min.css",
    description: "CSS-only tooltips (Usage: class='hint--top' aria-label='...')",
    tags: `<link rel="stylesheet" href="/libs/hint/${v('hint')}/hint.min.css">`,
    inject: "on-request",
    version: v('hint')
  },
  {
    id: "hotkeys",
    filename: "hotkeys.min.js",
    description: "Capture keyboard shortcuts (Global: hotkeys('ctrl+a', ...))",
    tags: `<script src="/libs/hotkeys-js/${v('hotkeys-js')}/hotkeys.min.js"></script>`,
    inject: "on-request",
    version: v('hotkeys-js')
  },
  {
    id: "lucide",
    filename: "lucide.min.js",
    description: "Beautiful icons (Global: lucide.createIcons())",
    tags: `<script src="/libs/lucide/${v('lucide')}/lucide.min.js"></script>`,
    inject: "on-request",
    version: v('lucide')
  },
  {
    id: "minidenticons",
    filename: "minidenticons.min.js",
    description: "Tiny SVG identicons (Usage: <minidenticon-svg username='...'></minidenticon-svg>)",
    tags: `<script type="module" src="/libs/minidenticons/${v('minidenticons')}/minidenticons.min.js"></script>`,
    inject: "on-request",
    version: v('minidenticons')
  },
  {
    id: "nes",
    filename: "nes.min.css",
    description: "8-bit/NES inspired CSS framework (Usage: class='nes-btn')",
    tags: `<link rel="stylesheet" href="/libs/nes/${v('nes')}/nes.min.css">`,
    inject: "on-request",
    version: v('nes')
  },
  {
    id: "pico",
    filename: "pico.min.css",
    description: "Minimalist CSS framework (Usage: semantic HTML, no classes needed)",
    tags: `<link rel="stylesheet" href="/libs/picocss-pico/${v('picocss-pico')}/pico.min.css">`,
    inject: "on-request",
    version: v('picocss-pico')
  },
  {
    id: "rellax",
    filename: "rellax.min.js",
    description: "Lightweight parallax library (Global: new Rellax('.cl'))",
    tags: `<script src="/libs/rellax/${v('rellax')}/rellax.min.js"></script>`,
    inject: "on-request",
    version: v('rellax')
  },
  {
    id: "rough-notation",
    filename: "rough-notation.iife.js",
    description: "Hand-drawn highlights (Global: RoughNotation.annotate(...))",
    tags: `<script src="/libs/rough-notation/${v('rough-notation')}/rough-notation.iife.js"></script>`,
    inject: "on-request",
    version: v('rough-notation')
  },
  {
    id: "sortable",
    filename: "sortable.min.js",
    description: "Drag-and-drop sorting (Global: new Sortable(el, ...))",
    tags: `<script src="/libs/sortablejs/${v('sortablejs')}/sortable.min.js"></script>`,
    inject: "on-request",
    version: v('sortablejs')
  },
  {
    id: "swiper",
    filename: "swiper-element.min.js",
    description: "Modern carousel (Usage: <swiper-container>...<swiper-slide>...)",
    tags: `<script src="/libs/swiper/${v('swiper')}/swiper-element.min.js"></script>`,
    inject: "on-request",
    version: v('swiper')
  },
  {
    id: "animate",
    filename: "animate.min.css",
    description: "Cross-browser CSS animations (Usage: class='animate__animated animate__bounce')",
    tags: `<link rel="stylesheet" href="/libs/animate/${v('animate')}/animate.min.css">`,
    inject: "on-request",
    version: v('animate')
  },
  {
    id: "normalize",
    filename: "normalize.min.css",
    description: "Modern CSS reset (Global: applied automatically)",
    tags: `<link rel="stylesheet" href="/libs/normalize/${v('normalize')}/normalize.min.css">`,
    inject: "always",
    version: v('normalize')
  },
  {
    id: "tippy",
    filename: "tippy.min.js",
    description: "Tooltips and popovers (Global: tippy('#id', ...))",
    tags: `<script src="/libs/popperjs-core/${v('popperjs-core')}/popper.min.js"></script>\n<script src="/libs/tippy/${v('tippy')}/tippy.min.js"></script>`,
    inject: "on-request",
    version: v('tippy')
  },
  {
    id: "sweetalert2",
    filename: "sweetalert2.all.min.js",
    description: "Beautiful popups (Global: Swal.fire('Hello!'))",
    tags: `<script src="/libs/sweetalert2/${v('sweetalert2')}/sweetalert2.all.min.js"></script>`,
    inject: "on-request",
    version: v('sweetalert2')
  },
  {
    id: "toastify",
    filename: "toastify.js",
    description: "Toast notifications (Global: Toastify({text: 'Hi'}).showToast())",
    tags: `<link rel="stylesheet" href="/libs/toastify-js/${v('toastify-js')}/toastify.css">\n<script src="/libs/toastify-js/${v('toastify-js')}/toastify.js"></script>`,
    inject: "on-request",
    version: v('toastify-js')
  },
  {
    id: "flatpickr",
    filename: "flatpickr.min.js",
    description: "Datetime picker (Global: flatpickr('#id', {}))",
    tags: `<link rel="stylesheet" href="/libs/flatpickr/${v('flatpickr')}/flatpickr.min.css">\n<script src="/libs/flatpickr/${v('flatpickr')}/flatpickr.min.js"></script>`,
    inject: "on-request",
    version: v('flatpickr')
  },
  {
    id: "hammer",
    filename: "hammer.min.js",
    description: "Touch gestures (Global: new Hammer(el))",
    tags: `<script src="/libs/hammerjs/${v('hammerjs')}/hammer.min.js"></script>`,
    inject: "on-request",
    version: v('hammerjs')
  },
  {
    id: "numeral",
    filename: "numeral.min.js",
    description: "Number formatting (Global: numeral(1000).format('0,0'))",
    tags: `<script src="/libs/numeral/${v('numeral')}/numeral.min.js"></script>`,
    inject: "on-request",
    version: v('numeral')
  },
  {
    id: "filesaver",
    filename: "FileSaver.min.js",
    description: "Client-side file saving (Global: saveAs(blob, 'name'))",
    tags: `<script src="/libs/file-saver/${v('file-saver')}/FileSaver.min.js"></script>`,
    inject: "on-request",
    version: v('file-saver')
  },
  {
    id: "ms",
    filename: "ms.js",
    description: "Millisecond conversion (Global: ms('2 days'))",
    tags: `<script src="/libs/ms/${v('ms')}/ms.js"></script>`,
    inject: "on-request",
    version: v('ms')
  },
  {
    id: "geopattern",
    filename: "geopattern.min.js",
    description: "Generate SVG patterns (Global: GeoPattern.generate('seed').toDataUrl())",
    tags: `<script src="/libs/geopattern/${v('geopattern')}/geopattern.min.js"></script>`,
    inject: "on-request",
    version: v('geopattern')
  },
  {
    id: "typewriter",
    filename: "typewriter.js",
    description: "Typewriter effect (Global: new Typewriter('#id', ...))",
    tags: `<script src="/libs/typewriter-effect/${v('typewriter-effect')}/typewriter.js"></script>`,
    inject: "on-request",
    version: v('typewriter-effect')
  },
  {
    id: "winbox",
    filename: "winbox.bundle.js",
    description: "Window manager (Global: new WinBox('Title', { ... }))",
    tags: `<script src="/libs/winbox/${v('winbox')}/winbox.bundle.min.js"></script>`,
    inject: "on-request",
    version: v('winbox')
  },

  // TIER E: CHARTS / DATA / MEDIA
  {
    id: "chartjs",
    filename: "chart.umd.js",
    description: "Flexible charting (Global: new Chart(ctx, ...))",
    tags: `<script src="/libs/chart/${v('chart')}/chart.umd.js"></script>`,
    inject: "on-request",
    version: v('chart')
  },
  {
    id: "dayjs",
    filename: "dayjs.min.js",
    description: "Date/time library (Global: dayjs())",
    tags: `<script src="/libs/dayjs/${v('dayjs')}/dayjs.min.js"></script>`,
    inject: "on-request",
    version: v('dayjs')
  },
  {
    id: "gridjs",
    filename: "gridjs.umd.js",
    description: "Advanced tables (Global: new gridjs.Grid(...))",
    tags: `<link rel="stylesheet" href="/libs/gridjs/${v('gridjs')}/theme-mermaid.min.css">\n<script src="/libs/gridjs/${v('gridjs')}/gridjs.umd.js"></script>`,
    inject: "on-request",
    version: v('gridjs')
  },
  {
    id: "prism",
    filename: "prism.js",
    description: "Syntax highlighting (Global: Prism.highlightAll())",
    tags: `<link rel="stylesheet" href="/libs/prismjs/${v('prismjs')}/prism-tomorrow.css">\n<script src="/libs/prismjs/${v('prismjs')}/prism.js"></script>`,
    inject: "on-request",
    version: v('prismjs')
  },
  {
    id: "tone",
    filename: "Tone.js",
    description: "Web Audio framework (Global: Tone.Synth, etc.)",
    tags: `<script src="/libs/tone/${v('tone')}/Tone.js"></script>`,
    inject: "on-request",
    version: v('tone')
  },
  {
    id: "three",
    filename: "three.module.js",
    description: "3D graphics engine (ESM required: import * as THREE from '/libs/three.module.js')",
    tags: `<script type="module" src="/libs/three/${v('three')}/three.module.js"></script>`,
    inject: "on-request",
    version: v('three')
  },
  {
    id: "zdog",
    filename: "zdog.dist.min.js",
    description: "Round 3D engine (Global: Zdog)",
    tags: `<script src="/libs/zdog/${v('zdog')}/zdog.dist.min.js"></script>`,
    inject: "on-request",
    version: v('zdog')
  },
  {
    id: "kaboom",
    filename: "kaboom.js",
    description: "Game programming (Global: kaboom())",
    tags: `<script src="/libs/kaboom/${v('kaboom')}/kaboom.js"></script>`,
    inject: "on-request",
    version: v('kaboom')
  },
];
