#!/usr/bin/env node
import process from "node:process";
import { parseCliArgs } from "./cli/args.js";
import { resolveAppConfig } from "./config/runtime-config.js";
import { createLlmClient } from "./llm/factory.js";
import { SessionStore } from "./server/session-store.js";
import { createServer } from "./server/server.js";
import { logger } from "./logger.js";
async function main() {
    try {
        const cliOptions = parseCliArgs(process.argv.slice(2));
        if (cliOptions.showHelp) {
            printHelp();
            return;
        }
        const appConfig = await resolveAppConfig(cliOptions, process.env);
        const llmClient = appConfig.providerReady ? createLlmClient(appConfig.provider) : null;
        const sessionStore = new SessionStore(appConfig.runtime.sessionTtlMs, appConfig.runtime.sessionCap);
        const server = createServer({
            runtime: appConfig.runtime,
            provider: appConfig.provider,
            providerLocked: appConfig.providerLocked,
            llmClient,
            sessionStore,
        });
        await new Promise((resolve) => {
            server.listen(appConfig.runtime.port, appConfig.runtime.host, () => {
                const host = appConfig.runtime.host.includes(":")
                    ? `[${appConfig.runtime.host}]`
                    : appConfig.runtime.host;
                const localUrl = `http://${host}:${appConfig.runtime.port}/`;
                const adminUrl = `${localUrl.replace(/\/$/, "")}/serve-llm`;
                logger.info({ port: appConfig.runtime.port, host: appConfig.runtime.host, url: localUrl }, `Sourcecodeless server ready at ${localUrl}`);
                if (appConfig.runtime.brief) {
                    logger.info({ brief: appConfig.runtime.brief }, "Initial brief configured");
                }
                else {
                    logger.info("Waiting for brief via browser UI…");
                }
                if (appConfig.providerReady) {
                    logger.info({ provider: appConfig.provider.provider, model: appConfig.provider.model }, "LLM provider configured");
                }
                else {
                    logger.info({ provider: appConfig.provider.provider, model: appConfig.provider.model }, "LLM provider awaiting API key via setup wizard");
                }
                logger.info({ adminUrl }, `Admin interface available at ${adminUrl}`);
                resolve();
            });
        });
    }
    catch (error) {
        handleFatalError(error);
    }
}
function printHelp() {
    console.log(`Usage: serve-llm [options] "App brief here"

Options:
  --port <number>            Port to bind the HTTP server (default: 3000)
  --host <hostname>          Host interface to bind (default: 127.0.0.1)
  --model <name>             Override the model identifier for the chosen provider
  --provider <openai|gemini|anthropic|grok> Select the LLM provider explicitly
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
  REASONING_MODE             Default reasoning mode (none|low|medium|high)
  REASONING_TOKENS           Default reasoning/thinking token budget
  INSTRUCTION_PANEL          Toggle instruction panel (on/off)
  MODEL                      Default model name when not provided via CLI
  PORT                       Default port when --port is omitted
  HOST                       Host interface to bind when --host is omitted
  HISTORY_LIMIT              Number of historical pages injected into prompts when --history-limit is omitted
  HISTORY_MAX_BYTES          Maximum combined size (bytes) of history context passed to the LLM
`);
}
function handleFatalError(error) {
    if (error instanceof Error) {
        logger.fatal({ err: error }, "Fatal error");
    }
    else {
        logger.fatal({ error: String(error) }, "Fatal error");
    }
    process.exitCode = 1;
}
await main();
