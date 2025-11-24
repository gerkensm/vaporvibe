/**
 * Verify that Gemini basic mode truly has NO thinking tokens
 */

import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error('Error: GEMINI_API_KEY environment variable is required');
    process.exit(1);
}

const client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

async function testBasicMode() {
    console.log('\n🧪 Testing Gemini 2.5 Flash WITHOUT any thinking config...\n');

    // NO thinkingConfig at all
    const stream = await client.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: [{
            role: 'user',
            parts: [{ text: 'Write a simple hello world function in TypeScript with JSDoc comments.' }]
        }],
        config: {
            maxOutputTokens: 8192,
            // NO thinkingConfig whatsoever
        } as any,
    });

    let lastChunk: any = null;
    let chunkCount = 0;

    for await (const chunk of stream) {
        chunkCount++;
        lastChunk = chunk;
    }

    console.log(`📦 Captured ${chunkCount} chunks\n`);

    if (lastChunk?.usageMetadata) {
        const usage = lastChunk.usageMetadata;
        console.log('📊 Usage Metadata:');
        console.log('   promptTokenCount:', usage.promptTokenCount);
        console.log('   candidatesTokenCount:', usage.candidatesTokenCount);
        console.log('   totalTokenCount:', usage.totalTokenCount);
        console.log('   thoughtsTokenCount:', usage.thoughtsTokenCount);

        if (usage.thoughtsTokenCount && usage.thoughtsTokenCount > 0) {
            console.log('\n❌ UNEXPECTED: Basic mode has thinking tokens!');
            console.log('   This might be implicit Gemini behavior.');
            return false;
        } else {
            console.log('\n✅ CORRECT: Basic mode has NO thinking tokens');
            return true;
        }
    } else {
        console.log('\n⚠️  No usage metadata found');
        return false;
    }
}

async function testWithThinkingConfig() {
    console.log('\n🧪 Testing Gemini 2.5 Flash WITH thinkingConfig...\n');

    const stream = await client.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: [{
            role: 'user',
            parts: [{ text: 'Write a simple hello world function in TypeScript with JSDoc comments.' }]
        }],
        config: {
            maxOutputTokens: 8192,
            thinkingConfig: {
                includeThoughts: true,
                thinkingBudget: 2000,
            }
        } as any,
    });

    let lastChunk: any = null;
    let chunkCount = 0;

    for await (const chunk of stream) {
        chunkCount++;
        lastChunk = chunk;
    }

    console.log(`📦 Captured ${chunkCount} chunks\n`);

    if (lastChunk?.usageMetadata) {
        const usage = lastChunk.usageMetadata;
        console.log('📊 Usage Metadata:');
        console.log('   promptTokenCount:', usage.promptTokenCount);
        console.log('   candidatesTokenCount:', usage.candidatesTokenCount);
        console.log('   totalTokenCount:', usage.totalTokenCount);
        console.log('   thoughtsTokenCount:', usage.thoughtsTokenCount);

        if (usage.thoughtsTokenCount && usage.thoughtsTokenCount > 0) {
            console.log('\n✅ CORRECT: Thinking mode has thinking tokens');
            return true;
        } else {
            console.log('\n❌ UNEXPECTED: Thinking mode has NO thinking tokens!');
            return false;
        }
    } else {
        console.log('\n⚠️  No usage metadata found');
        return false;
    }
}

async function main() {
    console.log('='.repeat(60));
    console.log('Gemini Basic Mode Verification');
    console.log('='.repeat(60));

    const basicCorrect = await testBasicMode();

    await new Promise(resolve => setTimeout(resolve, 2000));

    const thinkingCorrect = await testWithThinkingConfig();

    console.log('\n' + '='.repeat(60));
    console.log('Summary:');
    console.log('='.repeat(60));
    console.log(`Basic mode:    ${basicCorrect ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Thinking mode: ${thinkingCorrect ? '✅ PASS' : '❌ FAIL'}`);

    if (!basicCorrect) {
        console.log('\n⚠️  ACTION REQUIRED: Regenerate basic fixture!');
        process.exit(1);
    }
}

main().catch(console.error);
