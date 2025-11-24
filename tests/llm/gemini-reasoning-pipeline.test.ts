/**
 * Gemini Reasoning Pipeline Tests (End-to-End)
 * 
 * Parametrized tests that trace data through the entire reasoning stack:
 * Raw API → GeminiClient → LlmStreamObserver → SSE Events → Frontend Display
 * 
 * Tests all fixture files automatically to ensure complete coverage.
 */

import { describe, it, expect, vi } from 'vitest';
import { GeminiClient } from '../../src/llm/gemini-client.js';
import type { LlmStreamObserver, LlmReasoningStreamEvent } from '../../src/llm/client.js';
import type { ProviderSettings } from '../../src/types.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, '..', 'fixtures', 'gemini');

// Discover all fixture files
const fixtureFiles = fs.readdirSync(fixturesDir)
    .filter(f => f.endsWith('.json'))
    .map(f => ({
        filename: f,
        path: path.join(fixturesDir, f),
        name: f.replace('.json', ''),
    }));

interface FixtureMetadata {
    filename: string;
    path: string;
    name: string;
}

function loadFixture(fixturePath: string) {
    return JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
}

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

describe('Gemini Reasoning Pipeline', () => {
    // Explicit assertion tests (easy to read, no snapshots)
    describe('Explicit Assertion Tests', () => {
        it('should separate thinking from HTML output', async () => {
            const fixture = fixtureFiles.find(f => f.name === 'gemini-2.5-flash-thinking');
            if (!fixture) throw new Error('Missing flash-thinking fixture');

            const data = loadFixture(fixture.path);
            const mockClient = {
                models: {
                    generateContentStream: vi.fn(async () => createMockStream(data.chunks)),
                },
            };

            const client = new GeminiClient({
                provider: 'gemini',
                apiKey: 'test',
                model: 'gemini-2.5-flash',
                maxOutputTokens: 8192,
                reasoningMode: 'none',
                reasoningTokens: 2000,
                reasoningTokensEnabled: true,
            });
            // @ts-ignore
            client['client'] = mockClient;

            const result = await client.generateHtml([{ role: 'user', content: 'test' }]);

            // HTML should NOT contain thinking markers
            expect(result.html).not.toContain('**Analyzing');
            expect(result.html).not.toContain('**Developing');
            expect(result.html).not.toContain('**Constructing');

            // HTML SHOULD contain actual code output
            expect(result.html).toContain('function');
            expect(result.html).toContain('sayHello');

            // Reasoning trace SHOULD contain thinking
            expect(result.reasoning).toBeDefined();
            expect(result.reasoning?.details).toBeInstanceOf(Array);
            expect(result.reasoning?.details?.length).toBeGreaterThan(0);

            // First detail should be thinking, not code
            const firstDetail = result.reasoning?.details?.[0];
            expect(firstDetail).toContain('Comprehending');
            expect(firstDetail).not.toContain('function sayHello');
        });

        it('should emit stream events with correct format', async () => {
            const fixture = fixtureFiles.find(f => f.name === 'gemini-2.5-flash-thinking');
            if (!fixture) throw new Error('Missing flash-thinking fixture');

            const data = loadFixture(fixture.path);
            const mockClient = {
                models: {
                    generateContentStream: vi.fn(async () => createMockStream(data.chunks)),
                },
            };

            const client = new GeminiClient({
                provider: 'gemini',
                apiKey: 'test',
                model: 'gemini-2.5-flash',
                maxOutputTokens: 8192,
                reasoningMode: 'none',
                reasoningTokens: 2000,
                reasoningTokensEnabled: true,
            });
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

            // Should emit events
            expect(events.length).toBeGreaterThan(0);

            // All events should be 'thinking'
            events.forEach(event => {
                expect(event.kind).toBe('thinking');
                expect(typeof event.text).toBe('string');
                expect(event.text.length).toBeGreaterThan(0);
                expect(event.text.endsWith('\n')).toBe(true);
            });

            // Events should NOT contain the final code output
            const allEventText = events.map(e => e.text).join('');
            expect(allEventText).not.toContain('function sayHello()');

            // Events SHOULD contain thinking process
            expect(allEventText).toContain('Comprehending');
        });

        it('should correctly propagate usage metadata for thinking models', async () => {
            const fixture = fixtureFiles.find(f => f.name === 'gemini-2.5-flash-thinking');
            if (!fixture) throw new Error('Missing flash-thinking fixture');

            const data = loadFixture(fixture.path);
            const mockClient = {
                models: {
                    generateContentStream: vi.fn(async () => createMockStream(data.chunks)),
                },
            };

            const client = new GeminiClient({
                provider: 'gemini',
                apiKey: 'test',
                model: 'gemini-2.5-flash',
                maxOutputTokens: 8192,
                reasoningMode: 'none',
                reasoningTokens: 2000,
                reasoningTokensEnabled: true,
            });
            // @ts-ignore
            client['client'] = mockClient;

            const result = await client.generateHtml([{ role: 'user', content: 'test' }]);

            // Usage should exist
            expect(result.usage).toBeDefined();

            // Should have all token counts
            // Should have all token counts
            expect(result.usage?.inputTokens).toBe(15);
            expect(result.usage?.outputTokens).toBe(514);
            expect(result.usage?.totalTokens).toBe(1508);

            // Should have reasoning tokens for thinking model
            expect(result.usage?.reasoningTokens).toBe(979);
            expect(result.usage?.reasoningTokens).toBeGreaterThan(0);
        });

        it('should handle basic (non-thinking) models correctly', async () => {
            const fixture = fixtureFiles.find(f => f.name === 'gemini-2.5-flash-basic');
            if (!fixture) throw new Error('Missing flash-basic fixture');

            const data = loadFixture(fixture.path);
            const mockClient = {
                models: {
                    generateContentStream: vi.fn(async () => createMockStream(data.chunks)),
                },
            };

            const client = new GeminiClient({
                provider: 'gemini',
                apiKey: 'test',
                model: 'gemini-2.5-flash',
                maxOutputTokens: 8192,
                reasoningMode: 'none',
            });
            // @ts-ignore
            client['client'] = mockClient;

            const events: LlmReasoningStreamEvent[] = [];
            const observer: LlmStreamObserver = {
                onReasoningEvent: (event) => events.push(event),
            };

            const result = await client.generateHtml(
                [{ role: 'user', content: 'test' }],
                { streamObserver: observer }
            );

            // Should have HTML output
            expect(result.html).toBeDefined();
            expect(result.html.length).toBeGreaterThan(0);

            // NOTE: Gemini can generate thinking even without explicit config
            // If there are thinking tokens, there should be a reasoning trace
            if (result.usage?.reasoningTokens && result.usage.reasoningTokens > 0) {
                expect(result.reasoning).toBeDefined();
                // But it won't be streamed (no observer events) since we didn't enable thinking
                expect(events).toHaveLength(0);
            } else {
                // If no thinking tokens, no reasoning trace
                expect(result.reasoning).toBeUndefined();
                expect(events).toHaveLength(0);
            }
        });

        it('should show different verbosity between Pro HIGH and LOW', async () => {
            const highFixture = fixtureFiles.find(f => f.name === 'gemini-3-pro-preview-thinking-high');
            const lowFixture = fixtureFiles.find(f => f.name === 'gemini-3-pro-preview-thinking-low');

            if (!highFixture || !lowFixture) {
                throw new Error('Missing Pro thinking fixtures');
            }

            const highData = loadFixture(highFixture.path);
            const lowData = loadFixture(lowFixture.path);

            const mockHigh = {
                models: {
                    generateContentStream: vi.fn(async () => createMockStream(highData.chunks)),
                },
            };

            const mockLow = {
                models: {
                    generateContentStream: vi.fn(async () => createMockStream(lowData.chunks)),
                },
            };

            const clientHigh = new GeminiClient({
                provider: 'gemini',
                apiKey: 'test',
                model: 'gemini-3-pro-preview',
                maxOutputTokens: 64000,
                reasoningMode: 'high',
            });

            const clientLow = new GeminiClient({
                provider: 'gemini',
                apiKey: 'test',
                model: 'gemini-3-pro-preview',
                maxOutputTokens: 64000,
                reasoningMode: 'low',
            });

            // @ts-ignore
            clientHigh['client'] = mockHigh;
            // @ts-ignore
            clientLow['client'] = mockLow;

            const resultHigh = await clientHigh.generateHtml([{ role: 'user', content: 'test' }]);
            const resultLow = await clientLow.generateHtml([{ role: 'user', content: 'test' }]);

            // Both should have reasoning
            expect(resultHigh.reasoning).toBeDefined();
            expect(resultLow.reasoning).toBeDefined();

            // HIGH should have MORE reasoning than LOW
            const highDetailsCount = (resultHigh.reasoning?.details as string[] | undefined)?.length || 0;
            const lowDetailsCount = (resultLow.reasoning?.details as string[] | undefined)?.length || 0;

            expect(highDetailsCount).toBeGreaterThanOrEqual(lowDetailsCount);

            // HIGH should use MORE reasoning tokens
            const highTokens = resultHigh.usage?.reasoningTokens || 0;
            const lowTokens = resultLow.usage?.reasoningTokens || 0;

            expect(highTokens).toBeGreaterThan(lowTokens);
        });

        it('should format SSE events correctly for frontend consumption', async () => {
            const fixture = fixtureFiles.find(f => f.name === 'gemini-2.5-flash-thinking');
            if (!fixture) throw new Error('Missing flash-thinking fixture');

            const data = loadFixture(fixture.path);
            const mockClient = {
                models: {
                    generateContentStream: vi.fn(async () => createMockStream(data.chunks)),
                },
            };

            const client = new GeminiClient({
                provider: 'gemini',
                apiKey: 'test',
                model: 'gemini-2.5-flash',
                maxOutputTokens: 8192,
                reasoningMode: 'none',
                reasoningTokens: 2000,
                reasoningTokensEnabled: true,
            });
            // @ts-ignore
            client['client'] = mockClient;

            const sseMessages: string[] = [];
            const observer: LlmStreamObserver = {
                onReasoningEvent: (event) => {
                    // Simulate what server sends
                    const payload = JSON.stringify({ kind: event.kind, text: event.text });
                    const sseMessage = `event: reasoning\ndata: ${payload}\n\n`;
                    sseMessages.push(sseMessage);
                },
            };

            await client.generateHtml(
                [{ role: 'user', content: 'test' }],
                { streamObserver: observer }
            );

            // Should have SSE messages
            expect(sseMessages.length).toBeGreaterThan(0);

            // Verify SSE format
            sseMessages.forEach(msg => {
                // Must start with event line
                expect(msg.startsWith('event: reasoning\n')).toBe(true);

                // Must have data line
                expect(msg).toContain('data: ');

                // Must end with double newline
                expect(msg.endsWith('\n\n')).toBe(true);

                // Data must be valid JSON
                const dataLine = msg.split('\n').find(line => line.startsWith('data: '));
                expect(dataLine).toBeDefined();

                const jsonStr = dataLine!.substring(6); // Remove 'data: '
                const parsed = JSON.parse(jsonStr);

                // Must have correct structure
                expect(parsed).toHaveProperty('kind');
                expect(parsed).toHaveProperty('text');
                expect(parsed.kind).toBe('thinking');
                expect(typeof parsed.text).toBe('string');
            });
        });
    });

    describe.each(fixtureFiles)('Fixture: $name', (fixture: FixtureMetadata) => {
        it('Stage 1: Raw API Response Structure', () => {
            const data = loadFixture(fixture.path);

            const structure = {
                chunkCount: data.chunks.length,
                hasThinking: data.chunks.some((c: any) =>
                    c.candidates?.[0]?.content?.parts?.some((p: any) => p.thought === true)
                ),
                hasContent: data.chunks.some((c: any) =>
                    c.candidates?.[0]?.content?.parts?.some((p: any) => p.thought !== true && p.text)
                ),
                finalUsage: data.chunks[data.chunks.length - 1]?.usageMetadata,
            };

            expect(structure).toMatchSnapshot('raw-api-structure');
        });

        it('Stage 2: GeminiClient Content Extraction', async () => {
            const data = loadFixture(fixture.path);

            const mockClient = {
                models: {
                    generateContentStream: vi.fn(async () => createMockStream(data.chunks)),
                },
            };

            const settings: ProviderSettings = {
                provider: 'gemini',
                apiKey: 'test',
                model: fixture.name.includes('pro') ? 'gemini-3-pro-preview' : 'gemini-2.5-flash',
                maxOutputTokens: 8192,
                reasoningMode: 'none',
            };

            const client = new GeminiClient(settings);
            // @ts-ignore
            client['client'] = mockClient;

            const result = await client.generateHtml([{ role: 'user', content: 'test' }]);

            const contentExtraction = {
                htmlLength: result.html.length,
                htmlPreview: result.html.substring(0, 200),
                containsThinking: result.html.includes('**'),
                containsCodeBlock: result.html.includes('```'),
            };

            expect(contentExtraction).toMatchSnapshot('content-extraction');
        });

        it('Stage 3: GeminiClient Reasoning Trace', async () => {
            const data = loadFixture(fixture.path);

            const mockClient = {
                models: {
                    generateContentStream: vi.fn(async () => createMockStream(data.chunks)),
                },
            };

            const settings: ProviderSettings = {
                provider: 'gemini',
                apiKey: 'test',
                model: fixture.name.includes('pro') ? 'gemini-3-pro-preview' : 'gemini-2.5-flash',
                maxOutputTokens: 8192,
                reasoningMode: fixture.name.includes('high') ? 'high' : fixture.name.includes('low') ? 'low' : 'none',
                reasoningTokens: fixture.name.includes('thinking') && !fixture.name.includes('pro') ? 2000 : undefined,
                reasoningTokensEnabled: fixture.name.includes('thinking') && !fixture.name.includes('pro'),
            };

            const client = new GeminiClient(settings);
            // @ts-ignore
            client['client'] = mockClient;

            const result = await client.generateHtml([{ role: 'user', content: 'test' }]);

            const reasoningTrace = {
                hasReasoning: !!result.reasoning,
                detailsCount: Array.isArray(result.reasoning?.details) ? result.reasoning.details.length : 0,
                rawType: Array.isArray(result.reasoning?.raw) ? 'array' : typeof result.reasoning?.raw,
                rawLength: Array.isArray(result.reasoning?.raw)
                    ? result.reasoning.raw.length
                    : typeof result.reasoning?.raw === 'string'
                        ? result.reasoning.raw.length
                        : 0,
                firstDetailPreview: Array.isArray(result.reasoning?.details) && result.reasoning.details[0]
                    ? result.reasoning.details[0].substring(0, 100)
                    : null,
            };

            expect(reasoningTrace).toMatchSnapshot('reasoning-trace');
        });

        it('Stage 4: Stream Observer Events', async () => {
            const data = loadFixture(fixture.path);

            const mockClient = {
                models: {
                    generateContentStream: vi.fn(async () => createMockStream(data.chunks)),
                },
            };

            const settings: ProviderSettings = {
                provider: 'gemini',
                apiKey: 'test',
                model: fixture.name.includes('pro') ? 'gemini-3-pro-preview' : 'gemini-2.5-flash',
                maxOutputTokens: 8192,
                reasoningMode: fixture.name.includes('high') ? 'high' : fixture.name.includes('low') ? 'low' : 'none',
                reasoningTokens: fixture.name.includes('thinking') && !fixture.name.includes('pro') ? 2000 : undefined,
                reasoningTokensEnabled: fixture.name.includes('thinking') && !fixture.name.includes('pro'),
            };

            const client = new GeminiClient(settings);
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

            const eventsSummary = {
                eventCount: events.length,
                allKindThinking: events.every(e => e.kind === 'thinking'),
                allEndWithNewline: events.every(e => e.text.endsWith('\n')),
                totalChars: events.reduce((sum, e) => sum + e.text.length, 0),
                firstEventPreview: events[0] ? events[0].text.substring(0, 100) : null,
            };

            expect(eventsSummary).toMatchSnapshot('stream-observer-events');
        });

        it('Stage 5: SSE Event Format (Server-Sent Events)', async () => {
            const data = loadFixture(fixture.path);

            const mockClient = {
                models: {
                    generateContentStream: vi.fn(async () => createMockStream(data.chunks)),
                },
            };

            const settings: ProviderSettings = {
                provider: 'gemini',
                apiKey: 'test',
                model: fixture.name.includes('pro') ? 'gemini-3-pro-preview' : 'gemini-2.5-flash',
                maxOutputTokens: 8192,
                reasoningMode: fixture.name.includes('high') ? 'high' : fixture.name.includes('low') ? 'low' : 'none',
                reasoningTokens: fixture.name.includes('thinking') && !fixture.name.includes('pro') ? 2000 : undefined,
                reasoningTokensEnabled: fixture.name.includes('thinking') && !fixture.name.includes('pro'),
            };

            const client = new GeminiClient(settings);
            // @ts-ignore
            client['client'] = mockClient;

            const sseMessages: string[] = [];
            const observer: LlmStreamObserver = {
                onReasoningEvent: (event) => {
                    // Simulate what the server sends via SSE
                    const ssePayload = JSON.stringify({ kind: event.kind, text: event.text });
                    sseMessages.push(`event: reasoning\ndata: ${ssePayload}\n\n`);
                },
            };

            await client.generateHtml(
                [{ role: 'user', content: 'test' }],
                { streamObserver: observer }
            );

            const sseFormat = {
                messageCount: sseMessages.length,
                firstMessagePreview: sseMessages[0] ? sseMessages[0].substring(0, 150) : null,
                allStartWithEvent: sseMessages.every(m => m.startsWith('event: reasoning\n')),
                allContainData: sseMessages.every(m => m.includes('data: ')),
            };

            expect(sseFormat).toMatchSnapshot('sse-event-format');
        });

        it('Stage 6: Frontend Display Logic (markdown rendering)', async () => {
            const data = loadFixture(fixture.path);

            const mockClient = {
                models: {
                    generateContentStream: vi.fn(async () => createMockStream(data.chunks)),
                },
            };

            const settings: ProviderSettings = {
                provider: 'gemini',
                apiKey: 'test',
                model: fixture.name.includes('pro') ? 'gemini-3-pro-preview' : 'gemini-2.5-flash',
                maxOutputTokens: 8192,
                reasoningMode: fixture.name.includes('high') ? 'high' : fixture.name.includes('low') ? 'low' : 'none',
                reasoningTokens: fixture.name.includes('thinking') && !fixture.name.includes('pro') ? 2000 : undefined,
                reasoningTokensEnabled: fixture.name.includes('thinking') && !fixture.name.includes('pro'),
            };

            const client = new GeminiClient(settings);
            // @ts-ignore
            client['client'] = mockClient;

            // Simulate frontend accumulation
            let accumulatedText = '';
            const observer: LlmStreamObserver = {
                onReasoningEvent: (event) => {
                    accumulatedText += event.text;
                },
            };

            const result = await client.generateHtml(
                [{ role: 'user', content: 'test' }],
                { streamObserver: observer }
            );

            // Simulate what frontend displays
            const displayState = {
                streamedTextLength: accumulatedText.length,
                streamedTextPreview: accumulatedText.substring(0, 200),
                finalTraceLength: Array.isArray(result.reasoning?.raw)
                    ? result.reasoning.raw.join('\n\n').length
                    : typeof result.reasoning?.raw === 'string'
                        ? result.reasoning.raw.length
                        : 0,
                hasMarkdownHeaders: accumulatedText.includes('**'),
                hasCodeBlocks: accumulatedText.includes('`'),
            };

            expect(displayState).toMatchSnapshot('frontend-display-state');
        });

        it('Stage 7: Usage Metadata Propagation', async () => {
            const data = loadFixture(fixture.path);

            const mockClient = {
                models: {
                    generateContentStream: vi.fn(async () => createMockStream(data.chunks)),
                },
            };

            const settings: ProviderSettings = {
                provider: 'gemini',
                apiKey: 'test',
                model: fixture.name.includes('pro') ? 'gemini-3-pro-preview' : 'gemini-2.5-flash',
                maxOutputTokens: 8192,
                reasoningMode: fixture.name.includes('high') ? 'high' : fixture.name.includes('low') ? 'low' : 'none',
                reasoningTokens: fixture.name.includes('thinking') && !fixture.name.includes('pro') ? 2000 : undefined,
                reasoningTokensEnabled: fixture.name.includes('thinking') && !fixture.name.includes('pro'),
            };

            const client = new GeminiClient(settings);
            // @ts-ignore
            client['client'] = mockClient;

            const result = await client.generateHtml([{ role: 'user', content: 'test' }]);

            // Track how usage metadata flows through
            const usageMetadata = {
                inputTokens: result.usage?.inputTokens,
                outputTokens: result.usage?.outputTokens,
                reasoningTokens: result.usage?.reasoningTokens,
                totalTokens: result.usage?.totalTokens,
                hasReasoningTokens: !!result.usage?.reasoningTokens && result.usage.reasoningTokens > 0,
            };

            expect(usageMetadata).toMatchSnapshot('usage-metadata');
        });
    });

    // Cross-fixture comparison tests
    describe('Cross-Fixture Comparisons', () => {
        const thinkingFixtures = fixtureFiles.filter(f => f.name.includes('thinking'));
        const basicFixtures = fixtureFiles.filter(f => f.name.includes('basic'));

        it('Thinking vs Basic: should show difference in reasoning output', async () => {
            if (thinkingFixtures.length === 0 || basicFixtures.length === 0) {
                return; // Skip if we don't have both types
            }

            const comparisons = [];

            for (const thinkingFixture of thinkingFixtures.slice(0, 2)) { // Test first 2
                const basicVariant = basicFixtures.find(b =>
                    b.name.replace('-thinking', '') === thinkingFixture.name.replace('-thinking-high', '').replace('-thinking-low', '')
                );

                if (!basicVariant) continue;

                const thinkingData = loadFixture(thinkingFixture.path);
                const basicData = loadFixture(basicVariant.path);

                const mockThinking = {
                    models: {
                        generateContentStream: vi.fn(async () => createMockStream(thinkingData.chunks)),
                    },
                };

                const mockBasic = {
                    models: {
                        generateContentStream: vi.fn(async () => createMockStream(basicData.chunks)),
                    },
                };

                const settings: ProviderSettings = {
                    provider: 'gemini',
                    apiKey: 'test',
                    model: 'gemini-2.5-flash',
                    maxOutputTokens: 8192,
                    reasoningMode: 'none',
                };

                const clientThinking = new GeminiClient({ ...settings, reasoningTokens: 2000, reasoningTokensEnabled: true });
                const clientBasic = new GeminiClient(settings);

                // @ts-ignore
                clientThinking['client'] = mockThinking;
                // @ts-ignore
                clientBasic['client'] = mockBasic;

                const resultThinking = await clientThinking.generateHtml([{ role: 'user', content: 'test' }]);
                const resultBasic = await clientBasic.generateHtml([{ role: 'user', content: 'test' }]);

                comparisons.push({
                    fixture: thinkingFixture.name,
                    thinking: {
                        hasReasoning: !!resultThinking.reasoning,
                        reasoningTokens: resultThinking.usage?.reasoningTokens || 0,
                    },
                    basic: {
                        hasReasoning: !!resultBasic.reasoning,
                        reasoningTokens: resultBasic.usage?.reasoningTokens || 0,
                    },
                });
            }

            expect(comparisons).toMatchSnapshot('thinking-vs-basic-comparison');
        });
    });
});
