#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
OUTPUT_ROOT="${ROOT_DIR}/out/macos-app"
APP_BUNDLE="${OUTPUT_ROOT}/VaporVibe.app"
DMG_NAME="VaporVibe.dmg"
DMG_PATH="${OUTPUT_ROOT}/${DMG_NAME}"
STAGING_DIR="${OUTPUT_ROOT}/dmg-staging"
VOL_NAME="VaporVibe"

if [[ ! -d "${APP_BUNDLE}" ]]; then
  echo "App bundle ${APP_BUNDLE} not found. Run scripts/macos-app/build-app-bundle.sh first." >&2
  exit 1
fi
mkdir -p "${OUTPUT_ROOT}"

# Clean up any existing DMG and staging directory
rm -f "${DMG_PATH}"
rm -rf "${STAGING_DIR}"
mkdir -p "${STAGING_DIR}"

cp -R "${APP_BUNDLE}" "${STAGING_DIR}/VaporVibe.app"
ln -s /Applications "${STAGING_DIR}/Applications"

if command -v create-dmg >/dev/null 2>&1; then
  # Remove DMG again before create-dmg (it sometimes creates temp files)
  rm -f "${DMG_PATH}"
  create-dmg --volname "${VOL_NAME}" --window-pos 200 120 --window-size 540 400 \
    --icon "VaporVibe.app" 140 200 --icon "Applications" 400 200 \
    "${DMG_PATH}" "${STAGING_DIR}"
else
  echo "→ create-dmg not found; using hdiutil fallback"
  hdiutil create -volname "${VOL_NAME}" -srcfolder "${STAGING_DIR}" -ov -format UDZO "${DMG_PATH}" >/dev/null
fi

rm -rf "${STAGING_DIR}"

echo "→ DMG created at ${DMG_PATH}"

echo "Notarization reminder:"
echo "  xcrun notarytool submit ${DMG_PATH} --keychain-profile <profile> --wait"
echo "  xcrun stapler staple ${DMG_PATH}"
