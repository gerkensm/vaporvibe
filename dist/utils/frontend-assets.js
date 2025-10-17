import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const moduleDir = dirname(fileURLToPath(import.meta.url));
let cachedAssetsDir;
function findFrontendAssetsDir() {
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
function getDevServerBaseUrl() {
    const raw = process.env.SERVE_LLM_DEV_SERVER_URL;
    const base = raw && raw.trim().length > 0 ? raw.trim() : DEFAULT_DEV_SERVER_URL;
    return base.replace(/\/$/, "");
}
export function resolveScriptSource(assetFile, devEntry) {
    const assetsDir = findFrontendAssetsDir();
    if (assetsDir) {
        const assetPath = resolve(assetsDir, assetFile);
        if (existsSync(assetPath)) {
            return { url: `/assets/${assetFile}`, mode: "asset" };
        }
    }
    const baseUrl = getDevServerBaseUrl();
    const entryPath = devEntry.startsWith("/") ? devEntry : `/${devEntry}`;
    return { url: `${baseUrl}${entryPath}`, mode: "dev" };
}
