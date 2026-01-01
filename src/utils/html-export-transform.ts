/**
 * HTML Export Transform Utilities
 *
 * Transforms LLM-generated HTML for standalone export by:
 * 1. Replacing local /libs/ paths with CDN URLs
 * 2. Replacing <ai-image> custom elements with embedded data URL images
 */

import { getGeneratedImagePath, GENERATED_IMAGES_ROUTE } from "../image-gen/paths.js";
import type { GeneratedImage } from "../types.js";
import { logger } from "../logger.js";
import { reencodeImagesForExport } from "./image-reencoder.js";

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

    // Animation & SPA Libraries
    motion: (v, f) => `https://cdn.jsdelivr.net/npm/motion@${v}/dist/${f}`,
    gsap: (v, f) => `https://cdn.jsdelivr.net/npm/gsap@${v}/dist/${f}`,
    "lottie-web": (v, f) => `https://cdn.jsdelivr.net/npm/lottie-web@${v}/build/player/${f}`,
    "formkit-auto-animate": (v, f) => (f === 'auto-animate.min.js' || f === 'auto-animate.bundle.js')
        ? `https://cdn.jsdelivr.net/npm/@formkit/auto-animate@${v}/index.min.js`
        : `https://cdn.jsdelivr.net/npm/@formkit/auto-animate@${v}/${f}`,
    lenis: (v, f) => `https://cdn.jsdelivr.net/npm/lenis@${v}/dist/${f}`,
    "barba-core": (v, f) => `https://cdn.jsdelivr.net/npm/@barba/core@${v}/dist/${f}`,
    swup: (v, f) => `https://cdn.jsdelivr.net/npm/swup@${v}/dist/${f}`,
    cytoscape: (v, f) => `https://cdn.jsdelivr.net/npm/cytoscape@${v}/dist/${f}`,
    echarts: (v, f) => `https://cdn.jsdelivr.net/npm/echarts@${v}/dist/${f}`,
    apexcharts: (v, f) => `https://cdn.jsdelivr.net/npm/apexcharts@${v}/dist/${f}`,

    // UI & Widgets
    "floating-ui-dom": (v, f) => `https://cdn.jsdelivr.net/npm/@floating-ui/dom@${v}/dist/${f}`,
    "editorjs-editorjs": (v, f) => `https://cdn.jsdelivr.net/npm/@editorjs/editorjs@${v}/dist/${f}`,
    uppy: (v, f) => `https://cdn.jsdelivr.net/npm/uppy@${v}/dist/${f}`,
    "medium-zoom": (v, f) => `https://cdn.jsdelivr.net/npm/medium-zoom@${v}/dist/${f}`,
    photoswipe: (v, f) => f.includes('umd')
        ? `https://cdn.jsdelivr.net/npm/photoswipe@${v}/dist/umd/${f}`
        : `https://cdn.jsdelivr.net/npm/photoswipe@${v}/dist/${f}`, // css is in dist/

    // Particles & Effects
    tsparticles: (v, f) => `https://cdn.jsdelivr.net/npm/tsparticles@${v}/${f}`, // Bundle is in root
    vanta: (v, f) => `https://cdn.jsdelivr.net/npm/vanta@${v}/dist/${f}`,

    // Fontsource fonts use @fontsource/ scope

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

        // Also map by ID-based route (some legacy paths or manual edits might use ID)
        if (img.id) {
            // Assume .png extension for ID-based routes as that's the default
            imagesByRoute.set(`${GENERATED_IMAGES_ROUTE}/${img.id}.png`, img);
        }
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
 *
 * Matching strategy:
 * 1. First tries to match by prompt text (case-insensitive, trimmed)
 * 2. Falls back to matching by src attribute URL if present (for tour generation
 *    where the LLM may copy src attributes from history HTML)
 */
export function transformAiImagesToDataUrls(
    html: string,
    generatedImages?: GeneratedImage[]
): string {
    if (!generatedImages || generatedImages.length === 0) {
        return html;
    }

    // Build maps for matching
    const imagesByPrompt = new Map<string, GeneratedImage>();
    const imagesByUrl = new Map<string, GeneratedImage>();
    const imagesById = new Map<string, GeneratedImage>();

    for (const img of generatedImages) {
        if (img.base64) {
            if (img.prompt) {
                imagesByPrompt.set(img.prompt.toLowerCase().trim(), img);
            }
            if (img.url) {
                imagesByUrl.set(img.url, img);
            }
            const { route } = getGeneratedImagePath(img.cacheKey);
            imagesByUrl.set(route, img);
            if (img.id) {
                imagesById.set(img.id, img);
            }
        }
    }

    // Match <ai-image ...> tags (self-closing or not)
    return html.replace(
        /<ai-image\s+([^>]*?)\/?>|<ai-image\s+([^>]*)>[^<]*<\/ai-image>/gi,
        (match, attrs1, attrs2) => {
            const attributesStr = attrs1 || attrs2 || "";
            const attributes = parseAttributes(attributesStr);
            const prompt = attributes.prompt || attributes["data-prompt"] || "";
            const srcAttr = attributes.src || "";
            const dataId = attributes["data-id"] || "";

            // 1. Try ID match (most robust)
            let image: GeneratedImage | undefined;
            if (dataId) {
                image = imagesById.get(dataId);
            }

            // 2. Try to find matching image by prompt
            if (!image && prompt) {
                image = imagesByPrompt.get(prompt.toLowerCase().trim());
            }

            // 3. Fall back to matching by src URL
            if (!image && srcAttr) {
                image = imagesByUrl.get(srcAttr);
            }

            if (!image || !image.base64) {
                logger.warn({ dataId, prompt, srcAttr }, "transformAiImagesToDataUrls: Failed to find image or missing base64 data");
                return match; // Keep original if no cached image found
            }

            logger.debug({ dataId, prompt, imageId: image.id }, "transformAiImagesToDataUrls: Successfully matched and embedding image");

            // Build <img> tag
            const mimeType = image.mimeType || "image/png";
            const dataUrl = `data:${mimeType};base64,${image.base64}`;

            const imgAttrs: string[] = [`src="${dataUrl}"`];

            // Use prompt as alt text
            const altText = image.prompt || prompt;
            if (altText) {
                imgAttrs.push(`alt="${escapeHtmlAttr(altText)}"`);
            }

            // Copy over other attributes (except prompt, ratio, data-prompt, src, data-id)
            const skipAttrs = new Set(["prompt", "ratio", "data-prompt", "src", "data-id"]);
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
 * Options for HTML export transformation
 */
export interface PrepareHtmlForExportOptions {
    /** Compress images for smaller file size (JPEG <200KB for non-alpha) */
    compressImages?: boolean;
}

/**
 * Prepares HTML for standalone export by applying all transformations.
 */
export async function prepareHtmlForExport(
    html: string,
    generatedImages?: GeneratedImage[],
    options?: PrepareHtmlForExportOptions
): Promise<string> {
    let result = html;
    let imagesToUse = generatedImages;

    // Optionally compress images for smaller file size
    if (options?.compressImages && imagesToUse?.length) {
        imagesToUse = await reencodeImagesForExport(imagesToUse);
    }

    // Handle legacy driver.js inclusion that omits versioned paths
    result = result.replace(
        /<script src="\/libs\/driver\.js"><\/script>/g,
        '<script src="https://cdn.jsdelivr.net/npm/driver.js@1.0.1/dist/driver.js.iife.js"></script><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/driver.js@1.0.1/dist/driver.css" />'
    );

    // 1. Replace local /libs/ paths with CDN URLs
    result = transformLocalLibsToCdn(result);

    // 2. Replace /generated-images/ URLs with data URLs (for standard img tags that survived)
    result = transformGeneratedImagesToDataUrls(result, imagesToUse);


    // 3. Inject IDs into <ai-image> tags if they are missing
    // This ensures tags generated by the LLM get mapped to their IDs even if the LLM forgot the attribute
    result = injectAiImageIds(result, imagesToUse);

    // 4. Inject Client-Side Hydration Script for <ai-image> (Dynamic & Static)
    // This replaces the old transformAiImagesToDataUrls which only handled static HTML
    result = injectClientSideImageHydration(result, imagesToUse);

    return result;
}

/**
 * Injects a client-side script and JSON manifest to hydrate <ai-image> tags.
 * This handles both statically present tags AND tags created dynamically by JS.
 */
export function injectClientSideImageHydration(
    html: string,
    generatedImages?: GeneratedImage[]
): string {
    if (!generatedImages || generatedImages.length === 0) {
        return html;
    }

    // Build the manifest: Map<NormalizedKey, Base64>
    // Keys include: IDs, Normalized Prompts, and URLs (for backup)
    const manifest: Record<string, string> = {};

    const normalize = (s: string) => s.toLowerCase().trim().replace(/[^\w\s]/g, "");

    for (const img of generatedImages) {
        if (!img.base64) continue;
        const mime = img.mimeType || "image/png";
        const dataUrl = `data:${mime};base64,${img.base64}`;

        if (img.id) manifest[img.id] = dataUrl;
        if (img.prompt) manifest[normalize(img.prompt)] = dataUrl;
        if (img.url) manifest[img.url] = dataUrl;

        // Also map cache path route for robust matching
        const { route } = getGeneratedImagePath(img.cacheKey);
        manifest[route] = dataUrl;
    }

    // CSS for beautiful loading and error states
    const styles = `
    <style id="vaporvibe-image-hydration-styles">
      /* ai-image loading state: shimmer animation */
      ai-image {
        display: block;
        position: relative;
        overflow: hidden;
        min-height: 80px;
        background: linear-gradient(90deg, #e5e7eb 0%, #f3f4f6 50%, #e5e7eb 100%);
        background-size: 200% 100%;
        animation: ai-image-shimmer 1.8s ease-in-out infinite;
        border-radius: 8px;
      }
      
      /* Loading state prompt text */
      ai-image::before {
        content: attr(data-display-prompt);
        display: flex;
        align-items: center;
        justify-content: center;
        position: absolute;
        inset: 0;
        padding: 12px;
        font: 400 0.85rem/1.4 system-ui, -apple-system, sans-serif;
        color: #6b7280;
        text-align: center;
        overflow: hidden;
        text-overflow: ellipsis;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
      }
      
      /* Aspect ratio support via data-ratio attribute */
      ai-image[data-ratio="1:1"] { aspect-ratio: 1 / 1; }
      ai-image[data-ratio="16:9"] { aspect-ratio: 16 / 9; }
      ai-image[data-ratio="9:16"] { aspect-ratio: 9 / 16; }
      ai-image[data-ratio="4:3"] { aspect-ratio: 4 / 3; }
      ai-image[data-ratio="3:4"] { aspect-ratio: 3 / 4; }
      
      /* Error state: muted and graceful */
      ai-image[data-error] {
        background: #f3f4f6;
        animation: none;
      }
      
      ai-image[data-error]::before {
        content: "⚠ " attr(data-display-prompt);
        color: #9ca3af;
      }
      
      ai-image[data-error]::after {
        content: "Image unavailable";
        position: absolute;
        bottom: 8px;
        left: 0;
        right: 0;
        font: 400 0.7rem/1 system-ui, sans-serif;
        color: #9ca3af;
        text-align: center;
      }
      
      /* Shimmer keyframes */
      @keyframes ai-image-shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      
      /* Hide after hydration (replaced with img) */
      ai-image[data-hydrated] { display: none; }
    </style>
    `;

    const script = `
    <script id="vaporvibe-image-hydration">
    (function() {
      // Manifest of all generated images available in this session
      const MANIFEST = ${JSON.stringify(manifest)};

      // Helper to match fuzzy prompts logic
      const normalize = (s) => s ? s.toLowerCase().trim().replace(/[^\\w\\s]/g, "") : "";
      
      // Truncate prompt for display
      const truncate = (s, maxLen = 80) => {
        if (!s || s.length <= maxLen) return s || "";
        return s.slice(0, maxLen).trim() + "…";
      };

      class AiImage extends HTMLElement {
        constructor() {
            super();
        }

        connectedCallback() {
           if (this.hasAttribute('data-hydrated')) return;
           
           const prompt = this.getAttribute('prompt') || "";
           const ratio = this.getAttribute('ratio');
           
           // Set display prompt for CSS ::before content
           this.setAttribute('data-display-prompt', truncate(prompt, 60));
           
           // Copy ratio to data attribute for CSS aspect-ratio
           if (ratio) {
             this.setAttribute('data-ratio', ratio);
           }
           
           // Prioritize data-image-id (tour mode) -> data-id (session mode) -> src
           const imageId = this.getAttribute('data-image-id') || this.getAttribute('data-id');
           const src = this.getAttribute('src');

             // Try ID, then URL/Src, then Prompt
           let dataUrl = MANIFEST[imageId] || MANIFEST[src] || MANIFEST[normalize(prompt)];

           console.log('[VaporVibe] Hydrating <ai-image>:', { imageId, prompt: truncate(prompt, 40), src, found: !!dataUrl });

           if (dataUrl) {
             this.setAttribute('data-hydrated', 'true');
             
             const img = document.createElement('img');
             img.src = dataUrl;
             
             // Copy known attributes
             const allowedAttrs = ['alt', 'class', 'style', 'width', 'height', 'title', 'draggable', 'loading'];
             for (const attr of this.attributes) {
                if (allowedAttrs.includes(attr.name) || attr.name.startsWith('data-')) {
                    img.setAttribute(attr.name, attr.value);
                }
             }
             // Ensure alt text exists
             if (!img.alt && prompt) img.alt = prompt;

             // Replace the <ai-image> with the real <img>
             this.replaceWith(img);
           } else {
             console.warn('[VaporVibe] Could not hydrate <ai-image>:', { prompt: truncate(prompt, 40), imageId, src });
             // Show graceful error state via CSS
             this.setAttribute('data-error', 'true');
           }
        }
      }

      // Register the custom element
      if (!customElements.get('ai-image')) {
        customElements.define('ai-image', AiImage);
      }
    })();
    </script>
    `;

    // Inject styles in <head> and script before </body>
    let result = html;

    // Inject styles into <head>
    if (result.includes("</head>")) {
        result = result.replace("</head>", `${styles}</head>`);
    } else if (result.includes("<body")) {
        result = result.replace(/<body/i, `${styles}<body`);
    } else {
        result = styles + result;
    }

    // Inject script before </body>
    if (result.includes("</body>")) {
        result = result.replace("</body>", `${script}</body>`);
    } else {
        result = result + script;
    }

    return result;
}

/**
 * Transforms <ai-image> custom elements into standard <img> tags with /generated-images/ URLs.
 * 
 * This is used for preprocessing history HTML before sending to the LLM for tour generation.
 * Unlike transformAiImagesToDataUrls, this produces URL-based references that the LLM can
 * copy and that can later be transformed to data URLs by transformGeneratedImagesToDataUrls.
 *
 * Input: <ai-image prompt="A sunset" ratio="16:9" class="hero">
 * Output: <img src="/generated-images/abc123.png" alt="A sunset" class="hero">
 */
export function injectAiImageIds(
    html: string,
    generatedImages?: GeneratedImage[]
): string {
    if (!generatedImages || generatedImages.length === 0) {
        return html;
    }

    // Build a map of prompt -> GeneratedImage for matching
    const imagesByPrompt = new Map<string, GeneratedImage>();
    for (const img of generatedImages) {
        if (img.prompt) {
            imagesByPrompt.set(img.prompt.toLowerCase().trim(), img);
        }
    }

    // Match <ai-image ...> tags (self-closing or not)
    return html.replace(
        /<ai-image\s+([^>]*?)\/?>|<ai-image\s+([^>]*)>[^<]*<\/ai-image>/gi,
        (match, attrs1, attrs2) => {
            const attributesStr = attrs1 || attrs2 || "";
            const attributes = parseAttributes(attributesStr);

            // If it already has an explicit image ID, don't overwrite it
            // We intentionally IGNORE data-id here because it might be a component ID (sl-gen-*)
            // We want to ensure data-image-id is always present for hydration
            if (attributes["data-image-id"]) {
                return match;
            }

            const prompt = attributes.prompt || attributes["data-prompt"] || "";
            const image = prompt
                ? imagesByPrompt.get(prompt.toLowerCase().trim())
                : undefined;

            if (!image) {
                logger.debug({ prompt, attributes }, "injectAiImageIds: No matching image found for prompt");
                return match;
            }

            // Inject the ID
            // We reconstruct the tag to ensure clean attribute ordering, or easier just append
            // But replacing is safer to ensure we don't break existing attrs

            // Rebuild attributes string
            const newAttrs: string[] = [];
            for (const [key, value] of Object.entries(attributes)) {
                newAttrs.push(`${key}="${escapeHtmlAttr(value)}"`);
            }
            // Use data-image-id to avoid conflict with sl-gen- IDs
            newAttrs.push(`data-image-id="${image.id}"`);

            const isSelfClosing = match.trim().endsWith("/>");
            if (isSelfClosing) {
                return `<ai-image ${newAttrs.join(" ")} />`;
            } else {
                return `<ai-image ${newAttrs.join(" ")}></ai-image>`;
            }
        }
    );
}


