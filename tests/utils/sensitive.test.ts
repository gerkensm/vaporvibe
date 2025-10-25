import { describe, expect, it } from "vitest";

import { maskSensitive } from "../../src/utils/sensitive.js";

describe("maskSensitive", () => {
  it("returns placeholder when value absent", () => {
    expect(maskSensitive(null)).toBe("not set");
    expect(maskSensitive(undefined)).toBe("not set");
    expect(maskSensitive("")).toBe("not set");
  });

  it("fully masks short values", () => {
    expect(maskSensitive("abc")).toBe("***");
  });

  it("masks and annotates longer values", () => {
    expect(maskSensitive("abcdefghijk")).toBe("******** (11 chars)");
  });
});
