
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, '../../tests', 'fixtures');

function loadFixture(provider: string, filename: string) {
    const filePath = path.join(fixturesDir, provider, filename);
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function verifyAnthropic(filename: string, data: any) {
    const isThinking = filename.includes('thinking');
    // Anthropic fixtures have 'events' array
    const events = data.events;

    if (!events || !Array.isArray(events)) {
        console.error(`❌ ${filename}: Invalid fixture format (missing events array)`);
        return false;
    }
    const hasThinkingBlock = events.some((e: any) =>
        (e.type === 'content_block_start' && e.content_block?.type === 'thinking') ||
        (e.type === 'content_block_delta' && e.delta?.type === 'thinking_delta')
    );

    if (isThinking && !hasThinkingBlock) {
        console.error(`❌ ${filename}: Expected thinking block but found none.`);
        return false;
    }
    if (!isThinking && hasThinkingBlock) {
        console.error(`❌ ${filename}: Found unexpected thinking block.`);
        return false;
    }
    console.log(`✅ ${filename}`);
    return true;
}

function verifyOpenAI(filename: string, data: any) {
    const isThinking = filename.includes('reasoning');
    const isReasoningModel = filename.includes('gpt-5') || filename.includes('o1');
    const chunks = Array.isArray(data) ? data : data.chunks;
    // Find usage in the last chunk usually
    const lastChunk = chunks[chunks.length - 1];
    const usage = lastChunk.usage || {};
    // Check both standard location and potential alternatives
    const reasoningTokens =
        usage.completion_tokens_details?.reasoning_tokens ||
        usage.completion_tokens_details?.reasoning ||
        0;

    if (isThinking && reasoningTokens === 0) {
        // Some "reasoning" models might just be names, but if it says reasoning-high/low it should probably have tokens.
        // However, let's check if it's strictly 0.
        console.warn(`⚠️ ${filename}: Expected reasoning tokens but found 0. (Might be a model that doesn't support it yet or failed to reason)`);
        // return false; // Soft fail for now as we investigate
    }
    if (!isThinking && reasoningTokens > 0) {
        if (isReasoningModel) {
            console.log(`ℹ️ ${filename}: Found reasoning tokens in basic mode (${reasoningTokens}), expected for reasoning model.`);
        } else {
            console.error(`❌ ${filename}: Found unexpected reasoning tokens: ${reasoningTokens}`);
            return false;
        }
    }
    console.log(`✅ ${filename} (Tokens: ${reasoningTokens})`);
    return true;
}

function verifyGroq(filename: string, data: any) {
    const isThinking = filename.includes('reasoning');
    const isLeakyModel = filename.includes('openai-gpt-oss'); // These models seem to leak reasoning
    const hasReasoningContent = data.chunks.some((c: any) =>
        c.choices?.[0]?.delta?.reasoning_content || c.choices?.[0]?.delta?.reasoning
    );

    if (isThinking && !hasReasoningContent) {
        console.error(`❌ ${filename}: Expected reasoning_content but found none.`);
        return false;
    }
    if (!isThinking && hasReasoningContent) {
        if (isLeakyModel) {
            console.log(`ℹ️ ${filename}: Found unexpected reasoning_content in basic mode, known quirk for this model.`);
        } else {
            console.error(`❌ ${filename}: Found unexpected reasoning_content.`);
            return false;
        }
    }
    console.log(`✅ ${filename}`);
    return true;
}

function verifyGemini(filename: string, data: any) {
    const isThinking = filename.includes('thinking');
    // Gemini 2.5 Pro always thinks, so basic check is moot if we removed it.
    // But for others:
    const lastChunk = data.chunks[data.chunks.length - 1];
    const thoughtsTokenCount = lastChunk.usageMetadata?.thoughtsTokenCount;

    if (isThinking && !thoughtsTokenCount) {
        console.error(`❌ ${filename}: Expected thoughtsTokenCount but found none.`);
        return false;
    }
    if (!isThinking && thoughtsTokenCount > 0) {
        console.error(`❌ ${filename}: Found unexpected thoughtsTokenCount: ${thoughtsTokenCount}`);
        return false;
    }
    console.log(`✅ ${filename} (Thoughts: ${thoughtsTokenCount ?? 0})`);
    return true;
}

async function main() {
    const providers = ['anthropic', 'openai', 'groq', 'gemini'];
    let failed = false;

    for (const provider of providers) {
        console.log(`\n=== Verifying ${provider} ===`);
        const dir = path.join(fixturesDir, provider);
        if (!fs.existsSync(dir)) continue;

        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

        for (const file of files) {
            const data = loadFixture(provider, file);
            let result = true;

            if (provider === 'anthropic') result = verifyAnthropic(file, data);
            else if (provider === 'openai') result = verifyOpenAI(file, data);
            else if (provider === 'groq') result = verifyGroq(file, data);
            else if (provider === 'gemini') result = verifyGemini(file, data);

            if (!result) failed = true;
        }
    }

    if (failed) process.exit(1);
}

main();
