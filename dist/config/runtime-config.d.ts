import type { AppConfig } from "../types.js";
import type { CliOptions } from "../cli/args.js";
export declare function resolveAppConfig(options: CliOptions, env: NodeJS.ProcessEnv): Promise<AppConfig>;
