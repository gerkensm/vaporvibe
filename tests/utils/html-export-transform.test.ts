import { describe, it, expect } from "vitest";
import {
    localLibPathToCdn,
    transformLocalLibsToCdn,
    transformGeneratedImagesToDataUrls,
    transformAiImagesToDataUrls,
    prepareHtmlForExport,
} from "../../src/utils/html-export-transform.js";
import type { GeneratedImage } from "../../src/types.js";

describe("html-export-transform", () => {
    describe("localLibPathToCdn", () => {
        it("should convert standard library paths to jsdelivr CDN URLs", () => {
            expect(localLibPathToCdn("/libs/alpinejs/3.14.3/alpine.min.js")).toBe(
                "https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js"
            );
        });

        it("should use tailwindcss CDN for tailwind", () => {
            expect(localLibPathToCdn("/libs/tailwind/3.4.1/tailwind.js")).toBe(
                "https://cdn.tailwindcss.com/3.4.1"
            );
        });

        it("should handle scoped packages (fortawesome)", () => {
            expect(
                localLibPathToCdn("/libs/fortawesome-fontawesome-free/6.5.1/css/all.min.css")
            ).toBe(
                "https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.1/css/all.min.css"
            );
        });

        it("should handle htmx.org package", () => {
            expect(localLibPathToCdn("/libs/htmx.org/2.0.4/htmx.min.js")).toBe(
                "https://cdn.jsdelivr.net/npm/htmx.org@2.0.4/dist/htmx.min.js"
            );
        });

        it("should return null for invalid paths", () => {
            expect(localLibPathToCdn("/invalid/path")).toBeNull();
            expect(localLibPathToCdn("not-a-path")).toBeNull();
        });
    });

    describe("transformLocalLibsToCdn", () => {
        it("should replace src attributes with CDN URLs", () => {
            const html = `<script src="/libs/alpinejs/3.14.3/alpine.min.js"></script>`;
            const result = transformLocalLibsToCdn(html);
            expect(result).toBe(
                `<script src="https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js"></script>`
            );
        });

        it("should replace href attributes with CDN URLs", () => {
            const html = `<link href="/libs/daisyui/4.12.24/full.css" rel="stylesheet">`;
            const result = transformLocalLibsToCdn(html);
            expect(result).toBe(
                `<link href="https://cdn.jsdelivr.net/npm/daisyui@4.12.24/dist/full.css" rel="stylesheet">`
            );
        });

        it("should handle multiple library references", () => {
            const html = `
        <link href="/libs/daisyui/4.12.24/full.css" rel="stylesheet">
        <script src="/libs/tailwind/3.4.1/tailwind.js"></script>
        <script src="/libs/alpinejs/3.14.3/alpine.min.js"></script>
      `;
            const result = transformLocalLibsToCdn(html);
            expect(result).toContain("https://cdn.jsdelivr.net/npm/daisyui@4.12.24/dist/full.css");
            expect(result).toContain("https://cdn.tailwindcss.com/3.4.1");
            expect(result).toContain("https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js");
        });

        it("should leave non-lib paths unchanged", () => {
            const html = `<script src="/assets/app.js"></script>`;
            const result = transformLocalLibsToCdn(html);
            expect(result).toBe(html);
        });
    });

    describe("transformGeneratedImagesToDataUrls", () => {
        it("should replace /generated-images/ URLs with data URLs", () => {
            const cacheKey = "test-model:1:1:a sunset over mountains";
            const images: GeneratedImage[] = [
                {
                    id: "gen-1",
                    cacheKey,
                    url: `/generated-images/${cacheKey}.png`,
                    prompt: "a sunset over mountains",
                    ratio: "1:1",
                    provider: "openai",
                    modelId: "dall-e-3",
                    base64: "iVBORw0KGgoAAAANSUhEUg==",
                    mimeType: "image/png",
                    createdAt: new Date().toISOString(),
                },
            ];

            const html = `<img src="/generated-images/${cacheKey}.png" alt="test">`;
            const result = transformGeneratedImagesToDataUrls(html, images);
            expect(result).toBe(
                `<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==" alt="test">`
            );
        });

        it("should leave non-matching images unchanged", () => {
            const html = `<img src="/generated-images/unknown-key.png" alt="test">`;
            const result = transformGeneratedImagesToDataUrls(html, []);
            expect(result).toBe(html);
        });

        it("should return original HTML if no images provided", () => {
            const html = `<img src="/generated-images/test.png">`;
            expect(transformGeneratedImagesToDataUrls(html)).toBe(html);
            expect(transformGeneratedImagesToDataUrls(html, [])).toBe(html);
        });
    });

    describe("transformAiImagesToDataUrls", () => {
        const images: GeneratedImage[] = [
            {
                id: "gen-2",
                cacheKey: "test-model:1:1:a beautiful sunset",
                url: "/generated-images/test-model:1:1:a beautiful sunset.png",
                prompt: "a beautiful sunset",
                ratio: "1:1",
                provider: "openai",
                modelId: "dall-e-3",
                base64: "iVBORw0KGgoAAAANSU==",
                mimeType: "image/png",
                createdAt: new Date().toISOString(),
            },
        ];

        it("should replace <ai-image> tags with <img> tags", () => {
            const html = `<ai-image prompt="a beautiful sunset" ratio="1:1">`;
            const result = transformAiImagesToDataUrls(html, images);
            expect(result).toContain("<img ");
            expect(result).toContain('src="data:image/png;base64,iVBORw0KGgoAAAANSU=="');
            expect(result).toContain('alt="a beautiful sunset"');
        });

        it("should preserve additional attributes", () => {
            const html = `<ai-image prompt="a beautiful sunset" class="hero-image" id="main">`;
            const result = transformAiImagesToDataUrls(html, images);
            expect(result).toContain('class="hero-image"');
            expect(result).toContain('id="main"');
        });

        it("should handle self-closing tags", () => {
            const html = `<ai-image prompt="a beautiful sunset" />`;
            const result = transformAiImagesToDataUrls(html, images);
            expect(result).toContain("<img ");
            expect(result).not.toContain("<ai-image");
        });

        it("should leave unmatched ai-image tags unchanged", () => {
            const html = `<ai-image prompt="unknown prompt">`;
            const result = transformAiImagesToDataUrls(html, images);
            expect(result).toBe(html);
        });

        it("should return original HTML if no images provided", () => {
            const html = `<ai-image prompt="test">`;
            expect(transformAiImagesToDataUrls(html)).toBe(html);
            expect(transformAiImagesToDataUrls(html, [])).toBe(html);
        });

        it("should handle case-insensitive prompt matching", () => {
            const html = `<ai-image prompt="A BEAUTIFUL SUNSET">`;
            const result = transformAiImagesToDataUrls(html, images);
            expect(result).toContain("<img ");
        });
    });

    describe("prepareHtmlForExport", () => {
        it("should apply all transformations", () => {
            const images: GeneratedImage[] = [
                {
                    id: "gen-3",
                    cacheKey: "model:1:1:a logo",
                    url: "/generated-images/model:1:1:a logo.png",
                    prompt: "a logo",
                    ratio: "1:1",
                    provider: "openai",
                    modelId: "dall-e-3",
                    base64: "abc123==",
                    mimeType: "image/png",
                    createdAt: new Date().toISOString(),
                },
            ];

            const html = `
<!DOCTYPE html>
<html>
<head>
  <link href="/libs/daisyui/4.12.24/full.css" rel="stylesheet">
</head>
<body>
  <ai-image prompt="a logo" class="logo">
  <img src="/generated-images/model:1:1:a logo.png" alt="logo">
</body>
</html>`;

            const result = prepareHtmlForExport(html, images);

            // Check CDN replacement
            expect(result).toContain("https://cdn.jsdelivr.net/npm/daisyui@4.12.24/dist/full.css");
            expect(result).not.toContain("/libs/daisyui");

            // Check ai-image transformation
            expect(result).not.toContain("<ai-image");
            expect(result).toContain('class="logo"');

            // Check generated image replacement
            expect(result).toContain("data:image/png;base64,abc123==");
            expect(result).not.toContain("/generated-images/");
        });

        it("should work with empty images array", () => {
            const html = `<script src="/libs/alpinejs/3.14.3/alpine.min.js"></script>`;
            const result = prepareHtmlForExport(html, []);
            expect(result).toBe(
                `<script src="https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js"></script>`
            );
        });

        it("should work with undefined images", () => {
            const html = `<p>Hello world</p>`;
            const result = prepareHtmlForExport(html);
            expect(result).toBe(html);
        });
    });
});
