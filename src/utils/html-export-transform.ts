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
 * Most libraries use the standard jsdelivr pattern.
 */
const SPECIAL_CDN_MAPPINGS: Record<string, (version: string, file: string) => string> = {
    tailwind: (version) => `https://cdn.tailwindcss.com/${version}`,
};

/**
 * Maps a local /libs/ path to its CDN equivalent.
 *
 * Standard pattern: /libs/{package}/{version}/{file}
 * CDN pattern: https://cdn.jsdelivr.net/npm/{package}@{version}/dist/{file}
 */
export function localLibPathToCdn(localPath: string): string | null {
    // Match /libs/{package}/{version}/{rest...}
    const match = localPath.match(/^\/libs\/([^/]+)\/([^/]+)\/(.+)$/);
    if (!match) {
        return null;
    }

    const [, packageName, version, filePath] = match;

    // Check for special CDN mappings
    if (SPECIAL_CDN_MAPPINGS[packageName]) {
        return SPECIAL_CDN_MAPPINGS[packageName](version, filePath);
    }

    // Convert package name back to npm format (e.g., "fortawesome-fontawesome-free" -> "@fortawesome/fontawesome-free")
    const npmPackage = packageNameToNpm(packageName);

    // Use jsdelivr for everything else
    // jsdelivr automatically resolves /dist/, so we include the full path
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

    // htmx.org and hyperscript.org are special cases (dots in package name)
    if (dirName === "htmx") {
        return "htmx.org";
    }
    if (dirName === "hyperscript") {
        return "hyperscript.org";
    }

    return dirName;
}

/**
 * Replaces all local /libs/ references in HTML with CDN equivalents.
 */
export function transformLocalLibsToCdn(html: string): string {
    // Match src="..." and href="..." attributes containing /libs/
    return html.replace(
        /((?:src|href)\s*=\s*["'])(\/?libs\/[^"']+)(["'])/gi,
        (match, prefix, libPath, suffix) => {
            // Normalize path to start with /libs/
            const normalizedPath = libPath.startsWith("/") ? libPath : `/${libPath}`;
            const cdnUrl = localLibPathToCdn(normalizedPath);
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
        /<ai-image\s+([^>]*?)\/?>/gi,
        (match, attributesStr) => {
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

    // 1. Replace local /libs/ paths with CDN URLs
    result = transformLocalLibsToCdn(result);

    // 2. Replace /generated-images/ URLs with data URLs
    result = transformGeneratedImagesToDataUrls(result, generatedImages);

    // 3. Replace <ai-image> custom elements with <img> tags
    result = transformAiImagesToDataUrls(result, generatedImages);

    return result;
}
