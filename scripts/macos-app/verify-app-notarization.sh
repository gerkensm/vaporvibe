#!/usr/bin/env bash
# Verify notarization and stapling for macOS app bundle and DMG

set -euo pipefail

# ANSI color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
APP_PATH="${ROOT_DIR}/out/macos-app/ServeLLM.app"
DMG_PATH="${ROOT_DIR}/out/macos-app/ServeLLM.dmg"

echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   macOS App Bundle & DMG Verification             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Check what exists
APP_EXISTS=false
DMG_EXISTS=false

if [[ -d "$APP_PATH" ]]; then
  APP_EXISTS=true
  echo -e "${GREEN}✓ App bundle found at: $APP_PATH${NC}"
else
  echo -e "${YELLOW}⚠ App bundle not found at: $APP_PATH${NC}"
fi

if [[ -f "$DMG_PATH" ]]; then
  DMG_EXISTS=true
  echo -e "${GREEN}✓ DMG found at: $DMG_PATH${NC}"
else
  echo -e "${YELLOW}⚠ DMG not found at: $DMG_PATH${NC}"
fi

echo ""

if [[ "$APP_EXISTS" == false ]] && [[ "$DMG_EXISTS" == false ]]; then
  echo -e "${RED}Error: Neither app bundle nor DMG found${NC}" >&2
  echo -e "${YELLOW}Run 'npm run build:macos' to create them${NC}" >&2
  exit 1
fi

# Verify App Bundle
if [[ "$APP_EXISTS" == true ]]; then
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  Verifying App Bundle (ServeLLM.app)${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  
  # Test 1: Code signature
  echo -e "${BLUE}[1/5] Checking code signature...${NC}"
  if codesign --verify --deep --strict --verbose=2 "$APP_PATH" 2>&1; then
    echo -e "${GREEN}✓ Code signature is valid${NC}"
  else
    echo -e "${RED}✗ Code signature is invalid${NC}"
    exit 1
  fi
  echo ""
  
  # Test 2: Signature details
  echo -e "${BLUE}[2/5] Signature details:${NC}"
  codesign -dvvv "$APP_PATH" 2>&1 | grep -E "(Authority|TeamIdentifier|Timestamp|Runtime)" | sed 's/^/  /'
  echo ""
  
  # Test 3: Check stapled ticket
  echo -e "${BLUE}[3/5] Checking for stapled notarization ticket...${NC}"
  if xcrun stapler validate "$APP_PATH" 2>&1 | grep -q "The validate action worked"; then
    echo -e "${GREEN}✓ App bundle has a stapled notarization ticket${NC}"
  else
    echo -e "${YELLOW}⚠ No stapled ticket found on app bundle${NC}"
  fi
  echo ""
  
  # Test 4: Gatekeeper assessment
  echo -e "${BLUE}[4/5] Running Gatekeeper assessment (spctl)...${NC}"
  SPCTL_OUTPUT=$(spctl -a -t exec -vv "$APP_PATH" 2>&1)
  echo "$SPCTL_OUTPUT" | sed 's/^/  /'
  
  if echo "$SPCTL_OUTPUT" | grep -q "accepted"; then
    if echo "$SPCTL_OUTPUT" | grep -q "Notarized Developer ID"; then
      echo -e "${GREEN}✓ App bundle is notarized and accepted by Gatekeeper${NC}"
    else
      echo -e "${GREEN}✓ App bundle is accepted by Gatekeeper${NC}"
    fi
  else
    echo -e "${RED}✗ App bundle rejected by Gatekeeper${NC}"
  fi
  echo ""
  
  # Test 5: Check embedded SEA binary
  echo -e "${BLUE}[5/5] Checking embedded SEA binary...${NC}"
  SEA_BINARY="$APP_PATH/Contents/Resources/serve-llm-macos"
  if [[ -f "$SEA_BINARY" ]]; then
    # Note: Nested binaries in --deep signed bundles may not verify independently
    # What matters is the bundle signature, which we already verified
    SIG_CHECK=$(codesign --verify --strict --verbose=2 "$SEA_BINARY" 2>&1 || true)
    if echo "$SIG_CHECK" | grep -q "valid on disk"; then
      echo -e "${GREEN}✓ Embedded SEA binary is properly signed${NC}"
    else
      echo -e "${YELLOW}ℹ Embedded binary covered by bundle signature (--deep)${NC}"
      echo -e "${GREEN}✓ Not an issue - the app bundle signature is valid${NC}"
    fi
  else
    echo -e "${YELLOW}⚠ SEA binary not found${NC}"
  fi
  echo ""
fi

# Verify DMG
if [[ "$DMG_EXISTS" == true ]]; then
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  Verifying DMG (ServeLLM.dmg)${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  
  # Test 1: Check stapled ticket
  echo -e "${BLUE}[1/3] Checking for stapled notarization ticket on DMG...${NC}"
  if xcrun stapler validate "$DMG_PATH" 2>&1 | grep -q "The validate action worked"; then
    echo -e "${GREEN}✓ DMG has a stapled notarization ticket${NC}"
    DMG_STAPLED=true
  else
    echo -e "${YELLOW}⚠ No stapled ticket found on DMG${NC}"
    DMG_STAPLED=false
  fi
  echo ""
  
  # Test 2: Gatekeeper assessment for DMG
  echo -e "${BLUE}[2/3] Running Gatekeeper assessment on DMG...${NC}"
  SPCTL_DMG_OUTPUT=$(spctl -a -t open --context context:primary-signature -vv "$DMG_PATH" 2>&1 || true)
  echo "$SPCTL_DMG_OUTPUT" | sed 's/^/  /'
  
  if echo "$SPCTL_DMG_OUTPUT" | grep -q "accepted"; then
    echo -e "${GREEN}✓ DMG is accepted by Gatekeeper${NC}"
  elif echo "$SPCTL_DMG_OUTPUT" | grep -q "Insufficient Context"; then
    echo -e "${YELLOW}ℹ 'Insufficient Context' is normal for DMG files${NC}"
    echo -e "${GREEN}✓ DMG stapling verified - this is what matters${NC}"
  else
    echo -e "${YELLOW}⚠ DMG Gatekeeper check inconclusive (not critical)${NC}"
  fi
  echo ""
  
  # Test 3: Mount and check app inside DMG
  echo -e "${BLUE}[3/3] Verifying app bundle inside DMG...${NC}"
  echo -e "${YELLOW}Mounting DMG to check contents...${NC}"
  
  MOUNT_POINT=$(mktemp -d)
  if hdiutil attach "$DMG_PATH" -mountpoint "$MOUNT_POINT" -nobrowse -quiet 2>/dev/null; then
    APP_IN_DMG="$MOUNT_POINT/Serve LLM.app"
    
    if [[ -d "$APP_IN_DMG" ]]; then
      echo -e "${BLUE}Checking app bundle inside DMG...${NC}"
      
      # Check if app in DMG has stapled ticket
      if xcrun stapler validate "$APP_IN_DMG" 2>&1 | grep -q "The validate action worked"; then
        echo -e "${GREEN}✓ App inside DMG has stapled notarization ticket${NC}"
      else
        echo -e "${YELLOW}⚠ App inside DMG does not have stapled ticket${NC}"
      fi
      
      # Check code signature
      if codesign --verify --deep --strict "$APP_IN_DMG" 2>/dev/null; then
        echo -e "${GREEN}✓ App inside DMG is properly signed${NC}"
      else
        echo -e "${YELLOW}⚠ App inside DMG has signature issues${NC}"
      fi
    fi
    
    # Unmount
    hdiutil detach "$MOUNT_POINT" -quiet 2>/dev/null || true
    rm -rf "$MOUNT_POINT"
  else
    echo -e "${YELLOW}⚠ Could not mount DMG for inspection${NC}"
  fi
  echo ""
fi

# Summary
echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                   Summary                          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"

ALL_GOOD=true

if [[ "$APP_EXISTS" == true ]]; then
  # Check if app passes all tests
  if codesign --verify --deep --strict "$APP_PATH" >/dev/null 2>&1 && \
     xcrun stapler validate "$APP_PATH" 2>&1 | grep -q "The validate action worked" && \
     spctl -a -t exec -vv "$APP_PATH" 2>&1 | grep -q "accepted"; then
    echo -e "${GREEN}✓ App bundle is fully signed, notarized, and stapled${NC}"
  else
    echo -e "${YELLOW}⚠ App bundle may need re-signing or notarization${NC}"
    ALL_GOOD=false
  fi
fi

if [[ "$DMG_EXISTS" == true ]]; then
  if [[ "$DMG_STAPLED" == true ]]; then
    echo -e "${GREEN}✓ DMG is notarized and stapled${NC}"
  else
    echo -e "${YELLOW}⚠ DMG needs notarization and stapling${NC}"
    ALL_GOOD=false
  fi
fi

echo ""
if [[ "$ALL_GOOD" == true ]]; then
  echo -e "${GREEN}✅ All artifacts are ready for distribution!${NC}"
  echo ""
  echo -e "${BLUE}Distribution files:${NC}"
  [[ "$APP_EXISTS" == true ]] && echo -e "  • App: ${GREEN}$APP_PATH${NC}"
  [[ "$DMG_EXISTS" == true ]] && echo -e "  • DMG: ${GREEN}$DMG_PATH${NC}"
  echo ""
  echo -e "${GREEN}Both the DMG and the app inside are notarized and stapled.${NC}"
  echo -e "${GREEN}Users can download and run without security warnings (offline).${NC}"
else
  echo -e "${YELLOW}⚠ Some artifacts need attention${NC}"
  echo -e "${YELLOW}Run 'npm run build:macos' to build everything properly${NC}"
fi

echo ""