import { describe, it, expect } from "vitest";
import { createImageGenClient } from "../../src/image-gen/factory.js";
import { CachedImageGenClient } from "../../src/image-gen/cache.js";
import { GoogleImageGenClient } from "../../src/image-gen/providers/google.js";
import { OpenAiImageGenClient } from "../../src/image-gen/providers/openai.js";

describe("createImageGenClient", () => {
    it("should return a CachedImageGenClient wrapping GoogleImageGenClient for 'gemini' provider", () => {
        const client = createImageGenClient("gemini");

        expect(client).toBeInstanceOf(CachedImageGenClient);
        expect((client as any).client).toBeInstanceOf(GoogleImageGenClient);
    });

    it("should return a CachedImageGenClient wrapping OpenAiImageGenClient for 'openai' provider", () => {
        const client = createImageGenClient("openai");

        expect(client).toBeInstanceOf(CachedImageGenClient);
        expect((client as any).client).toBeInstanceOf(OpenAiImageGenClient);
    });
});
