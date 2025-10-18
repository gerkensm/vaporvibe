import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const sourceDir = resolve(projectRoot, "src/views/loading-shell/assets");
const targetDir = resolve(projectRoot, "dist/views/loading-shell/assets");

if (!existsSync(sourceDir)) {
  console.error("Loading shell assets missing:", sourceDir);
  process.exit(1);
}

mkdirSync(resolve(projectRoot, "dist/views/loading-shell"), { recursive: true });
cpSync(sourceDir, targetDir, { recursive: true });
