# Secure Credential Storage

## Overview

serve-llm securely stores API keys entered through the UI using your operating system's native credential storage via [keytar](https://github.com/atom/node-keytar):

- **macOS**: Keychain
- **Windows**: Credential Manager
- **Linux**: Secret Service (libsecret / gnome-keyring / KWallet)

## Behavior

### ✅ Keys That ARE Stored Securely

API keys entered through the **UI** (setup wizard or admin dashboard) are automatically stored in your OS keychain:

1. User enters API key in the setup wizard → stored in OS keychain
2. User replaces key in admin dashboard → new key stored in OS keychain
3. Keys persist across sessions and restarts

### ❌ Keys That Are NOT Stored

API keys from these sources remain **in-memory only** for the current session:

- Environment variables (`OPENAI_API_KEY`, `GEMINI_API_KEY`, etc.)
- CLI options (`--api-key`)
- Keys loaded from `.env` files

**Rationale**: Environment-based credentials are typically managed by deployment tools, CI/CD pipelines, or infrastructure-as-code. Storing them in the keychain would duplicate state and could cause confusion about which credential is active.

## Fallback Behavior

If keytar cannot load (e.g., in SEA bundles without native bindings, or Linux systems without Secret Service), the system **gracefully degrades**:

1. **Keytar unavailable** → warning logged, credentials stored in memory only
2. **Keychain write fails** → error logged, credential still works in memory
3. **Keychain read fails** → error logged, falls back to environment variables

The application **always works** regardless of keychain availability—worst case is credentials don't persist between sessions.

## Security Notes

### Why This is Secure

- **OS-level protection**: Credentials are protected by your OS's security model
- **Per-user isolation**: Keys are only accessible to the user who stored them
- **No plaintext storage**: Keys are never written to config files or logs
- **Audit trail**: On macOS, Keychain logs access attempts

### macOS Specifics

- Items created by your app are readable by your app without prompts
- If you codesign/notarize later, keep the same bundle identifier (`com.serve-llm.app`) to avoid ACL issues
- Keys are stored under service name `com.serve-llm.app`

### Windows Specifics

- Stored under **Generic Credentials** in Credential Manager
- Works in both GUI and service contexts
- View stored keys via: Control Panel → Credential Manager

### Linux Specifics

- Requires a running Secret Service (standard on most desktop environments)
- On headless servers without a keyring, keytar will fail to load → falls back to memory-only storage
- Ubuntu/Debian: ensure `libsecret-1-0` is installed
- Build time: requires `libsecret-1-dev` for native compilation

## Implementation Details

### Code Structure

- [`src/utils/credential-store.ts`](../src/utils/credential-store.ts) - Main credential storage implementation
- [`src/server/admin-controller.ts`](../src/server/admin-controller.ts) - Integrates storage into admin flow
- [`src/server/server.ts`](../src/server/server.ts) - Integrates storage into setup wizard

### Key Functions

```typescript
const store = getCredentialStore();

// Save a UI-entered key (not env/CLI keys)
await store.saveApiKey("openai", "sk-...");

// Retrieve a stored key
const key = await store.getApiKey("openai"); // null if not found

// Check if key exists
const hasKey = await store.hasStoredKey("openai");

// Remove a key
await store.deleteApiKey("openai");

// Clear all stored keys
await store.clearAll();

// Check storage backend
const info = await store.getStorageInfo();
// Returns: { backend: "OS Keychain (keytar)" | "Memory (in-session only)", persistent: boolean }
```

### Error Handling

All credential store methods are defensive:

- Failed saves → logs error, continues with memory storage
- Failed reads → logs error, returns null
- Keytar unavailable → warning on first use, falls back to memory

## Testing Credential Storage

### Manual Test (UI Entry)

1. Start serve-llm: `npm run dev "Test app"`
2. In the setup wizard, enter an API key (e.g., OpenAI)
3. Verify it stores successfully (check logs for errors)
4. Restart the server
5. The key should be pre-loaded from the keychain

### Manual Test (Environment Key)

1. Set env var: `export OPENAI_API_KEY=sk-...`
2. Start serve-llm: `npm run dev "Test app"`
3. The setup wizard shows "key detected from environment"
4. This key is NOT stored in the keychain
5. Restart without the env var → key is gone (expected)

### Verify Storage Backend

Check the logs on startup. You should see either:

- **Success**: No warnings (keytar loaded successfully)
- **Fallback**: `"Secure credential storage unavailable (keytar not loaded)..."`

On macOS, verify stored keys:

```bash
# List all serve-llm credentials
security find-generic-password -s "com.serve-llm.app"

# View specific key (will prompt for access)
security find-generic-password -s "com.serve-llm.app" -a "openai" -w
```

## Building with Keytar

### Regular Node Builds

```bash
npm install  # Builds native bindings automatically
npm run build
npm start
```

### SEA (Single Executable Application)

**Current Status**: keytar's native `.node` files are bundled into the SEA blob automatically via the `node_modules/` traversal in [`scripts/build-macos-sea.sh`](../scripts/build-macos-sea.sh).

**How it works**:

1. Build process includes all files from `node_modules/keytar/build/Release/*.node`
2. At runtime, SEA extracts these to a temp directory
3. Node.js loads the native module from the temp location
4. If extraction/loading fails → graceful fallback to memory-only storage

**Signing considerations**:

- Native `.node` files inside the SEA blob are signed as part of the outer binary
- Current entitlements (`com.apple.security.cs.disable-library-validation`) allow loading extracted native modules
- No additional signing steps needed for SEA builds

**Testing SEA with keytar**:

```bash
# Build signed SEA
npm run build:sea:signed

# Run - check for keytar warnings
./out/sea/serve-llm-macos "Test app" --port 9999
```

If you see `"Secure credential storage unavailable"`, keytar failed to load. This is non-fatal - credentials will work in-memory only.

### macOS App Bundle

For the app bundle (`.app` distribution), native modules are handled more reliably:

1. Native `.node` files are **pre-extracted** during bundle creation
2. Each `.node` file is **signed individually** before the bundle signature
3. More stable than SEA extraction (no temp directory issues)

The signing script ([`scripts/macos-app/sign-app-bundle.sh`](../scripts/macos-app/sign-app-bundle.sh)) automatically:

- Finds all `.node` files in the Resources directory
- Signs each one with Developer ID and runtime hardening
- Then signs the entire app bundle

**Required entitlements** (already configured):

- `com.apple.security.cs.disable-library-validation` - Allows loading native modules
- `com.apple.security.cs.allow-unsigned-executable-memory` - Required for V8 JIT
- `com.apple.security.cs.allow-dyld-environment-variables` - Needed for Node.js

**Keychain access**: Developer ID (non-sandboxed) apps can access user keychains without additional entitlements. If you ever submit to the Mac App Store, you'll need sandbox entitlements and explicit keychain-access-groups.

### Docker/CI Builds

On Linux build environments:

```dockerfile
# Install libsecret for keytar compilation
RUN apt-get update && apt-get install -y libsecret-1-dev

# Then install Node dependencies
RUN npm install
```

## Troubleshooting

### "Secure credential storage unavailable"

**Cause**: keytar failed to load (missing native bindings or Secret Service)

**Impact**: Credentials stored in memory only (session-scoped)

**Solutions**:

- Ensure native dependencies are installed
- Linux: Install Secret Service provider (`libsecret-1-0`)
- Or: Use environment variables for credentials

### "Failed to save credential to keychain"

**Cause**: Keychain is locked or permission denied

**Impact**: Credential still works (stored in memory)

**Solutions**:

- Unlock your system keychain
- Check file permissions on keychain files
- Or: Use environment variables for credentials

### Keys Not Persisting

**Check**:

1. Did you enter the key in the UI, or was it from an env var?
2. Check logs for keytar warnings
3. On macOS: `security find-generic-password -s "com.serve-llm.app"`
4. On Windows: Open Credential Manager and look for "com.serve-llm.app"
