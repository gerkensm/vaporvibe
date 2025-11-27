import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { LlmStreamObserver, LlmTokenUsageDelta } from '../../src/llm/client.js';
import type { ProviderSettings } from '../../src/types.js';
import { GeminiClient } from '../../src/llm/gemini-client.js';
import { AnthropicClient } from '../../src/llm/anthropic-client.js';
import { OpenAiClient } from '../../src/llm/openai-client.js';
import { GroqClient } from '../../src/llm/groq-client.js';
import { estimateTokenCount } from '../../src/llm/token-tracker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type TokenProgressCase = {
    name: string;
    provider: 'gemini' | 'anthropic' | 'openai' | 'groq';
    fixture: string;
    model: string;
    expectedOutputTokens: number;
};

const cases: TokenProgressCase[] = [
    {
        name: 'Gemini 2.5 Flash basic (65 tokens)',
        provider: 'gemini',
        fixture: 'gemini/gemini-2.5-flash-basic.json',
        model: 'gemini-2.5-flash',
        expectedOutputTokens: 65,
    },
    {
        name: 'Anthropic Claude 4 Sonnet thinking (787 tokens)',
        provider: 'anthropic',
        fixture: 'anthropic/claude-sonnet-4-thinking.json',
        model: 'claude-3-5-sonnet-latest',
        expectedOutputTokens: 787,
    },
    {
        name: 'OpenAI gpt-5 basic (574 tokens)',
        provider: 'openai',
        fixture: 'openai/gpt-5-basic.json',
        model: 'gpt-5',
        expectedOutputTokens: 574,
    },
    {
        name: 'Groq GPT-OSS 120B reasoning high (796 tokens)',
        provider: 'groq',
        fixture: 'groq/openai-gpt-oss-120b-reasoning-high.json',
        model: 'openai/gpt-oss-120b',
        expectedOutputTokens: 796,
    },
];

function loadFixture(fixture: string): any {
    const fixturePath = path.join(__dirname, '..', 'fixtures', fixture);
    return JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
}

function createObserver(bucket: LlmTokenUsageDelta[]): LlmStreamObserver {
    return {
        onReasoningEvent: vi.fn(),
        onTokenDelta: (delta) => bucket.push(delta),
    };
}

function createGeminiClient(settings: ProviderSettings, mockData: any): GeminiClient {
    const client = new GeminiClient(settings);
    const stream = async function* () {
        for (const chunk of mockData.chunks) {
            yield chunk;
        }
    };
    // @ts-ignore - override real client
    client['client'] = {
        models: {
            generateContentStream: vi.fn(async () => stream()),
            generateContent: vi.fn(async () => mockData.chunks[mockData.chunks.length - 1]),
        },
    };
    return client;
}

function createAnthropicClient(settings: ProviderSettings, mockData: any): AnthropicClient {
    const client = new AnthropicClient(settings);
    const stream = (async function* () {
        for (const event of mockData.events) {
            yield event;
        }
    })();
    // @ts-ignore - attach finalMessage
    stream.finalMessage = async () => {
        const text = mockData.events
            .filter((e: any) => e.type === 'content_block_delta' && e.delta?.type === 'text_delta')
            .map((e: any) => e.delta.text)
            .join('');
        const usageEvent = mockData.events.find((e: any) => e.type === 'message_stop' && e.usage);
        return {
            content: [{ type: 'text', text }],
            usage: usageEvent?.usage,
        };
    };
    // @ts-ignore
    client['client'] = {
        messages: {
            stream: vi.fn(() => stream),
            create: vi.fn(async () => stream.finalMessage?.()),
        },
    };
    return client;
}

function createOpenAiClient(settings: ProviderSettings, mockData: any): OpenAiClient {
    const client = new OpenAiClient(settings);
    const handlers: Record<string, Array<(payload: any) => void>> = {};
    const stream = {
        on(event: string, callback: (payload: any) => void) {
            (handlers[event] ??= []).push(callback);
            return stream;
        },
        off: () => stream,
        async finalResponse() {
            for (const chunk of mockData.chunks) {
                const delta = chunk?.choices?.[0]?.delta;
                const reasoning = (delta as any)?.reasoning;
                const content = (delta as any)?.content;
                if (reasoning && handlers['response.reasoning_text.delta']) {
                    handlers['response.reasoning_text.delta'].forEach((cb) => cb({ delta: reasoning }));
                }
                if (typeof content === 'string' && handlers['response.output_text.delta']) {
                    handlers['response.output_text.delta'].forEach((cb) => cb({ delta: content }));
                }
                if (Array.isArray(content)) {
                    const joined = content.map((part) => (typeof part === 'string' ? part : (part as any)?.text ?? '')).join('');
                    handlers['response.output_text.delta']?.forEach((cb) => cb({ delta: joined }));
                }
            }
            return mockData.chunks[mockData.chunks.length - 1];
        },
        [Symbol.asyncIterator]: async function* () {
            return;
        },
    } as any;
    // @ts-ignore
    client['client'] = {
        responses: {
            stream: vi.fn(() => stream),
        },
    };
    return client;
}

function createGroqClient(settings: ProviderSettings, mockData: any): GroqClient {
    const client = new GroqClient(settings);
    const stream = (async function* () {
        for (const chunk of mockData.chunks) {
            yield chunk;
        }
    })();
    // @ts-ignore
    stream.finalChatCompletion = async () => ({
        choices: [{ message: { content: '' } }],
        usage: mockData.chunks[mockData.chunks.length - 1].usage,
    });
    // @ts-ignore
    client['client'] = {
        chat: {
            completions: {
                stream: vi.fn(() => stream),
            },
        },
    };
    return client;
}

function createClient(testCase: TokenProgressCase, fixtureData: any) {
    const settings: ProviderSettings = {
        provider: testCase.provider as any,
        apiKey: 'test-key',
        model: testCase.model,
        maxOutputTokens: testCase.expectedOutputTokens,
        reasoningMode: 'none',
    };

    if (testCase.provider === 'anthropic') {
        settings.reasoningTokens = testCase.expectedOutputTokens;
        settings.reasoningTokensEnabled = true;
    }

    if (testCase.provider === 'gemini') return createGeminiClient(settings, fixtureData);
    if (testCase.provider === 'anthropic') return createAnthropicClient(settings, fixtureData);
    if (testCase.provider === 'openai') return createOpenAiClient(settings, fixtureData);
    return createGroqClient(settings, fixtureData);
}

function computeFixtureTokens(provider: TokenProgressCase['provider'], fixtureData: any) {
    let outputText = '';
    let reasoningText = '';

    if (provider === 'gemini') {
        for (const chunk of fixtureData.chunks) {
            const parts = chunk?.candidates?.[0]?.content?.parts ?? [];
            for (const part of parts) {
                if (typeof part?.text === 'string' && part.thought === true) {
                    reasoningText += part.text;
                } else if (typeof part?.text === 'string') {
                    outputText += part.text;
                }
            }
        }
    } else if (provider === 'anthropic') {
        for (const event of fixtureData.events) {
            if (event?.delta?.type === 'text_delta' && typeof event.delta.text === 'string') {
                outputText += event.delta.text;
            }
            if (event?.delta?.type === 'thinking_delta' && typeof event.delta.thinking === 'string') {
                reasoningText += event.delta.thinking;
            }
        }
    } else if (provider === 'openai' || provider === 'groq') {
        for (const chunk of fixtureData.chunks) {
            const delta = chunk?.choices?.[0]?.delta ?? {};
            if (typeof delta.reasoning === 'string') {
                reasoningText += delta.reasoning;
            }
            const content = delta.content;
            if (Array.isArray(content)) {
                for (const part of content) {
                    const text = typeof part === 'string' ? part : (part as any)?.text;
                    if (typeof text === 'string') {
                        outputText += text;
                    }
                }
            } else if (typeof content === 'string') {
                outputText += content;
            }
        }
    }

    return {
        outputTokens: estimateTokenCount(outputText),
        reasoningTokens: estimateTokenCount(reasoningText),
    };
}

function extractFixtureUsage(fixtureData: any) {
    const usageSource = fixtureData.events?.find((e: any) => e.usage)?.usage
        ?? fixtureData.chunks?.find((c: any) => c.usage)?.usage;

    if (!usageSource || typeof usageSource !== 'object') return {} as { outputTokens?: number; reasoningTokens?: number };

    return {
        outputTokens: usageSource.output_tokens ?? usageSource.completion_tokens,
        reasoningTokens:
            usageSource.thinking_tokens
            ?? usageSource.reasoning_tokens
            ?? usageSource.completion_tokens_details?.reasoning_tokens,
    } as { outputTokens?: number; reasoningTokens?: number };
}

describe('Streaming token progress (fixtures)', () => {
    describe.each(cases)('$name', (testCase) => {
        it('emits monotonic deltas and finishes at or past the expected total', async () => {
            const fixtureData = loadFixture(testCase.fixture);
            const client = createClient(testCase, fixtureData);
            const tokenDeltas: LlmTokenUsageDelta[] = [];
            const observer = createObserver(tokenDeltas);
            const fixtureTokens = computeFixtureTokens(testCase.provider, fixtureData);
            const fixtureUsage = extractFixtureUsage(fixtureData);

            await client.generateHtml(
                [{ role: 'user', content: 'test' }],
                { streamObserver: observer },
            );

            expect(tokenDeltas.length).toBeGreaterThan(0);
            const producedValues = tokenDeltas.map((d) => d.produced);
            expect(producedValues).toEqual([...producedValues].sort((a, b) => a - b));
            const expectedMax =
                testCase.provider === 'anthropic'
                    ? testCase.expectedOutputTokens + (testCase.expectedOutputTokens - 1)
                    : (fixtureUsage.outputTokens ?? testCase.expectedOutputTokens)
                        + (fixtureUsage.reasoningTokens ?? fixtureTokens.reasoningTokens);
            expect(tokenDeltas.every((d) => !d.maxOutputTokens || d.maxOutputTokens <= expectedMax)).toBe(true);
            const observedMax = Math.max(...tokenDeltas.map((d) => d.maxOutputTokens ?? 0));
            expect(observedMax).toBe(expectedMax);
            expect(producedValues[producedValues.length - 1]).toBeGreaterThanOrEqual(expectedMax);
            expect(producedValues[producedValues.length - 1]).toBeGreaterThanOrEqual(
                fixtureTokens.outputTokens + fixtureTokens.reasoningTokens,
            );
        });
    });
});
