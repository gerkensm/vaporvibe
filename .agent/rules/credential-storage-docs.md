---
trigger: always_on
globs: **/*
---


# Content from docs/modules/utils/credential-store.md

# Module: Credential Store

> **File**: `src/utils/credential-store.ts`
> **Class**: `CredentialStore`

## Overview
The `CredentialStore` manages the secure storage and retrieval of sensitive API keys. It abstracts the underlying storage mechanism, providing a unified interface that degrades gracefully from OS-level encryption to in-memory caching.

## Storage Strategy

### 1. Primary: OS Keychain (`keytar`)
The store attempts to use the `keytar` native module to access the operating system's secure keychain (e.g., macOS Keychain, Windows Credential Manager, Linux libsecret).
-   **Security**: High. Keys are encrypted by the OS.
-   **Persistence**: Keys survive application restarts.
-   **Requirement**: Native build dependencies must be present.

### 2. Fallback: In-Memory Map
If `keytar` fails to load (common in Docker containers, CI/CD environments, or Linux systems without a desktop environment), the store automatically falls back to a Javascript `Map`.
-   **Security**: Medium (memory dump risk).
-   **Persistence**: None. Keys are lost when the process exits.
-   **Behavior**: The application continues to function normally, but users will need to re-enter keys after a restart.

## API Reference

### `saveApiKey(provider, key)`
-   Writes to both the memory cache and the OS keychain (if available).
-   Logs a warning if keychain storage fails but memory storage succeeds.

### `getApiKey(provider)`
-   Checks memory cache first (fast path).
-   If missing, queries the OS keychain and populates the cache.

### `isAvailable()`
-   Returns `true` if the OS keychain backend is loaded and functional.
-   Useful for UI indicators (e.g., showing a "Keys will not be saved" warning).

## Implementation Details
The class uses a lazy-loading pattern for the `keytar` module (`import("keytar")`) inside a `try/catch` block. This prevents the entire application from crashing at startup if the native bindings are missing or incompatible with the current Node.js version.

