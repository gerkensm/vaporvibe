/**
 * Capture real OpenAI API responses for test fixtures
 * 
 * Usage: OPENAI_API_KEY=sk-... npx tsx capture-openai-responses.ts
 */

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    process.exit(1);
}

const client = new OpenAI({ apiKey: OPENAI_API_KEY });

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
        stream_options: { include_usage: true },
    };

    // Configure reasoning effort if specified
    if (options.reasoningEffort) {
        requestConfig.reasoning_effort = options.reasoningEffort;
    }

    console.log(`\nCapturing ${model} stream (reasoning: ${options.reasoningEffort ?? 'none'})...`);

    const stream = await client.chat.completions.create(requestConfig);

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
    const fixturesDir = path.join(__dirname, '../../tests/fixtures/openai');
    fs.mkdirSync(fixturesDir, { recursive: true });

    const testPrompt = 'Write a simple hello world function in TypeScript with JSDoc comments.';

    // Featured OpenAI models based on model-catalog.ts (featured: true)
    const featuredModels = [
        { id: 'gpt-5.1', label: 'GPT-5.1', supportsReasoningMode: true },
        { id: 'gpt-5', label: 'GPT-5', supportsReasoningMode: true },
        { id: 'gpt-5-mini', label: 'GPT-5 Mini', supportsReasoningMode: true },
        { id: 'gpt-5-nano', label: 'GPT-5 Nano', supportsReasoningMode: true },
        { id: 'gpt-4o', label: 'GPT-4o', supportsReasoningMode: false },
    ];

    const scenarios = [];

    // For each featured model, create appropriate variants
    for (const model of featuredModels) {
        // Basic (no reasoning)
        scenarios.push({
            name: `${model.id}-basic`,
            model: model.id,
            prompt: testPrompt,
            options: {},
        });

        // Reasoning variants if supported
        if (model.supportsReasoningMode) {
            for (const effort of ['low', 'medium', 'high'] as const) {
                scenarios.push({
                    name: `${model.id}-reasoning-${effort}`,
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

    console.log('\n✅ All OpenAI captures complete!');
}

main().catch(console.error);
