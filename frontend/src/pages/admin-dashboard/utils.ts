
import type { CustomModelConfig } from "../../components";
import { ADMIN_ROUTE_PREFIX, DEFAULT_CUSTOM_MODEL_CONFIG } from "./constants";
import { TAB_ORDER } from "./constants";
import { type TabKey } from "./types";

export function createDefaultCustomConfig(): CustomModelConfig {
    return { ...DEFAULT_CUSTOM_MODEL_CONFIG };
}

export const isAdminPath = (path: string) => path.startsWith(ADMIN_ROUTE_PREFIX);

export const normalizeAdminPath = (path: string) => {
    if (path === ADMIN_ROUTE_PREFIX) return ADMIN_ROUTE_PREFIX + "/";
    return path;
};

export function isTabKey(key: string): key is TabKey {
    return TAB_ORDER.includes(key as TabKey);
}

export function getTabFromPath(pathname: string): TabKey {
    // If we are at the root admin path (e.g. /vaporvibe or /vaporvibe/), redirect to provider
    const normalized = normalizeAdminPath(pathname);
    if (
        normalized === ADMIN_ROUTE_PREFIX + "/" ||
        normalized === ADMIN_ROUTE_PREFIX
    ) {
        return "provider";
    }

    // Extract the last segment
    const parts = normalized.split("/");
    const lastPart = parts[parts.length - 1];

    if (isTabKey(lastPart)) {
        return lastPart;
    }

    return "provider"; // Default fallback
}

export function createTabPath(tab: TabKey): string {
    return `${ADMIN_ROUTE_PREFIX}/${tab}`;
}

export const clamp = (num: number, min: number, max: number) =>
    Math.min(Math.max(num, min), max);
