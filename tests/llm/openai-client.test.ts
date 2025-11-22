import { describe, it, expect, vi } from 'vitest';
import { OpenAiClient, normalizeReasoningChunk } from '../../src/llm/openai-client';
import { ProviderSettings } from '../../src/types';

// Mock OpenAI
vi.mock('openai', () => {
    return {
        default: class MockOpenAI {
            responses = {
                stream: vi.fn()
            };
        }
    };
});

describe('OpenAiClient', () => {
    const mockConfig: ProviderSettings = {
        provider: 'openai',
        model: 'gpt-4o',
        apiKey: 'test-key',
        reasoningMode: 'high',
        maxOutputTokens: 1000
    };

    describe('normalizeReasoningChunk', () => {
        it('should preserve explicit newlines', () => {
            const previous = "Chunk 1";
            const raw = "\nChunk 2";
            const normalized = normalizeReasoningChunk(previous, raw);
            // Current implementation trims whitespace, so this might fail or return "Chunk 2" without newline
            // We want it to preserve the newline
            expect(normalized).toBe("\nChunk 2");
        });

        it('should handle whitespace-only chunks (newlines)', () => {
            const previous = "Chunk 1";
            const raw = "\n\n";
            const normalized = normalizeReasoningChunk(previous, raw);
            // Current implementation returns null for whitespace-only chunks
            expect(normalized).toBe("\n\n");
        });

        it('should not add extra newlines if already present', () => {
            const previous = "Chunk 1\n";
            const raw = "\nChunk 2";
            const normalized = normalizeReasoningChunk(previous, raw);
            expect(normalized).toBe("\nChunk 2");
        });
    });

    it('should correctly merge disjoint reasoning chunks with newlines', async () => {
        const client = new OpenAiClient(mockConfig);

        // Mock the stream
        const mockStream = {
            on: vi.fn(),
            finalResponse: vi.fn().mockResolvedValue({
                output: [],
                usage: { total_tokens: 100 }
            }),
            [Symbol.asyncIterator]: vi.fn()
        };

        (client as any).client.responses.stream.mockReturnValue(mockStream);

        // We need to simulate the events
        const events: any[] = [];
        const observer = {
            onReasoningEvent: (event: any) => events.push(event)
        };

        // Trigger generation
        const promise = client.generateHtml([{ role: 'user', content: 'test' }], { streamObserver: observer });

        // Simulate stream events
        // Get the event handlers registered
        const reasoningHandler = mockStream.on.mock.calls.find(call => call[0] === 'response.reasoning_text.delta')?.[1];

        if (reasoningHandler) {
            // Simulate chunks that should be separated (Header)
            reasoningHandler({ delta: "Thinking about the problem." });
            reasoningHandler({ delta: "**Managing app state effectively**" }); // Header (starts with *)

            // Simulate chunks that should NOT be separated (Sentences)
            reasoningHandler({ delta: " This is sentence one." });
            reasoningHandler({ delta: "This is sentence two." });
        }

        await promise;

        // Reconstruct full text
        const fullText = events.map(e => e.text).join('');

        // Expectation: 
        // 1. Header separated by newlines: "Thinking about the problem.\n\n**Managing app state effectively**"
        // 2. Sentences joined normally (maybe with a space if missing, or just concatenated): " This is sentence one.This is sentence two."
        //    (Note: The merge logic currently doesn't add spaces, it just prevents double newlines. 
        //     If the stream doesn't have a space, it will be "one.This". That's fine for now, we just want to avoid \n\n)

        expect(fullText).toContain('Thinking about the problem.\n\n**Managing app state effectively**');
        expect(fullText).toContain('This is sentence one.This is sentence two.');
        expect(fullText).not.toContain('This is sentence one.\n\nThis is sentence two.');
    });
});
