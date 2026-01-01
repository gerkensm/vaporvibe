#!/usr/bin/env npx tsx
/**
 * CDN URL Verification Script
 * 
 * Verifies that all local /libs/ paths can be correctly mapped to CDN URLs.
 * Run with: npx tsx scripts/verify-cdn-urls.ts
 */

import { LIB_VERSIONS } from '../src/config/generated-lib-versions.js';

interface LibMapping {
    localPath: string;
    cdnUrl: string;
    status?: 'ok' | 'redirect' | 'error';
    finalUrl?: string;
}

// Build all local paths from the library manifest patterns
const LOCAL_PATHS = [
    // Tailwind (special CDN)
    `/libs/tailwind/${LIB_VERSIONS['tailwind']}/tailwind.js`,

    // DaisyUI
    `/libs/daisyui/${LIB_VERSIONS['daisyui']}/daisyui.css`,

    // Alpine
    `/libs/alpinejs/${LIB_VERSIONS['alpinejs']}/alpine.js`,

    // HTMX
    `/libs/htmx.org/${LIB_VERSIONS['htmx.org']}/htmx.min.js`,

    // Hyperscript
    `/libs/hyperscript.org/${LIB_VERSIONS['hyperscript.org']}/hyperscript.min.js`,

    // Fonts (fontsource)
    `/libs/inter/${LIB_VERSIONS['inter']}/index.css`,
    `/libs/jetbrains-mono/${LIB_VERSIONS['jetbrains-mono']}/index.css`,
    `/libs/press-start-2p/${LIB_VERSIONS['press-start-2p']}/index.css`,
    `/libs/playfair-display/${LIB_VERSIONS['playfair-display']}/index.css`,
    `/libs/roboto/${LIB_VERSIONS['roboto']}/index.css`,
    `/libs/poppins/${LIB_VERSIONS['poppins']}/index.css`,
    `/libs/fira-code/${LIB_VERSIONS['fira-code']}/index.css`,
    `/libs/lora/${LIB_VERSIONS['lora']}/index.css`,
    `/libs/merriweather/${LIB_VERSIONS['merriweather']}/index.css`,
    `/libs/montserrat/${LIB_VERSIONS['montserrat']}/index.css`,
    `/libs/oswald/${LIB_VERSIONS['oswald']}/index.css`,
    `/libs/raleway/${LIB_VERSIONS['raleway']}/index.css`,
    `/libs/dm-sans/${LIB_VERSIONS['dm-sans']}/index.css`,
    `/libs/manrope/${LIB_VERSIONS['manrope']}/index.css`,
    `/libs/space-grotesk/${LIB_VERSIONS['space-grotesk']}/index.css`,
    `/libs/ibm-plex-sans/${LIB_VERSIONS['ibm-plex-sans']}/index.css`,

    // Maps & Diagrams
    `/libs/leaflet/${LIB_VERSIONS['leaflet']}/leaflet.css`,
    `/libs/leaflet/${LIB_VERSIONS['leaflet']}/leaflet.js`,
    `/libs/katex/${LIB_VERSIONS['katex']}/katex.min.css`,
    `/libs/katex/${LIB_VERSIONS['katex']}/katex.min.js`,
    `/libs/mermaid/${LIB_VERSIONS['mermaid']}/mermaid.min.js`,

    // Animation
    `/libs/animejs/${LIB_VERSIONS['animejs']}/anime.min.js`,
    `/libs/aos/${LIB_VERSIONS['aos']}/aos.css`,
    `/libs/aos/${LIB_VERSIONS['aos']}/aos.js`,

    // UI Frameworks
    `/libs/bootstrap/${LIB_VERSIONS['bootstrap']}/bootstrap.min.css`,
    `/libs/bootstrap/${LIB_VERSIONS['bootstrap']}/bootstrap.bundle.min.js`,
    `/libs/bootstrap-icons/${LIB_VERSIONS['bootstrap-icons']}/bootstrap-icons.css`,
    `/libs/bulma/${LIB_VERSIONS['bulma']}/bulma.min.css`,
    `/libs/materialize-css/${LIB_VERSIONS['materialize-css']}/materialize.min.css`,
    `/libs/materialize-css/${LIB_VERSIONS['materialize-css']}/materialize.min.js`,
    `/libs/material-icons/${LIB_VERSIONS['material-icons']}/material-icons.css`,
    `/libs/spectre/${LIB_VERSIONS['spectre']}/spectre.min.css`,
    `/libs/uikit/${LIB_VERSIONS['uikit']}/uikit.min.css`,
    `/libs/uikit/${LIB_VERSIONS['uikit']}/uikit.min.js`,
    `/libs/uikit/${LIB_VERSIONS['uikit']}/uikit-icons.min.js`,
    `/libs/shoelace-style-shoelace/${LIB_VERSIONS['shoelace-style-shoelace']}/themes/light.css`,
    `/libs/shoelace-style-shoelace/${LIB_VERSIONS['shoelace-style-shoelace']}/shoelace-autoloader.js`,
    `/libs/flowbite/${LIB_VERSIONS['flowbite']}/flowbite.min.css`,
    `/libs/flowbite/${LIB_VERSIONS['flowbite']}/flowbite.min.js`,

    // UI Components
    `/libs/cleave/${LIB_VERSIONS['cleave']}/cleave.min.js`,
    `/libs/canvas-confetti/${LIB_VERSIONS['canvas-confetti']}/confetti.browser.min.js`,
    `/libs/driver/${LIB_VERSIONS['driver']}/driver.min.css`,
    `/libs/driver/${LIB_VERSIONS['driver']}/driver.min.js`,
    `/libs/hint/${LIB_VERSIONS['hint']}/hint.min.css`,
    `/libs/hotkeys-js/${LIB_VERSIONS['hotkeys-js']}/hotkeys.min.js`,
    `/libs/lucide/${LIB_VERSIONS['lucide']}/lucide.min.js`,
    `/libs/fortawesome-fontawesome-free/${LIB_VERSIONS['fortawesome-fontawesome-free']}/fontawesome.min.css`,
    `/libs/minidenticons/${LIB_VERSIONS['minidenticons']}/minidenticons.min.js`,
    `/libs/nes/${LIB_VERSIONS['nes']}/nes.min.css`,
    `/libs/picocss-pico/${LIB_VERSIONS['picocss-pico']}/pico.min.css`,
    `/libs/rellax/${LIB_VERSIONS['rellax']}/rellax.min.js`,
    `/libs/rough-notation/${LIB_VERSIONS['rough-notation']}/rough-notation.iife.js`,
    `/libs/sortablejs/${LIB_VERSIONS['sortablejs']}/sortable.min.js`,
    `/libs/swiper/${LIB_VERSIONS['swiper']}/swiper-element.min.js`,
    `/libs/animate/${LIB_VERSIONS['animate']}/animate.min.css`,
    `/libs/normalize/${LIB_VERSIONS['normalize']}/normalize.min.css`,
    `/libs/popperjs-core/${LIB_VERSIONS['popperjs-core']}/popper.min.js`,
    `/libs/tippy/${LIB_VERSIONS['tippy']}/tippy.min.js`,
    `/libs/tippy/${LIB_VERSIONS['tippy']}/tippy.css`,
    `/libs/tippy/${LIB_VERSIONS['tippy']}/animations/shift-away.css`,
    `/libs/sweetalert2/${LIB_VERSIONS['sweetalert2']}/sweetalert2.all.min.js`,
    `/libs/toastify-js/${LIB_VERSIONS['toastify-js']}/toastify.css`,
    `/libs/toastify-js/${LIB_VERSIONS['toastify-js']}/toastify.js`,
    `/libs/flatpickr/${LIB_VERSIONS['flatpickr']}/flatpickr.min.css`,
    `/libs/flatpickr/${LIB_VERSIONS['flatpickr']}/flatpickr.min.js`,
    `/libs/hammerjs/${LIB_VERSIONS['hammerjs']}/hammer.min.js`,
    `/libs/numeral/${LIB_VERSIONS['numeral']}/numeral.min.js`,
    `/libs/file-saver/${LIB_VERSIONS['file-saver']}/FileSaver.min.js`,
    `/libs/ms/${LIB_VERSIONS['ms']}/ms.js`,
    `/libs/geopattern/${LIB_VERSIONS['geopattern']}/geopattern.min.js`,
    `/libs/typewriter-effect/${LIB_VERSIONS['typewriter-effect']}/typewriter.js`,
    `/libs/winbox/${LIB_VERSIONS['winbox']}/winbox.bundle.min.js`,

    // Charts & Data
    `/libs/chart/${LIB_VERSIONS['chart']}/chart.umd.js`,
    `/libs/dayjs/${LIB_VERSIONS['dayjs']}/dayjs.min.js`,
    `/libs/gridjs/${LIB_VERSIONS['gridjs']}/theme-mermaid.min.css`,
    `/libs/gridjs/${LIB_VERSIONS['gridjs']}/gridjs.umd.js`,
    `/libs/prismjs/${LIB_VERSIONS['prismjs']}/prism-tomorrow.css`,
    `/libs/prismjs/${LIB_VERSIONS['prismjs']}/prism.js`,
    `/libs/marked/${LIB_VERSIONS['marked']}/marked.min.js`,
    `/libs/tone/${LIB_VERSIONS['tone']}/Tone.js`,
    `/libs/three/${LIB_VERSIONS['three']}/three.module.js`,
    `/libs/zdog/${LIB_VERSIONS['zdog']}/zdog.dist.min.js`,
    `/libs/phaser/${LIB_VERSIONS['phaser']}/phaser.min.js`,
    `/libs/gsap/${LIB_VERSIONS['gsap']}/gsap.min.js`,
    `/libs/gsap/${LIB_VERSIONS['gsap']}/ScrollTrigger.min.js`,
    `/libs/motion/${LIB_VERSIONS['motion']}/motion.js`,
    `/libs/lottie-web/${LIB_VERSIONS['lottie-web']}/lottie.min.js`,
    `/libs/formkit-auto-animate/${LIB_VERSIONS['formkit-auto-animate']}/auto-animate.bundle.js`,
    `/libs/lenis/${LIB_VERSIONS['lenis']}/lenis.min.js`,
    `/libs/lenis/${LIB_VERSIONS['lenis']}/lenis.css`,
    `/libs/barba-core/${LIB_VERSIONS['barba-core']}/barba.umd.js`,
    `/libs/swup/${LIB_VERSIONS['swup']}/Swup.umd.js`,
    `/libs/cytoscape/${LIB_VERSIONS['cytoscape']}/cytoscape.min.js`,
    `/libs/echarts/${LIB_VERSIONS['echarts']}/echarts.min.js`,
    `/libs/apexcharts/${LIB_VERSIONS['apexcharts']}/apexcharts.min.js`,
    `/libs/floating-ui-dom/${LIB_VERSIONS['floating-ui-dom']}/floating-ui.dom.umd.min.js`,
    `/libs/editorjs-editorjs/${LIB_VERSIONS['editorjs-editorjs']}/editorjs.umd.js`,
    `/libs/editorjs-header/${LIB_VERSIONS['editorjs-header']}/editorjs-header.js`,
    `/libs/editorjs-list/${LIB_VERSIONS['editorjs-list']}/editorjs-list.js`,
    `/libs/editorjs-checklist/${LIB_VERSIONS['editorjs-checklist']}/editorjs-checklist.js`,
    `/libs/editorjs-quote/${LIB_VERSIONS['editorjs-quote']}/editorjs-quote.js`,
    `/libs/editorjs-code/${LIB_VERSIONS['editorjs-code']}/editorjs-code.js`,
    `/libs/editorjs-delimiter/${LIB_VERSIONS['editorjs-delimiter']}/editorjs-delimiter.js`,
    `/libs/editorjs-inline-code/${LIB_VERSIONS['editorjs-inline-code']}/editorjs-inline-code.js`,
    `/libs/editorjs-marker/${LIB_VERSIONS['editorjs-marker']}/editorjs-marker.js`,
    `/libs/editorjs-table/${LIB_VERSIONS['editorjs-table']}/editorjs-table.js`,
    `/libs/editorjs-embed/${LIB_VERSIONS['editorjs-embed']}/editorjs-embed.js`,
    `/libs/editorjs-warning/${LIB_VERSIONS['editorjs-warning']}/editorjs-warning.js`,
    `/libs/editorjs-link/${LIB_VERSIONS['editorjs-link']}/editorjs-link.js`,
    `/libs/editorjs-raw/${LIB_VERSIONS['editorjs-raw']}/editorjs-raw.js`,
    `/libs/editorjs-simple-image/${LIB_VERSIONS['editorjs-simple-image']}/editorjs-simple-image.js`,
    `/libs/editorjs-image/${LIB_VERSIONS['editorjs-image']}/editorjs-image.js`,
    `/libs/editorjs-attaches/${LIB_VERSIONS['editorjs-attaches']}/editorjs-attaches.js`,
    `/libs/editorjs-personality/${LIB_VERSIONS['editorjs-personality']}/editorjs-personality.js`,
    `/libs/uppy/${LIB_VERSIONS['uppy']}/uppy.min.js`,
    `/libs/uppy/${LIB_VERSIONS['uppy']}/uppy.min.css`,
    `/libs/medium-zoom/${LIB_VERSIONS['medium-zoom']}/medium-zoom.min.js`,
    `/libs/photoswipe/${LIB_VERSIONS['photoswipe']}/photoswipe.umd.min.js`,
    `/libs/photoswipe/${LIB_VERSIONS['photoswipe']}/photoswipe-lightbox.umd.min.js`,
    `/libs/photoswipe/${LIB_VERSIONS['photoswipe']}/photoswipe.css`,
    `/libs/tsparticles/${LIB_VERSIONS['tsparticles']}/tsparticles.bundle.min.js`,
    `/libs/vanta/${LIB_VERSIONS['vanta']}/vanta.net.min.js`,
    `/libs/vanta/${LIB_VERSIONS['vanta']}/vanta.waves.min.js`, // Checking another one just in case
];

// Import the transform function to test
import { localLibPathToCdn } from '../src/utils/html-export-transform.js';

async function checkUrl(url: string): Promise<{ status: 'ok' | 'redirect' | 'error'; finalUrl?: string; statusCode?: number }> {
    try {
        const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
        if (response.ok) {
            return { status: 'ok', finalUrl: response.url, statusCode: response.status };
        }
        return { status: 'error', statusCode: response.status };
    } catch (error) {
        return { status: 'error' };
    }
}

async function main() {
    console.log('🔍 Verifying CDN URLs for HTML export...\n');

    const results: LibMapping[] = [];
    const errors: LibMapping[] = [];

    for (const localPath of LOCAL_PATHS) {
        const cdnUrl = localLibPathToCdn(localPath);

        if (!cdnUrl) {
            console.log(`❌ No CDN mapping for: ${localPath}`);
            errors.push({ localPath, cdnUrl: 'N/A' });
            continue;
        }

        const result = await checkUrl(cdnUrl);
        const mapping: LibMapping = {
            localPath,
            cdnUrl,
            status: result.status,
            finalUrl: result.finalUrl,
        };

        if (result.status === 'ok') {
            console.log(`✅ ${localPath.split('/')[2]} → ${result.status}`);
        } else {
            console.log(`❌ FAIL: ${localPath}`);
            console.log(`   URL: ${cdnUrl}`);
            console.log(`   Status: ${result.statusCode || 'network error'}`);
            errors.push(mapping);
        }

        results.push(mapping);

        // Rate limit to avoid hammering the CDN
        await new Promise(r => setTimeout(r, 100));
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 Results: ${results.length - errors.length}/${results.length} URLs valid`);

    if (errors.length > 0) {
        console.log('\n❌ Failed URLs:');
        for (const err of errors) {
            console.log(`  - ${err.localPath}`);
            console.log(`    → ${err.cdnUrl}`);
        }
    }
}

main().catch(console.error);
