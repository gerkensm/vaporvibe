import { describe, expect, it } from "vitest";

import {
  BRANCH_FIELD,
  sanitizeBranchId,
  branchIdFromUrl,
  resolveActiveBranchId,
  applyBranchToUrl,
  ensureBranchField,
} from "../../frontend/src/interceptor-branch-utils.js";

class MockInput {
  type = "text";
  constructor(public name = "", public value = "") { }
}

class MockForm {
  readonly children: MockInput[] = [];

  querySelector<T extends MockInput>(selector: string): T | null {
    const match = selector.match(/^input\[name="(.+)"\]$/);
    if (!match) return null;
    const found = this.children.find((child) => child.name === match[1]);
    return (found as T | undefined) ?? null;
  }

  appendChild(node: MockInput): void {
    this.children.push(node);
  }
}

const mockDocument = {
  createElement(tag: string) {
    if (tag !== "input") {
      throw new Error(`Unexpected element tag: ${tag}`);
    }
    return new MockInput() as unknown as HTMLInputElement;
  },
};

describe("interceptor branch utilities", () => {
  it("sanitizes branch identifiers", () => {
    expect(sanitizeBranchId("   ")).toBeNull();
    expect(sanitizeBranchId(null)).toBeNull();
    expect(sanitizeBranchId(undefined)).toBeNull();
    expect(sanitizeBranchId(" branch-123 ")).toBe("branch-123");
  });

  it("extracts branch id from url when present", () => {
    const withBranch = branchIdFromUrl(
      `https://example.com/foo?${BRANCH_FIELD}=demo`
    );
    expect(withBranch).toBe("demo");

    const withoutBranch = branchIdFromUrl("https://example.com/foo");
    expect(withoutBranch).toBeNull();
  });

  it("resolves active branch preferring url over frame attribute", () => {
    const fromUrl = resolveActiveBranchId({
      href: `https://example.com/foo?${BRANCH_FIELD}=from-url`,
      frameBranchAttribute: "from-frame",
    });
    expect(fromUrl).toBe("from-url");

    const fromFrame = resolveActiveBranchId({
      href: "https://example.com/foo",
      frameBranchAttribute: "from-frame",
    });
    expect(fromFrame).toBe("from-frame");

    const fallback = resolveActiveBranchId({
      href: "https://example.com/foo",
      frameBranchAttribute: "   ",
    });
    expect(fallback).toBeNull();
  });

  it("applies branch identifiers to urls when missing", () => {
    const url = new URL("https://example.com/path?existing=value");
    applyBranchToUrl("branch-a", url);
    expect(url.searchParams.get(BRANCH_FIELD)).toBe("branch-a");

    const unchanged = new URL(
      `https://example.com/path?${BRANCH_FIELD}=original`
    );
    applyBranchToUrl("branch-b", unchanged);
    expect(unchanged.searchParams.get(BRANCH_FIELD)).toBe("original");
  });

  it("ensures branch field is appended or updated on forms", () => {
    const form = new MockForm();
    ensureBranchField("branch-1", form as unknown as HTMLFormElement, mockDocument);
    expect(form.children).toHaveLength(1);
    expect(form.children[0].name).toBe(BRANCH_FIELD);
    expect(form.children[0].type).toBe("hidden");
    expect(form.children[0].value).toBe("branch-1");

    ensureBranchField("branch-2", form as unknown as HTMLFormElement, mockDocument);
    expect(form.children).toHaveLength(1);
    expect(form.children[0].value).toBe("branch-2");

    const emptyForm = new MockForm();
    ensureBranchField(null, emptyForm as unknown as HTMLFormElement, mockDocument);
    expect(emptyForm.children).toHaveLength(0);
  });
});
