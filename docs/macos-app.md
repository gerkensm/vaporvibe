# macOS App Packaging

This guide outlines how to wrap the Serve LLM SEA binary inside a macOS app bundle, attach the branded icon, and produce a DMG that you can sign, notarize, and distribute.

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

The SEA payload will land in `out/sea/serve-llm-macos`.

## 2. Generate the icon assets

```bash
npm run macos:icon
```

The script renders the icon to `scripts/macos-app/icon-build/ServeLLMIcon.iconset` and tries to convert it into `scripts/macos-app/ServeLLMIcon.icns`. If `iconutil` fails because of a sandboxed shell, run the command manually outside the sandbox:

```bash
iconutil -c icns scripts/macos-app/icon-build/ServeLLMIcon.iconset \
  -o scripts/macos-app/ServeLLMIcon.icns
```

## 3. Assemble the `.app` bundle

```bash
npm run macos:app
```

Outputs `out/macos-app/ServeLLM.app` with:

- `Contents/MacOS/ServeLLMLauncher`: Swift launcher that forks the SEA binary, streams logs to `~/Library/Logs/ServeLLM/serve-llm.log`, and opens `http://127.0.0.1:3000/` once the server is ready.
- `Contents/Resources/serve-llm-macos`: unsigned SEA executable.
- `Contents/Resources/ServeLLMIcon.icns`: generated icon.
- `Contents/Info.plist`: bundle metadata (`com.gerkensm.serve-llm`).

## 4. Codesign the bundle

Sign nested binaries first, then the bundle:

```bash
codesign --force --options runtime --timestamp \
  --sign "Developer ID Application: Your Name (TEAMID)" \
  out/macos-app/ServeLLM.app/Contents/Resources/serve-llm-macos

codesign --force --options runtime --timestamp \
  --sign "Developer ID Application: Your Name (TEAMID)" \
  out/macos-app/ServeLLM.app/Contents/MacOS/ServeLLMLauncher

codesign --deep --force --options runtime --timestamp \
  --sign "Developer ID Application: Your Name (TEAMID)" \
  out/macos-app/ServeLLM.app
```

Verify signatures before moving on:

```bash
codesign --verify --strict --verbose=4 out/macos-app/ServeLLM.app
spctl --assess --type execute -vv out/macos-app/ServeLLM.app
```

## 5. Create the DMG

```bash
npm run macos:dmg
```

Produces `out/macos-app/ServeLLM.dmg`. If you have `create-dmg` installed, the script uses it for layout; otherwise it falls back to `hdiutil`.

## 6. Notarize and staple the DMG

```bash
npm run macos:notarize        # defaults to notarizing the DMG
# or to notarize the app bundle directly
npm run macos:notarize -- app
```

Under the hood the script calls `xcrun notarytool submit … --wait`, staples the result, and runs `spctl` to verify the ticket. Gatekeeper now trusts the disk image offline, and the embedded bundle can be distributed without the "can’t check for malicious software" warning.

To sanity check the notarized artifact later, run:

```bash
npm run verify:notarization          # auto-detects the DMG/app/binary
npm run verify:notarization -- ./out/macos-app/ServeLLM.app   # explicit path
```

## 7. Distribution tips

- Include a `README` on the DMG explaining that logs stream to `~/Library/Logs/ServeLLM/serve-llm.log`.
- For automatic updates, consider distributing a signed PKG that installs both the CLI binary under `/usr/local/bin` and the `.app` under `/Applications`.
- Each new release requires rebuilding the SEA, regenerating the bundle, re-signing, and re-notarizing the DMG.
