#!/usr/bin/env bash
# Notarize and staple macOS artifacts
# Usage: notarize-app.sh [app|dmg]
#
# IMPORTANT: For proper DMG distribution:
#   1. First run with 'app' to notarize/staple the app bundle
#   2. Then create the DMG from the stapled app
#   3. Finally run with 'dmg' to notarize/staple the DMG
#
# This ensures both the app inside the DMG and the DMG itself have stapled tickets

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

DEFAULT_TARGET="app"
TARGET="${1:-$DEFAULT_TARGET}"

case "$TARGET" in
  dmg|app) ;;
  *)
    echo "Usage: $0 [app|dmg]" >&2
    echo "" >&2
    echo "Options:" >&2
    echo "  app  - Notarize and staple the app bundle (do this BEFORE creating DMG)" >&2
    echo "  dmg  - Notarize and staple the DMG (do this AFTER creating DMG)" >&2
    exit 1
    ;;
esac

DMG_PATH="${ROOT_DIR}/out/macos-app/VaporVibe.dmg"
APP_PATH="${ROOT_DIR}/out/macos-app/VaporVibe.app"
ZIP_PATH="${ROOT_DIR}/out/macos-app/VaporVibe-app.zip"

if [[ "$TARGET" == "dmg" && ! -f "$DMG_PATH" ]]; then
  echo "⚠️  DMG not found at $DMG_PATH; falling back to app bundle." >&2
  TARGET="app"
fi

if [[ "$TARGET" == "app" && ! -d "$APP_PATH" ]]; then
  echo "❌ App bundle not found at $APP_PATH" >&2
  echo "   Run npm run macos:app first." >&2
  exit 1
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
  ARTIFACT_PATH="$ZIP_PATH"
  ARTIFACT_LABEL="VaporVibe.app"
  
  # Notarize and staple the app bundle
  echo "→ Notarizing and stapling VaporVibe.app…"
  rm -f "$ZIP_PATH"
  /usr/bin/ditto -c -k --keepParent "$APP_PATH" "$ZIP_PATH"

  echo "→ Submitting VaporVibe.app to Apple Notary Service (this may take a few minutes)…"
  if ! xcrun notarytool submit "$ZIP_PATH" --keychain-profile "$APPLE_KEYCHAIN_PROFILE" --wait; then
    echo "❌ App bundle notarization failed. Inspect the submission log via:" >&2
    echo "   xcrun notarytool history --keychain-profile $APPLE_KEYCHAIN_PROFILE" >&2
    exit 1
  fi

  echo "→ Stapling notarization ticket to VaporVibe.app…"
  xcrun stapler staple "$APP_PATH"
  echo "→ Validating stapled app bundle…"
  xcrun stapler validate "$APP_PATH"
else
  ARTIFACT_PATH="$DMG_PATH"
  ARTIFACT_LABEL="VaporVibe.dmg"
  
  # Notarize and staple the DMG (app should already be stapled)
  echo "→ Notarizing and stapling VaporVibe.dmg…"
  echo "ℹ️  Note: The app bundle inside should already be notarized and stapled"
  
  if ! xcrun notarytool submit "$DMG_PATH" --keychain-profile "$APPLE_KEYCHAIN_PROFILE" --wait; then
    echo "❌ DMG notarization failed. Inspect the submission log via:" >&2
    echo "   xcrun notarytool history --keychain-profile $APPLE_KEYCHAIN_PROFILE" >&2
    exit 1
  fi
  
  echo "→ Stapling notarization ticket to DMG…"
  xcrun stapler staple "$DMG_PATH"
  echo "→ Validating stapled DMG…"
  xcrun stapler validate "$DMG_PATH"
fi

# Final verification
echo ""
echo "-> Final Gatekeeper check for ${ARTIFACT_LABEL}..."
if [[ "$TARGET" == "app" ]]; then
  spctl -a -t exec -vv "$APP_PATH"
else
  spctl -a -t open -vv "$DMG_PATH"
fi

echo ""
echo "✅ Notarization and stapling complete for ${ARTIFACT_LABEL}"
echo ""
if [[ "$TARGET" == "dmg" ]]; then
  echo "The DMG and the app bundle inside are both stapled:"
  echo "  • App:  $APP_PATH (stapled before DMG creation)"
  echo "  • DMG:  $DMG_PATH (stapled after creation)"
  echo ""
  echo "Users can mount the DMG or extract the app - both work offline!"
else
  echo "App bundle is notarized and stapled at:"
  echo "  • $APP_PATH"
  echo ""
  echo "Next step: Create DMG with 'npm run build:macos:dmg'"
fi
echo ""
echo "ℹ️  The intermediate zip remains at $ZIP_PATH (remove manually if desired)."
