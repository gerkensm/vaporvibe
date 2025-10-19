#!/usr/bin/env bash

set -euo pipefail

if [[ "$(uname)" != "Darwin" ]]; then
  echo "Warning: this helper is tuned for macOS binaries (current: $(uname))." >&2
# Note: keytar native bindings
# - keytar's .node files are bundled in the SEA blob via node_modules traversal
# - At runtime, they're extracted to a temp directory
# - If extraction fails, the credential store falls back to memory-only storage
# - For production macOS app bundles, native modules should be pre-extracted and signed
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pushd "$ROOT_DIR" >/dev/null

if ! command -v node >/dev/null 2>&1; then
  echo "node executable not found in PATH." >&2
  exit 1
fi

NODE_VERSION="$(node -v)"
MIN_MAJOR=20
NODE_MAJOR="${NODE_VERSION#v}"
NODE_MAJOR="${NODE_MAJOR%%.*}"
if (( NODE_MAJOR < MIN_MAJOR )); then
  echo "Node ${MIN_MAJOR}.x or newer is required for SEA (found ${NODE_VERSION})." >&2
  exit 1
fi

echo "→ Building TypeScript sources…"
npm run build

SEA_OUT="${ROOT_DIR}/out/sea"
rm -rf "${SEA_OUT}"
mkdir -p "${SEA_OUT}"

PACKAGE_VERSION="$(node -p "require('./package.json').version")"

ENTRY_SCRIPT="${SEA_OUT}/vaporvibe-entry.cjs"
cat > "${ENTRY_SCRIPT}" <<CJS
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { pathToFileURL } = require("node:url");

const ASSET_VERSION = "${PACKAGE_VERSION}";

const { basename, resolve, join, dirname } = path;

const execBasename = basename(process.execPath);
const runningViaNode = execBasename === "node" || execBasename === "node.exe";

async function runFromFilesystem(distRoot) {
  const target = resolve(distRoot, "index.js");
  await import(pathToFileURL(target).href);
}

(async () => {
  try {
    if (process.env.NODE_SEA_BUILD === "1") {
      return;
    }

    if (runningViaNode) {
      await runFromFilesystem(resolve(__dirname, "..", "..", "dist"));
      return;
    }

    let sea;
    try {
      sea = require("node:sea");
    } catch {
      sea = null;
    }

    const inSea = sea && typeof sea.isSea === "function" && sea.isSea();
    if (!inSea) {
      await runFromFilesystem(resolve(__dirname, "..", "..", "dist"));
      return;
    }

    const extractRoot = fs.mkdtempSync(join(os.tmpdir(), "vaporvibe-" + ASSET_VERSION + "-"));
    const distRoot = join(extractRoot, "dist");
    fs.mkdirSync(distRoot, { recursive: true });

    const keys = typeof sea.getAssetKeys === "function" ? sea.getAssetKeys() : [];
    for (const key of keys) {
      if (
        !key.startsWith("dist/") &&
        !key.startsWith("node_modules/") &&
        !key.startsWith("frontend/")
      ) {
        continue;
      }
      const asset = sea.getAsset(key);
      const buffer = Buffer.from(asset);
      const outputPath = join(extractRoot, key);
      fs.mkdirSync(dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, buffer);
    }

    await runFromFilesystem(distRoot);
  } catch (error) {
    console.error("Failed to start vaporvibe from SEA bundle:", error);
    process.exit(1);
  }
})();
CJS

CONFIG_PATH="${SEA_OUT}/sea-config.json"
node - "${ROOT_DIR}" "${CONFIG_PATH}" "${ENTRY_SCRIPT}" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const [rootDir, configPath, entryScriptPath] = process.argv.slice(2);
const blobOutputPath = path.join(rootDir, "out", "sea", "vaporvibe.blob");
const distDir = path.join(rootDir, "dist");
const nodeModulesDir = path.join(rootDir, "node_modules");
const frontendDistDir = path.join(rootDir, "frontend", "dist");
const pkgJsonPath = path.join(rootDir, "package.json");

if (!fs.existsSync(distDir)) {
  console.error("dist directory missing. Run \"npm run build\" before building SEA.");
  process.exit(1);
}

const assets = {};

/**
 * Recursively collect dist assets so they can be hydrated at runtime.
 */
const skipSuffixes = [".d.ts", ".d.mts", ".d.cts", ".map"];

const visit = dir => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      visit(fullPath);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (skipSuffixes.some(suffix => entry.name.endsWith(suffix))) {
      continue;
    }
    const relativeKey = path.relative(rootDir, fullPath).replace(/\\/g, "/");
    assets[relativeKey] = fullPath;
  }
};

visit(distDir);

if (fs.existsSync(frontendDistDir)) {
  visit(frontendDistDir);
} else {
  console.warn(
    "Warning: frontend/dist directory missing. Run \"npm run build:fe\" before building SEA."
  );
}

if (fs.existsSync(pkgJsonPath) && fs.existsSync(nodeModulesDir)) {
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
  const dependencies = Object.keys(pkg.dependencies ?? {});
  const lockPath = path.join(rootDir, "package-lock.json");

  if (fs.existsSync(lockPath)) {
    const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    const packages = lock.packages ?? {};
    const visited = new Set();
    const queue = [];

    for (const depName of dependencies) {
      queue.push(`node_modules/${depName}`);
    }

    while (queue.length > 0) {
      const key = queue.shift();
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);

      const packageDir = path.join(rootDir, key);
      if (fs.existsSync(packageDir)) {
        visit(packageDir);
      }

      const meta = packages[key];
      if (!meta || !meta.dependencies) {
        continue;
      }

      for (const childName of Object.keys(meta.dependencies)) {
        const nestedKey = `${key}/node_modules/${childName}`;
        if (packages[nestedKey] || fs.existsSync(path.join(rootDir, nestedKey))) {
          queue.push(nestedKey);
          continue;
        }

        const rootKey = `node_modules/${childName}`;
        if (!visited.has(rootKey) && (packages[rootKey] || fs.existsSync(path.join(rootDir, rootKey)))) {
          queue.push(rootKey);
        }
      }
    }
  } else {
    for (const depName of dependencies) {
      const depDir = path.join(nodeModulesDir, depName);
      if (fs.existsSync(depDir)) {
        visit(depDir);
      }
    }
  }
}

const config = {
  main: path.relative(rootDir, entryScriptPath).replace(/\\/g, "/"),
  output: path.relative(rootDir, blobOutputPath).replace(/\\/g, "/"),
  disableExperimentalSEAWarning: true,
  assets
};

fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
NODE

echo "→ Generating SEA blob…"
NODE_SEA_BUILD=1 node --experimental-sea-config "${SEA_OUT}/sea-config.json"

NODE_BIN="$(command -v node)"
TARGET_BIN="${SEA_OUT}/vaporvibe-macos"
cp "${NODE_BIN}" "${TARGET_BIN}"
chmod +w "${TARGET_BIN}"

if [[ "$(uname)" == "Darwin" ]] && command -v codesign >/dev/null 2>&1; then
  echo "→ Removing existing code signature…"
  codesign --remove-signature "${TARGET_BIN}" >/dev/null 2>&1 || true
fi

echo "→ Stamping blob into launcher…"
npx --yes postject@1.0.0-alpha.6 "${TARGET_BIN}" NODE_SEA_BLOB "${SEA_OUT}/vaporvibe.blob" \
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 \
  --macho-segment-name NODE_SEA

chmod +x "${TARGET_BIN}"

if [[ "$(uname)" == "Darwin" ]] && command -v codesign >/dev/null 2>&1; then
  # Check if we should use Developer ID signing for notarization
  if [[ -n "${APPLE_TEAM_ID:-}" ]] && [[ "${NOTARIZE:-false}" == "true" ]]; then
    echo "→ Applying Developer ID code signature with entitlements…"
    ENTITLEMENTS_PATH="${ROOT_DIR}/scripts/entitlements.plist"
    
    # Find Developer ID certificate
    CERT_NAME=$(security find-identity -v -p codesigning | \
      grep "Developer ID Application" | \
      grep "$APPLE_TEAM_ID" | \
      head -1 | \
      sed -E 's/.*"(.+)"/\1/')
    
    if [[ -n "$CERT_NAME" ]]; then
      echo "   Using certificate: $CERT_NAME"
      codesign --force \
        --sign "$CERT_NAME" \
        --options runtime \
        --timestamp \
        --entitlements "$ENTITLEMENTS_PATH" \
        "${TARGET_BIN}"
      echo "   Binary signed for notarization"
    else
      echo "   Warning: No Developer ID certificate found, using ad-hoc signature"
      codesign --force --sign - "${TARGET_BIN}"
    fi
  else
    echo "→ Applying ad-hoc code signature…"
    codesign --force --sign - "${TARGET_BIN}"
  fi
fi

echo ""
echo "Standalone binary ready at:"
echo "  ${TARGET_BIN}"
echo ""
popd >/dev/null
