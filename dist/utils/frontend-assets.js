import { existsSync } from "node:fs";
import { resolve } from "node:path";
const FRONTEND_ASSETS_DIR = resolve(process.cwd(), "frontend/dist/assets");
const DEFAULT_DEV_SERVER_URL = "http://localhost:5173";
function getDevServerBaseUrl() {
    const raw = process.env.SERVE_LLM_DEV_SERVER_URL;
    const base = raw && raw.trim().length > 0 ? raw.trim() : DEFAULT_DEV_SERVER_URL;
    return base.replace(/\/$/, "");
}
export function resolveScriptSource(assetFile, devEntry) {
    const assetPath = resolve(FRONTEND_ASSETS_DIR, assetFile);
    if (existsSync(assetPath)) {
        return { url: `/assets/${assetFile}`, mode: "asset" };
    }
    const baseUrl = getDevServerBaseUrl();
    const entryPath = devEntry.startsWith("/") ? devEntry : `/${devEntry}`;
    return { url: `${baseUrl}${entryPath}`, mode: "dev" };
}
