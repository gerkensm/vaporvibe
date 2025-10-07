#!/usr/bin/env bash

set -euo pipefail

if [[ "$(uname)" != "Darwin" ]]; then
  echo "Warning: this helper is tuned for macOS binaries (current: $(uname))." >&2
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

ENTRY_SCRIPT="${SEA_OUT}/serve-llm-entry.cjs"
cat > "${ENTRY_SCRIPT}" <<'CJS'
const { pathToFileURL } = require("node:url");
const { resolve } = require("node:path");

(async () => {
  try {
    const target = resolve(__dirname, "..", "..", "dist/index.js");
    await import(pathToFileURL(target).href);
  } catch (error) {
    console.error("Failed to start serve-llm from SEA bundle:", error);
    process.exit(1);
  }
})();
CJS

cat > "${SEA_OUT}/sea-config.json" <<'JSON'
{
  "main": "./out/sea/serve-llm-entry.cjs",
  "output": "./out/sea/serve-llm.blob",
  "disableExperimentalSEAWarning": true
}
JSON

echo "→ Generating SEA blob…"
node --experimental-sea-config "${SEA_OUT}/sea-config.json"

NODE_BIN="$(command -v node)"
TARGET_BIN="${SEA_OUT}/serve-llm-macos"
cp "${NODE_BIN}" "${TARGET_BIN}"
chmod +w "${TARGET_BIN}"

if [[ "$(uname)" == "Darwin" ]] && command -v codesign >/dev/null 2>&1; then
  echo "→ Removing existing code signature…"
  codesign --remove-signature "${TARGET_BIN}" >/dev/null 2>&1 || true
fi

echo "→ Stamping blob into launcher…"
npx --yes postject@1.0.0-alpha.6 "${TARGET_BIN}" NODE_SEA_BLOB "${SEA_OUT}/serve-llm.blob" \
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 \
  --macho-segment-name NODE_SEA

chmod +x "${TARGET_BIN}"

if [[ "$(uname)" == "Darwin" ]] && command -v codesign >/dev/null 2>&1; then
  echo "→ Applying ad-hoc code signature…"
  codesign --force --sign - "${TARGET_BIN}"
fi

echo ""
echo "Standalone binary ready at:"
echo "  ${TARGET_BIN}"
echo ""
popd >/dev/null
