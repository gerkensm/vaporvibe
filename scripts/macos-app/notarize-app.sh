#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

DEFAULT_TARGET="dmg"
TARGET="${1:-$DEFAULT_TARGET}"

case "$TARGET" in
  dmg|app) ;;
  *)
    echo "Usage: $0 [dmg|app]" >&2
    exit 1
    ;;
esac

DMG_PATH="${ROOT_DIR}/out/macos-app/ServeLLM.dmg"
APP_PATH="${ROOT_DIR}/out/macos-app/ServeLLM.app"
ZIP_PATH="${ROOT_DIR}/out/macos-app/ServeLLM-app.zip"

if [[ "$TARGET" == "dmg" && ! -f "$DMG_PATH" ]]; then
  echo "⚠️  DMG not found at $DMG_PATH; falling back to app bundle." >&2
  TARGET="app"
fi

if [[ "$TARGET" == "app" && ! -d "$APP_PATH" ]]; then
  echo "❌ App bundle not found at $APP_PATH" >&2
  echo "   Run npm run macos:app first." >&2
  exit 1
fi

if [[ "$TARGET" == "dmg" ]]; then
  ARTIFACT_PATH="$DMG_PATH"
  ARTIFACT_LABEL="ServeLLM.dmg"
else
  ARTIFACT_PATH="$ZIP_PATH"
  ARTIFACT_LABEL="ServeLLM.app (zip)"
fi

REQUIRED_VARS=("APPLE_KEYCHAIN_PROFILE")
MISSING=()
for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    MISSING+=("$var")
  fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo "❌ Missing required environment variables: ${MISSING[*]}" >&2
  echo "   Configure xcrun notarytool credentials and export APPLE_KEYCHAIN_PROFILE." >&2
  exit 1
fi

if [[ "$TARGET" == "app" ]]; then
  echo "→ Preparing zip archive for notarizing ServeLLM.app…"
  rm -f "$ZIP_PATH"
  /usr/bin/ditto -c -k --keepParent "$APP_PATH" "$ZIP_PATH"
fi

echo "→ Submitting $ARTIFACT_LABEL to Apple Notary Service (this may take a few minutes)…"

if ! xcrun notarytool submit "$ARTIFACT_PATH" --keychain-profile "$APPLE_KEYCHAIN_PROFILE" --wait; then
  echo "❌ Notarization failed. Inspect the submission log via:" >&2
  echo "   xcrun notarytool history --keychain-profile $APPLE_KEYCHAIN_PROFILE" >&2
  exit 1
fi

if [[ "$TARGET" == "dmg" ]]; then
  echo "→ Stapling notarization ticket to DMG…"
  xcrun stapler staple "$DMG_PATH"
  echo "→ Validating stapled DMG…"
  xcrun stapler validate "$DMG_PATH"
else
  echo "→ Stapling notarization ticket to ServeLLM.app…"
  xcrun stapler staple "$APP_PATH"
fi

echo "→ Gatekeeper check (spctl)"
if [[ "$TARGET" == "dmg" ]]; then
  spctl -a -t open -vv "$DMG_PATH"
else
  spctl -a -t exec -vv "$APP_PATH"
fi

echo "✅ Notarization and stapling complete for $ARTIFACT_LABEL"

if [[ "$TARGET" == "app" ]]; then
  echo "ℹ️  The intermediate zip remains at $ZIP_PATH (remove manually if desired)."
fi
