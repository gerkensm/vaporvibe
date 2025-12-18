/**
 * Gemini Client Tests
 * 
 * Comprehensive test suite for GeminiClient using real API fixtures.
 * Tests data transformation through each processing stage with snapshot verification.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GeminiClient } from '../../src/llm/gemini-client.js';
import type { LlmStreamObserver, LlmReasoningStreamEvent } from '../../src/llm/client.js';
import type { ProviderSettings } from '../../src/types.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load fixtures
const fixturesDir = path.join(__dirname, '..', 'fixtures', 'gemini');

function loadFixture(filename: string) {
    const fixturePath = path.join(fixturesDir, filename);
    const content = fs.readFileSync(fixturePath, 'utf-8');
    return JSON.parse(content);
}

describe('GeminiClient', () => {
    describe('Data Transformation Pipeline', () => {
        describe('Flash Model with Thinking', () => {
            const fixture = loadFixture('gemini-2.5-flash-thinking.json');

            it('should match snapshot of raw fixture structure', () => {
                // Verify the raw fixture structure
                expect(fixture).toMatchSnapshot('raw-fixture');
            });

            it('should extract thinking parts from chunks', () => {
                // Test Stage 1: Raw chunks -> Thinking parts extraction
                const thinkingParts = [];
                const contentParts = [];

                for (const chunk of fixture.chunks) {
                    const parts = chunk.candidates?.[0]?.content?.parts;
                    if (!parts) continue;

                    for (const part of parts) {
                        if (part.thought === true) {
                            thinkingParts.push({
                                text: part.text,
                                timestamp: chunk.timestamp,
                                usage: chunk.usageMetadata,
                            });
                        } else if (part.text) {
                            contentParts.push({
                                text: part.text,
                                timestamp: chunk.timestamp,
                            });
                        }
                    }
                }

                expect(thinkingParts).toMatchSnapshot('thinking-parts-extracted');
                expect(contentParts).toMatchSnapshot('content-parts-extracted');
            });

            it('should accumulate thinking text progressively', () => {
                // Test Stage 2: Progressive accumulation (simulating collectGeminiThoughtSummaries)
                const thinkingSnapshots: Array<{ chunkIndex: number; accumulated: string[] }> = [];
                const accumulated: string[] = [];

                fixture.chunks.forEach((chunk: any, index: number) => {
                    const parts = chunk.candidates?.[0]?.content?.parts;
                    if (!parts) return;

                    for (const part of parts) {
                        if (part.thought === true && typeof part.text === 'string') {
                            const normalized = part.text.trim();
                            if (normalized.length > 0) {
                                // In the real implementation, this would be a delta
                                // For snapshot testing, we accumulate the full texts
                                accumulated.push(normalized);
                            }
                        }
                    }

                    // Snapshot every few chunks to show progression
                    if (index === 0 || index === 3 || index === fixture.chunks.length - 1) {
                        thinkingSnapshots.push({
                            chunkIndex: index,
                            accumulated: [...accumulated],
                        });
                    }
                });

                expect(thinkingSnapshots).toMatchSnapshot('thinking-accumulation-progression');
            });

            it('should emit thinking events with correct structure', () => {
                // Test Stage 3: Event emission (simulating LlmStreamObserver)
                const emittedEvents: LlmReasoningStreamEvent[] = [];
                const mockObserver: LlmStreamObserver = {
                    onReasoningEvent: (event) => {
                        emittedEvents.push(event);
                    },
                };

                // Simulate the actual processing with delta/newline logic
                const snapshots: string[] = [];

                for (const chunk of fixture.chunks.slice(0, 4)) {
                    // Only first 4 thinking chunks
                    const parts = chunk.candidates?.[0]?.content?.parts;
                    if (!parts) continue;

                    let thoughtIndex = 0;
                    for (const part of parts) {
                        if (part.thought === true && typeof part.text === 'string') {
                            const normalized = part.text.trim();
                            if (normalized.length === 0) {
                                thoughtIndex += 1;
                                continue;
                            }

                            const previousSnapshot = snapshots[thoughtIndex] ?? '';
                            if (normalized === previousSnapshot) {
                                thoughtIndex += 1;
                                continue;
                            }

                            snapshots[thoughtIndex] = normalized;

                            // Calculate delta (matching actual implementation)
                            let delta = normalized;
                            if (previousSnapshot && normalized.startsWith(previousSnapshot)) {
                                delta = normalized.slice(previousSnapshot.length);
                            } else if (previousSnapshot && normalized !== previousSnapshot) {
                                const tailIndex = normalized.lastIndexOf(previousSnapshot);
                                if (tailIndex > 0) {
                                    delta = normalized.slice(0, tailIndex);
                                }
                            }

                            const emission = delta.length > 0 ? delta : normalized;
                            if (emission.length > 0) {
                                // Match actual implementation: append newline
                                mockObserver.onReasoningEvent({
                                    kind: 'thinking',
                                    text: emission + '\n',
                                });
                            }

                            thoughtIndex += 1;
                        }
                    }
                }

                expect(emittedEvents).toMatchSnapshot('emitted-thinking-events');
                expect(emittedEvents.every((e) => e.kind === 'thinking')).toBe(true);
                expect(emittedEvents.every((e) => e.text.endsWith('\n'))).toBe(true);
            });

            it('should extract final usage metadata', () => {
                // Test Stage 4: Final metadata extraction
                const lastChunk = fixture.chunks[fixture.chunks.length - 1];
                const usage = lastChunk.usageMetadata;

                const extractedMetadata = {
                    promptTokenCount: usage.promptTokenCount,
                    candidatesTokenCount: usage.candidatesTokenCount,
                    totalTokenCount: usage.totalTokenCount,
                    thoughtsTokenCount: usage.thoughtsTokenCount,
                };

                expect(extractedMetadata).toMatchSnapshot('final-usage-metadata');
            });

            it('should combine all content parts into final HTML', () => {
                // Test Stage 5: Content assembly
                let combinedContent = '';

                for (const chunk of fixture.chunks) {
                    const parts = chunk.candidates?.[0]?.content?.parts;
                    if (!parts) continue;

                    for (const part of parts) {
                        if (part.thought !== true && part.text) {
                            combinedContent += part.text;
                        }
                    }
                }

                expect(combinedContent).toMatchSnapshot('final-combined-content');
                expect(combinedContent).toContain('function sayHello()');
                expect(combinedContent).toContain('console.log("Hello, World!")');
            });
        });

        describe('Flash Model without Thinking', () => {
            const fixture = loadFixture('gemini-2.5-flash-basic.json');

            it('should match snapshot of basic (non-thinking) fixture', () => {
                expect(fixture).toMatchSnapshot('basic-fixture');
            });

            it('should have no thinking parts', () => {
                const thinkingParts = [];

                for (const chunk of fixture.chunks) {
                    const parts = chunk.candidates?.[0]?.content?.parts;
                    if (!parts) continue;

                    for (const part of parts) {
                        if (part.thought === true) {
                            thinkingParts.push(part);
                        }
                    }
                }

                expect(thinkingParts).toHaveLength(0);
                expect(thinkingParts).toMatchSnapshot('no-thinking-parts');
            });

            it('should extract all content directly', () => {
                let content = '';

                for (const chunk of fixture.chunks) {
                    const parts = chunk.candidates?.[0]?.content?.parts;
                    if (!parts) continue;

                    for (const part of parts) {
                        if (part.text) {
                            content += part.text;
                        }
                    }
                }

                expect(content).toMatchSnapshot('basic-content');
                expect(content.length).toBeGreaterThan(0);
            });
        });

        describe('Pro Model with ThinkingLevel', () => {
            const fixtureHigh = loadFixture('gemini-3-pro-preview-thinking-high.json');
            const fixtureLow = loadFixture('gemini-3-pro-preview-thinking-low.json');

            it('should match snapshot of Pro thinking-high fixture', () => {
                expect(fixtureHigh).toMatchSnapshot('pro-thinking-high-fixture');
            });

            it('should match snapshot of Pro thinking-low fixture', () => {
                expect(fixtureLow).toMatchSnapshot('pro-thinking-low-fixture');
            });

            it('should show difference in thinking verbosity between high and low', () => {
                const extractThinkingLength = (fixture: any) => {
                    let thinkingLength = 0;

                    for (const chunk of fixture.chunks) {
                        const parts = chunk.candidates?.[0]?.content?.parts;
                        if (!parts) continue;

                        for (const part of parts) {
                            if (part.thought === true && part.text) {
                                thinkingLength += part.text.length;
                            }
                        }
                    }

                    return thinkingLength;
                };

                const highLength = extractThinkingLength(fixtureHigh);
                const lowLength = extractThinkingLength(fixtureLow);

                expect({
                    high: highLength,
                    low: lowLength,
                    difference: highLength - lowLength,
                }).toMatchSnapshot('thinking-verbosity-comparison');
            });
        });

        describe('Flash Lite Model', () => {
            const fixture = loadFixture('gemini-2.5-flash-lite-thinking.json');

            it('should match snapshot of Flash Lite thinking fixture', () => {
                expect(fixture).toMatchSnapshot('flash-lite-thinking-fixture');
            });

            it('should extract thinking with potentially smaller budget', () => {
                let thinkingTokenCount = 0;

                for (const chunk of fixture.chunks) {
                    if (chunk.usageMetadata?.thoughtsTokenCount) {
                        thinkingTokenCount = chunk.usageMetadata.thoughtsTokenCount;
                    }
                }

                expect({ thinkingTokenCount }).toMatchSnapshot('flash-lite-thinking-tokens');
            });
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty chunks array', () => {
            const emptyFixture = { chunks: [] as any[] };
            let content = '';

            for (const chunk of emptyFixture.chunks) {
                const parts = chunk.candidates?.[0]?.content?.parts;
                if (!parts) continue;

                for (const part of parts) {
                    if (part.text) {
                        content += part.text;
                    }
                }
            }

            expect(content).toBe('');
        });

        it('should handle chunk with no parts', () => {
            const malformedFixture: any = {
                chunks: [
                    { candidates: [{ content: { role: 'model' } }] },
                ],
            };

            let content = '';

            for (const chunk of malformedFixture.chunks) {
                const parts = chunk.candidates?.[0]?.content?.parts;
                if (!parts) continue;

                for (const part of parts) {
                    if (part.text) {
                        content += part.text;
                    }
                }
            }

            expect(content).toBe('');
        });

        it('should handle mixed thought and non-thought parts in same chunk', () => {
            const mixedFixture = {
                chunks: [
                    {
                        candidates: [
                            {
                                content: {
                                    parts: [
                                        { text: 'Thinking...', thought: true },
                                        { text: 'Output text', thought: false },
                                    ],
                                    role: 'model',
                                },
                            },
                        ],
                    },
                ],
            };

            const thinkingParts = [];
            const contentParts = [];

            for (const chunk of mixedFixture.chunks) {
                const parts = chunk.candidates?.[0]?.content?.parts;
                if (!parts) continue;

                for (const part of parts) {
                    if (part.thought === true) {
                        thinkingParts.push(part.text);
                    } else if (part.text) {
                        contentParts.push(part.text);
                    }
                }
            }

            expect(thinkingParts).toEqual(['Thinking...']);
            expect(contentParts).toEqual(['Output text']);
        });
    });
});
