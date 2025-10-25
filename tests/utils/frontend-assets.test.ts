import type { PathLike } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  process.env = { ...ORIGINAL_ENV } as NodeJS.ProcessEnv;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV } as NodeJS.ProcessEnv;
});

describe("resolveScriptSource", () => {
  it("prefers built assets when available", async () => {
    vi.doMock("node:fs", () => ({
      existsSync: (target: PathLike) =>
        typeof target === "string" && target.includes("frontend/dist/assets"),
    }));

    const { resolveScriptSource } = await import("../../src/utils/frontend-assets.js");

    const result = resolveScriptSource("admin.js", "/src/main.tsx");

    expect(result).toEqual({ url: "/vaporvibe/assets/admin.js", mode: "asset" });
  });

  it("returns local dev entry when preferred", async () => {
    process.env.VAPORVIBE_PREFER_DEV_FRONTEND = "1";

    const { resolveScriptSource } = await import("../../src/utils/frontend-assets.js");

    const result = resolveScriptSource("admin.js", "src/main.tsx");

    expect(result).toEqual({ url: "/src/main.tsx", mode: "dev" });
  });

  it("falls back to configured dev server when assets missing", async () => {
    process.env.SERVE_LLM_DEV_SERVER_URL = "http://localhost:6006/";
    vi.doMock("node:fs", () => ({
      existsSync: () => false,
    }));

    const { resolveScriptSource } = await import("../../src/utils/frontend-assets.js");

    const result = resolveScriptSource("admin.js", "src/main.tsx");

    expect(result).toEqual({ url: "http://localhost:6006/src/main.tsx", mode: "dev" });
  });
});
