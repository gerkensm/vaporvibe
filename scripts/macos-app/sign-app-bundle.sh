#!/usr/bin/env bash
# Sign the macOS app bundle with Developer ID

set -euo pipefail

# ANSI color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
APP_BUNDLE="${ROOT_DIR}/out/macos-app/VaporVibe.app"
ENTITLEMENTS_PATH="${ROOT_DIR}/scripts/entitlements.plist"

echo -e "${BLUE}Starting code signing for VaporVibe.app...${NC}"

# Check if app bundle exists
if [[ ! -d "$APP_BUNDLE" ]]; then
  echo -e "${RED}Error: App bundle not found at $APP_BUNDLE${NC}" >&2
  echo -e "${YELLOW}Run 'npm run macos:app' first to create the app bundle.${NC}" >&2
  exit 1
fi

# Check required environment variables
if [[ -z "${APPLE_TEAM_ID:-}" ]]; then
  echo -e "${RED}Error: APPLE_TEAM_ID environment variable not set${NC}" >&2
  echo -e "${YELLOW}Set it to your Apple Developer Team ID (e.g., ABCD123456)${NC}" >&2
  exit 1
fi

# Find the Developer ID Application certificate
echo -e "${BLUE}Finding Developer ID certificate...${NC}"
CERT_NAME=$(security find-identity -v -p codesigning | \
  grep "Developer ID Application" | \
  grep "$APPLE_TEAM_ID" | \
  head -1 | \
  sed -E 's/.*"(.+)"/\1/')

if [[ -z "$CERT_NAME" ]]; then
  echo -e "${RED}Error: No Developer ID Application certificate found for Team ID: $APPLE_TEAM_ID${NC}" >&2
  echo ""
  echo -e "${YELLOW}Available certificates:${NC}" >&2
  security find-identity -v -p codesigning | grep "Developer ID Application" || echo "  (none found)"
  echo ""
  echo -e "${YELLOW}To install a certificate:${NC}" >&2
  echo -e "  1. Go to https://developer.apple.com/account/resources/certificates/list" >&2
  echo -e "  2. Create/download a 'Developer ID Application' certificate" >&2
  echo -e "  3. Double-click the downloaded .cer file to install in Keychain" >&2
  exit 1
fi

echo -e "${GREEN}✓ Using certificate: $CERT_NAME${NC}"
# Sign any native modules (e.g., keytar .node files) if present
echo -e "${BLUE}Signing native modules (if present)...${NC}"
RESOURCES_DIR="${APP_BUNDLE}/Contents/Resources"
if [[ -d "$RESOURCES_DIR" ]]; then
  # Find and sign all .node files (native Node.js addons like keytar)
  while IFS= read -r -d '' node_file; do
    echo -e "  Signing: $(basename "$node_file")"
    codesign --force \
      --sign "$CERT_NAME" \
      --options runtime \
      --timestamp \
      "$node_file" 2>/dev/null || true
  done < <(find "$RESOURCES_DIR" -name "*.node" -type f -print0 2>/dev/null)
fi
echo ""

echo ""

# Sign the embedded SEA binary first
echo -e "${BLUE}Step 1: Signing embedded SEA binary...${NC}"
SEA_BINARY="${APP_BUNDLE}/Contents/Resources/vaporvibe-macos"

if [[ -f "$SEA_BINARY" ]]; then
  codesign --force \
    --sign "$CERT_NAME" \
    --options runtime \
    --timestamp \
    --entitlements "$ENTITLEMENTS_PATH" \
    "$SEA_BINARY"
  echo -e "${GREEN}✓ SEA binary signed${NC}"
else
  echo -e "${YELLOW}⚠ SEA binary not found at expected location${NC}"
fi
echo ""

# Sign the launcher executable
echo -e "${BLUE}Step 2: Signing launcher executable...${NC}"
LAUNCHER="${APP_BUNDLE}/Contents/MacOS/VaporVibeLauncher"

if [[ -f "$LAUNCHER" ]]; then
  codesign --force \
    --sign "$CERT_NAME" \
    --options runtime \
    --timestamp \
    --entitlements "$ENTITLEMENTS_PATH" \
    "$LAUNCHER"
  echo -e "${GREEN}✓ Launcher signed${NC}"
else
  echo -e "${RED}✗ Launcher not found at $LAUNCHER${NC}"
  exit 1
fi
echo ""

# Sign the entire app bundle
echo -e "${BLUE}Step 3: Signing app bundle with --deep...${NC}"
codesign --deep --force \
  --sign "$CERT_NAME" \
  --options runtime \
  --timestamp \
  --entitlements "$ENTITLEMENTS_PATH" \
  "$APP_BUNDLE"
echo -e "${GREEN}✓ App bundle signed${NC}"
echo ""

# Verify the signature
echo -e "${BLUE}Step 4: Verifying signature...${NC}"
codesign --verify --deep --strict --verbose=2 "$APP_BUNDLE"
echo ""
echo -e "${GREEN}✓ Signature verified successfully${NC}"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        Code Signing Complete!                      ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Signed app bundle: ${GREEN}$APP_BUNDLE${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Create DMG: ${BLUE}npm run macos:dmg${NC}"
echo -e "  2. Notarize DMG: ${BLUE}npm run macos:notarize${NC}"