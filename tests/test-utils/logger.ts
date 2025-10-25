export function getLoggerMock() {
  return (globalThis as typeof globalThis & {
    __VITEST_LOGGER__?: {
      info: (...args: unknown[]) => void;
      warn: (...args: unknown[]) => void;
      error: (...args: unknown[]) => void;
      debug: (...args: unknown[]) => void;
      child: (...args: unknown[]) => unknown;
    };
  }).__VITEST_LOGGER__!;
}
