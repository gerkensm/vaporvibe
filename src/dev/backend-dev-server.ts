import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import chokidar from "chokidar";
import { logger } from "../logger.js";
import {
  startVaporVibe,
  type StartOptions,
  type StartResult,
} from "../index.js";
import {
  snapshotServerState,
  type ServerStateSnapshot,
} from "../server/server.js";
import type { SessionStoreSnapshot } from "../server/session-store.js";
import type { DevFrontendServer } from "../server/server.js";

const cliArgs = process.argv.slice(2);
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(moduleDir, "..", "..");
const frontendDir = path.resolve(rootDir, "frontend");
const viteConfigPath = path.resolve(frontendDir, "vite.config.ts");
const frontendRequire = createRequire(path.resolve(frontendDir, "package.json"));
const watcher = chokidar.watch(
  [
    "src/**/*.ts",
    "src/**/*.tsx",
    "scripts/**/*.mjs",
    "tsconfig.json",
    "frontend/vite.config.ts",
  ],
  {
    cwd: rootDir,
    ignoreInitial: true,
  }
);

let current: StartResult | null = null;
let pendingStateSnapshot: ServerStateSnapshot | null = null;
let pendingSessionSnapshot: SessionStoreSnapshot | null = null;
let restartTimer: NodeJS.Timeout | null = null;
let isRestarting = false;
let shuttingDown = false;
let viteServer: DevFrontendServer | null = null;

async function ensureViteDevServer(): Promise<DevFrontendServer | null> {
  if (viteServer) {
    return viteServer;
  }

  if (process.env.VAPORVIBE_PREFER_DEV_FRONTEND === "0") {
    return null;
  }

  try {
    const viteModule = frontendRequire("vite") as {
      createServer: (options: Record<string, unknown>) => Promise<DevFrontendServer>;
    };

    viteServer = await viteModule.createServer({
      root: frontendDir,
      configFile: viteConfigPath,
      server: {
        middlewareMode: true,
        hmr: {
          protocol: "ws",
        },
      },
      appType: "spa",
    });
    logger.info({ root: frontendDir }, "Vite dev server ready in middleware mode");
    return viteServer;
  } catch (error) {
    logger.error({ err: error }, "Failed to start Vite dev server");
    return null;
  }
}

async function boot(initial = false): Promise<void> {
  const viteDevServer = await ensureViteDevServer();
  const options: StartOptions = {
    cliArgs,
    env: process.env,
    sessionSnapshot: pendingSessionSnapshot,
    stateSnapshot: pendingStateSnapshot,
    skipBrowser: !initial,
    devServer: viteDevServer,
  };
  const result = await startVaporVibe(options);
  if (!result) {
    process.exit(0);
    return;
  }
  current = result;
  pendingSessionSnapshot = null;
  pendingStateSnapshot = null;
  logger.info(
    { port: result.port },
    initial ? "Backend dev server ready" : "Backend dev server reloaded"
  );
}

function scheduleRestart(reason: string): void {
  if (shuttingDown) {
    return;
  }
  logger.debug({ reason }, "Queueing backend reload");
  if (restartTimer) {
    clearTimeout(restartTimer);
  }
  restartTimer = setTimeout(() => {
    restartTimer = null;
    void restart(reason);
  }, 100);
}

async function restart(reason: string): Promise<void> {
  if (isRestarting) {
    return;
  }
  isRestarting = true;
  logger.info({ reason }, "Reloading backend due to file change");

  const previous = current;
  if (previous) {
    pendingStateSnapshot = snapshotServerState(previous.state);
    pendingSessionSnapshot = previous.sessionStore.exportSnapshot();
    try {
      await closeServer(previous);
    } catch (error) {
      logger.error({ err: error }, "Failed to shut down previous server");
    }
    current = null;
  }

  try {
    await boot(false);
  } catch (error) {
    logger.error({ err: error }, "Failed to restart backend server");
  } finally {
    isRestarting = false;
  }
}

async function closeServer(result: StartResult): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    result.server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  logger.info({ signal }, "Shutting down backend dev server");
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
  await watcher.close();
  if (current) {
    try {
      await closeServer(current);
    } catch (error) {
      logger.error({ err: error }, "Error while closing server during shutdown");
    }
  }
  if (viteServer) {
    try {
      await viteServer.close();
    } catch (error) {
      logger.error({ err: error }, "Error while closing Vite dev server during shutdown");
    } finally {
      viteServer = null;
    }
  }
  process.exit(0);
}

watcher.on("all", (event, filePath) => {
  const normalized = path.normalize(filePath);
  scheduleRestart(`${event}:${normalized}`);
});

boot(true).catch((error) => {
  logger.error({ err: error }, "Failed to start backend dev server");
  process.exit(1);
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
