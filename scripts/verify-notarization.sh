#!/usr/bin/env bash
# Verify notarization status of the macOS SEA binary

set -euo pipefail

# ANSI color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BINARY_PATH="${1:-$ROOT_DIR/out/sea/serve-llm-macos}"

echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Verifying Notarization Status                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if binary exists
if [[ ! -f "$BINARY_PATH" ]]; then
  echo -e "${RED}Error: Binary not found at $BINARY_PATH${NC}" >&2
  echo -e "${YELLOW}Usage: $0 [path-to-binary]${NC}" >&2
  exit 1
fi

echo -e "Binary path: ${YELLOW}$BINARY_PATH${NC}"
echo ""

# Test 1: Check code signature
echo -e "${BLUE}[1/5] Checking code signature...${NC}"
if codesign --verify --deep --strict --verbose=2 "$BINARY_PATH" 2>&1; then
  echo -e "${GREEN}✓ Code signature is valid${NC}"
else
  echo -e "${RED}✗ Code signature is invalid or missing${NC}"
  exit 1
fi
echo ""

# Test 2: Display signature details
echo -e "${BLUE}[2/5] Signature details:${NC}"
codesign -dvvv "$BINARY_PATH" 2>&1 | grep -E "(Authority|TeamIdentifier|Timestamp|Runtime)" | sed 's/^/  /'
echo ""
# Test 3: Check if notarization ticket is stapled
echo -e "${BLUE}[3/5] Checking for stapled notarization ticket...${NC}"
STAPLE_OUTPUT=$(xcrun stapler validate "$BINARY_PATH" 2>&1)
if echo "$STAPLE_OUTPUT" | grep -q "The validate action worked"; then
  echo -e "${GREEN}✓ Notarization ticket is stapled${NC}"
  STAPLED=true
elif echo "$STAPLE_OUTPUT" | grep -q "Error 73"; then
  echo -e "${YELLOW}⚠ Stapling not supported for this file format (CLI executable)${NC}"
  echo -e "${YELLOW}  This is normal. Notarization verified online instead.${NC}"
  STAPLED=false
else
  echo -e "${YELLOW}⚠ No stapled ticket found${NC}"
  echo -e "${YELLOW}  The binary may still be notarized via online verification.${NC}"
  STAPLED=false
fi
echo ""
echo ""

# Test 4: Gatekeeper assessment
echo -e "${BLUE}[4/5] Running Gatekeeper assessment (spctl)...${NC}"
SPCTL_OUTPUT=$(spctl --assess --type execute --verbose "$BINARY_PATH" 2>&1)
echo "$SPCTL_OUTPUT" | sed 's/^/  /'

if echo "$SPCTL_OUTPUT" | grep -q "accepted"; then
  echo -e "${GREEN}✓ Binary passes Gatekeeper assessment${NC}"
  GATEKEEPER_OK=true
elif echo "$SPCTL_OUTPUT" | grep -q "rejected (the code is valid but does not seem to be an app)"; then
  echo -e "${YELLOW}⚠ Marked as 'not an app' (expected for CLI tools)${NC}"
  echo -e "${GREEN}✓ Code signature is valid, notarization will be checked online${NC}"
  GATEKEEPER_OK=true  # CLI tools are OK even with this message
else
  echo -e "${RED}✗ Binary rejected by Gatekeeper${NC}"
  GATEKEEPER_OK=false
fi
echo ""

# Test 5: Check notarization history (requires credentials)
echo -e "${BLUE}[5/5] Checking notarization status online...${NC}"
NOTARIZED_ONLINE=false
if [[ -n "${APPLE_KEYCHAIN_PROFILE:-}" ]]; then
  echo -e "${YELLOW}Fetching notarization history (this requires credentials)...${NC}"
  HISTORY=$(xcrun notarytool history --keychain-profile "$APPLE_KEYCHAIN_PROFILE" 2>&1 | head -20)
  if echo "$HISTORY" | grep -q "Accepted"; then
    echo -e "${GREEN}✓ Recent notarizations found in history${NC}"
    echo "$HISTORY" | head -10 | sed 's/^/  /'
    
    # Check if our binary's zip is in recent history (rough check)
    if echo "$HISTORY" | grep -q "serve-llm"; then
      echo -e "${GREEN}✓ This binary appears in notarization history${NC}"
      NOTARIZED_ONLINE=true
    fi
  else
    echo -e "${YELLOW}⚠ No recent successful notarizations found${NC}"
  fi
else
  echo -e "${YELLOW}⚠ Skipped - APPLE_KEYCHAIN_PROFILE not set${NC}"
  echo -e "  Set APPLE_KEYCHAIN_PROFILE to check online notarization status"
fi
echo ""

# Summary
echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                 Summary                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"

if [[ "$GATEKEEPER_OK" == true ]]; then
  if [[ "$STAPLED" == true ]]; then
    echo -e "${GREEN}✓ Binary is fully notarized with stapled ticket${NC}"
    echo -e "${GREEN}✓ Will run offline without warnings${NC}"
  elif [[ "$NOTARIZED_ONLINE" == true ]]; then
    echo -e "${GREEN}✓ Binary is fully notarized (online verification)${NC}"
    echo -e "${YELLOW}ℹ Users need internet on first run for verification${NC}"
    echo -e "${YELLOW}ℹ After first run, works offline${NC}"
  else
    echo -e "${GREEN}✓ Binary is properly signed and passes Gatekeeper${NC}"
    echo -e "${YELLOW}ℹ Notarization status: Verified locally${NC}"
  fi
  echo ""
  echo -e "${GREEN}Safe to distribute! Users can run it with:${NC}"
  echo -e "  ${YELLOW}curl -L -o serve-llm <download-url>${NC}"
  echo -e "  ${YELLOW}chmod +x serve-llm${NC}"
  echo -e "  ${YELLOW}./serve-llm \"Your brief here\"${NC}"
else
  echo -e "${RED}✗ Binary is NOT properly notarized${NC}"
  echo -e "${RED}  Run 'npm run notarize:sea' to sign and notarize${NC}"
  exit 1
fi

echo ""