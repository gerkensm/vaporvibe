/**
 * Capture real Anthropic API responses for test fixtures
 * 
 * Usage: ANTHROPIC_API_KEY=sk-... npx tsx capture-anthropic-responses.ts
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is required');
    process.exit(1);
}

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

interface CapturedStream {
    events: Array<{
        type: string;
        delta?: any;
        content_block_delta?: any;
        timestamp: number;
    }>;
    finalMessage: any;
}

async function captureStreamingResponse(
    model: string,
    messages: any[],
    options: {
        thinking?: boolean;
        thinkingBudget?: number;
    } = {}
): Promise<CapturedStream> {
    const events: CapturedStream['events'] = [];
    const startTime = Date.now();

    const requestConfig: any = {
        model,
        max_tokens: options.thinking ? 4096 : 2048,
        messages,
    };

    if (options.thinking && options.thinkingBudget) {
        requestConfig.thinking = {
            type: 'enabled',
            budget_tokens: options.thinkingBudget,
        };
    }

    console.log(`\nCapturing ${model} stream (thinking: ${options.thinking})...`);
    const stream = await client.messages.stream(requestConfig);

    for await (const event of stream) {
        events.push({
            type: (event as any).type,
            delta: (event as any).delta,
            content_block_delta: (event as any).content_block_delta,
            timestamp: Date.now() - startTime,
        });
    }

    const finalMessage = await stream.finalMessage();

    console.log(`  Captured ${events.length} events in ${Date.now() - startTime}ms`);
    console.log(`  Final message content blocks: ${finalMessage?.content?.length ?? 0}`);

    if (finalMessage?.usage) {
        console.log(`  Usage:`, finalMessage.usage);
    }

    return { events, finalMessage };
}

async function main() {
    const fixturesDir = path.join(__dirname, '../../tests/fixtures/anthropic');
    fs.mkdirSync(fixturesDir, { recursive: true });

    const testMessages = [
        {
            role: 'user' as const,
            content: 'Write a simple hello world function in TypeScript with JSDoc comments.',
        },
    ];

    // Featured Anthropic models based on model-catalog.ts
    const featuredModels = [
        { id: 'claude-sonnet-4-5-20250929', label: 'Claude 4.5 Sonnet' },
        { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
        { id: 'claude-opus-4-1-20250805', label: 'Claude Opus 4.1' },
        { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
    ];

    const scenarios = [];

    // For each featured model, create basic + thinking variants
    for (const model of featuredModels) {
        scenarios.push({
            name: `${model.id}-basic`,
            model: model.id,
            messages: testMessages,
            options: {},
        });

        scenarios.push({
            name: `${model.id}-thinking`,
            model: model.id,
            messages: testMessages,
            options: { thinking: true, thinkingBudget: 2000 },
        });
    }
    for (const scenario of scenarios) {
        try {
            const response = await captureStreamingResponse(
                scenario.model,
                scenario.messages,
                scenario.options
            );

            const outputPath = path.join(fixturesDir, `${scenario.name}.json`);
            fs.writeFileSync(outputPath, JSON.stringify(response, null, 2));
            console.log(`  ✓ Saved to ${outputPath}`);
        } catch (error) {
            console.error(`  ✗ Failed to capture ${scenario.name}:`, error);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n✅ All captures complete!');
}

main().catch(console.error);
