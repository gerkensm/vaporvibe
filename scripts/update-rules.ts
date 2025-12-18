/*
type: new file
fileName: scripts/update-rules.ts
*/
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..");
const RULES_DIR = join(PROJECT_ROOT, ".agent/rules");
const MAX_CHARS = 12000;

interface RuleConfig {
    docs: string[];
    trigger: "always_on" | "glob";
    globs?: string[];
}

const CONFIGURATION: Record<string, RuleConfig> = {
    "CODEBASE_MAP.md": {
        docs: ["docs/CODEBASE_MAP.md"],
        trigger: "always_on",
    },
    "agents-md.md": {
        docs: ["AGENTS.md"],
        trigger: "always_on",
    },
    "architecture-docs.md": {
        docs: ["docs/ARCHITECTURE.md"],
        trigger: "always_on",
    },
    "ab-testing-docs.md": {
        docs: ["docs/architecture/ab-testing.md"],
        trigger: "glob",
        globs: [
            "src/server/session-store.ts",
            "src/server/admin-controller.ts",
            "frontend/src/components/ABWorkspaceShell.tsx",
            "frontend/src/pages/AbTestWorkspacePage.tsx",
            "frontend/src/interceptor*.ts",
        ],
    },
    "admin-api-docs.md": {
        docs: ["docs/architecture/admin-api.md"],
        trigger: "glob",
        globs: [
            "src/server/admin-controller.ts",
            "src/types/admin-api.ts",
            "frontend/src/api/admin.ts",
            "frontend/src/pages/AdminDashboard.tsx",
        ],
    },
    "admin-controller-docs.md": {
        docs: ["docs/modules/server/admin-controller.md"],
        trigger: "glob",
        globs: ["src/server/admin-controller.ts"],
    },
    "codebase-map.md": {
        docs: ["docs/CODEBASE_MAP.md"],
        trigger: "glob",
        globs: ["package.json", "src/**", "frontend/src/**"],
    },
    "component-cache-docs.md": {
        docs: ["docs/modules/server/component-cache.md"],
        trigger: "glob",
        globs: ["src/server/component-cache.ts", "src/server/server.ts"],
    },
    "credential-storage-docs.md": {
        docs: ["docs/modules/utils/credential-store.md"],
        trigger: "glob",
        globs: ["src/utils/credential-store.ts"],
    },
    "credential-storage-guide.md": {
        docs: ["docs/CREDENTIAL_STORAGE.md"],
        trigger: "glob",
        globs: [
            "src/utils/credential-store.ts",
            "src/server/server.ts",
            "src/config/runtime-config.ts",
        ],
    },
    "llm-client-docs.md": {
        docs: ["docs/modules/llm/client.md"],
        trigger: "glob",
        globs: ["src/llm/client.ts", "src/llm/*-client.ts"],
    },
    "llm-factory-docs.md": {
        docs: ["docs/modules/llm/factory.md"],
        trigger: "glob",
        globs: ["src/llm/factory.ts"],
    },
    "llm-pipeline-docs.md": {
        docs: ["docs/architecture/llm-pipeline.md"],
        trigger: "glob",
        globs: [
            "src/server/server.ts",
            "src/llm/client.ts",
            "src/views/loading-shell.ts",
            "src/views/loading-shell/**/*",
        ],
    },
    "llm-provider-docs.md": {
        docs: [], // Will be populated dynamically from docs/modules/llm/providers/
        trigger: "glob",
        globs: ["src/llm/*-client.ts", "src/llm/providers/*.ts"],
    },
    "macos-app-docs.md": {
        docs: ["docs/macos-app.md"],
        trigger: "glob",
        globs: ["scripts/macos-app/**", "scripts/*.sh", "scripts/entitlements.plist"],
    },
    "notarization-docs.md": {
        docs: ["docs/NOTARIZATION.md"],
        trigger: "glob",
        globs: [
            "scripts/notarize-macos-sea.sh",
            "scripts/verify-notarization.sh",
            "scripts/check-notarization-credentials.sh",
        ],
    },
    "rest-api-controller-docs.md": {
        docs: ["docs/modules/server/rest-api-controller.md"],
        trigger: "glob",
        globs: ["src/server/rest-api-controller.ts"],
    },
    "runtime-config-docs.md": {
        docs: ["docs/modules/config/runtime-config.md"],
        trigger: "glob",
        globs: [
            "src/config/runtime-config.ts",
            "src/cli/args.ts",
            "src/utils/config-store.ts",
        ],
    },
    "server-core-docs.md": {
        docs: ["docs/modules/server/server.md"],
        trigger: "glob",
        globs: ["src/server/server.ts", "src/index.ts"],
    },
    "session-lifecycle-docs.md": {
        docs: ["docs/architecture/session-lifecycle.md"],
        trigger: "glob",
        globs: ["src/server/session-store.ts", "src/types.ts"],
    },
    "session-store-docs.md": {
        docs: ["docs/modules/server/session-store.md"],
        trigger: "glob",
        globs: ["src/server/session-store.ts"],
    },
    "token-optimization-docs.md": {
        docs: ["docs/architecture/token-optimization.md"],
        trigger: "glob",
        globs: ["src/server/component-cache.ts", "src/server/server.ts"],
    },
    "transition-ux-docs.md": {
        docs: ["docs/architecture/transition-ux.md"],
        trigger: "glob",
        globs: [
            "src/views/loading-shell/**",
            "frontend/public/vaporvibe-interceptor-sw.js",
            "frontend/src/interceptor.ts",
        ],
    },
    "virtual-rest-api-docs.md": {
        docs: ["docs/architecture/virtual-rest-api.md"],
        trigger: "glob",
        globs: ["src/server/rest-api-controller.ts", "src/types.ts"],
    },
    "llm-test-architecture.md": {
        docs: ["tests/llm/README.md"],
        trigger: "glob",
        globs: [
            "tests/llm/**/*.test.ts",
            "tests/fixtures/**/*.json",
            "scripts/fixtures/**/*.ts",
        ],
    },
};

// Helper to dynamically populate provider docs
const providersDir = join(PROJECT_ROOT, "docs/modules/llm/providers");
if (existsSync(providersDir)) {
    const providerDocs = readdirSync(providersDir)
        .filter((f) => f.endsWith(".md"))
        .map((f) => `docs/modules/llm/providers/${f}`);
    CONFIGURATION["llm-provider-docs.md"].docs = providerDocs;
}

function splitContent(text: string, limit: number): string[] {
    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > limit) {
        let splitIdx = remaining.lastIndexOf("\n", limit);
        if (splitIdx === -1) {
            splitIdx = limit;
        }
        chunks.push(remaining.slice(0, splitIdx));
        remaining = remaining.slice(splitIdx);
    }
    if (remaining.length > 0) {
        chunks.push(remaining);
    }
    return chunks;
}

function generateFrontmatter(rule: RuleConfig): string {
    const lines = ["---"];
    if (rule.trigger === "always_on") {
        lines.push("trigger: always_on");
        lines.push("globs: **/*"); // Explicit wildmatch for always_on to ensure coverage
    } else {
        lines.push("trigger: glob");
        if (rule.globs && rule.globs.length > 0) {
            const globString = rule.globs.map((g) => `**/${g}`).join(", ");
            lines.push(`globs: ${globString}`);
        } else {
            // Fallback if no globs provided
            lines.push("globs: **/*");
        }
    }
    lines.push("---");
    lines.push("");
    return lines.join("\n");
}

function main() {
    console.log("🚀 Updating agent rules...");

    for (const [ruleFile, config] of Object.entries(CONFIGURATION)) {
        console.log(`Processing ${ruleFile}...`);
        let fullContent = "";

        for (const docFile of config.docs) {
            const docPath = join(PROJECT_ROOT, docFile);
            if (existsSync(docPath)) {
                let content = readFileSync(docPath, "utf8");
                // Fix relative links for rules context
                if (docFile.includes("ARCHITECTURE.md") || ruleFile === "architecture-docs.md") {
                    content = content.replace(/\]\(docs\//g, "](../../docs/");
                }
                fullContent += `\n# Content from ${docFile}\n\n${content}\n`;
            } else {
                console.warn(`⚠️  Warning: Doc file ${docFile} not found.`);
            }
        }

        if (!fullContent.trim()) {
            console.log(`Skipping ${ruleFile} (no content).`);
            continue;
        }

        const frontmatter = generateFrontmatter(config);
        const chunkSize = MAX_CHARS - frontmatter.length - 100;
        const chunks = splitContent(fullContent, chunkSize);

        const baseName = basename(ruleFile, extname(ruleFile));
        const ext = extname(ruleFile);

        chunks.forEach((chunk, index) => {
            const filename = chunks.length > 1 ? `${baseName}-part${index + 1}${ext}` : ruleFile;
            const outPath = join(RULES_DIR, filename);
            writeFileSync(outPath, frontmatter + chunk);
            console.log(`   -> Written ${filename} (${chunk.length} chars)`);
        });
    }

    // Direct copies for critical files (as backup/standard)
    const copyList = [
        { src: "AGENTS.md", dest: "AGENTS.md" },
        { src: "docs/ARCHITECTURE.md", dest: "ARCHITECTURE.md" },
    ];

    copyList.forEach(({ src, dest }) => {
        const srcPath = join(PROJECT_ROOT, src);
        const destPath = join(RULES_DIR, dest);
        if (existsSync(srcPath)) {
            // We still wrap them in the frontmatter so the agent picks them up correctly
            // using the same logic as the loop above (via "agents-md.md" and "architecture-docs.md")
            // but if we want raw copies for direct file access by tools:
            writeFileSync(destPath, readFileSync(srcPath, "utf8"));
            console.log(`   -> Copied ${src} to rules/${dest}`);
        }
    });

    console.log("✅ Rules updated successfully.");
}

main();