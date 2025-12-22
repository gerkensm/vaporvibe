#!/usr/bin/env node
/**
 * Smart CDN Content Validation Script
 * 
 * Compares actual library files (using versions from generated-lib-versions.ts)
 * with their CDN counterparts to ensure functional equivalence.
 * 
 * Usage: npx tsx scripts/verify-cdn-content.ts
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { LIB_VERSIONS } from '../src/config/generated-lib-versions.js';
import { localLibPathToCdn } from '../src/utils/html-export-transform.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LIBS_DIR = resolve(__dirname, '../frontend/public/libs');

interface ComparisonResult {
    libraryId: string;
    localPath: string;
    cdnUrl: string;
    localSize: number;
    cdnSize: number;
    localHash: string;
    cdnHash: string;
    sizeDiff: number;
    sizeDiffPercent: number;
    hashMatch: boolean;
    status: 'identical' | 'size-mismatch' | 'hash-mismatch' | 'fetch-error' | 'local-missing';
    error?: string;
}

async function fetchCdnContent(url: string): Promise<Buffer | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            return null;
        }
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } catch (error) {
        return null;
    }
}

function hashContent(content: Buffer): string {
    return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

async function compareFile(
    libraryId: string,
    localPath: string,
    cdnUrl: string
): Promise<ComparisonResult> {
    const fullLocalPath = resolve(LIBS_DIR, localPath);

    // Check if local file exists
    if (!existsSync(fullLocalPath)) {
        return {
            libraryId,
            localPath,
            cdnUrl,
            localSize: 0,
            cdnSize: 0,
            localHash: '',
            cdnHash: '',
            sizeDiff: 0,
            sizeDiffPercent: 0,
            hashMatch: false,
            status: 'local-missing',
            error: 'Local file not found'
        };
    }

    // Read local file
    const localContent = readFileSync(fullLocalPath);
    const localSize = localContent.length;
    const localHash = hashContent(localContent);

    // Fetch CDN content
    const cdnContent = await fetchCdnContent(cdnUrl);
    if (!cdnContent) {
        return {
            libraryId,
            localPath,
            cdnUrl,
            localSize,
            cdnSize: 0,
            localHash,
            cdnHash: '',
            sizeDiff: 0,
            sizeDiffPercent: 0,
            hashMatch: false,
            status: 'fetch-error',
            error: 'Failed to fetch CDN content'
        };
    }

    const cdnSize = cdnContent.length;
    const cdnHash = hashContent(cdnContent);
    const sizeDiff = Math.abs(localSize - cdnSize);
    const sizeDiffPercent = localSize > 0 ? (sizeDiff / localSize) * 100 : 100;
    const hashMatch = localHash === cdnHash;

    let status: ComparisonResult['status'];
    if (hashMatch) {
        status = 'identical';
    } else if (sizeDiffPercent > 5) {
        status = 'size-mismatch';
    } else {
        status = 'hash-mismatch';
    }

    return {
        libraryId,
        localPath,
        cdnUrl,
        localSize,
        cdnSize,
        localHash,
        cdnHash,
        sizeDiff,
        sizeDiffPercent,
        hashMatch,
        status
    };
}

/**
 * Discover all libraries that have been copied to frontend/public/libs
 * Only includes runtime files (JS, CSS, fonts, images), not dev artifacts
 */
function discoverLibraries(): Array<{ libraryId: string; version: string; files: string[] }> {
    const libraries: Array<{ libraryId: string; version: string; files: string[] }> = [];

    if (!existsSync(LIBS_DIR)) {
        return libraries;
    }

    // File extensions we care about validating
    const RUNTIME_EXTENSIONS = new Set(['.js', '.css', '.woff', '.woff2', '.ttf', '.eot', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp']);

    // Skip these subdirectories (development-only)
    const SKIP_DIRS = new Set(['development', 'node', 'src', 'types', 'decorators']);

    const libraryDirs = readdirSync(LIBS_DIR, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    for (const libraryId of libraryDirs) {
        const libraryPath = join(LIBS_DIR, libraryId);
        const versionDirs = readdirSync(libraryPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        for (const version of versionDirs) {
            const versionPath = join(libraryPath, version);
            const files: string[] = [];

            // Recursively find all runtime files
            function findFiles(dir: string, relativePath: string = '') {
                const entries = readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = join(dir, entry.name);
                    const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

                    if (entry.isDirectory()) {
                        // Skip development directories
                        if (!SKIP_DIRS.has(entry.name)) {
                            findFiles(fullPath, relPath);
                        }
                    } else if (entry.isFile()) {
                        const ext = entry.name.substring(entry.name.lastIndexOf('.'));
                        // Only include runtime files, skip .d.ts, .map, etc.
                        if (RUNTIME_EXTENSIONS.has(ext) && !entry.name.endsWith('.d.ts') && !entry.name.endsWith('.map')) {
                            files.push(relPath);
                        }
                    }
                }
            }

            findFiles(versionPath);
            if (files.length > 0) {
                libraries.push({ libraryId, version, files });
            }
        }
    }

    return libraries;
}

async function main() {
    console.log('🔍 Discovering and verifying library files against CDN...\n');

    const discoveredLibraries = discoverLibraries();
    console.log(`📦 Found ${discoveredLibraries.length} library versions\n`);

    const results: ComparisonResult[] = [];
    let totalFiles = 0;

    for (const { libraryId, version, files } of discoveredLibraries) {
        console.log(`\n📚 ${libraryId}@${version} (${files.length} files):`);

        for (const file of files) {
            totalFiles++;
            const localPath = `${libraryId}/${version}/${file}`;
            const cdnUrl = localLibPathToCdn(`/libs/${localPath}`);

            if (!cdnUrl) {
                console.log(`  ⚠️  ${file} - No CDN mapping`);
                continue;
            }

            const result = await compareFile(libraryId, localPath, cdnUrl);
            results.push(result);

            // Print result
            const icon = result.status === 'identical' ? '✅' :
                result.status === 'size-mismatch' || result.status === 'hash-mismatch' ? '⚠️' : '❌';

            if (result.status === 'identical') {
                console.log(`  ${icon} ${file} (${formatBytes(result.localSize)})`);
            } else if (result.status === 'size-mismatch') {
                console.log(`  ${icon} ${file} - Size mismatch: ${formatBytes(result.localSize)} → ${formatBytes(result.cdnSize)} (${result.sizeDiffPercent.toFixed(1)}% diff)`);
            } else if (result.status === 'hash-mismatch') {
                console.log(`  ${icon} ${file} - Content differs (${formatBytes(result.localSize)} vs ${formatBytes(result.cdnSize)})`);
            } else {
                console.log(`  ${icon} ${file} - ${result.error}`);
            }
        }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log('='.repeat(60));

    const identical = results.filter(r => r.status === 'identical').length;
    const sizeMismatch = results.filter(r => r.status === 'size-mismatch').length;
    const hashMismatch = results.filter(r => r.status === 'hash-mismatch').length;
    const errors = results.filter(r => r.status === 'fetch-error' || r.status === 'local-missing').length;

    console.log(`Total files checked: ${totalFiles}`);
    console.log(`   ✅ Identical: ${identical}/${results.length}`);
    console.log(`   ⚠️  Size mismatch: ${sizeMismatch}/${results.length}`);
    console.log(`   ⚠️  Hash mismatch: ${hashMismatch}/${results.length}`);
    console.log(`   ❌ Errors: ${errors}/${results.length}`);
    console.log();

    if (identical === results.length) {
        console.log('✅ All CDN files match local library files!');
        process.exit(0);
    } else if (errors > 0) {
        console.log('❌ Some files failed to fetch or were missing locally.');
        process.exit(1);
    } else {
        console.log('⚠️  Some CDN files differ from local versions.');
        console.log('   This may be expected for minified/optimized CDN builds.');
        process.exit(0);
    }
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

main().catch(console.error);
