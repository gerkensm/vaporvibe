import type { Logger } from "pino";

export function getLoggerMock(): Logger {
  return (globalThis as typeof globalThis & {
    __VITEST_LOGGER__?: {
      level: string;
      info: (...args: unknown[]) => void;
      warn: (...args: unknown[]) => void;
      error: (...args: unknown[]) => void;
      debug: (...args: unknown[]) => void;
      fatal: (...args: unknown[]) => void;
      trace: (...args: unknown[]) => void;
      silent: (...args: unknown[]) => void;
      child: (...args: unknown[]) => unknown;
    };
  }).__VITEST_LOGGER__ as unknown as Logger;
}
