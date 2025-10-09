#!/usr/bin/env bash
# Notarize and staple the macOS SEA binary
# Requires: APPLE_APP_PASSWORD, APPLE_EMAIL, APPLE_KEYCHAIN_PROFILE, APPLE_TEAM_ID

set -euo pipefail

# ANSI color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting notarization process for serve-llm...${NC}"

# Check if running on macOS
if [[ "$(uname)" != "Darwin" ]]; then
  echo -e "${RED}Error: Notarization only works on macOS (current: $(uname)).${NC}" >&2
  exit 1
fi

# Check required environment variables
REQUIRED_VARS=("APPLE_APP_PASSWORD" "APPLE_EMAIL" "APPLE_KEYCHAIN_PROFILE" "APPLE_TEAM_ID")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    MISSING_VARS+=("$var")
  fi
done

if [[ ${#MISSING_VARS[@]} -gt 0 ]]; then
  echo -e "${RED}Error: Missing required environment variables:${NC}" >&2
  for var in "${MISSING_VARS[@]}"; do
    echo -e "  ${RED}• $var${NC}" >&2
  done
  echo ""
  echo -e "${YELLOW}Set these variables before running notarization:${NC}" >&2
  echo -e "  export APPLE_EMAIL='your-apple-id@example.com'" >&2
  echo -e "  export APPLE_TEAM_ID='YOUR_TEAM_ID'" >&2
  echo -e "  export APPLE_APP_PASSWORD='your-app-specific-password'" >&2
  echo -e "  export APPLE_KEYCHAIN_PROFILE='your-keychain-profile'" >&2
  echo ""
  echo -e "${YELLOW}To create a keychain profile:${NC}" >&2
  echo -e "  xcrun notarytool store-credentials <profile-name> \\" >&2
  echo -e "    --apple-id <your-apple-id> \\" >&2
  echo -e "    --team-id <your-team-id> \\" >&2
  echo -e "    --password <app-specific-password>" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Path to the binary created by build:sea
BINARY_PATH="out/sea/serve-llm-macos"
NOTARIZE_DIR="out/notarize"
ZIP_PATH="$NOTARIZE_DIR/serve-llm-macos.zip"
ENTITLEMENTS_PATH="scripts/entitlements.plist"

# Check if binary exists
if [[ ! -f "$BINARY_PATH" ]]; then
  echo -e "${RED}Error: Binary not found at $BINARY_PATH${NC}" >&2
  echo -e "${YELLOW}Run 'npm run build:sea' first to create the binary.${NC}" >&2
  exit 1
fi

# Create notarize directory
mkdir -p "$NOTARIZE_DIR"
# Step 1: Check if binary is already signed with Developer ID
echo -e "${BLUE}Step 1: Checking binary signature...${NC}"

# Check current signature
CURRENT_SIG=$(codesign -dv "$BINARY_PATH" 2>&1 | grep "Authority=Developer ID Application" || true)

if [[ -n "$CURRENT_SIG" ]]; then
  echo -e "${GREEN}✓ Binary already signed with Developer ID${NC}"
  echo -e "${YELLOW}$CURRENT_SIG${NC}"
  echo -e "${YELLOW}Skipping re-signing to avoid corruption${NC}"
else
  echo -e "${YELLOW}Binary not signed with Developer ID, signing now...${NC}"
  
  # Find the Developer ID Application certificate
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

  echo -e "${YELLOW}Using certificate: $CERT_NAME${NC}"

  # Remove any existing signature first
  codesign --remove-signature "$BINARY_PATH" 2>/dev/null || true

  # Sign with hardened runtime and entitlements
  echo -e "${YELLOW}Signing with entitlements for Node.js compatibility...${NC}"
  codesign --force \
    --sign "$CERT_NAME" \
    --options runtime \
    --timestamp \
    --entitlements "$ENTITLEMENTS_PATH" \
    "$BINARY_PATH"
  
  echo -e "${GREEN}✓ Binary signed successfully${NC}"
fi

# Verify the signature
echo -e "${BLUE}Verifying code signature...${NC}"
codesign --verify --deep --strict --verbose=2 "$BINARY_PATH"
echo -e "${GREEN}✓ Binary signed successfully${NC}"

# Step 2: Create zip for notarization
echo -e "${BLUE}Step 2: Creating zip archive for notarization...${NC}"
cd "$(dirname "$BINARY_PATH")"
zip -r "$ROOT_DIR/$ZIP_PATH" "$(basename "$BINARY_PATH")"
cd "$ROOT_DIR"
echo -e "${GREEN}✓ Zip created: $ZIP_PATH${NC}"

# Step 3: Submit for notarization
echo -e "${BLUE}Step 3: Submitting to Apple Notary Service...${NC}"
echo -e "${YELLOW}This may take several minutes. The command will wait for completion.${NC}"
echo ""

# Submit and stream output in real-time
# The --wait flag makes it wait for notarization to complete
if ! xcrun notarytool submit "$ZIP_PATH" \
  --keychain-profile "$APPLE_KEYCHAIN_PROFILE" \
  --wait; then
  echo ""
  echo -e "${RED}Error: Notarization failed${NC}" >&2
  echo -e "${YELLOW}Run the following to view recent submissions:${NC}" >&2
  echo -e "  xcrun notarytool history --keychain-profile $APPLE_KEYCHAIN_PROFILE" >&2
  echo ""
  echo -e "${YELLOW}To view logs for a specific submission:${NC}" >&2
  echo -e "  xcrun notarytool log <SUBMISSION_ID> --keychain-profile $APPLE_KEYCHAIN_PROFILE" >&2
  exit 1
fi

echo ""
echo ""
echo -e "${GREEN}✓ Notarization completed successfully${NC}"

# Step 4: Verify the notarized binary (skip stapling for CLI executables)
echo -e "${BLUE}Step 4: Verifying notarized binary...${NC}"
echo -e "${YELLOW}Note: Skipping stapling - not supported for CLI executables and can corrupt the binary${NC}"

echo -e "${BLUE}Verifying code signature...${NC}"
codesign --verify --deep --strict --verbose=2 "$BINARY_PATH" 2>&1 | head -3

echo -e "${BLUE}Testing binary execution...${NC}"
if "$BINARY_PATH" --help >/dev/null 2>&1 || [[ $? -lt 126 ]]; then
  echo -e "${GREEN}✓ Binary executes successfully${NC}"
else
  echo -e "${RED}✗ Binary execution failed${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Binary is properly signed and notarized${NC}"
# Summary
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          Notarization Complete!                    ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Notarized binary: ${GREEN}$BINARY_PATH${NC}"
echo -e "Archive created:  ${GREEN}$ZIP_PATH${NC}"
echo ""
echo -e "${GREEN}The binary is fully notarized (online verification).${NC}"
echo -e "${YELLOW}Users will need internet connection on first run for verification.${NC}"
echo -e "${YELLOW}After first run, it will work offline.${NC}"
echo ""
echo -e "${BLUE}Distribution:${NC} Users can download and run directly:"
echo -e "  ${YELLOW}curl -L -o serve-llm <your-download-url>${NC}"
echo -e "  ${YELLOW}chmod +x serve-llm${NC}"
echo -e "  ${YELLOW}./serve-llm \"Your brief\"${NC}"
echo ""

# Clean up zip (optional)
read -p "Remove notarization zip archive? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  rm "$ZIP_PATH"
  echo -e "${GREEN}✓ Zip archive removed${NC}"
fi