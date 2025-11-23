#!/usr/bin/env node

/**
 * Generate a codebase map for LLM context
 * 
 * This script analyzes the project structure and generates LLM-friendly 
 * documentation including detailed import/export graphs with symbol-level information.
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const markdownOutputPath = join(projectRoot, 'docs', 'CODEBASE_MAP.md');
const jsonOutputPath = join(projectRoot, 'docs', 'codebase-graph.json');

console.log('🔍 Analyzing codebase structure...');

// Parse import statements from source files
const parseImports = (filePath) => {
    try {
        const content = readFileSync(filePath, 'utf8');
        const imports = {
            named: [], // { module: string, symbols: string[] }
            default: [], // { module: string, symbol: string }
            namespace: [], // { module: string, alias: string }
            typeOnly: [], // { module: string, symbols: string[] }
        };

        // Match ES6 import statements
        const importRegex = /import\s+(?:(?:type\s+)?(?:{([^}]+)}|(\*\s+as\s+\w+)|(\w+))(?:\s*,\s*(?:{([^}]+)}|(\*\s+as\s+\w+)))?)?\s+from\s+['"]([^'"]+)['"]/g;
        const typeImportRegex = /import\s+type\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/g;

        let match;

        // Parse type-only imports
        while ((match = typeImportRegex.exec(content)) !== null) {
            const symbols = match[1].split(',').map(s => s.trim()).filter(Boolean);
            const module = match[2];
            imports.typeOnly.push({ module, symbols });
        }

        // Parse regular imports
        const simpleImportRegex = /import\s+(?:{([^}]+)}|(\w+)|\*\s+as\s+(\w+))\s+from\s+['"]([^'"]+)['"]/g;
        while ((match = simpleImportRegex.exec(content)) !== null) {
            const module = match[4];

            if (match[1]) {
                // Named imports: import { a, b } from 'module'
                const symbols = match[1].split(',').map(s => {
                    const parts = s.trim().split(/\s+as\s+/);
                    return parts[0].trim();
                }).filter(Boolean);
                imports.named.push({ module, symbols });
            } else if (match[2]) {
                // Default import: import X from 'module'
                imports.default.push({ module, symbol: match[2] });
            } else if (match[3]) {
                // Namespace import: import * as X from 'module'
                imports.namespace.push({ module, alias: match[3] });
            }
        }

        return imports;
    } catch (error) {
        return { named: [], default: [], namespace: [], typeOnly: [] };
    }
};

// Recursively find all source files
const findSourceFiles = (dir, extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs']) => {
    const files = [];

    try {
        const entries = readdirSync(dir);

        for (const entry of entries) {
            const fullPath = join(dir, entry);
            const stat = statSync(fullPath);

            if (stat.isDirectory()) {
                if (entry !== 'node_modules' && entry !== 'dist' && entry !== 'out' && entry !== '.git') {
                    files.push(...findSourceFiles(fullPath, extensions));
                }
            } else if (stat.isFile() && extensions.includes(extname(entry))) {
                files.push(fullPath);
            }
        }
    } catch (error) {
        // Ignore errors
    }

    return files;
};

// Analyze both backend and frontend
const analyses = [];

// Backend analysis
try {
    console.log('📊 Analyzing backend modules...');
    const backendFiles = findSourceFiles(join(projectRoot, 'src'));
    const backendModules = backendFiles.map(filePath => {
        const relativePath = relative(join(projectRoot, 'src'), filePath);
        const imports = parseImports(filePath);
        return { path: relativePath, imports };
    });
    analyses.push({ name: 'Backend', basePath: 'src', modules: backendModules });
    console.log(`   Found ${backendModules.length} backend modules`);
} catch (error) {
    console.warn('⚠️  Could not analyze backend:', error.message);
}

// Frontend analysis
try {
    console.log('📊 Analyzing frontend modules...');
    const frontendFiles = findSourceFiles(join(projectRoot, 'frontend/src'));
    const frontendModules = frontendFiles.map(filePath => {
        const relativePath = relative(join(projectRoot, 'frontend/src'), filePath);
        const imports = parseImports(filePath);
        return { path: relativePath, imports };
    });
    analyses.push({ name: 'Frontend', basePath: 'frontend/src', modules: frontendModules });
    console.log(`   Found ${frontendModules.length} frontend modules`);
} catch (error) {
    console.warn('⚠️  Could not analyze frontend:', error.message);
}

if (analyses.length === 0) {
    console.error('❌ No modules found in either backend or frontend');
    process.exit(1);
}

// Build import symbol map
const buildSymbolMap = (modules) => {
    const symbolMap = new Map(); // module path -> { exports: Set, importedBy: Map<string, Set<string>> }

    modules.forEach(module => {
        const { named, default: defaultImports, namespace, typeOnly } = module.imports;

        [...named, ...typeOnly].forEach(imp => {
            const targetModule = imp.module;
            if (!symbolMap.has(module.path)) {
                symbolMap.set(module.path, { from: new Map(), importedBy: new Map() });
            }

            if (!symbolMap.get(module.path).from.has(targetModule)) {
                symbolMap.get(module.path).from.set(targetModule, new Set());
            }

            imp.symbols.forEach(sym => {
                symbolMap.get(module.path).from.get(targetModule).add(sym);
            });
        });

        defaultImports.forEach(imp => {
            if (!symbolMap.has(module.path)) {
                symbolMap.set(module.path, { from: new Map(), importedBy: new Map() });
            }
            if (!symbolMap.get(module.path).from.has(imp.module)) {
                symbolMap.get(module.path).from.set(imp.module, new Set());
            }
            symbolMap.get(module.path).from.get(imp.module).add(`default as ${imp.symbol}`);
        });

        namespace.forEach(imp => {
            if (!symbolMap.has(module.path)) {
                symbolMap.set(module.path, { from: new Map(), importedBy: new Map() });
            }
            if (!symbolMap.get(module.path).from.has(imp.module)) {
                symbolMap.get(module.path).from.set(imp.module, new Set());
            }
            symbolMap.get(module.path).from.get(imp.module).add(`* as ${imp.alias}`);
        });
    });

    return symbolMap;
};

// Generate markdown
let markdown = `# Codebase Import/Export Map

> **Auto-generated documentation for LLM context**  
> Last updated: ${new Date().toISOString()}  
> Generated by: \`npm run gen:codebase-map\`

This document provides detailed import/export relationships, showing which specific symbols (functions, classes, types, variables) are imported by each module.

---

`;

// Process each analysis
analyses.forEach(({ name, basePath, modules }) => {
    if (modules.length === 0) {
        console.log(`⚠️  Skipping ${name} - no modules found`);
        return;
    }

    const symbolMap = buildSymbolMap(modules);

    // Collect external vs internal imports
    const externalModules = new Map(); // package -> Set of files using it
    const internalModules = new Map(); // module -> Set of files importing it

    modules.forEach(module => {
        const allImports = [
            ...module.imports.named,
            ...module.imports.default,
            ...module.imports.namespace,
            ...module.imports.typeOnly
        ];

        allImports.forEach(imp => {
            const isExternal = imp.module.startsWith('@') ||
                imp.module.startsWith('.') === false &&
                imp.module.startsWith('/') === false;

            if (isExternal) {
                // Extract package name
                let pkgName = imp.module;
                if (pkgName.startsWith('@')) {
                    const parts = pkgName.split('/');
                    pkgName = parts.slice(0, 2).join('/');
                } else {
                    pkgName = pkgName.split('/')[0];
                }

                if (!externalModules.has(pkgName)) {
                    externalModules.set(pkgName, new Set());
                }
                externalModules.get(pkgName).add(module.path);
            }
        });
    });

    markdown += `## ${name} (${basePath}/)\n\n`;
    markdown += `**Total Modules**: ${modules.length}  \n`;
    markdown += `**External Packages**: ${externalModules.size}\n\n`;
    markdown += `---\n\n`;

    // Generate architecture overview diagram
    markdown += `### Architecture Overview\n\n`;
    markdown += '```mermaid\n';
    markdown += 'graph TD\n';

    // Group modules by directory
    const moduleGroups = new Map();
    modules.forEach(module => {
        const parts = module.path.split('/');
        const dir = parts.length > 1 ? parts[0] : 'root';
        if (!moduleGroups.has(dir)) {
            moduleGroups.set(dir, []);
        }
        moduleGroups.get(dir).push(module);
    });

    // Create nodes for each group
    const groupNodes = Array.from(moduleGroups.keys()).map(dir => {
        const nodeId = dir.replace(/[^a-zA-Z0-9]/g, '_');
        const count = moduleGroups.get(dir).length;
        return { dir, nodeId, count };
    });

    // Add group nodes with styling
    groupNodes.forEach(({ dir, nodeId, count }) => {
        const label = `${dir}/<br/>${count} modules`;

        if (dir === 'server' || dir.includes('controller')) {
            markdown += `  ${nodeId}["${label}"]:::serverNode\n`;
        } else if (dir === 'llm') {
            markdown += `  ${nodeId}["${label}"]:::llmNode\n`;
        } else if (dir === 'views' || dir.includes('component')) {
            markdown += `  ${nodeId}["${label}"]:::viewNode\n`;
        } else if (dir === 'utils') {
            markdown += `  ${nodeId}["${label}"]:::utilNode\n`;
        } else {
            markdown += `  ${nodeId}["${label}"]\n`;
        }
    });

    // Add edges based on cross-directory imports
    const directoryImports = new Map(); // from -> Set<to>
    modules.forEach(module => {
        const fromDir = module.path.split('/')[0] || 'root';
        const symbolInfo = symbolMap.get(module.path);

        if (symbolInfo && symbolInfo.from) {
            symbolInfo.from.forEach((symbols, importPath) => {
                if (importPath.startsWith('.')) {
                    // Internal import - determine target directory
                    const targetPath = importPath.replace(/^\.\.?\//, '').replace(/\.js$/, '').replace(/\.ts$/, '');
                    const toDir = targetPath.split('/')[0] || 'root';

                    if (fromDir !== toDir) {
                        if (!directoryImports.has(fromDir)) {
                            directoryImports.set(fromDir, new Set());
                        }
                        directoryImports.get(fromDir).add(toDir);
                    }
                }
            });
        }
    });

    // Add edges
    directoryImports.forEach((targets, source) => {
        const sourceNode = source.replace(/[^a-zA-Z0-9]/g, '_');
        targets.forEach(target => {
            const targetNode = target.replace(/[^a-zA-Z0-9]/g, '_');
            markdown += `  ${sourceNode} --> ${targetNode}\n`;
        });
    });

    // Add styling
    markdown += '\n  classDef serverNode fill:#e3f2fd,stroke:#1976d2,stroke-width:2px\n';
    markdown += '  classDef llmNode fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px\n';
    markdown += '  classDef viewNode fill:#e8f5e9,stroke:#388e3c,stroke-width:2px\n';
    markdown += '  classDef utilNode fill:#fff3e0,stroke:#f57c00,stroke-width:2px\n';
    markdown += '```\n\n';
    markdown += `---\n\n`;

    // Generate key module dependency diagram (for modules with most imports)
    const modulesWithImports = modules
        .filter(m => symbolMap.get(m.path)?.from?.size > 0)
        .sort((a, b) => (symbolMap.get(b.path)?.from?.size || 0) - (symbolMap.get(a.path)?.from?.size || 0))
        .slice(0, 10);

    if (modulesWithImports.length > 0) {
        markdown += `### Key Module Dependencies\n\n`;
        markdown += '_Top 10 modules by import count_\n\n';
        markdown += '```mermaid\n';
        markdown += 'graph LR\n';

        modulesWithImports.forEach(module => {
            const nodeId = module.path.replace(/[^a-zA-Z0-9]/g, '_');
            const fileName = module.path.split('/').pop();
            markdown += `  ${nodeId}["${fileName}"]\n`;

            const symbolInfo = symbolMap.get(module.path);
            if (symbolInfo && symbolInfo.from) {
                let internalCount = 0;
                symbolInfo.from.forEach((symbols, importPath) => {
                    if (importPath.startsWith('.') && internalCount < 5) {
                        const targetPath = importPath.split('/').pop()?.replace(/\.js$/, '').replace(/\.ts$/, '');
                        const targetId = importPath.replace(/[^a-zA-Z0-9]/g, '_');
                        if (targetPath) {
                            markdown += `  ${targetId}["${targetPath}"] --> ${nodeId}\n`;
                            internalCount++;
                        }
                    }
                });
            }
        });

        markdown += '```\n\n';
        markdown += `---\n\n`;
    }

    // External dependencies
    if (externalModules.size > 0) {
        markdown += `### External Dependencies\n\n`;
        const sorted = Array.from(externalModules.entries())
            .sort((a, b) => b[1].size - a[1].size);

        sorted.forEach(([pkg, files]) => {
            markdown += `#### \`${pkg}\`\n\n`;
            markdown += `Used by ${files.size} module(s)\n\n`;
        });
        markdown += `---\n\n`;
    }

    // Module details
    markdown += `### Module Import Details\n\n`;

    const sortedModules = modules.sort((a, b) => a.path.localeCompare(b.path));

    sortedModules.forEach(module => {
        markdown += `#### \`${module.path}\`\n\n`;

        const symbolInfo = symbolMap.get(module.path);
        if (symbolInfo && symbolInfo.from.size > 0) {
            const entries = Array.from(symbolInfo.from.entries());
            const internal = entries.filter(([mod]) => mod.startsWith('.') || mod.startsWith('/'));
            const external = entries.filter(([mod]) => !mod.startsWith('.') && !mod.startsWith('/'));

            if (internal.length > 0) {
                markdown += `**Internal Imports:**\n\n`;
                internal.forEach(([mod, symbols]) => {
                    markdown += `- From \`${mod}\`: ${Array.from(symbols).map(s => `\`${s}\``).join(', ')}\n`;
                });
                markdown += `\n`;
            }

            if (external.length > 0) {
                markdown += `**External Imports:**\n\n`;
                external.forEach(([mod, symbols]) => {
                    markdown += `- From \`${mod}\`: ${Array.from(symbols).map(s => `\`${s}\``).join(', ')}\n`;
                });
                markdown += `\n`;
            }
        } else {
            markdown += `_No imports_\n\n`;
        }
    });

    markdown += `\n---\n\n`;
});

// Add regeneration instructions
markdown += `## Regenerating This Documentation

To update this file when imports change:

\`\`\`bash
npm run gen:codebase-map
\`\`\`

This will re-analyze both backend and frontend source files and regenerate both this markdown documentation and the machine-readable JSON file (\`docs/codebase-graph.json\`).
`;

// Build JSON output
const jsonOutput = {
    generated: new Date().toISOString(),
    backend: null,
    frontend: null
};

// Process analyses for JSON
analyses.forEach(({ name, basePath, modules }) => {
    if (modules.length === 0) return;

    const symbolMap = buildSymbolMap(modules);
    const externalModules = new Map();

    // Collect external modules
    modules.forEach(module => {
        const allImports = [
            ...module.imports.named,
            ...module.imports.default,
            ...module.imports.namespace,
            ...module.imports.typeOnly
        ];

        allImports.forEach(imp => {
            const isExternal = imp.module.startsWith('@') ||
                imp.module.startsWith('.') === false &&
                imp.module.startsWith('/') === false;

            if (isExternal) {
                let pkgName = imp.module;
                if (pkgName.startsWith('@')) {
                    const parts = pkgName.split('/');
                    pkgName = parts.slice(0, 2).join('/');
                } else {
                    pkgName = pkgName.split('/')[0];
                }

                if (!externalModules.has(pkgName)) {
                    externalModules.set(pkgName, new Set());
                }
                externalModules.get(pkgName).add(module.path);
            }
        });
    });

    // Build module data for JSON
    const modulesData = {};
    modules.forEach(module => {
        const symbolInfo = symbolMap.get(module.path);
        const imports = { internal: {}, external: {} };

        if (symbolInfo && symbolInfo.from) {
            symbolInfo.from.forEach((symbols, importPath) => {
                const symbolArray = Array.from(symbols);
                if (importPath.startsWith('.')) {
                    imports.internal[importPath] = symbolArray;
                } else {
                    imports.external[importPath] = symbolArray;
                }
            });
        }

        // Find who imports this module
        const importedBy = [];
        modules.forEach(otherModule => {
            const otherSymbolInfo = symbolMap.get(otherModule.path);
            if (otherSymbolInfo && otherSymbolInfo.from) {
                otherSymbolInfo.from.forEach((symbols, importPath) => {
                    // Check if this import resolves to the current module
                    const resolvedPath = importPath.replace(/^\.\.?\//, '').replace(/\.js$/, '').replace(/\.ts$/, '');
                    if (resolvedPath === module.path.replace(/\.ts$/, '').replace(/\.tsx$/, '')) {
                        importedBy.push(otherModule.path);
                    }
                });
            }
        });

        modulesData[module.path] = {
            imports,
            importedBy: [...new Set(importedBy)],
            importCount: Object.keys(imports.internal).length + Object.keys(imports.external).length
        };
    });

    // Build external dependencies data
    const externalDepsData = {};
    externalModules.forEach((files, pkg) => {
        externalDepsData[pkg] = {
            usedBy: Array.from(files),
            count: files.size
        };
    });

    const sectionData = {
        basePath,
        totalModules: modules.length,
        externalPackages: externalModules.size,
        modules: modulesData,
        externalDependencies: externalDepsData
    };

    if (name === 'Backend') {
        jsonOutput.backend = sectionData;
    } else if (name === 'Frontend') {
        jsonOutput.frontend = sectionData;
    }
});

// Write markdown output
console.log(`📝 Writing markdown documentation to ${markdownOutputPath}`);
writeFileSync(markdownOutputPath, markdown, 'utf8');

// Write JSON output
console.log(`📝 Writing JSON data to ${jsonOutputPath}`);
writeFileSync(jsonOutputPath, JSON.stringify(jsonOutput, null, 2), 'utf8');

console.log('✅ Codebase map generated successfully!');
console.log(`\n📖 View the documentation at:`);
console.log(`   - Markdown: docs/CODEBASE_MAP.md`);
console.log(`   - JSON: docs/codebase-graph.json`);
