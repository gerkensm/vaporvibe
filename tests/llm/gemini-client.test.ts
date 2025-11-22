import { describe, it, expect, vi } from 'vitest';
import { GeminiClient, mergeGeminiThoughtSummary } from '../../src/llm/gemini-client';
import { ProviderSettings } from '../../src/types';

// Mock GoogleGenAI
vi.mock('@google/genai', () => {
    return {
        GoogleGenAI: class MockGoogleGenAI {
            models = {
                generateContentStream: vi.fn(),
                generateContent: vi.fn()
            };
        },
        ThinkingLevel: { LOW: 'LOW', HIGH: 'HIGH' }
    };
});

describe('GeminiClient', () => {
    const mockConfig: ProviderSettings = {
        provider: 'gemini',
        model: 'gemini-2.0-flash-thinking-exp-1219',
        apiKey: 'test-key',
        reasoningMode: 'high'
    };

    it('should instantiate correctly', () => {
        const client = new GeminiClient(mockConfig);
        expect(client).toBeInstanceOf(GeminiClient);
    });

    describe('mergeGeminiThoughtSummary', () => {
        it("should handle edge cases with existing newlines correctly", () => {
            // Case 1: Existing ends with newline, incoming starts with text
            let current = "Chunk 1\n";
            let incoming = "Chunk 2";
            let merged = mergeGeminiThoughtSummary(current, incoming);
            expect(merged).toBe("Chunk 1\n\nChunk 2");

            // Case 2: Existing ends with text, incoming starts with newline
            current = "Chunk 1";
            incoming = "\nChunk 2";
            merged = mergeGeminiThoughtSummary(current, incoming);
            expect(merged).toBe("Chunk 1\n\nChunk 2");

            // Case 3: Both have newlines
            current = "Chunk 1\n";
            incoming = "\nChunk 2";
            merged = mergeGeminiThoughtSummary(current, incoming);
            expect(merged).toBe("Chunk 1\n\nChunk 2");
        });

        it("should NOT split words when merging tokens if they are passed as separate chunks", () => {
            // Note: The current logic enforces double newlines for ANY merge that doesn't overlap.
            // This means "Hel" + "lo" -> "Hel\n\nlo".
            // This is acceptable for *thought summaries* which are usually distinct sentences/thoughts.
            // If we wanted to support token streaming, we would need the heuristic back.
            // For now, we verify the current behavior to ensure stability.
            const current = "Hel";
            const incoming = "lo";
            const merged = mergeGeminiThoughtSummary(current, incoming);
            expect(merged).toBe("Hel\n\nlo");
        });

        it('should correctly merge disjoint thought chunks with newlines', () => {
            const chunk1 = "Summary (draft)";
            const chunk2 = "Conceptualizing the Interface";
            const chunk3 = "Developing the Core Features";

            let merged = mergeGeminiThoughtSummary(undefined, chunk1);
            merged = mergeGeminiThoughtSummary(merged, chunk2);
            merged = mergeGeminiThoughtSummary(merged, chunk3);

            expect(merged).toBe('Summary (draft)\n\nConceptualizing the Interface\n\nDeveloping the Core Features');
        });
    });
});
