---
trigger: glob
globs: **/scripts/macos-app/**, **/scripts/*.sh, **/scripts/entitlements.plist
---

# Content from docs/macos-app.md

# macOS App Packaging

This guide outlines how to wrap the VaporVibe SEA binary inside a macOS app bundle, attach the branded icon, and produce a DMG that you can sign, notarize, and distribute.

## Prerequisites

- macOS host with Xcode Command Line Tools (`xcode-select --install`)
- Node.js 24.x (`nvm use` before running any npm scripts)
- Developer ID Application certificate available in your keychain for codesigning
- Apple notarization credentials configured for `xcrun notarytool` (see `scripts/check-notarization-credentials.sh`)

## 1. Build the SEA binary

```bash
nvm use
npm run build:sea
```

The SEA payload will land in `out/sea/vaporvibe-macos`.

## 2. Generate the icon assets

```bash
npm run macos:icon
```

The script renders the icon to `scripts/macos-app/icon-build/VaporVibeIcon.iconset` and tries to convert it into `scripts/macos-app/VaporVibeIcon.icns`. If `iconutil` fails because of a sandboxed shell, run the command manually outside the sandbox:

```bash
iconutil -c icns scripts/macos-app/icon-build/VaporVibeIcon.iconset \
  -o scripts/macos-app/VaporVibeIcon.icns
```

## 3. Assemble the `.app` bundle

```bash
npm run macos:app
```

Outputs `out/macos-app/VaporVibe.app` with:

- `Contents/MacOS/VaporVibeLauncher`: Swift launcher that forks the SEA binary, streams logs to `~/Library/Logs/VaporVibe/vaporvibe.log`, and opens `http://127.0.0.1:3000/` once the server is ready.
- `Contents/Resources/vaporvibe-macos`: unsigned SEA executable.
- `Contents/Resources/VaporVibeIcon.icns`: generated icon.
- `Contents/Info.plist`: bundle metadata (`com.gerkensm.vaporvibe`).

## 4. Sign the app bundle

Use the automated signing script that handles nested binaries correctly:

```bash
npm run macos:sign
```

This script will:

- Find your Developer ID Application certificate automatically (using `APPLE_TEAM_ID`)
- Sign the embedded SEA binary with entitlements
- Sign the launcher executable
- Sign the entire app bundle with `--deep`
- Verify all signatures

**Manual signing (alternative):**

If you prefer manual control, sign nested binaries first, then the bundle:

```bash
# Set your certificate name
CERT="Developer ID Application: Your Name (TEAMID)"

# Sign embedded binaries with entitlements
codesign --force --options runtime --timestamp \
  --entitlements scripts/entitlements.plist \
  --sign "$CERT" \
  out/macos-app/VaporVibe.app/Contents/Resources/vaporvibe-macos

codesign --force --options runtime --timestamp \
  --entitlements scripts/entitlements.plist \
  --sign "$CERT" \
  out/macos-app/VaporVibe.app/Contents/MacOS/VaporVibeLauncher

# Sign the bundle
codesign --deep --force --options runtime --timestamp \
  --entitlements scripts/entitlements.plist \
  --sign "$CERT" \
  out/macos-app/VaporVibe.app

# Verify
codesign --verify --strict --verbose=4 out/macos-app/VaporVibe.app
spctl --assess --type execute -vv out/macos-app/VaporVibe.app
```

````

## 5. Create the DMG

```bash
npm run macos:dmg
````

Produces `out/macos-app/VaporVibe.dmg`. If you have `create-dmg` installed, the script uses it for layout; otherwise it falls back to `hdiutil`.

## 6. Notarize and staple the DMG

```bash
npm run macos:notarize        # defaults to notarizing the DMG
# or to notarize the app bundle directly
npm run macos:notarize -- app
```

Under the hood the script:

1. Submits to Apple's Notary Service with `xcrun notarytool submit --wait`
2. **Staples the notarization ticket** to the DMG (or app bundle)
3. Validates the stapled ticket with `xcrun stapler validate`
4. Runs `spctl` to verify Gatekeeper acceptance

Once stapled, the DMG (and the embedded app bundle) can be distributed and will run offline without security warnings.

To sanity check the notarized artifact later, run:

```bash
npm run verify:notarization          # auto-detects the DMG/app/binary
npm run verify:notarization -- ./out/macos-app/VaporVibe.app   # explicit path
```

## 7. Complete workflow

## Understanding the Workflow

When you notarize a DMG containing an app, Apple's notarization service notarizes **both** the DMG and the app inside it. However, **stapling is separate**:

- Stapling the DMG only staples the DMG itself
- The app inside remains notarized but without a stapled ticket
- For best user experience, **staple both** the app and the DMG

**Why staple both?**

- Users who mount the DMG and copy the app get an app with a stapled ticket (works offline immediately)
- Users who download the DMG get a DMG with a stapled ticket (offline verification)

Here's the full command sequence for creating a fully notarized and stapled DMG:

**Option 1: All-in-one command (Recommended)**

```bash
npm run build:macos
```

This single command runs all the steps in order:

1. Builds the SEA binary with Developer ID signing
2. Creates the app bundle
3. Signs the app bundle
4. Creates the DMG
5. Notarizes and staples the DMG

**Option 2: Step-by-step (for debugging)**

```bash
# 1. Build the SEA binary with Developer ID signing
npm run build:sea:signed

# 2. Generate icon assets (if not done already)
npm run build:macos:icon

# 3. Create the app bundle
npm run build:macos:app

# 4. Sign the app bundle with Developer ID
npm run build:macos:sign

# 5. Create the DMG
npm run build:macos:dmg

# 6. Notarize and staple the DMG
npm run build:macos:submit
```

After successful notarization, the DMG at `out/macos-app/VaporVibe.dmg` will have a stapled notarization ticket and can be distributed.

## 8. Distribution tips

- Include a `README` on the DMG explaining that logs stream to `~/Library/Logs/VaporVibe/vaporvibe.log`.
- The stapled notarization ticket allows offline verification - users don't need internet to run the app after first download.
- For automatic updates, consider distributing a signed PKG that installs both the CLI binary under `/usr/local/bin` and the `.app` under `/Applications`.
- Each new release requires rebuilding the SEA, regenerating the bundle, re-signing, and re-notarizing the DMG.

## Troubleshooting

### "Invalid" notarization status

If notarization fails with "status: Invalid", the most common causes are:

1. The SEA binary wasn't signed with Developer ID (use `npm run build:sea:signed`)
2. The app bundle wasn't properly signed (ensure `npm run build:macos:sign` completed successfully)
3. Missing entitlements for Node.js/V8

The `npm run build:macos` command handles all these steps in the correct order.

### Missing entitlements

Node.js SEA binaries require specific entitlements for V8's JIT compiler. These are automatically applied by the signing script using `scripts/entitlements.plist`.

