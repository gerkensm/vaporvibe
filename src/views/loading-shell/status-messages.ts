import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ASSET_FILE = "status-messages.json";

let cachedStatusMessages: readonly string[] | null = null;

function readStatusMessagesAsset(): string {
  const preferredPath = resolvePath(__dirname, "assets", ASSET_FILE);
  if (existsSync(preferredPath)) {
    return readFileSync(preferredPath, "utf8");
  }

  const fallbackPath = resolvePath(
    process.cwd(),
    "src/views/loading-shell/assets",
    ASSET_FILE
  );
  if (existsSync(fallbackPath)) {
    return readFileSync(fallbackPath, "utf8");
  }

  throw new Error("Unable to locate loading shell status messages asset");
}

export function getStatusMessages(): readonly string[] {
  if (!cachedStatusMessages) {
    const raw = readStatusMessagesAsset();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
      throw new Error("Invalid status messages payload");
    }
    cachedStatusMessages = parsed;
  }

  return cachedStatusMessages;
}

