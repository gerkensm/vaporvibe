#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
OUTPUT_ROOT="${ROOT_DIR}/out/macos-app"
APP_NAME="ServeLLM"
APP_BUNDLE="${OUTPUT_ROOT}/${APP_NAME}.app"
RESOURCES_DIR="${APP_BUNDLE}/Contents/Resources"
MACOS_DIR="${APP_BUNDLE}/Contents/MacOS"
SEA_BINARY="${ROOT_DIR}/out/sea/serve-llm-macos"
ICON_SOURCE="${SCRIPT_DIR}/VaporVibeIcon.icns"
INFO_PLIST="${APP_BUNDLE}/Contents/Info.plist"
VERSION="$(cd "${ROOT_DIR}" && node -p "require('./package.json').version" 2>/dev/null || echo "0.0.0")"

if [[ ! -f "${SEA_BINARY}" ]]; then
  echo "SEA binary ${SEA_BINARY} not found. Run \"npm run build:sea\" first." >&2
  exit 1
fi

mkdir -p "${OUTPUT_ROOT}"
rm -rf "${APP_BUNDLE}"
mkdir -p "${RESOURCES_DIR}" "${MACOS_DIR}"

if [[ ! -f "${ICON_SOURCE}" ]]; then
  echo "App icon missing. Generate it via scripts/macos-app/create-icon-assets.sh" >&2
else
  cp "${ICON_SOURCE}" "${RESOURCES_DIR}/VaporVibeIcon.icns"
fi

cat > "${INFO_PLIST}" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleDisplayName</key>
  <string>Serve LLM</string>
  <key>CFBundleExecutable</key>
  <string>ServeLLMLauncher</string>
  <key>CFBundleIconFile</key>
  <string>VaporVibeIcon</string>
  <key>CFBundleIdentifier</key>
  <string>com.gerkensm.serve-llm</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>Serve LLM</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>${VERSION}</string>
  <key>CFBundleVersion</key>
  <string>${VERSION}</string>
  <key>LSMinimumSystemVersion</key>
  <string>11.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST

cp "${SEA_BINARY}" "${RESOURCES_DIR}/serve-llm-macos"
chmod +x "${RESOURCES_DIR}/serve-llm-macos"

SWIFT_BIN="$(command -v swiftc || true)"
if [[ -z "${SWIFT_BIN}" ]]; then
  echo "swiftc not found. Install Xcode command line tools." >&2
  exit 1
fi

MODULE_CACHE="${OUTPUT_ROOT}/swift-module-cache"
mkdir -p "${MODULE_CACHE}"

"${SWIFT_BIN}" \
  -module-cache-path "${MODULE_CACHE}" \
  -target arm64-apple-macos11.0 \
  "${SCRIPT_DIR}/ServeLLMLauncher.swift" \
  -o "${MACOS_DIR}/ServeLLMLauncher"

chmod +x "${MACOS_DIR}/ServeLLMLauncher"

cat <<'EOF'
→ macOS app bundle created at out/macos-app/ServeLLM.app

Next steps:
  1. codesign --deep --force --options runtime --timestamp --sign "Developer ID Application: …" out/macos-app/ServeLLM.app
  2. zip or wrap the .app in a DMG/PKG, then notarize and staple the outer artifact
EOF
