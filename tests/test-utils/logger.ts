import { type Mock } from "vitest";

type LoggerMock = {
  level: string;
  info: Mock;
  warn: Mock;
  error: Mock;
  debug: Mock;
  fatal: Mock;
  trace: Mock;
  silent: Mock;
  child: Mock;
};

export function getLoggerMock(): LoggerMock {
  return (globalThis as typeof globalThis & {
    __VITEST_LOGGER__?: LoggerMock;
  }).__VITEST_LOGGER__ as LoggerMock;
}
