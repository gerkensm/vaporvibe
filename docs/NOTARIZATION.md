# macOS Notarization Guide

This guide explains how to notarize the VaporVibe SEA (Single Executable Application) binary for macOS distribution.

## Prerequisites

### 1. Apple Developer Account

- You need an active Apple Developer Program membership ($99/year)
- Enrolled at: https://developer.apple.com/programs/

### 2. Developer ID Certificate

You need a "Developer ID Application" certificate installed on your Mac:

1. Go to https://developer.apple.com/account/resources/certificates/list
2. Create a new certificate: **Developer ID Application**
3. Download and install it in your Keychain
4. Verify installation:
   ```bash
   security find-identity -v -p codesigning
   ```

### 3. App-Specific Password

Create an app-specific password for notarization:

1. Go to https://appleid.apple.com/account/manage
2. Sign in with your Apple ID
3. Under "Sign-In and Security" → "App-Specific Passwords"
4. Click "Generate an app-specific password"
5. Label it (e.g., "VaporVibe notarization")
6. Save the generated password

### 4. Team ID

Find your Team ID:

1. Go to https://developer.apple.com/account
2. Click "Membership" in the sidebar
3. Your Team ID is displayed (e.g., "ABCD123456")

## Setting Up Credentials

### Option 1: Create a Keychain Profile (Recommended)

Create a secure keychain profile to avoid exposing credentials:

```bash
xcrun notarytool store-credentials "vaporvibe-notary" \
  --apple-id "your-apple-id@example.com" \
  --team-id "YOUR_TEAM_ID" \
  --password "your-app-specific-password"
```

Then set only the profile name as an environment variable:

```bash
export APPLE_KEYCHAIN_PROFILE="vaporvibe-notary"
export APPLE_TEAM_ID="YOUR_TEAM_ID"
export APPLE_EMAIL="your-apple-id@example.com"
# APPLE_APP_PASSWORD is stored securely in the keychain profile
```

### Option 2: Environment Variables

Set all required environment variables directly:

```bash
export APPLE_EMAIL="your-apple-id@example.com"
export APPLE_TEAM_ID="YOUR_TEAM_ID"
export APPLE_APP_PASSWORD="xxxx-xxxx-xxxx-xxxx"  # App-specific password
export APPLE_KEYCHAIN_PROFILE="vaporvibe-notary"  # Name of your keychain profile
```

**Add to your shell profile** (`.zshrc`, `.bashrc`, etc.) to persist across sessions:

```bash
# Apple Developer Credentials for notarization
export APPLE_EMAIL="your-apple-id@example.com"
export APPLE_TEAM_ID="YOUR_TEAM_ID"
export APPLE_KEYCHAIN_PROFILE="vaporvibe-notary"
```

## Build and Notarize Process

### Two-Step Workflow

**Option 1: Build with Developer ID Signing (Recommended)**

```bash
# Step 1: Build and sign in one command
npm run build:sea:signed

# Step 2: Submit for notarization
npm run build:sea:submit
```

**Option 2: Separate Build and Signing**

```bash
# Step 1: Build with ad-hoc signature (for testing)
npm run build:sea

# Step 2: Sign and notarize
npm run build:sea:submit
```

````

### What Each Script Does

**`npm run build:sea:notarize`** - Builds and signs with Developer ID:

1. ✅ Compiles TypeScript
2. ✅ Generates SEA blob
3. ✅ Injects blob into Node binary
4. 🔏 Signs with Developer ID certificate and entitlements

**`npm run notarize:sea`** - Submits for notarization:

1. ✅ Checks if binary is already signed (skips re-signing if yes)
2. 📦 Creates zip archive for submission
3. ⏳ Submits to Apple's Notary Service (takes 2-5 minutes)
4. ✅ Verifies the notarized binary

### Step 3: Verify the Notarized Binary

```bash
# Run comprehensive verification
npm run build:sea:verify

# Or test manually
./out/sea/vaporvibe-macos "You are a helpful assistant"
````

The verification script performs 5 checks:

1. ✅ **Code signature validity** - Ensures the binary is properly signed
2. 🔍 **Signature details** - Shows Developer ID, Team ID, and timestamp
3. 📌 **Stapled ticket check** - Verifies notarization ticket is attached
4. 🛡️ **Gatekeeper assessment** - Tests if macOS will allow execution
5. 📜 **Online notarization history** - Shows recent submissions (if credentials set)

**Example successful output:**

```
✓ Code signature is valid
✓ Notarization ticket is stapled
✓ Binary passes Gatekeeper assessment
✓ Binary is properly notarized and will run without warnings
```

## Distribution

Once notarized and stapled, the binary can be distributed and will run on any macOS system without security warnings.

### Download without warnings

Users can download and run the binary directly:

```bash
curl -L -o vaporvibe https://github.com/yourorg/vaporvibe/releases/download/v1.0.0/vaporvibe-macos
chmod +x vaporvibe
./vaporvibe "You are a helpful assistant"
```

## Understanding Stapling for CLI Tools

### What is Stapling?

Stapling attaches the notarization ticket directly to your binary. However, **stapling doesn't work for plain executable files** - only for app bundles (.app), disk images (.dmg), and installer packages (.pkg).

### CLI Tools and Notarization

For CLI executables like `vaporvibe-macos`:

- ✅ **Full notarization works** (signed, submitted, and accepted by Apple)
- ✅ **Security is identical** to stapled binaries
- ⚠️ **Stapling fails with Error 73** (this is expected and normal)
- 📡 **Online verification** - macOS checks notarization on first run (requires internet)
- 💾 **Cached after first run** - subsequent runs work offline

### What This Means for Distribution

Your notarized CLI tool:

- Will run without warnings after users have internet on first launch
- Is fully secure and properly signed
- Meets all Apple security requirements
- Can be distributed via direct download, GitHub releases, etc.

## Troubleshooting

### "Error 73" during stapling

**This is normal for CLI executables.** The stapling step will show:

```
Processing: /path/to/vaporvibe-macos
The staple and validate action failed! Error 73.
```

This is **not an error** - your binary is fully notarized. Error 73 means "can't staple to this file format," which is expected for plain executables. The verification step will confirm notarization is successful.

### "HTTP status code: 403. A required agreement is missing or has expired"

**This is the most common issue for first-time notarization.**

Apple requires you to accept their developer agreements before notarizing:

1. **Go to https://developer.apple.com/account**
2. Sign in with your Apple ID
3. Look for any pending agreements or alerts at the top
4. Click on **"Agreements, Tax, and Banking"** in the sidebar
5. Review and accept any pending agreements
6. Wait 5-10 minutes for the changes to propagate
7. Try notarization again: `npm run build:sea:submit`

**Note:** Even with an active Apple Developer Program membership, you must explicitly accept the latest agreements before notarization will work.

### "No identity found" error

Your Developer ID certificate isn't installed. Install it from:

- https://developer.apple.com/account/resources/certificates/list

### "Invalid notarization credentials"

1. Verify your app-specific password is correct
2. Check your Apple ID and Team ID
3. Ensure your keychain profile exists:
   ```bash
   xcrun notarytool list --keychain-profile "vaporvibe-notary"
   ```

### "The binary is not signed"

The signing step failed. Check that:

- Your Developer ID certificate is installed
- The certificate matches your Team ID
- The certificate hasn't expired

### Notarization takes too long

- Normal wait time: 2-5 minutes
- If longer than 15 minutes, check status:
  ```bash
  xcrun notarytool history --keychain-profile "vaporvibe-notary"
  ```

### View notarization logs

If notarization fails, retrieve detailed logs:

```bash
# Get submission ID from the error output
xcrun notarytool log <SUBMISSION_ID> --keychain-profile "vaporvibe-notary"
```

## Security Notes

- **Never commit** `APPLE_APP_PASSWORD` to version control
- Use keychain profiles instead of environment variables when possible
- App-specific passwords can be revoked at https://appleid.apple.com
- Developer ID certificates expire after 5 years

## Native Modules and keytar

### Background

VaporVibe uses [keytar](https://github.com/atom/node-keytar) for secure credential storage, which includes native `.node` bindings that need special handling during signing and notarization.

### SEA (Single Executable) Builds

The current SEA build process:

1. **Bundles keytar's native bindings** in the blob via `node_modules/` traversal
2. **Extracts them at runtime** to a temporary directory
3. **Loads dynamically** - may fail if extraction or loading fails

**Important entitlements needed:**

- `com.apple.security.cs.disable-library-validation` - Allows loading extracted native modules
- `com.apple.security.cs.allow-dyld-environment-variables` - Needed for Node.js runtime

These are already configured in [`scripts/entitlements.plist`](../scripts/entitlements.plist).

### App Bundle (.app) Builds

For the macOS app bundle, native modules are handled differently:

1. **Native bindings are extracted** during bundle creation
2. **Each .node file is signed individually** before the app bundle signature
3. **More reliable** than SEA extraction

The signing script ([`scripts/macos-app/sign-app-bundle.sh`](../scripts/macos-app/sign-app-bundle.sh)) now includes:

```bash
# Sign any native modules (e.g., keytar .node files) if present
find "$RESOURCES_DIR" -name "*.node" -type f -print0 | while IFS= read -r -d '' node_file; do
  codesign --force --sign "$CERT_NAME" --options runtime --timestamp "$node_file"
done
```

### Keychain Access Permissions

For **Developer ID (non-sandboxed)** apps:

- ✅ No special keychain entitlements needed
- ✅ App can access user's keychains by default
- ✅ Works with current entitlements configuration

For **Mac App Store** apps (future consideration):

- Would need sandboxing enabled
- Would need explicit keychain-access-groups entitlement
- Would need to specify app identifier prefix

### Testing Native Module Loading

After building and signing, verify keytar loads correctly:

```bash
# Build and sign
npm run build:sea:signed

# Test - should not show "Secure credential storage unavailable" warning
./out/sea/vaporvibe-macos "Test" --port 9999
```

If you see the warning, keytar failed to load. Check:

1. Native bindings are in the SEA blob
2. Extraction permissions are correct
3. Signature is valid: `codesign -dv ./out/sea/vaporvibe-macos`

### Fallback Behavior

If keytar fails to load (missing bindings, SEA extraction failure, etc.):

- ⚠️ Warning logged: "Secure credential storage unavailable"
- ✅ App continues to function normally
- 💾 Credentials stored in memory only for the session
- 🔄 Falls back to environment variables on restart

## References

- [Apple Notarization Documentation](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [notarytool User Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution/customizing_the_notarization_workflow)
- [Code Signing Guide](https://developer.apple.com/library/archive/documentation/Security/Conceptual/CodeSigningGuide/Introduction/Introduction.html)
