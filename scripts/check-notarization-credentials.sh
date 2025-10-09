#!/usr/bin/env bash
# Diagnose notarization credential issues

set -euo pipefail

# ANSI color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Notarization Credentials Diagnostics            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Check environment variables
echo -e "${BLUE}[1/4] Checking environment variables...${NC}"
VARS_OK=true

for var in APPLE_EMAIL APPLE_TEAM_ID APPLE_KEYCHAIN_PROFILE; do
  if [[ -n "${!var:-}" ]]; then
    echo -e "  ${GREEN}✓ $var is set${NC}"
  else
    echo -e "  ${RED}✗ $var is NOT set${NC}"
    VARS_OK=false
  fi
done
echo ""

if [[ "$VARS_OK" == false ]]; then
  echo -e "${RED}Some required environment variables are missing.${NC}"
  exit 1
fi

# Check keychain profile
echo -e "${BLUE}[2/4] Testing keychain profile...${NC}"
echo -e "Profile name: ${YELLOW}$APPLE_KEYCHAIN_PROFILE${NC}"

if xcrun notarytool history --keychain-profile "$APPLE_KEYCHAIN_PROFILE" 2>&1 | head -5; then
  echo -e "${GREEN}✓ Keychain profile is valid and accessible${NC}"
else
  echo -e "${RED}✗ Failed to access keychain profile${NC}"
  echo ""
  echo -e "${YELLOW}Try recreating the keychain profile:${NC}"
  echo -e "  xcrun notarytool store-credentials \"$APPLE_KEYCHAIN_PROFILE\" \\"
  echo -e "    --apple-id \"$APPLE_EMAIL\" \\"
  echo -e "    --team-id \"$APPLE_TEAM_ID\" \\"
  echo -e "    --password \"<your-app-specific-password>\""
  exit 1
fi
echo ""

# Check Developer ID certificate
echo -e "${BLUE}[3/4] Checking Developer ID certificate...${NC}"
CERT=$(security find-identity -v -p codesigning | grep "Developer ID Application" | grep "$APPLE_TEAM_ID" || true)

if [[ -n "$CERT" ]]; then
  echo -e "${GREEN}✓ Developer ID certificate found:${NC}"
  echo "$CERT" | sed 's/^/  /'
else
  echo -e "${RED}✗ No Developer ID certificate found for Team ID: $APPLE_TEAM_ID${NC}"
  exit 1
fi
echo ""

# Try a test submission to check agreements
echo -e "${BLUE}[4/4] Testing notarization service access...${NC}"
echo -e "${YELLOW}Creating a minimal test file...${NC}"

TEST_DIR=$(mktemp -d)
TEST_FILE="$TEST_DIR/test.txt"
TEST_ZIP="$TEST_DIR/test.zip"

echo "Test file for notarization check" > "$TEST_FILE"
cd "$TEST_DIR"
zip -q test.zip test.txt
cd - > /dev/null

echo -e "${YELLOW}Attempting to submit (will be rejected, but tests access)...${NC}"
SUBMIT_OUTPUT=$(xcrun notarytool submit "$TEST_ZIP" \
  --keychain-profile "$APPLE_KEYCHAIN_PROFILE" \
  2>&1 || true)

# Clean up
rm -rf "$TEST_DIR"

# Analyze the output
if echo "$SUBMIT_OUTPUT" | grep -q "403"; then
  echo -e "${RED}✗ 403 Error: Agreement issue detected${NC}"
  echo ""
  echo -e "${YELLOW}Possible causes:${NC}"
  echo -e "  1. New Apple developer agreement needs to be accepted"
  echo -e "  2. App-specific password has expired or been revoked"
  echo -e "  3. Keychain profile has stale credentials"
  echo ""
  echo -e "${YELLOW}Solutions to try:${NC}"
  echo -e "  ${BLUE}A. Check for new agreements:${NC}"
  echo -e "     https://developer.apple.com/account"
  echo -e "     → Go to 'Agreements, Tax, and Banking'"
  echo -e "     → Accept any pending agreements"
  echo ""
  echo -e "  ${BLUE}B. Regenerate app-specific password:${NC}"
  echo -e "     https://appleid.apple.com/account/manage"
  echo -e "     → Generate new app-specific password"
  echo -e "     → Update keychain profile:"
  echo -e "       xcrun notarytool store-credentials \"$APPLE_KEYCHAIN_PROFILE\" \\"
  echo -e "         --apple-id \"$APPLE_EMAIL\" \\"
  echo -e "         --team-id \"$APPLE_TEAM_ID\" \\"
  echo -e "         --password \"<new-password>\""
  echo ""
  echo -e "  ${BLUE}C. Try with a different Team/Account:${NC}"
  echo -e "     If you have multiple Apple Developer accounts,"
  echo -e "     ensure you're using the correct Team ID"
elif echo "$SUBMIT_OUTPUT" | grep -q "Invalid"; then
  echo -e "${RED}✗ Invalid package (expected for test file)${NC}"
  echo -e "${GREEN}✓ But notarization service is accessible!${NC}"
  echo ""
  echo -e "${GREEN}Your credentials are working. The 403 error with your actual${NC}"
  echo -e "${GREEN}binary might be specific to that file. Try:${NC}"
  echo -e "  1. Rebuild the binary: ${YELLOW}npm run build:sea${NC}"
  echo -e "  2. Try notarization again: ${YELLOW}npm run notarize:sea${NC}"
else
  echo -e "${GREEN}✓ Notarization service access verified${NC}"
  echo -e "${GREEN}Your setup appears to be working correctly.${NC}"
fi

echo ""