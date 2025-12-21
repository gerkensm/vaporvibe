import type { GeneratedImage, ImageAspectRatio } from "../types.js";

/**
 * Extracts all <ai-image> tags from HTML and returns their prompts and ratios.
 * Used for on-demand image generation in tour mode.
 */
export function extractAiImageRequests(html: string): Array<{
    prompt: string;
    ratio: ImageAspectRatio;
}> {
    const requests: Array<{ prompt: string; ratio: ImageAspectRatio }> = [];
    const seen = new Set<string>();

    // Match <ai-image ...> tags (self-closing or not)
    const regex = /<ai-image\s+([^>]*?)\/?>/gi;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(html)) !== null) {
        const attributesStr = match[1] || "";
        const attributes = parseAttributes(attributesStr);

        const prompt = attributes.prompt || attributes["data-prompt"] || "";
        const ratioRaw = attributes.ratio || "1:1";
        const ratio = normalizeRatio(ratioRaw);

        if (prompt && prompt.trim().length > 0) {
            const key = `${prompt.toLowerCase().trim()}:${ratio}`;
            if (!seen.has(key)) {
                seen.add(key);
                requests.push({ prompt: prompt.trim(), ratio });
            }
        }
    }

    return requests;
}

/**
 * Checks which image requests are missing from the provided generated images.
 */
export function findMissingImages(
    requests: Array<{ prompt: string; ratio: ImageAspectRatio }>,
    existingImages: GeneratedImage[]
): Array<{ prompt: string; ratio: ImageAspectRatio }> {
    const imagesByPrompt = new Map<string, GeneratedImage>();
    for (const img of existingImages) {
        if (img.prompt) {
            const key = img.prompt.toLowerCase().trim();
            imagesByPrompt.set(key, img);
        }
    }

    return requests.filter((req) => {
        const key = req.prompt.toLowerCase().trim();
        return !imagesByPrompt.has(key);
    });
}

function parseAttributes(str: string): Record<string, string> {
    const result: Record<string, string> = {};
    // Match key="value" or key='value' patterns
    const attrRegex = /(\w+(?:-\w+)*)=["']([^"']*)["']/g;
    let match: RegExpExecArray | null;

    while ((match = attrRegex.exec(str)) !== null) {
        result[match[1]] = match[2];
    }

    return result;
}

function normalizeRatio(value: string): ImageAspectRatio {
    const allowed: ImageAspectRatio[] = ["1:1", "16:9", "9:16", "4:3", "3:4"];
    return allowed.includes(value as ImageAspectRatio)
        ? (value as ImageAspectRatio)
        : "1:1";
}
