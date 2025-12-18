import { beforeEach, vi } from "vitest";

type LoggerMock = {
  level: string;
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
  fatal: ReturnType<typeof vi.fn>;
  trace: ReturnType<typeof vi.fn>;
  silent: ReturnType<typeof vi.fn>;
  child: ReturnType<typeof vi.fn>;
};

const loggerMock: LoggerMock = {
  level: "debug",
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  fatal: vi.fn(),
  trace: vi.fn(),
  silent: vi.fn(),
  child: vi.fn(),
};

loggerMock.child.mockImplementation(() => loggerMock as unknown as LoggerMock);

vi.mock("../src/logger.js", () => ({
  logger: loggerMock,
}));

beforeEach(() => {
  loggerMock.info.mockClear();
  loggerMock.warn.mockClear();
  loggerMock.error.mockClear();
  loggerMock.debug.mockClear();
  loggerMock.fatal.mockClear();
  loggerMock.trace.mockClear();
  loggerMock.silent.mockClear();
  loggerMock.child.mockClear();
  loggerMock.child.mockImplementation(() => loggerMock as unknown as LoggerMock);
});

declare global {
  // eslint-disable-next-line no-var
  var __VITEST_LOGGER__: typeof loggerMock | undefined;
}

globalThis.__VITEST_LOGGER__ = loggerMock;

