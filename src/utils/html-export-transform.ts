/**
 * HTML Export Transform Utilities
 *
 * Transforms LLM-generated HTML for standalone export by:
 * 1. Replacing local /libs/ paths with CDN URLs
 * 2. Replacing <ai-image> custom elements with embedded data URL images
 */

import { getGeneratedImagePath } from "../image-gen/paths.js";
import type { GeneratedImage } from "../types.js";

/**
 * CDN URL mappings for libraries that need special handling.
 * Maps local package directory name to a function that produces the CDN URL.
 * 
 * Format: (version, filePath) => full CDN URL
 */
const SPECIAL_CDN_MAPPINGS: Record<string, (version: string, file: string) => string> = {
    // Tailwind uses its own CDN
    tailwind: (version) => `https://cdn.tailwindcss.com/${version}`,

    // Libraries with /dist/ prefix
    daisyui: (v, f) => `https://cdn.jsdelivr.net/npm/daisyui@${v}/dist/full.css`,
    alpinejs: (v) => `https://cdn.jsdelivr.net/npm/alpinejs@${v}/dist/cdn.min.js`,
    lucide: (v, f) => `https://cdn.jsdelivr.net/npm/lucide@${v}/dist/umd/${f}`,
    leaflet: (v, f) => `https://cdn.jsdelivr.net/npm/leaflet@${v}/dist/${f}`,
    katex: (v, f) => `https://cdn.jsdelivr.net/npm/katex@${v}/dist/${f}`,
    mermaid: (v, f) => `https://cdn.jsdelivr.net/npm/mermaid@${v}/dist/${f}`,
    animejs: (v) => `https://cdn.jsdelivr.net/npm/animejs@${v}/lib/anime.min.js`,
    aos: (v, f) => `https://cdn.jsdelivr.net/npm/aos@${v}/dist/${f}`,
    bootstrap: (v, f) => `https://cdn.jsdelivr.net/npm/bootstrap@${v}/dist/${f.includes('.css') ? 'css' : 'js'}/${f}`,
    // Bootstrap Icons CSS uses expanded version, not minified
    "bootstrap-icons": (v, f) => {
        if (f === 'bootstrap-icons.css') {
            return `https://cdn.jsdelivr.net/npm/bootstrap-icons@${v}/font/bootstrap-icons.css`;
        }
        return `https://cdn.jsdelivr.net/npm/bootstrap-icons@${v}/font/${f}`;
    },
    bulma: (v, f) => `https://cdn.jsdelivr.net/npm/bulma@${v}/css/${f}`,
    "materialize-css": (v, f) => `https://cdn.jsdelivr.net/npm/materialize-css@${v}/dist/${f.includes('.css') ? 'css' : 'js'}/${f}`,
    spectre: (v, f) => `https://cdn.jsdelivr.net/npm/spectre.css@${v}/dist/${f}`,
    uikit: (v, f) => `https://cdn.jsdelivr.net/npm/uikit@${v}/dist/${f.includes('.css') ? 'css' : 'js'}/${f}`,
    flowbite: (v, f) => `https://cdn.jsdelivr.net/npm/flowbite@${v}/dist/${f}`,
    cleave: (v, f) => `https://cdn.jsdelivr.net/npm/cleave.js@${v}/dist/${f}`,
    // canvas-confetti browser minified version
    "canvas-confetti": (v, f) => f.includes('browser')
        ? `https://cdn.jsdelivr.net/npm/canvas-confetti@${v}/dist/${f}`
        : `https://cdn.jsdelivr.net/npm/canvas-confetti@${v}/dist/confetti.browser.min.js`,
    driver: (v, f) => f.includes('.css')
        ? `https://cdn.jsdelivr.net/npm/driver.js@${v}/dist/${f}`
        : `https://cdn.jsdelivr.net/npm/driver.js@${v}/dist/driver.js.iife.js`,
    hint: (v, f) => `https://cdn.jsdelivr.net/npm/hint.css@${v}/${f}`,
    "hotkeys-js": (v, f) => `https://cdn.jsdelivr.net/npm/hotkeys-js@${v}/dist/${f.replace('hotkeys.min.js', 'hotkeys-js.min.js')}`,
    minidenticons: (v, f) => `https://cdn.jsdelivr.net/npm/minidenticons@${v}/${f}`,
    nes: (v, f) => `https://cdn.jsdelivr.net/npm/nes.css@${v}/css/${f}`,
    rellax: (v, f) => `https://cdn.jsdelivr.net/npm/rellax@${v}/${f}`,
    "rough-notation": (v, f) => `https://cdn.jsdelivr.net/npm/rough-notation@${v}/lib/${f}`,
    sortablejs: (v) => `https://cdn.jsdelivr.net/npm/sortablejs@${v}/Sortable.min.js`,
    // swiper element bundle
    swiper: (v, f) => f.includes('swiper-element')
        ? `https://cdn.jsdelivr.net/npm/swiper@${v}/swiper-element-bundle.min.js`
        : `https://cdn.jsdelivr.net/npm/swiper@${v}/${f}`,
    animate: (v, f) => `https://cdn.jsdelivr.net/npm/animate.css@${v}/${f}`,
    normalize: (v, f) => `https://cdn.jsdelivr.net/npm/normalize.css@${v}/${f}`,
    "popperjs-core": (v, f) => `https://cdn.jsdelivr.net/npm/@popperjs/core@${v}/dist/umd/${f}`,
    tippy: (v, f) => {
        // tippy.js uses tippy-bundle.umd.min.js for the main file
        if (f === 'tippy.min.js') {
            return `https://cdn.jsdelivr.net/npm/tippy.js@${v}/dist/tippy-bundle.umd.min.js`;
        }
        // CSS files are in /dist/ (no .min version for tippy.css)
        if (f === 'tippy.css') {
            return `https://cdn.jsdelivr.net/npm/tippy.js@${v}/dist/tippy.css`;
        }
        return `https://cdn.jsdelivr.net/npm/tippy.js@${v}/${f}`;
    },
    sweetalert2: (v, f) => `https://cdn.jsdelivr.net/npm/sweetalert2@${v}/dist/${f}`,
    "toastify-js": (v, f) => `https://cdn.jsdelivr.net/npm/toastify-js@${v}/src/${f}`,
    flatpickr: (v, f) => `https://cdn.jsdelivr.net/npm/flatpickr@${v}/dist/${f}`,
    hammerjs: (v, f) => `https://cdn.jsdelivr.net/npm/hammerjs@${v}/${f}`,
    numeral: (v, f) => `https://cdn.jsdelivr.net/npm/numeral@${v}/min/${f}`,
    "file-saver": (v, f) => `https://cdn.jsdelivr.net/npm/file-saver@${v}/dist/${f}`,
    ms: (v, f) => `https://cdn.jsdelivr.net/npm/ms@${v}/index.js`,
    "typewriter-effect": (v) => `https://cdn.jsdelivr.net/npm/typewriter-effect@${v}/dist/core.js`,
    winbox: (v, f) => `https://cdn.jsdelivr.net/npm/winbox@${v}/dist/${f}`,
    chart: (v, f) => `https://cdn.jsdelivr.net/npm/chart.js@${v}/dist/${f}`,
    dayjs: (v, f) => `https://cdn.jsdelivr.net/npm/dayjs@${v}/${f}`,
    gridjs: (v, f) => {
        // Theme files use different naming: theme-mermaid.min.css → mermaid.css
        if (f.startsWith('theme-') && f.endsWith('.min.css')) {
            const themeName = f.replace('theme-', '').replace('.min.css', '.css');
            return `https://cdn.jsdelivr.net/npm/gridjs@${v}/dist/theme/${themeName}`;
        }
        return `https://cdn.jsdelivr.net/npm/gridjs@${v}/dist/${f}`;
    },
    prismjs: (v, f) => f.includes('.css')
        ? `https://cdn.jsdelivr.net/npm/prismjs@${v}/themes/${f}`
        : `https://cdn.jsdelivr.net/npm/prismjs@${v}/${f}`,
    marked: (v, f) => `https://cdn.jsdelivr.net/npm/marked@${v}/lib/${f.replace('.min.js', '.umd.js')}`,
    tone: (v, f) => `https://cdn.jsdelivr.net/npm/tone@${v}/build/${f}`,
    three: (v, f) => `https://cdn.jsdelivr.net/npm/three@${v}/build/${f}`,
    zdog: (v, f) => `https://cdn.jsdelivr.net/npm/zdog@${v}/dist/${f}`,
    phaser: (v, f) => `https://cdn.jsdelivr.net/npm/phaser@${v}/dist/${f}`,

    // Fontsource fonts use @fontsource/ scope
    inter: (v, f) => `https://cdn.jsdelivr.net/npm/@fontsource/inter@${v}/${f}`,
    "jetbrains-mono": (v, f) => `https://cdn.jsdelivr.net/npm/@fontsource/jetbrains-mono@${v}/${f}`,
    "press-start-2p": (v, f) => `https://cdn.jsdelivr.net/npm/@fontsource/press-start-2p@${v}/${f}`,
    "playfair-display": (v, f) => `https://cdn.jsdelivr.net/npm/@fontsource/playfair-display@${v}/${f}`,
    roboto: (v, f) => `https://cdn.jsdelivr.net/npm/@fontsource/roboto@${v}/${f}`,
    poppins: (v, f) => `https://cdn.jsdelivr.net/npm/@fontsource/poppins@${v}/${f}`,
    "fira-code": (v, f) => `https://cdn.jsdelivr.net/npm/@fontsource/fira-code@${v}/${f}`,
    lora: (v, f) => `https://cdn.jsdelivr.net/npm/@fontsource/lora@${v}/${f}`,
    merriweather: (v, f) => `https://cdn.jsdelivr.net/npm/@fontsource/merriweather@${v}/${f}`,
    montserrat: (v, f) => `https://cdn.jsdelivr.net/npm/@fontsource/montserrat@${v}/${f}`,
    oswald: (v, f) => `https://cdn.jsdelivr.net/npm/@fontsource/oswald@${v}/${f}`,
    raleway: (v, f) => `https://cdn.jsdelivr.net/npm/@fontsource/raleway@${v}/${f}`,
    "dm-sans": (v, f) => `https://cdn.jsdelivr.net/npm/@fontsource/dm-sans@${v}/${f}`,
    manrope: (v, f) => `https://cdn.jsdelivr.net/npm/@fontsource/manrope@${v}/${f}`,
    "space-grotesk": (v, f) => `https://cdn.jsdelivr.net/npm/@fontsource/space-grotesk@${v}/${f}`,
    "ibm-plex-sans": (v, f) => `https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-sans@${v}/${f}`,

    // Other scoped packages 
    "material-icons": (v, f) => `https://cdn.jsdelivr.net/npm/material-icons@${v}/iconfont/${f}`,

    // htmx and hyperscript
    "htmx.org": (v, f) => `https://cdn.jsdelivr.net/npm/htmx.org@${v}/dist/${f}`,
    "hyperscript.org": (v, f) => f.includes('hyperscript') ? `https://cdn.jsdelivr.net/npm/hyperscript.org@${v}/dist/_${f}` : `https://cdn.jsdelivr.net/npm/hyperscript.org@${v}/dist/${f}`,

    // Shoelace uses /cdn/ path
    "shoelace-style-shoelace": (v, f) => `https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@${v}/cdn/${f}`,

    // FontAwesome: CSS files need /css/ prefix on CDN
    "fortawesome-fontawesome-free": (v, f) => {
        // If file already has css/ prefix (like css/all.min.css), use as-is
        // Otherwise, add css/ prefix for CSS files (like fontawesome.min.css)
        if (f.endsWith('.css') && !f.startsWith('css/')) {
            return `https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@${v}/css/${f}`;
        }
        // Files like "css/all.min.css" or webfonts already have correct paths
        return `https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@${v}/${f}`;
    },

    // Pico CSS uses /css/ subdirectory
    "picocss-pico": (v, f) => `https://cdn.jsdelivr.net/npm/@picocss/pico@${v}/css/${f}`,

    // Lit ecosystem (scoped packages)
    "@lit": (v, f) => `https://cdn.jsdelivr.net/npm/@lit/reactive-element@${v}/${f}`,
    "lit": (v, f) => `https://cdn.jsdelivr.net/npm/lit@${v}/${f}`,
    "lit-element": (v, f) => `https://cdn.jsdelivr.net/npm/lit-element@${v}/${f}`,
    "lit-html": (v, f) => `https://cdn.jsdelivr.net/npm/lit-html@${v}/${f}`,
};

/**
 * Maps a local /libs/ path to its CDN equivalent.
 *
 * Standard pattern: /libs/{package}/{version}/{file}
 * CDN pattern varies by library - see SPECIAL_CDN_MAPPINGS
 */
export function localLibPathToCdn(localPath: string): string | null {
    // Match /libs/{package}/{version}/{rest...}
    const match = localPath.match(/^\/libs\/([^/]+)\/([^/]+)\/(.+)$/);
    if (!match) {
        return null;
    }

    const [, packageName, version, filePath] = match;

    // Check for special CDN mappings (most libraries need this)
    if (SPECIAL_CDN_MAPPINGS[packageName]) {
        return SPECIAL_CDN_MAPPINGS[packageName](version, filePath);
    }

    // Convert package name back to npm format for remaining packages
    const npmPackage = packageNameToNpm(packageName);

    // Default: use jsdelivr with the file at root (rarely works, most use /dist/)
    return `https://cdn.jsdelivr.net/npm/${npmPackage}@${version}/${filePath}`;
}

/**
 * Converts directory-safe package names back to npm package names.
 * e.g., "fortawesome-fontawesome-free" -> "@fortawesome/fontawesome-free"
 */
function packageNameToNpm(dirName: string): string {
    // Check known scoped packages
    const scopedPrefixes: Record<string, string> = {
        "fortawesome-": "@fortawesome/",
        "picocss-": "@picocss/",
        "popperjs-": "@popperjs/",
        "shoelace-style-": "@shoelace-style/",
        "fontsource-": "@fontsource/",
    };

    for (const [prefix, scope] of Object.entries(scopedPrefixes)) {
        if (dirName.startsWith(prefix)) {
            return scope + dirName.slice(prefix.length);
        }
    }

    return dirName;
}

/**
 * Replaces all local /libs/ references in HTML with CDN equivalents.
 */
export function transformLocalLibsToCdn(html: string): string {
    // Match src="..." and href="..." attributes containing /libs/
    return html.replace(
        /((?:src|href)\s*=\s*["'])(\/libs\/[^"']+)(["'])/gi,
        (match, prefix, libPath, suffix) => {
            const cdnUrl = localLibPathToCdn(libPath);
            if (cdnUrl) {
                return `${prefix}${cdnUrl}${suffix}`;
            }
            return match;
        }
    );
}

/**
 * Replaces /generated-images/ URLs with data URLs using cached image data.
 */
export function transformGeneratedImagesToDataUrls(
    html: string,
    generatedImages?: GeneratedImage[]
): string {
    if (!generatedImages || generatedImages.length === 0) {
        return html;
    }

    // Build a map of route -> GeneratedImage for fast lookup
    const imagesByRoute = new Map<string, GeneratedImage>();
    for (const img of generatedImages) {
        if (img.url) {
            imagesByRoute.set(img.url, img);
        }
        // Also map by cache key route pattern
        const { route } = getGeneratedImagePath(img.cacheKey);
        imagesByRoute.set(route, img);
    }

    // Replace /generated-images/... URLs in src attributes with data URLs
    return html.replace(
        /(src\s*=\s*["'])(\/generated-images\/[^"']+)(["'])/gi,
        (match, prefix, imagePath, suffix) => {
            const image = imagesByRoute.get(imagePath);
            if (image?.base64) {
                const mimeType = image.mimeType || "image/png";
                return `${prefix}data:${mimeType};base64,${image.base64}${suffix}`;
            }
            return match;
        }
    );
}

/**
 * Transforms <ai-image> custom elements into standard <img> tags with data URLs.
 *
 * Input: <ai-image prompt="A sunset" ratio="16:9" class="hero">
 * Output: <img src="data:image/png;base64,..." alt="A sunset" class="hero">
 */
export function transformAiImagesToDataUrls(
    html: string,
    generatedImages?: GeneratedImage[]
): string {
    if (!generatedImages || generatedImages.length === 0) {
        return html;
    }

    // Build a map of prompt -> GeneratedImage for matching
    const imagesByPrompt = new Map<string, GeneratedImage>();
    for (const img of generatedImages) {
        if (img.prompt && img.base64) {
            // Use lowercase normalized prompt for matching
            imagesByPrompt.set(img.prompt.toLowerCase().trim(), img);
        }
    }

    // Match <ai-image ...> tags (self-closing or not)
    return html.replace(
        /<ai-image\s+([^>]*?)\/?>|<ai-image\s+([^>]*)>[^<]*<\/ai-image>/gi,
        (match, attrs1, attrs2) => {
            const attributesStr = attrs1 || attrs2 || "";
            // Parse attributes
            const attributes = parseAttributes(attributesStr);
            const prompt = attributes.prompt || attributes["data-prompt"] || "";

            if (!prompt) {
                return match; // Keep original if no prompt
            }

            // Find matching image
            const image = imagesByPrompt.get(prompt.toLowerCase().trim());
            if (!image || !image.base64) {
                return match; // Keep original if no cached image found
            }

            // Build <img> tag
            const mimeType = image.mimeType || "image/png";
            const dataUrl = `data:${mimeType};base64,${image.base64}`;

            // Transfer relevant attributes
            const imgAttrs: string[] = [`src="${dataUrl}"`];

            // Use prompt as alt text
            imgAttrs.push(`alt="${escapeHtmlAttr(prompt)}"`);

            // Copy over other attributes (except prompt, ratio, data-prompt)
            const skipAttrs = new Set(["prompt", "ratio", "data-prompt"]);
            for (const [key, value] of Object.entries(attributes)) {
                if (!skipAttrs.has(key.toLowerCase())) {
                    imgAttrs.push(`${key}="${escapeHtmlAttr(value)}"`);
                }
            }

            return `<img ${imgAttrs.join(" ")}>`;
        }
    );
}

/**
 * Parses HTML attributes from a string into a key-value object.
 */
function parseAttributes(attrStr: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    // Match attribute="value" or attribute='value' or attribute=value or just attribute
    const attrRegex = /([a-z_-][a-z0-9_-]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/gi;

    let match;
    while ((match = attrRegex.exec(attrStr)) !== null) {
        const [, name, doubleQuoted, singleQuoted, unquoted] = match;
        attrs[name.toLowerCase()] = doubleQuoted ?? singleQuoted ?? unquoted ?? "";
    }

    return attrs;
}

/**
 * Escapes a string for use in an HTML attribute value.
 */
function escapeHtmlAttr(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

/**
 * Prepares HTML for standalone export by applying all transformations.
 */
export function prepareHtmlForExport(
    html: string,
    generatedImages?: GeneratedImage[]
): string {
    let result = html;

    // Handle legacy driver.js inclusion that omits versioned paths
    result = result.replace(
        /<script src="\/libs\/driver\.js"><\/script>/g,
        '<script src="https://cdn.jsdelivr.net/npm/driver.js@1.0.1/dist/driver.js.iife.js"></script><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/driver.js@1.0.1/dist/driver.css" />'
    );

    // 1. Replace local /libs/ paths with CDN URLs
    result = transformLocalLibsToCdn(result);

    // 2. Replace /generated-images/ URLs with data URLs
    result = transformGeneratedImagesToDataUrls(result, generatedImages);

    // 3. Replace <ai-image> custom elements with <img> tags
    result = transformAiImagesToDataUrls(result, generatedImages);

    return result;
}
