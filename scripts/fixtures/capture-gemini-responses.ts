/**
 * Capture real Gemini API responses for test fixtures
 * 
 * Usage: GEMINI_API_KEY=AIza... npx tsx capture-gemini-responses.ts
 */

import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error('Error: GEMINI_API_KEY environment variable is required');
    process.exit(1);
}

const client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

interface CapturedStream {
    chunks: Array<{
        candidates?: any[];
        usageMetadata?: any;
        modelVersion?: string;
        timestamp: number;
    }>;
}

async function captureStreamingResponse(
    model: string,
    prompt: string,
    options: {
        thinking?: 'low' | 'high';
        thinkingBudget?: number;
    } = {}
): Promise<CapturedStream> {
    const chunks: CapturedStream['chunks'] = [];
    const startTime = Date.now();

    const requestConfig: any = {};

    // Configure thinking based on model type
    if (options.thinking) {
        requestConfig.thinkingConfig = { includeThoughts: true };

        // Pro models use thinkingLevel
        if (model.includes('-pro-')) {
            requestConfig.thinkingConfig.thinkingLevel = options.thinking === 'low' ? 'LOW' : 'HIGH';
        }
        // Flash models use thinkingBudget
        else if (options.thinkingBudget !== undefined) {
            requestConfig.thinkingConfig.thinkingBudget = options.thinkingBudget;
        }
    } else {
        // For basic mode on non-Pro models, explicitly disable thinking with budget: 0
        if (!model.includes('-pro-')) {
            requestConfig.thinkingConfig = {
                includeThoughts: true,
                thinkingBudget: 0,
            };
        }
    }

    console.log(`\nCapturing ${model} stream (thinking: ${options.thinking ?? 'none'})...`);

    const stream = await client.models.generateContentStream({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: requestConfig as any,
    });

    for await (const chunk of stream) {
        chunks.push({
            candidates: chunk.candidates,
            usageMetadata: chunk.usageMetadata,
            modelVersion: chunk.modelVersion,
            timestamp: Date.now() - startTime,
        });
    }

    console.log(`  Captured ${chunks.length} chunks in ${Date.now() - startTime}ms`);

    // Show usage from last chunk
    const lastChunk = chunks[chunks.length - 1];
    if (lastChunk?.usageMetadata) {
        console.log(`  Usage:`, lastChunk.usageMetadata);
    }

    return { chunks };
}

async function main() {
    const fixturesDir = path.join(__dirname, '../../tests/fixtures/gemini');
    fs.mkdirSync(fixturesDir, { recursive: true });

    const testPrompt = 'Write a simple hello world function in TypeScript with JSDoc comments.';

    // Featured Gemini models based on model-catalog.ts (featured: true)
    const featuredModels = [
        { id: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview', type: 'pro', supportsReasoningMode: true, alwaysThinking: true },
        { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', type: 'flash' },
        { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', type: 'flash' },
        { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', type: 'pro', alwaysThinking: true },
    ];

    const scenarios = [];

    // For each featured model, create appropriate variants
    for (const model of featuredModels) {
        // Basic (no thinking) - skip for models that always think
        if (!model.alwaysThinking) {
            scenarios.push({
                name: `${model.id}-basic`,
                model: model.id,
                prompt: testPrompt,
                options: {},
            });
        }

        // Thinking variant
        if (model.supportsReasoningMode) {
            // Models with explicit reasoningMode support
            scenarios.push({
                name: `${model.id}-thinking-low`,
                model: model.id,
                prompt: testPrompt,
                options: { thinking: 'low' as const },
            });

            scenarios.push({
                name: `${model.id}-thinking-high`,
                model: model.id,
                prompt: testPrompt,
                options: { thinking: 'high' as const },
            });
        } else {
            // Models using thinkingBudget
            scenarios.push({
                name: `${model.id}-thinking`,
                model: model.id,
                prompt: testPrompt,
                options: { thinking: 'low' as const, thinkingBudget: 2000 },
            });
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

    console.log('\n✅ All Gemini captures complete!');
}

main().catch(console.error);
