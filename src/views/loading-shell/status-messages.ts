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

function collectStatusMessageValidationErrors(value: unknown): readonly string[] {
  if (typeof value !== "object" || value === null) {
    return ["Expected an object but received a non-object value."];
  }

  const record = value as Record<string, unknown>;
  const errors: string[] = [];

  const requiredStringFields: readonly (keyof Pick<
    StatusMessageDefinition,
    "id" | "headline" | "mood" | "energy" | "category"
  >)[] = ["id", "headline", "mood", "energy", "category"];

  requiredStringFields.forEach((field) => {
    const fieldValue = record[field];
    if (typeof fieldValue !== "string" || fieldValue.trim().length === 0) {
      errors.push(`Field "${field}" must be a non-empty string.`);
    }
  });

  if (
    Object.prototype.hasOwnProperty.call(record, "hint") &&
    record.hint !== undefined &&
    typeof record.hint !== "string"
  ) {
    errors.push('Field "hint" must be a string when provided.');
  }

  if (
    Object.prototype.hasOwnProperty.call(record, "tags") &&
    record.tags !== undefined
  ) {
    if (!Array.isArray(record.tags)) {
      errors.push('Field "tags" must be an array of strings.');
    } else {
      const invalidTagIndexes = record.tags
        .map((tag, index) => (typeof tag === "string" ? null : index))
        .filter((index): index is number => index !== null);
      if (invalidTagIndexes.length > 0) {
        errors.push(
          `Field "tags" must be an array of strings (invalid entries at indexes: ${invalidTagIndexes.join(", ")}).`
        );
      }
    }
  }

  return errors;
}

function validateStatusMessage(value: unknown): value is StatusMessageDefinition {
  return collectStatusMessageValidationErrors(value).length === 0;
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
    if (!Array.isArray(parsed)) {
      throw new Error("Invalid status messages payload: expected an array.");
    }

    const validationFailures: string[] = [];
    parsed.forEach((item, index) => {
      const errors = collectStatusMessageValidationErrors(item);
      if (errors.length > 0) {
        validationFailures.push(
          `Entry at index ${index} is invalid: ${errors.join(" ")}`
        );
      }
    });

    if (validationFailures.length > 0) {
      throw new Error(
        `Invalid status messages payload:\n${validationFailures.join("\n")}`
      );
    }

    cachedStatusMessages = (parsed as StatusMessageDefinition[]).map((item) => ({
      ...item,
      tags: Array.isArray(item.tags) ? [...new Set(item.tags)] : undefined,
    }));
  }

  if (options?.randomize) {
    return shuffleStatusMessages(cachedStatusMessages);
  }

  return cachedStatusMessages;
}

