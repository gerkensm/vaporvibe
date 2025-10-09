import type { ModelProvider } from "../types.js";
/**
 * Credential store that uses OS keychain when available (via keytar),
 * falls back to in-memory storage when keytar is unavailable.
 *
 * Only stores credentials entered via the UI, never those from environment variables or CLI.
 */
export declare class CredentialStore {
    private keytar;
    private keytarAvailable;
    private memoryCache;
    /**
     * Lazy-load keytar to handle missing native bindings gracefully
     */
    private loadKeytar;
    /**
     * Check if secure storage is available (OS keychain via keytar)
     */
    isAvailable(): Promise<boolean>;
    /**
     * Save an API key for a provider (UI-entered only, not from env/CLI)
     */
    saveApiKey(provider: ModelProvider, apiKey: string): Promise<void>;
    /**
     * Retrieve a stored API key for a provider
     */
    getApiKey(provider: ModelProvider): Promise<string | null>;
    /**
     * Delete a stored API key for a provider
     */
    deleteApiKey(provider: ModelProvider): Promise<boolean>;
    /**
     * Check if a provider has a stored credential
     */
    hasStoredKey(provider: ModelProvider): Promise<boolean>;
    /**
     * Clear all stored credentials (memory and keychain)
     */
    clearAll(): Promise<void>;
    /**
     * Get storage backend info for debugging
     */
    getStorageInfo(): Promise<{
        backend: string;
        persistent: boolean;
    }>;
}
export declare function getCredentialStore(): CredentialStore;
