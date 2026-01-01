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
    id: "tailwindcss",
    filename: "tailwind.js",
    description: "Tailwind CSS Runtime (Script-based). Required for ANY and ALL Tailwind utility classes (e.g. flex, p-4, items-center), arbitrary values, and responsive variants.",
    tags: `<script src="/libs/tailwind/${v('tailwind')}/tailwind.js"></script>`,
    inject: "on-request",
    version: v('tailwind')
  },
  {
    id: "daisyui",
    filename: "daisyui.css",
    description: "UI framework (Tailwind CSS + Components). Includes STANDARD Tailwind utilities. NOTE: Use classes directly in HTML. Do NOT use @apply with DaisyUI classes in <style> blocks (the runtime cannot see them).",
    tags: `<link rel="stylesheet" href="/libs/daisyui/${v('daisyui')}/daisyui.css">`,
    inject: "on-request",
    version: v('daisyui')
  },
  {
    id: "alpine",
    filename: "alpine.js",
    description: "Lightweight reactivity framework (Global: Alpine, x-data attributes)",
    tags: `<script src="/libs/alpinejs/${v('alpinejs')}/alpine.js" defer></script>`,
    inject: "on-request",
    version: v('alpinejs')
  },
  {
    id: "htmx",
    filename: "htmx.min.js",
    description: "High-power tools for HTML (Usage: hx-get, hx-post). Access AJAX, CSS Transitions, WebSockets and Server Sent Events directly in HTML.",
    tags: `<script src="/libs/htmx.org/${v('htmx.org')}/htmx.min.js"></script>`,
    inject: "on-request",
    version: v('htmx.org')
  },
  {
    id: "hyperscript",
    filename: "hyperscript.min.js",
    description: "A small scripting language for the web (Usage: _='on click...'). Companion to htmx.",
    tags: `<script src="/libs/hyperscript.org/${v('hyperscript.org')}/hyperscript.min.js"></script>`,
    inject: "on-request",
    version: v('hyperscript.org')
  },

  // TIER B: FONTS
  {
    id: "font-inter",
    filename: "fonts/inter/index.css",
    description: "Inter variable font (CSS: font-family: 'Inter')",
    tags: `<link rel="stylesheet" href="/libs/inter/${v('inter')}/index.css">`,
    inject: "on-request",
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
  {
    id: "font-lora",
    filename: "fonts/lora/index.css",
    description: "Lora upscale serif (CSS: font-family: 'Lora')",
    tags: `<link rel="stylesheet" href="/libs/lora/${v('lora')}/index.css">`,
    inject: "on-request",
    version: v('lora')
  },
  {
    id: "font-merriweather",
    filename: "fonts/merriweather/index.css",
    description: "Merriweather serif (CSS: font-family: 'Merriweather')",
    tags: `<link rel="stylesheet" href="/libs/merriweather/${v('merriweather')}/index.css">`,
    inject: "on-request",
    version: v('merriweather')
  },
  {
    id: "font-montserrat",
    filename: "fonts/montserrat/index.css",
    description: "Montserrat modern sans (CSS: font-family: 'Montserrat')",
    tags: `<link rel="stylesheet" href="/libs/montserrat/${v('montserrat')}/index.css">`,
    inject: "on-request",
    version: v('montserrat')
  },
  {
    id: "font-oswald",
    filename: "fonts/oswald/index.css",
    description: "Oswald condensed sans (CSS: font-family: 'Oswald')",
    tags: `<link rel="stylesheet" href="/libs/oswald/${v('oswald')}/index.css">`,
    inject: "on-request",
    version: v('oswald')
  },
  {
    id: "font-raleway",
    filename: "fonts/raleway/index.css",
    description: "Raleway elegant sans (CSS: font-family: 'Raleway')",
    tags: `<link rel="stylesheet" href="/libs/raleway/${v('raleway')}/index.css">`,
    inject: "on-request",
    version: v('raleway')
  },
  {
    id: "font-dm-sans",
    filename: "fonts/dm-sans/index.css",
    description: "DM Sans - modern SaaS body text (CSS: font-family: 'DM Sans')",
    tags: `<link rel="stylesheet" href="/libs/dm-sans/${v('dm-sans')}/index.css">`,
    inject: "on-request",
    version: v('dm-sans')
  },
  {
    id: "font-manrope",
    filename: "fonts/manrope/index.css",
    description: "Manrope - sleek techy headings (CSS: font-family: 'Manrope')",
    tags: `<link rel="stylesheet" href="/libs/manrope/${v('manrope')}/index.css">`,
    inject: "on-request",
    version: v('manrope')
  },
  {
    id: "font-space-grotesk",
    filename: "fonts/space-grotesk/index.css",
    description: "Space Grotesk - futuristic techy headings (CSS: font-family: 'Space Grotesk')",
    tags: `<link rel="stylesheet" href="/libs/space-grotesk/${v('space-grotesk')}/index.css">`,
    inject: "on-request",
    version: v('space-grotesk')
  },
  {
    id: "font-ibm-plex-sans",
    filename: "fonts/ibm-plex-sans/index.css",
    description: "IBM Plex Sans - enterprise / B2B seriousness (CSS: font-family: 'IBM Plex Sans')",
    tags: `<link rel="stylesheet" href="/libs/ibm-plex-sans/${v('ibm-plex-sans')}/index.css">`,
    inject: "on-request",
    version: v('ibm-plex-sans')
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
    description: "Powerful animation engine (Global: anime({ targets: ... }))",
    tags: `<script src="/libs/animejs/${v('animejs')}/anime.min.js"></script>`,
    inject: "on-request",
    version: v('animejs')
  },
  {
    id: "motion",
    filename: "motion.js",
    description: "Motion (Motion One) - Modern Web Animations API wrapper (Global: Motion.animate(...))",
    tags: `<script src="/libs/motion/${v('motion')}/motion.js"></script>`,
    inject: "on-request",
    version: v('motion')
  },
  {
    id: "gsap",
    filename: "gsap.min.js",
    description: "Professional animation library (Global: gsap). Includes ScrollTrigger (Global: ScrollTrigger).",
    tags: `<script src="/libs/gsap/${v('gsap')}/gsap.min.js"></script>\n<script src="/libs/gsap/${v('gsap')}/ScrollTrigger.min.js"></script>`,
    inject: "on-request",
    version: v('gsap')
  },
  {
    id: "lottie",
    filename: "lottie.min.js",
    description: "Render After Effects animations (Global: lottie.loadAnimation(...))",
    tags: `<script src="/libs/lottie-web/${v('lottie-web')}/lottie.min.js"></script>`,
    inject: "on-request",
    version: v('lottie-web')
  },
  {
    id: "formkit-auto-animate",
    filename: "auto-animate.bundle.js",
    description: "Automatic animations (Global: autoAnimate(el))",
    tags: `<script src="/libs/formkit-auto-animate/${v('formkit-auto-animate')}/auto-animate.bundle.js"></script>`,
    inject: "on-request",
    version: v('formkit-auto-animate')
  },
  {
    id: "aos",
    filename: "aos.js",
    description: "Animate On Scroll library (Global: AOS.init()). NOTE: Use 'data-aos' attributes on elements; can be combined with 'animate' library for custom effects.",
    tags: `<link rel="stylesheet" href="/libs/aos/${v('aos')}/aos.css">\n<script src="/libs/aos/${v('aos')}/aos.js"></script>`,
    inject: "on-request",
    version: v('aos')
  },
  {
    id: "bootstrap",
    filename: "bootstrap.min.css",
    description: "Classic Bootstrap 5 (Global: bootstrap). Includes JS bundle + Popper + Bootstrap Icons.",
    tags: `<link rel="stylesheet" href="/libs/bootstrap/${v('bootstrap')}/bootstrap.min.css">\n<link rel="stylesheet" href="/libs/bootstrap-icons/${v('bootstrap-icons')}/bootstrap-icons.css">\n<script src="/libs/bootstrap/${v('bootstrap')}/bootstrap.bundle.min.js"></script>`,
    inject: "on-request",
    version: v('bootstrap')
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
    id: "materialize",
    filename: "materialize.min.css",
    description: "Material Design framework (Global: M.AutoInit()). Includes Material Icons.",
    tags: `<link rel="stylesheet" href="/libs/materialize-css/${v('materialize-css')}/materialize.min.css">\n<link rel="stylesheet" href="/libs/material-icons/${v('material-icons')}/material-icons.css">\n<script src="/libs/materialize-css/${v('materialize-css')}/materialize.min.js"></script>`,
    inject: "on-request",
    version: v('materialize-css')
  },
  {
    id: "spectre",
    filename: "spectre.min.css",
    description: "Lightweight, clean CSS framework.",
    tags: `<link rel="stylesheet" href="/libs/spectre/${v('spectre')}/spectre.min.css">`,
    inject: "on-request",
    version: v('spectre')
  },
  {
    id: "uikit",
    filename: "uikit.min.css",
    description: "Web interface framework (Global: UIkit). Robust components.",
    tags: `<link rel="stylesheet" href="/libs/uikit/${v('uikit')}/uikit.min.css">\n<script src="/libs/uikit/${v('uikit')}/uikit.min.js"></script>\n<script src="/libs/uikit/${v('uikit')}/uikit-icons.min.js"></script>`,
    inject: "on-request",
    version: v('uikit')
  },
  {
    id: "shoelace",
    filename: "shoelace.js",
    description: "Web Component library (Usage: <sl-button>). Framework agnostic.",
    tags: `<link rel="stylesheet" href="/libs/shoelace-style-shoelace/${v('shoelace-style-shoelace')}/themes/light.css">\n<script type="module" src="/libs/shoelace-style-shoelace/${v('shoelace-style-shoelace')}/shoelace-autoloader.js"></script>`,
    inject: "on-request",
    version: v('shoelace-style-shoelace')
  },
  {
    id: "flowbite",
    filename: "flowbite.min.js",
    description: "Tailwind components + interactive JS (Global: initFlowbite()).",
    tags: `<link rel="stylesheet" href="/libs/flowbite/${v('flowbite')}/flowbite.min.css">\n<script src="/libs/flowbite/${v('flowbite')}/flowbite.min.js"></script>`,
    inject: "on-request",
    version: v('flowbite')
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
    id: "font-awesome",
    filename: "fontawesome.min.css",
    description: "Font Awesome Free icons (Usage: <i class='fa-solid fa-house'>). Includes CSS and Webfonts.",
    tags: `<link rel="stylesheet" href="/libs/fortawesome-fontawesome-free/${v('fortawesome-fontawesome-free')}/fontawesome.min.css">`,
    inject: "on-request",
    version: v('fortawesome-fontawesome-free')
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
    description: "Cross-browser CSS animations. NOTE: Usage requires 'animate__animated' class plus an effect class like 'animate__fadeIn' or 'animate__bounce'.",
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
    tags: `<script src="/libs/popperjs-core/${v('popperjs-core')}/popper.min.js"></script>\n<script src="/libs/tippy/${v('tippy')}/tippy.min.js"></script>\n<link rel="stylesheet" href="/libs/tippy/${v('tippy')}/tippy.css">\n<link rel="stylesheet" href="/libs/tippy/${v('tippy')}/animations/shift-away.css">`,
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
    description: "Window manager (Global: new WinBox('Title', { ... })). IMPORTANT: Always specify a 'root' container element to avoid DOM cleanup errors. Add null checks before calling .close() or .resize() on window instances.",
    tags: `<script src="/libs/winbox/${v('winbox')}/winbox.bundle.min.js"></script>`,
    inject: "on-request",
    version: v('winbox')
  },
  {
    id: "lenis",
    filename: "lenis.min.js",
    description: "Smooth scrolling library (Global: new Lenis())",
    tags: `<link rel="stylesheet" href="/libs/lenis/${v('lenis')}/lenis.css">\n<script src="/libs/lenis/${v('lenis')}/lenis.min.js"></script>`,
    inject: "on-request",
    version: v('lenis')
  },
  {
    id: "barba",
    filename: "barba.umd.js",
    description: "Smooth page transitions & SPA routing (Global: barba.init())",
    tags: `<script src="/libs/barba-core/${v('barba-core')}/barba.umd.js"></script>`,
    inject: "on-request",
    version: v('barba-core')
  },
  {
    id: "swup",
    filename: "Swup.umd.js",
    description: "Page transition library (Global: new Swup())",
    tags: `<script src="/libs/swup/${v('swup')}/Swup.umd.js"></script>`,
    inject: "on-request",
    version: v('swup')
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
    id: "cytoscape",
    filename: "cytoscape.min.js",
    description: "Graph theory / network visualization (Global: cytoscape({ ... }))",
    tags: `<script src="/libs/cytoscape/${v('cytoscape')}/cytoscape.min.js"></script>`,
    inject: "on-request",
    version: v('cytoscape')
  },
  {
    id: "echarts",
    filename: "echarts.min.js",
    description: "Powerful visualization library (Global: echarts.init(dom))",
    tags: `<script src="/libs/echarts/${v('echarts')}/echarts.min.js"></script>`,
    inject: "on-request",
    version: v('echarts')
  },
  {
    id: "apexcharts",
    filename: "apexcharts.min.js",
    description: "Modern & interactive charts (Global: new ApexCharts(el, options))",
    tags: `<script src="/libs/apexcharts/${v('apexcharts')}/apexcharts.min.js"></script>`,
    inject: "on-request",
    version: v('apexcharts')
  },
  {
    id: "floating-ui",
    filename: "floating-ui.dom.bundle.js",
    description: "Positioning library for tooltips/popovers (Global: FloatingUIDOM)",
    tags: `<script src="/libs/floating-ui-dom/${v('floating-ui-dom')}/floating-ui.dom.bundle.js"></script>`,
    inject: "on-request",
    version: v('floating-ui-dom')
  },
  {
    id: "editorjs",
    filename: "editorjs.umd.js",
    description: "Block-styled editor (Global: new EditorJS())",
    tags: `<script src="/libs/editorjs-editorjs/${v('editorjs-editorjs')}/editorjs.umd.js"></script>`,
    inject: "on-request",
    version: v('editorjs-editorjs')
  },
  {
    id: "codemirror",
    filename: "codemirror.bundle.js",
    description: "Code editor (Global: CodeMirror.{EditorState, EditorView, basicSetup, ...})",
    tags: `<script src="/libs/codemirror/${v('codemirror')}/codemirror.bundle.js"></script>`,
    inject: "on-request",
    version: v('codemirror')
  },
  {
    id: "uppy",
    filename: "uppy.min.js",
    description: "Modular file uploader (Global: new Uppy.Uppy())",
    tags: `<link rel="stylesheet" href="/libs/uppy/${v('uppy')}/uppy.min.css">\n<script src="/libs/uppy/${v('uppy')}/uppy.min.js"></script>`,
    inject: "on-request",
    version: v('uppy')
  },
  {
    id: "medium-zoom",
    filename: "medium-zoom.min.js",
    description: "Image zooming like Medium (Global: mediumZoom(img))",
    tags: `<script src="/libs/medium-zoom/${v('medium-zoom')}/medium-zoom.min.js"></script>`,
    inject: "on-request",
    version: v('medium-zoom')
  },
  {
    id: "photoswipe",
    filename: "photoswipe.umd.min.js",
    description: "JavaScript image gallery (Global: PhotoSwipe, PhotoSwipeLightbox)",
    tags: `<link rel="stylesheet" href="/libs/photoswipe/${v('photoswipe')}/photoswipe.css">\n<script src="/libs/photoswipe/${v('photoswipe')}/photoswipe.umd.min.js"></script>\n<script src="/libs/photoswipe/${v('photoswipe')}/photoswipe-lightbox.umd.min.js"></script>`,
    inject: "on-request",
    version: v('photoswipe')
  },
  {
    id: "tsparticles",
    filename: "tsparticles.bundle.min.js",
    description: "Particle effects (Global: tsParticles.load(...))",
    tags: `<script src="/libs/tsparticles/${v('tsparticles')}/tsparticles.bundle.min.js"></script>`,
    inject: "on-request",
    version: v('tsparticles')
  },
  {
    id: "vanta",
    filename: "vanta.net.min.js",
    description: "Animated website backgrounds (Waves, Net, etc.)",
    tags: `<script src="/libs/three/${v('three')}/three.min.js"></script>\n<script src="/libs/vanta/${v('vanta')}/vanta.net.min.js"></script>\n<script src="/libs/vanta/${v('vanta')}/vanta.waves.min.js"></script>`,
    inject: "on-request",
    version: v('vanta')
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
    id: "marked",
    filename: "marked.min.js",
    description: "Markdown compiler (Global: marked.parse('**Bold**'))",
    tags: `<script src="/libs/marked/${v('marked')}/marked.min.js"></script>`,
    inject: "on-request",
    version: v('marked')
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
    filename: "three.min.js",
    description: "3D graphics engine (Global: THREE)",
    tags: `<script src="/libs/three/${v('three')}/three.min.js"></script>`,
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
    id: "phaser",
    filename: "phaser.min.js",
    description: "Professional 2D game engine (Global: new Phaser.Game({...})). Stable v3 API.",
    tags: `<script src="/libs/phaser/${v('phaser')}/phaser.min.js"></script>`,
    inject: "on-request",
    version: v('phaser')
  },
];
