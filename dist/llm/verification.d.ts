import type { ModelProvider, VerificationResult } from "../types.js";
export declare function verifyProviderApiKey(provider: ModelProvider, apiKey: string): Promise<VerificationResult>;
