/**
 * Test if thinkingBudget: 0 explicitly disables thinking
 */

import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error('Error: GEMINI_API_KEY environment variable is required');
    process.exit(1);
}

const client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

async function testZeroBudget() {
    console.log('\n🧪 Testing Gemini 2.5 Flash with thinkingBudget: 0...\n');

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
                thinkingBudget: 0,  // Explicitly zero
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

        if (!usage.thoughtsTokenCount || usage.thoughtsTokenCount === 0) {
            console.log('\n✅ SUCCESS: thinkingBudget: 0 disables thinking!');
            return true;
        } else {
            console.log('\n❌ FAIL: thinkingBudget: 0 still has thinking tokens');
            return false;
        }
    } else {
        console.log('\n⚠️  No usage metadata found');
        return false;
    }
}

async function testOmitThinkingConfig() {
    console.log('\n🧪 Testing Gemini 2.5 Flash with includeThoughts: false...\n');

    const stream = await client.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: [{
            role: 'user',
            parts: [{ text: 'Write a simple hello world function in TypeScript with JSDoc comments.' }]
        }],
        config: {
            maxOutputTokens: 8192,
            thinkingConfig: {
                includeThoughts: false,  // Explicitly false
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

        if (!usage.thoughtsTokenCount || usage.thoughtsTokenCount === 0) {
            console.log('\n✅ SUCCESS: includeThoughts: false disables thinking!');
            return true;
        } else {
            console.log('\n❌ FAIL: includeThoughts: false still has thinking tokens');
            return false;
        }
    } else {
        console.log('\n⚠️  No usage metadata found');
        return false;
    }
}

async function main() {
    console.log('='.repeat(60));
    console.log('Gemini Thinking Disable Methods Test');
    console.log('='.repeat(60));

    const zeroBudgetWorks = await testZeroBudget();

    await new Promise(resolve => setTimeout(resolve, 2000));

    const includeFalseWorks = await testOmitThinkingConfig();

    console.log('\n' + '='.repeat(60));
    console.log('Summary:');
    console.log('='.repeat(60));
    console.log(`thinkingBudget: 0:     ${zeroBudgetWorks ? '✅ Disables thinking' : '❌ Does not disable'}`);
    console.log(`includeThoughts: false: ${includeFalseWorks ? '✅ Disables thinking' : '❌ Does not disable'}`);

    if (zeroBudgetWorks) {
        console.log('\n💡 RECOMMENDATION: Use thinkingBudget: 0 to disable thinking');
    } else if (includeFalseWorks) {
        console.log('\n💡 RECOMMENDATION: Use includeThoughts: false to disable thinking');
    } else {
        console.log('\n⚠️  WARNING: No method successfully disables thinking!');
        console.log('   Gemini may always generate internal thinking for Flash models.');
    }
}

main().catch(console.error);
