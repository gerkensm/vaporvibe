#!/usr/bin/env node
import process from "node:process";
import open from "open";
import { parseCliArgs } from "./cli/args.js";
import { resolveAppConfig } from "./config/runtime-config.js";
import { createLlmClient } from "./llm/factory.js";
import { SessionStore } from "./server/session-store.js";
import { createServer } from "./server/server.js";
import { logger } from "./logger.js";

async function main(): Promise<void> {
  try {
    const cliOptions = parseCliArgs(process.argv.slice(2));
    if (cliOptions.showHelp) {
      printHelp();
      return;
    }

    const appConfig = await resolveAppConfig(cliOptions, process.env);
    const llmClient = appConfig.providerReady
      ? createLlmClient(appConfig.provider)
      : null;
    const sessionStore = new SessionStore(
      appConfig.runtime.sessionTtlMs,
      appConfig.runtime.sessionCap
    );

    const server = createServer({
      runtime: appConfig.runtime,
      provider: appConfig.provider,
      providerLocked: appConfig.providerLocked,
      providerSelectionRequired: appConfig.providerSelectionRequired,
      providersWithKeys: appConfig.providersWithKeys,
      llmClient,
      sessionStore,
    });

    // Only use port fallback if port was not explicitly specified via CLI or environment
    const portExplicitlySpecified =
      cliOptions.port !== undefined || process.env.PORT !== undefined;
    const actualPort = portExplicitlySpecified
      ? await startServerOnExactPort(
          server,
          appConfig.runtime.port,
          appConfig.runtime.host
        )
      : await startServerWithPortFallback(
          server,
          appConfig.runtime.port,
          appConfig.runtime.host
        );

    const host = appConfig.runtime.host.includes(":")
      ? `[${appConfig.runtime.host}]`
      : appConfig.runtime.host;
    const localUrl = `http://${host}:${actualPort}/`;
    const adminUrl = `${localUrl.replace(/\/$/, "")}/serve-llm`;

    logger.info(
      { port: actualPort, host: appConfig.runtime.host, url: localUrl },
      `Sourcecodeless server ready at ${localUrl}`
    );
    if (appConfig.runtime.brief) {
      logger.info(
        { brief: appConfig.runtime.brief },
        "Initial brief configured"
      );
    } else {
      logger.info("Waiting for brief via browser UI…");
    }
    if (appConfig.providerReady) {
      logger.info(
        {
          provider: appConfig.provider.provider,
          model: appConfig.provider.model,
        },
        "LLM provider configured"
      );
    } else {
      logger.info(
        {
          provider: appConfig.provider.provider,
          model: appConfig.provider.model,
        },
        "LLM provider awaiting API key via setup wizard"
      );
    }
    logger.info({ adminUrl }, `Admin interface available at ${adminUrl}`);

    // Auto-launch browser
    try {
      await open(localUrl);
      logger.info("Browser launched automatically");
    } catch (error) {
      logger.warn({ err: error }, "Failed to auto-launch browser");
    }
  } catch (error) {
    handleFatalError(error);
  }
}

async function startServerOnExactPort(
  server: ReturnType<typeof createServer>,
  port: number,
  host: string
): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.removeListener("error", reject);
      resolve();
    });
  });
  return port;
}

async function startServerWithPortFallback(
  server: ReturnType<typeof createServer>,
  preferredPort: number,
  host: string
): Promise<number> {
  const MAX_PORT = preferredPort + 10;

  for (let port = preferredPort; port <= MAX_PORT; port += 1) {
    try {
      await new Promise<void>((resolve, reject) => {
        const errorHandler = (error: NodeJS.ErrnoException) => {
          if (error.code === "EADDRINUSE") {
            logger.debug({ port }, `Port ${port} is in use, trying next port`);
            reject(error);
          } else {
            reject(error);
          }
        };

        server.once("error", errorHandler);
        server.listen(port, host, () => {
          server.removeListener("error", errorHandler);
          resolve();
        });
      });

      return port;
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "EADDRINUSE"
      ) {
        if (port === MAX_PORT) {
          throw new Error(
            `No available ports found in range ${preferredPort}-${MAX_PORT}`
          );
        }
        continue;
      }
      throw error;
    }
  }

  throw new Error(
    `Failed to start server on any port in range ${preferredPort}-${MAX_PORT}`
  );
}

function printHelp(): void {
  console.log(`Usage: serve-llm [options] "App brief here"

Options:
  --port <number>            Port to bind the HTTP server (default: 3000, will try 3001-3010 if occupied)
  --host <hostname>          Host interface to bind (default: 127.0.0.1)
  --model <name>             Override the model identifier for the chosen provider
  --provider <openai|gemini|anthropic|grok|groq> Select the LLM provider explicitly
  --max-tokens <number>      Set maximum output tokens (default: 128000)
  --reasoning-mode <none|low|medium|high>  Configure reasoning effort when supported
  --reasoning-tokens <number> Token budget for reasoning/thinking features
  --history-limit <number>   Number of historical pages injected into prompts (default: 30)
  --history-bytes <number>   Maximum combined size (bytes) of history context passed to the LLM (default: 200000)
  --instructions-panel <on|off> Toggle the floating instructions panel (default: on)
  -h, --help                 Show this help message

Environment variables:
  OPENAI_API_KEY             API key for OpenAI models
  GEMINI_API_KEY             API key for Gemini models
  ANTHROPIC_API_KEY          API key for Anthropic models
  XAI_API_KEY                API key for Grok (xAI) models
  GROQ_API_KEY               API key for Groq models
  REASONING_MODE             Default reasoning mode (none|low|medium|high)
  REASONING_TOKENS           Default reasoning/thinking token budget
  INSTRUCTION_PANEL          Toggle instruction panel (on/off)
  MODEL                      Default model name when not provided via CLI
  PORT                       Default port when --port is omitted
  HOST                       Host interface to bind when --host is omitted
  HISTORY_LIMIT              Number of historical pages injected into prompts when --history-limit is omitted
  HISTORY_MAX_BYTES          Maximum combined size (bytes) of history context passed to the LLM

Note: The server will automatically open your default web browser and try ports 3000-3010 if the preferred port is occupied.
`);
}

function handleFatalError(error: unknown): void {
  if (error instanceof Error) {
    logger.fatal({ err: error }, "Fatal error");
  } else {
    logger.fatal({ error: String(error) }, "Fatal error");
  }
  process.exitCode = 1;
}

await main();
