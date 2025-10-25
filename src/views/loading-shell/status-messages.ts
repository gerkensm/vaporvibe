import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ASSET_FILE = "status-messages.json";

export interface StatusMessageDefinition {
  id: string;
  headline: string;
  hint?: string;
  mood: string;
  energy: string;
  category: string;
  tags?: readonly string[];
}

let cachedStatusMessages: readonly StatusMessageDefinition[] | null = null;

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

function validateStatusMessage(value: unknown): value is StatusMessageDefinition {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || record.id.trim().length === 0) {
    return false;
  }
  if (typeof record.headline !== "string" || record.headline.trim().length === 0) {
    return false;
  }
  if (typeof record.mood !== "string" || record.mood.trim().length === 0) {
    return false;
  }
  if (typeof record.energy !== "string" || record.energy.trim().length === 0) {
    return false;
  }
  if (typeof record.category !== "string" || record.category.trim().length === 0) {
    return false;
  }
  if (
    Object.prototype.hasOwnProperty.call(record, "hint") &&
    record.hint !== undefined &&
    typeof record.hint !== "string"
  ) {
    return false;
  }
  if (
    Object.prototype.hasOwnProperty.call(record, "tags") &&
    record.tags !== undefined
  ) {
    if (!Array.isArray(record.tags)) {
      return false;
    }
    if (!record.tags.every((tag) => typeof tag === "string")) {
      return false;
    }
  }
  return true;
}

function shuffleStatusMessages(
  messages: readonly StatusMessageDefinition[]
): StatusMessageDefinition[] {
  const scrambled = [...messages];
  for (let i = scrambled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [scrambled[i], scrambled[j]] = [scrambled[j], scrambled[i]];
  }
  return scrambled;
}

export function getStatusMessages(options?: {
  randomize?: boolean;
}): readonly StatusMessageDefinition[] {
  if (!cachedStatusMessages) {
    const raw = readStatusMessagesAsset();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((item) => validateStatusMessage(item))) {
      throw new Error("Invalid status messages payload");
    }
    cachedStatusMessages = parsed.map((item) => ({
      ...item,
      tags: Array.isArray(item.tags) ? [...new Set(item.tags)] : undefined,
    }));
  }

  if (options?.randomize) {
    return shuffleStatusMessages(cachedStatusMessages);
  }

  return cachedStatusMessages;
}

