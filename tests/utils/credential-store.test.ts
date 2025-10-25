import { beforeEach, describe, expect, it, vi } from "vitest";

import { createKeytarMock } from "../test-utils/keytar.js";
import { getLoggerMock } from "../test-utils/logger.js";

const loggerMock = getLoggerMock();

async function loadCredentialStoreWithKeytar(
  factory: () => unknown
) {
  vi.resetModules();
  vi.doMock("keytar", () => ({ default: factory() }));
  const module = await import("../../src/utils/credential-store.js");
  return module.getCredentialStore();
}

async function loadCredentialStoreWithFailingKeytar() {
  vi.resetModules();
  vi.doMock("keytar", () => {
    throw new Error("keytar missing");
  });
  const module = await import("../../src/utils/credential-store.js");
  return module.getCredentialStore();
}

describe("CredentialStore", () => {
  beforeEach(() => {
    loggerMock.warn.mockClear();
    loggerMock.error.mockClear();
    loggerMock.debug.mockClear();
    loggerMock.info.mockClear();
  });

  it("persists credentials via keytar when available", async () => {
    const keytar = createKeytarMock();
    const store = await loadCredentialStoreWithKeytar(() => keytar);

    await store.saveApiKey("openai", "secret");
    expect(keytar.setPassword).toHaveBeenCalled();

    keytar.getPassword.mockResolvedValue("secret");
    const stored = await store.getApiKey("openai");
    expect(stored).toBe("secret");
  });

  it("falls back to memory storage when keytar fails to load", async () => {
    const store = await loadCredentialStoreWithFailingKeytar();

    await store.saveApiKey("gemini", "mem-key");
    const retrieved = await store.getApiKey("gemini");
    expect(retrieved).toBe("mem-key");
    expect(loggerMock.warn).toHaveBeenCalled();
  });

  it("reports storage backend information", async () => {
    const storeWithKeytar = await loadCredentialStoreWithKeytar(() =>
      createKeytarMock()
    );
    const info = await storeWithKeytar.getStorageInfo();
    expect(info.persistent).toBe(true);

    const memoryStore = await loadCredentialStoreWithFailingKeytar();
    const memoryInfo = await memoryStore.getStorageInfo();
    expect(memoryInfo.backend).toContain("Memory");
    expect(memoryInfo.persistent).toBe(false);
  });

  it("clears cached values", async () => {
    const store = await loadCredentialStoreWithFailingKeytar();

    await store.saveApiKey("anthropic", "value");
    await store.clearAll();
    const exists = await store.hasStoredKey("anthropic");
    expect(exists).toBe(false);
  });
});
