import { beforeEach, vi } from "vitest";

type LoggerMock = {
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
  child: ReturnType<typeof vi.fn>;
};

const loggerMock: Record<keyof LoggerMock, ReturnType<typeof vi.fn>> & {
  child: ReturnType<typeof vi.fn>;
} = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
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
  loggerMock.child.mockClear();
  loggerMock.child.mockImplementation(() => loggerMock as unknown as LoggerMock);
});

declare global {
  // eslint-disable-next-line no-var
  var __VITEST_LOGGER__: typeof loggerMock | undefined;
}

globalThis.__VITEST_LOGGER__ = loggerMock;
