#!/usr/bin/env tsx
/**
 * Diagnostic script to compare how Gemini Flash vs Pro stream reasoning thoughts.
 * Run with: tsx scripts/test-gemini-streaming.ts
 */

import { GoogleGenAI } from '@google/genai';

const API_KEY = process.env.GEMINI_API_KEY || '';

if (!API_KEY) {
    console.error('Please set GEMINI_API_KEY environment variable');
    process.exit(1);
}

const client = new GoogleGenAI({ apiKey: API_KEY });

async function testModel(modelName: string) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Testing: ${modelName}`);
    console.log('='.repeat(80));

    const stream = await client.models.generateContentStream({
        model: modelName,
        contents: [
            {
                role: 'user',
                parts: [{ text: 'Solve this step by step: What is 15 * 23?' }],
            },
        ],
        config: {
            thinkingConfig: {
                includeThoughts: true,
            },
        } as any,
    });

    let chunkIndex = 0;
    const thoughtsPerChunk: Array<{ index: number; thought: string | null }> = [];
    let finalResponse: any = null;

    console.log('\n📡 Streaming chunks:');
    for await (const chunk of stream) {
        finalResponse = chunk;
        chunkIndex++;

        const parts = chunk?.candidates?.[0]?.content?.parts ?? [];
        const textParts = parts.filter((p: any) => !p.thought && p.text);
        const thoughtParts = parts.filter((p: any) => p.thought === true && p.text);

        console.log(`\nChunk ${chunkIndex}:`);
        console.log(`  - Text parts: ${textParts.length}`);
        console.log(`  - Thought parts: ${thoughtParts.length}`);

        if (thoughtParts.length > 0) {
            thoughtParts.forEach((tp: any, i: number) => {
                const preview = tp.text.substring(0, 100).replace(/\n/g, ' ');
                console.log(`    Thought ${i + 1}: "${preview}${tp.text.length > 100 ? '...' : ''}"`);
                thoughtsPerChunk.push({ index: chunkIndex, thought: tp.text });
            });
        }

        if (textParts.length > 0) {
            textParts.forEach((tp: any, i: number) => {
                const preview = tp.text.substring(0, 50).replace(/\n/g, ' ');
                console.log(`    Text ${i + 1}: "${preview}${tp.text.length > 50 ? '...' : ''}"`);
            });
        }
    }

    console.log(`\n📊 Summary:`);
    console.log(`  - Total chunks: ${chunkIndex}`);
    console.log(`  - Thoughts streamed: ${thoughtsPerChunk.length}`);
    console.log(`  - Chunks with thoughts: ${new Set(thoughtsPerChunk.map(t => t.index)).size}`);

    // Check final response
    const finalParts = finalResponse?.candidates?.[0]?.content?.parts ?? [];
    const finalThoughts = finalParts.filter((p: any) => p.thought === true && p.text);
    console.log(`  - Thoughts in final response: ${finalThoughts.length}`);

    const usage = finalResponse?.usageMetadata ?? finalResponse?.usage_metadata;
    const thoughtTokens = usage?.thoughtsTokenCount ?? usage?.thoughts_token_count;
    console.log(`  - Thought token count: ${thoughtTokens ?? 'N/A'}`);

    if (finalThoughts.length > 0) {
        console.log(`\n💭 Final thoughts content:`);
        finalThoughts.forEach((t: any, i: number) => {
            console.log(`\n  Thought ${i + 1} (${t.text.length} chars):`);
            console.log(`  ${t.text.substring(0, 200).replace(/\n/g, '\n  ')}${t.text.length > 200 ? '...' : ''}`);
        });
    }
}

async function main() {
    console.log('🧪 Gemini Streaming Thoughts Diagnostic');
    console.log('Testing how different models stream reasoning thoughts...\n');

    try {
        // Test Flash
        await testModel('gemini-2.5-flash');

        // Test Pro (if you have access)
        await testModel('gemini-2.5-pro');

        console.log('\n✅ Test complete!\n');
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

main();
