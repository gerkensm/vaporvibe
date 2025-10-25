import type { ServerResponse } from "node:http";
import { describe, expect, it } from "vitest";

import { parseCookies, setCookie } from "../../src/utils/cookies.js";

class MockResponse {
  private header: string | readonly string[] | number | undefined;

  constructor(initial?: string | readonly string[]) {
    this.header = initial;
  }

  getHeader(name: string): string | readonly string[] | number | undefined {
    if (name.toLowerCase() === "set-cookie") {
      return this.header;
    }
    return undefined;
  }

  setHeader(name: string, value: string | readonly string[] | number): void {
    if (name.toLowerCase() === "set-cookie") {
      this.header = value;
    }
  }

  snapshot(): string | readonly string[] | number | undefined {
    return this.header;
  }
}

describe("cookies", () => {
  describe("parseCookies", () => {
    it("splits cookie header into decoded key/value pairs", () => {
      const parsed = parseCookies("session=abc123; theme=dark%20mode; empty=");

      expect(parsed).toEqual({
        session: "abc123",
        theme: "dark mode",
        empty: "",
      });
    });

    it("returns empty object when header missing", () => {
      expect(parseCookies(undefined)).toEqual({});
    });
  });

  describe("setCookie", () => {
    it("writes cookie header when none existed", () => {
      const res = new MockResponse();

      setCookie(res as unknown as ServerResponse, "session", "abc", {
        path: "/",
        httpOnly: true,
      });

      expect(res.snapshot()).toBe("session=abc; Path=/; HttpOnly");
    });

    it("appends to existing string header", () => {
      const res = new MockResponse("first=one");

      setCookie(res as unknown as ServerResponse, "second", "two");

      expect(res.snapshot()).toEqual(["first=one", "second=two"]);
    });

    it("extends existing cookie array", () => {
      const res = new MockResponse(["first=one"]);

      setCookie(res as unknown as ServerResponse, "second", "two", { secure: true });

      expect(res.snapshot()).toEqual(["first=one", "second=two; Secure"]);
    });
  });
});
