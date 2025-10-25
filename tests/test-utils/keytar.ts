import { vi } from "vitest";

export interface KeytarMock {
  setPassword: ReturnType<typeof vi.fn>;
  getPassword: ReturnType<typeof vi.fn>;
  deletePassword: ReturnType<typeof vi.fn>;
}

export function createKeytarMock(): KeytarMock {
  return {
    setPassword: vi.fn().mockResolvedValue(undefined),
    getPassword: vi.fn().mockResolvedValue(null),
    deletePassword: vi.fn().mockResolvedValue(true),
  };
}
