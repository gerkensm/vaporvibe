import { logger } from "../logger.js";

type ProviderKey = string;

const SERVICE_NAME = "com.vaporvibe.app";

/**
 * Credential store that uses OS keychain when available (via keytar),
 * falls back to in-memory storage when keytar is unavailable.
 *
 * Only stores credentials entered via the UI, never those from environment variables or CLI.
 */
export class CredentialStore {
  private keytar: typeof import("keytar") | null = null;
  private keytarAvailable: boolean | null = null;
  private memoryCache: Map<ProviderKey, string> = new Map();

  /**
   * Lazy-load keytar to handle missing native bindings gracefully
   */
  private async loadKeytar(): Promise<boolean> {
    if (this.keytarAvailable !== null) {
      return this.keytarAvailable;
    }

    logger.debug(
      "Attempting to load keytar native module for secure credential storage"
    );
    try {
      // Try to load keytar - will fail if native bindings aren't available
      const keytarModule = await import("keytar");
      this.keytar = keytarModule.default ?? keytarModule;
      this.keytarAvailable = true;
      logger.info(
        "Keytar loaded successfully - OS keychain storage available for UI-entered credentials"
      );
      return true;
    } catch (error) {
      // Native bindings not available (SEA without proper bundling, or missing libsecret on Linux)
      this.keytarAvailable = false;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.warn(
        { err: error },
        `Keytar failed to load (${errorMessage}) - falling back to memory-only credential storage`
      );
      logger.warn(
        "API keys entered in the UI will persist in memory only for this session. " +
        "For persistent storage, ensure native dependencies are available."
      );
      return false;
    }
  }

  /**
   * Check if secure storage is available (OS keychain via keytar)
   */
  async isAvailable(): Promise<boolean> {
    return await this.loadKeytar();
  }

  /**
   * Save an API key for a provider (UI-entered only, not from env/CLI)
   */
  async saveApiKey(provider: ProviderKey, apiKey: string): Promise<void> {
    // Always store in memory cache
    this.memoryCache.set(provider, apiKey);

    // Try to persist to OS keychain if available
    if (await this.loadKeytar()) {
      try {
        await this.keytar!.setPassword(SERVICE_NAME, provider, apiKey);
        logger.debug({ provider }, "Saved API key to OS keychain");
      } catch (error) {
        logger.error(
          { err: error, provider },
          "Failed to save credential to keychain - will use memory storage"
        );
        // Continue - still have memory cache
      }
    } else {
      logger.debug(
        { provider },
        "Stored API key in memory only (keytar unavailable)"
      );
    }
  }

  /**
   * Retrieve a stored API key for a provider
   */
  async getApiKey(provider: ProviderKey): Promise<string | null> {
    // Check memory cache first (faster)
    const cached = this.memoryCache.get(provider);
    if (cached) {
      return cached;
    }

    // Try to load from OS keychain
    if (await this.loadKeytar()) {
      try {
        const stored = await this.keytar!.getPassword(SERVICE_NAME, provider);
        if (stored) {
          logger.debug({ provider }, "Retrieved API key from OS keychain");
          // Update memory cache
          this.memoryCache.set(provider, stored);
          return stored;
        }
        logger.debug({ provider }, "No stored key found in OS keychain");
      } catch (error) {
        logger.error(
          { err: error, provider },
          "Failed to retrieve credential from keychain"
        );
      }
    }

    return null;
  }

  /**
   * Delete a stored API key for a provider
   */
  async deleteApiKey(provider: ProviderKey): Promise<boolean> {
    // Remove from memory cache
    this.memoryCache.delete(provider);

    // Try to remove from OS keychain
    if (await this.loadKeytar()) {
      try {
        const deleted = await this.keytar!.deletePassword(
          SERVICE_NAME,
          provider
        );
        if (deleted) {
          logger.debug({ provider }, "Deleted API key from OS keychain");
        }
        return deleted;
      } catch (error) {
        logger.error(
          { err: error, provider },
          "Failed to delete credential from keychain"
        );
        return false;
      }
    }

    return false;
  }

  /**
   * Check if a provider has a stored credential
   */
  async hasStoredKey(provider: ProviderKey): Promise<boolean> {
    const key = await this.getApiKey(provider);
    return key !== null && key.trim().length > 0;
  }

  /**
   * Clear all stored credentials (memory and keychain)
   */
  async clearAll(): Promise<void> {
    // Clear memory cache
    const providers = Array.from(this.memoryCache.keys());
    this.memoryCache.clear();

    // Clear from keychain
    if (await this.loadKeytar()) {
      for (const provider of providers) {
        try {
          await this.keytar!.deletePassword(SERVICE_NAME, provider);
        } catch {
          // Ignore individual deletion errors
        }
      }
    }
  }

  /**
   * Get storage backend info for debugging
   */
  async getStorageInfo(): Promise<{ backend: string; persistent: boolean }> {
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
let instance: CredentialStore | null = null;

export function getCredentialStore(): CredentialStore {
  if (!instance) {
    instance = new CredentialStore();
  }
  return instance;
}
