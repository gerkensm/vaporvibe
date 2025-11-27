/**
 * Capture real Groq API responses for test fixtures
 * 
 * Usage: GROQ_API_KEY=gsk_... npx tsx capture-groq-responses.ts
 */

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
    console.error('Error: GROQ_API_KEY environment variable is required');
    process.exit(1);
}

const client = new OpenAI({
    apiKey: GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
});

interface CapturedStream {
    chunks: Array<{
        id?: string;
        choices?: any[];
        usage?: any;
        timestamp: number;
    }>;
}

async function captureStreamingResponse(
    model: string,
    prompt: string,
    options: {
        reasoningEffort?: 'low' | 'medium' | 'high';
    } = {}
): Promise<CapturedStream> {
    const chunks: CapturedStream['chunks'] = [];
    const startTime = Date.now();

    const requestConfig: any = {
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
    };

    // Configure reasoning effort if specified
    if (options.reasoningEffort) {
        requestConfig.reasoning_effort = options.reasoningEffort;
    }

    console.log(`\nCapturing ${model} stream (reasoning: ${options.reasoningEffort ?? 'none'})...`);

    const stream = await client.chat.completions.create(requestConfig) as unknown as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;

    for await (const chunk of stream) {
        chunks.push({
            id: chunk.id,
            choices: chunk.choices,
            usage: chunk.usage,
            timestamp: Date.now() - startTime,
        });
    }

    console.log(`  Captured ${chunks.length} chunks in ${Date.now() - startTime}ms`);

    // Show usage from last chunk
    const lastChunk = chunks[chunks.length - 1];
    if (lastChunk?.usage) {
        console.log(`  Usage:`, lastChunk.usage);
    }

    return { chunks };
}

async function main() {
    const fixturesDir = path.join(__dirname, 'tests', 'fixtures', 'groq');
    fs.mkdirSync(fixturesDir, { recursive: true });

    const testPrompt = 'Write a simple hello world function in TypeScript with JSDoc comments.';

    // Featured Groq models based on model-catalog.ts (featured: true)
    const featuredModels = [
        { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', supportsReasoningMode: false },
        { id: 'meta-llama/llama-4-maverick-17b-128e-instruct', label: 'Llama 4 Maverick', supportsReasoningMode: false },
        { id: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout', supportsReasoningMode: false },
        { id: 'moonshotai/kimi-k2-instruct-0905', label: 'Kimi K2', supportsReasoningMode: false },
        { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B', supportsReasoningMode: true },
        { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B', supportsReasoningMode: true },
        { id: 'qwen/qwen3-32b', label: 'Qwen 3 32B', supportsReasoningMode: true },
    ];

    const scenarios = [];

    // For each featured model, create appropriate variants
    for (const model of featuredModels) {
        // Basic (no reasoning)
        scenarios.push({
            name: `${model.id.replace(/\//g, '-')}-basic`,
            model: model.id,
            prompt: testPrompt,
            options: {},
        });

        // Reasoning variants if supported
        if (model.supportsReasoningMode) {
            for (const effort of ['low', 'medium', 'high'] as const) {
                scenarios.push({
                    name: `${model.id.replace(/\//g, '-')}-reasoning-${effort}`,
                    model: model.id,
                    prompt: testPrompt,
                    options: { reasoningEffort: effort },
                });
            }
        }
    }

    for (const scenario of scenarios) {
        try {
            const response = await captureStreamingResponse(
                scenario.model,
                scenario.prompt,
                scenario.options
            );

            const outputPath = path.join(fixturesDir, `${scenario.name}.json`);
            fs.writeFileSync(outputPath, JSON.stringify(response, null, 2));
            console.log(`  ✓ Saved to ${outputPath}`);
        } catch (error: any) {
            console.error(`  ✗ Failed to capture ${scenario.name}:`, error?.message || error);

            // Check if it's a model not found error
            if (error?.message?.includes('not found') || error?.status === 404) {
                console.log(`    (Model ${scenario.model} may not be available yet)`);
            }
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n✅ All Groq captures complete!');
}

main().catch(console.error);
