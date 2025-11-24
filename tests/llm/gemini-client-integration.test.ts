/**
 * Gemini Client Integration Tests
 * 
 * Tests the actual GeminiClient transformations using real fixtures.
 * Snapshots capture what OUR CODE outputs, not just the raw API responses.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GeminiClient } from '../../src/llm/gemini-client.js';
import type { LlmStreamObserver, LlmReasoningStreamEvent } from '../../src/llm/client.js';
import type { ProviderSettings } from '../../src/types.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixturesDir = path.join(__dirname, '..', 'fixtures', 'gemini');

function loadFixture(filename: string) {
    const fixturePath = path.join(fixturesDir, filename);
    const content = fs.readFileSync(fixturePath, 'utf-8');
    return JSON.parse(content);
}

// Helper to create an async iterable from fixture chunks
async function* createMockStream(chunks: any[]) {
    for (const chunk of chunks) {
        const enhancedChunk = {
            ...chunk,
            text: () => {
                if (chunk.candidates?.[0]?.content?.parts) {
                    return chunk.candidates[0].content.parts
                        .filter((p: any) => p.thought !== true)
                        .map((p: any) => p.text || '')
                        .join('');
                }
                return '';
            }
        };
        yield enhancedChunk;
    }
}

describe('GeminiClient Integration', () => {
    describe('Thinking Extraction and Transformation', () => {
        it('should transform Flash thinking stream into LlmResult with reasoning trace', async () => {
            const fixture = loadFixture('gemini-2.5-flash-thinking.json');

            // Mock GoogleGenAI SDK
            const mockClient = {
                models: {
                    generateContentStream: vi.fn(async () => createMockStream(fixture.chunks)),
                },
            };

            const settings: ProviderSettings = {
                provider: 'gemini',
                apiKey: 'test-key',
                model: 'gemini-2.5-flash',
                maxOutputTokens: 8192,
                reasoningTokensEnabled: true,
                reasoningTokens: 2000,
                reasoningMode: 'default',
            };

            const client = new GeminiClient(settings);
            // @ts-ignore - inject mock
            client['client'] = mockClient;

            // Collect stream observer events
            const reasoningEvents: LlmReasoningStreamEvent[] = [];
            const streamObserver: LlmStreamObserver = {
                onReasoningEvent: (event) => {
                    reasoningEvents.push(event);
                },
            };

            const result = await client.generateHtml(
                [{ role: 'user', content: 'Write a hello world function' }],
                { streamObserver }
            );

            // Snapshot the TRANSFORMED output
            expect({
                html: result.html,
                reasoning: result.reasoning,
                usage: result.usage,
            }).toMatchSnapshot('gemini-flash-thinking-result');

            // Snapshot the emitted events (what the UI receives)
            expect(reasoningEvents).toMatchSnapshot('gemini-flash-thinking-events');

            // Verify transformations
            expect(result.html).toContain('function sayHello()');
            expect(result.html).not.toContain('**Analyzing the Requirements**'); // No thinking in HTML
            expect(result.reasoning?.details).toHaveLength(1); // Merged into 1 block
            expect((result.reasoning?.raw as string[])?.[0]).toContain('Comprehending the Task');
            expect(reasoningEvents.length).toBeGreaterThan(0);
            expect(reasoningEvents.every(e => e.text.endsWith('\n'))).toBe(true);
        });

        it('should transform Flash basic stream (no thinking) into LlmResult', async () => {
            const fixture = loadFixture('gemini-2.5-flash-basic.json');

            const mockClient = {
                models: {
                    generateContentStream: vi.fn(async () => createMockStream(fixture.chunks)),
                },
            };

            const settings: ProviderSettings = {
                provider: 'gemini',
                apiKey: 'test-key',
                model: 'gemini-2.5-flash',
                maxOutputTokens: 8192,
                reasoningMode: 'default',
            };

            const client = new GeminiClient(settings);
            // @ts-ignore
            client['client'] = mockClient;

            const result = await client.generateHtml(
                [{ role: 'user', content: 'Write a hello world function' }]
            );

            expect({
                html: result.html,
                reasoning: result.reasoning,
                usage: result.usage,
            }).toMatchSnapshot('gemini-flash-basic-result');

            // No thinking in basic mode
            expect(result.reasoning).toBeUndefined();
            expect(result.html).toContain('function');
        });

        it('should transform Pro HIGH thinking into verbose reasoning trace', async () => {
            const fixture = loadFixture('gemini-3-pro-preview-thinking-high.json');

            const mockClient = {
                models: {
                    generateContentStream: vi.fn(async () => createMockStream(fixture.chunks)),
                },
            };

            const settings: ProviderSettings = {
                provider: 'gemini',
                apiKey: 'test-key',
                model: 'gemini-3-pro-preview',
                maxOutputTokens: 64000,
                reasoningMode: 'high',
            };

            const client = new GeminiClient(settings);
            // @ts-ignore
            client['client'] = mockClient;

            const result = await client.generateHtml(
                [{ role: 'user', content: 'Write a hello world function' }]
            );

            expect({
                reasoningSummariesCount: result.reasoning?.summaries?.length,
                reasoningRawLength: (result.reasoning?.raw as string[] | undefined)?.length,
                html: result.html,
                usage: result.usage,
            }).toMatchSnapshot('gemini-pro-high-result');
        });

        it('should transform Pro LOW thinking into concise reasoning trace', async () => {
            const fixture = loadFixture('gemini-3-pro-preview-thinking-low.json');

            const mockClient = {
                models: {
                    generateContentStream: vi.fn(async () => createMockStream(fixture.chunks)),
                },
            };

            const settings: ProviderSettings = {
                provider: 'gemini',
                apiKey: 'test-key',
                model: 'gemini-3-pro-preview',
                maxOutputTokens: 64000,
                reasoningMode: 'low',
            };

            const client = new GeminiClient(settings);
            // @ts-ignore
            client['client'] = mockClient;

            const result = await client.generateHtml(
                [{ role: 'user', content: 'Write a hello world function' }]
            );

            expect({
                reasoningSummariesCount: result.reasoning?.summaries?.length,
                reasoningRawLength: (result.reasoning?.raw as string[] | undefined)?.length,
                usage: result.usage,
            }).toMatchSnapshot('gemini-pro-low-result');
        });

        it('should compare thinking verbosity between HIGH and LOW', async () => {
            const highFixture = loadFixture('gemini-3-pro-preview-thinking-high.json');
            const lowFixture = loadFixture('gemini-3-pro-preview-thinking-low.json');

            const mockClientHigh = {
                models: {
                    generateContentStream: vi.fn(async () => createMockStream(highFixture.chunks)),
                },
            };

            const mockClientLow = {
                models: {
                    generateContentStream: vi.fn(async () => createMockStream(lowFixture.chunks)),
                },
            };

            const settingsHigh: ProviderSettings = {
                provider: 'gemini',
                apiKey: 'test-key',
                model: 'gemini-3-pro-preview',
                maxOutputTokens: 64000,
                reasoningMode: 'high',
            };

            const settingsLow: ProviderSettings = {
                ...settingsHigh,
                reasoningMode: 'low',
            };

            const clientHigh = new GeminiClient(settingsHigh);
            const clientLow = new GeminiClient(settingsLow);

            // @ts-ignore
            clientHigh['client'] = mockClientHigh;
            // @ts-ignore
            clientLow['client'] = mockClientLow;

            const resultHigh = await clientHigh.generateHtml(
                [{ role: 'user', content: 'Write a hello world function' }]
            );

            const resultLow = await clientLow.generateHtml(
                [{ role: 'user', content: 'Write a hello world function' }]
            );

            const comparison = {
                high: {
                    detailsCount: (resultHigh.reasoning?.details as string[] | undefined)?.length,
                    rawLength: (resultHigh.reasoning?.raw as string[] | undefined)?.length,
                    thoughtTokens: resultHigh.usage?.reasoningTokens,
                },
                low: {
                    detailsCount: (resultLow.reasoning?.details as string[] | undefined)?.length,
                    rawLength: (resultLow.reasoning?.raw as string[] | undefined)?.length,
                    thoughtTokens: resultLow.usage?.reasoningTokens,
                },
                difference: {
                    details: ((resultHigh.reasoning?.details as string[] | undefined)?.length || 0) - ((resultLow.reasoning?.details as string[] | undefined)?.length || 0),
                    rawChars: ((resultHigh.reasoning?.raw as string[] | undefined)?.length || 0) - ((resultLow.reasoning?.raw as string[] | undefined)?.length || 0),
                    tokens: (resultHigh.usage?.reasoningTokens || 0) - (resultLow.usage?.reasoningTokens || 0),
                },
            };

            expect(comparison).toMatchSnapshot('gemini-pro-verbosity-comparison');
        });
    });

    describe('Usage Metadata Transformation', () => {
        it('should correctly extract and transform usage metadata', async () => {
            const fixture = loadFixture('gemini-2.5-flash-thinking.json');

            const mockClient = {
                models: {
                    generateContentStream: vi.fn(async () => createMockStream(fixture.chunks)),
                },
            };

            const client = new GeminiClient({ provider: 'gemini', apiKey: 'test', model: 'gemini-2.5-flash', reasoningMode: 'default' } as ProviderSettings);
            // @ts-ignore
            client['client'] = mockClient;

            const result = await client.generateHtml(
                [{ role: 'user', content: 'test' }]
            );

            // Snapshot the transformed usage object
            expect(result.usage).toMatchSnapshot('transformed-usage-metadata');

            // Verify our transformation logic
            expect(result.usage?.inputTokens).toBe(15);
            expect(result.usage?.outputTokens).toBe(514);
            expect(result.usage?.reasoningTokens).toBe(979);
            expect(result.usage?.totalTokens).toBe(1508);
        });
    });

    describe('Reasoning Trace Structure', () => {
        it('should create properly structured reasoning trace for history', async () => {
            const fixture = loadFixture('gemini-2.5-flash-thinking.json');

            const mockClient = {
                models: {
                    generateContentStream: vi.fn(async () => createMockStream(fixture.chunks)),
                },
            };

            const client = new GeminiClient({ provider: 'gemini', apiKey: 'test', model: 'gemini-2.5-flash', reasoningMode: 'default' } as ProviderSettings);
            // @ts-ignore
            client['client'] = mockClient;

            const result = await client.generateHtml(
                [{ role: 'user', content: 'test' }]
            );

            // Snapshot the reasoning trace structure that gets saved to history
            expect(result.reasoning).toMatchSnapshot('reasoning-trace-structure');

            // Verify structure
            expect(result.reasoning).toHaveProperty('details');
            expect(result.reasoning).toHaveProperty('raw');
            expect(Array.isArray(result.reasoning?.details)).toBe(true);
            expect(Array.isArray(result.reasoning?.raw)).toBe(true);
        });
    });

    describe('Stream Observer Events', () => {
        it('should emit correctly formatted events during streaming', async () => {
            const fixture = loadFixture('gemini-2.5-flash-thinking.json');

            const mockClient = {
                models: {
                    generateContentStream: vi.fn(async () => createMockStream(fixture.chunks)),
                },
            };

            const client = new GeminiClient({ provider: 'gemini', apiKey: 'test', model: 'gemini-2.5-flash', reasoningMode: 'default' } as ProviderSettings);
            // @ts-ignore
            client['client'] = mockClient;

            const events: LlmReasoningStreamEvent[] = [];
            const observer: LlmStreamObserver = {
                onReasoningEvent: (event) => events.push(event),
            };

            await client.generateHtml(
                [{ role: 'user', content: 'test' }],
                { streamObserver: observer }
            );

            // Snapshot what the UI actually receives
            expect(events).toMatchSnapshot('stream-observer-events');

            // Verify event format
            expect(events.length).toBeGreaterThan(0);
            expect(events.every(e => e.kind === 'thinking')).toBe(true);
            expect(events.every(e => typeof e.text === 'string')).toBe(true);
            expect(events.every(e => e.text.length > 0)).toBe(true);
        });

        it('should show progressive accumulation of thinking text', async () => {
            const fixture = loadFixture('gemini-2.5-flash-thinking.json');

            const mockClient = {
                models: {
                    generateContentStream: vi.fn(async () => createMockStream(fixture.chunks)),
                },
            };

            const client = new GeminiClient({ provider: 'gemini', apiKey: 'test', model: 'gemini-2.5-flash', reasoningMode: 'default' } as ProviderSettings);
            // @ts-ignore
            client['client'] = mockClient;

            const progression: Array<{ eventIndex: number; textLength: number; textPreview: string }> = [];
            let accumulated = '';

            const observer: LlmStreamObserver = {
                onReasoningEvent: (event) => {
                    accumulated += event.text;
                    progression.push({
                        eventIndex: progression.length,
                        textLength: accumulated.length,
                        textPreview: accumulated.slice(-50), // Last 50 chars
                    });
                },
            };

            await client.generateHtml(
                [{ role: 'user', content: 'test' }],
                { streamObserver: observer }
            );

            // Snapshot shows how text builds up over time
            expect(progression).toMatchSnapshot('thinking-text-progression');
        });
    });
});
