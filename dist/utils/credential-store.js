const SERVICE_NAME = "com.serve-llm.app";
/**
 * Credential store that uses OS keychain when available (via keytar),
 * falls back to in-memory storage when keytar is unavailable.
 *
 * Only stores credentials entered via the UI, never those from environment variables or CLI.
 */
export class CredentialStore {
    keytar = null;
    keytarAvailable = null;
    memoryCache = new Map();
    /**
     * Lazy-load keytar to handle missing native bindings gracefully
     */
    async loadKeytar() {
        if (this.keytarAvailable !== null) {
            return this.keytarAvailable;
        }
        try {
            // Try to load keytar - will fail if native bindings aren't available
            const keytarModule = await import("keytar");
            this.keytar = keytarModule.default ?? keytarModule;
            this.keytarAvailable = true;
            return true;
        }
        catch (error) {
            // Native bindings not available (SEA without proper bundling, or missing libsecret on Linux)
            this.keytarAvailable = false;
            console.warn("Secure credential storage unavailable (keytar not loaded). " +
                "API keys entered in the UI will be stored in memory only for this session. " +
                "For persistent storage, ensure native dependencies are available.");
            return false;
        }
    }
    /**
     * Check if secure storage is available (OS keychain via keytar)
     */
    async isAvailable() {
        return await this.loadKeytar();
    }
    /**
     * Save an API key for a provider (UI-entered only, not from env/CLI)
     */
    async saveApiKey(provider, apiKey) {
        // Always store in memory cache
        this.memoryCache.set(provider, apiKey);
        // Try to persist to OS keychain if available
        if (await this.loadKeytar()) {
            try {
                await this.keytar.setPassword(SERVICE_NAME, provider, apiKey);
            }
            catch (error) {
                console.error(`Failed to save ${provider} credential to keychain:`, error instanceof Error ? error.message : String(error));
                // Continue - still have memory cache
            }
        }
    }
    /**
     * Retrieve a stored API key for a provider
     */
    async getApiKey(provider) {
        // Check memory cache first (faster)
        const cached = this.memoryCache.get(provider);
        if (cached) {
            return cached;
        }
        // Try to load from OS keychain
        if (await this.loadKeytar()) {
            try {
                const stored = await this.keytar.getPassword(SERVICE_NAME, provider);
                if (stored) {
                    // Update memory cache
                    this.memoryCache.set(provider, stored);
                    return stored;
                }
            }
            catch (error) {
                console.error(`Failed to retrieve ${provider} credential from keychain:`, error instanceof Error ? error.message : String(error));
            }
        }
        return null;
    }
    /**
     * Delete a stored API key for a provider
     */
    async deleteApiKey(provider) {
        // Remove from memory cache
        this.memoryCache.delete(provider);
        // Try to remove from OS keychain
        if (await this.loadKeytar()) {
            try {
                return await this.keytar.deletePassword(SERVICE_NAME, provider);
            }
            catch (error) {
                console.error(`Failed to delete ${provider} credential from keychain:`, error instanceof Error ? error.message : String(error));
                return false;
            }
        }
        return false;
    }
    /**
     * Check if a provider has a stored credential
     */
    async hasStoredKey(provider) {
        const key = await this.getApiKey(provider);
        return key !== null && key.trim().length > 0;
    }
    /**
     * Clear all stored credentials (memory and keychain)
     */
    async clearAll() {
        // Clear memory cache
        const providers = Array.from(this.memoryCache.keys());
        this.memoryCache.clear();
        // Clear from keychain
        if (await this.loadKeytar()) {
            for (const provider of providers) {
                try {
                    await this.keytar.deletePassword(SERVICE_NAME, provider);
                }
                catch {
                    // Ignore individual deletion errors
                }
            }
        }
    }
    /**
     * Get storage backend info for debugging
     */
    async getStorageInfo() {
        const available = await this.isAvailable();
        return {
            backend: available ? "OS Keychain (keytar)" : "Memory (in-session only)",
            persistent: available,
        };
    }
}
/**
 * Singleton instance for global access
 */
let instance = null;
export function getCredentialStore() {
    if (!instance) {
        instance = new CredentialStore();
    }
    return instance;
}
