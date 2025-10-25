import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ADMIN_ROUTE_PREFIX } from "../constants.js";

const moduleDir = dirname(fileURLToPath(import.meta.url));
let cachedAssetsDir: string | undefined;

const ADMIN_ASSET_ROUTE_PREFIX = "/vaporvibe/assets";
const ADMIN_ASSET_ROUTE_PREFIX_WITH_SLASH = `${ADMIN_ASSET_ROUTE_PREFIX}/`;

function findFrontendAssetsDir(): string | null {
  if (cachedAssetsDir && existsSync(cachedAssetsDir)) {
    return cachedAssetsDir;
  }

  const candidates = [
    resolve(moduleDir, "..", "..", "frontend", "dist", "assets"),
    resolve(process.cwd(), "frontend", "dist", "assets"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      cachedAssetsDir = candidate;
      return candidate;
    }
  }

  cachedAssetsDir = undefined;
  return null;
}

const DEFAULT_DEV_SERVER_URL = "http://localhost:5173";

function getDevServerBaseUrl(): string {
  const raw = process.env.SERVE_LLM_DEV_SERVER_URL;
  const base = raw && raw.trim().length > 0 ? raw.trim() : DEFAULT_DEV_SERVER_URL;
  return base.replace(/\/$/, "");
}

export function resolveScriptSource(
  assetFile: string,
  devEntry: string
): { url: string; mode: "asset" | "dev" } {
  const preferDevFrontend = process.env.VAPORVIBE_PREFER_DEV_FRONTEND === "1";
  const assetsDir = findFrontendAssetsDir();

  if (!preferDevFrontend && assetsDir) {
    const assetPath = resolve(assetsDir, assetFile);
    if (existsSync(assetPath)) {
      return {
        url: `${ADMIN_ASSET_ROUTE_PREFIX_WITH_SLASH}${assetFile}`,
        mode: "asset",
      };
    }
  }

  const entryPath = devEntry.startsWith("/") ? devEntry : `/${devEntry}`;

  if (preferDevFrontend) {
    return { url: entryPath, mode: "dev" };
  }

  const baseUrl = getDevServerBaseUrl();
  return { url: `${baseUrl}${entryPath}`, mode: "dev" };
}
