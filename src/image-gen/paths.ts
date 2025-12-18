import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolvePath(moduleDir, "..", "..");

export const GENERATED_IMAGES_DIR = resolvePath(
  PROJECT_ROOT,
  "dist",
  "public",
  "generated-images"
);

export const GENERATED_IMAGES_ROUTE = "/generated-images";

export const RUNTIME_DIST_DIR = resolvePath(
  PROJECT_ROOT,
  "frontend",
  "dist",
  "runtime"
);

export const RUNTIME_SOURCE_DIR = resolvePath(
  PROJECT_ROOT,
  "frontend",
  "public",
  "runtime"
);

export function getGeneratedImagePath(hash: string): {
  filePath: string;
  route: string;
} {
  return {
    filePath: resolvePath(GENERATED_IMAGES_DIR, `${hash}.png`),
    route: `${GENERATED_IMAGES_ROUTE}/${hash}.png`,
  };
}
