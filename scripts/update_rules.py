
import os
import re
import shutil
import sys

print("Starting script...")
MAX_CHARS = 12000

mapping = {
    "ab-testing-docs.md": ["docs/architecture/ab-testing.md"],
    "admin-api-docs.md": ["docs/architecture/admin-api.md"],
    "admin-controller-docs.md": ["docs/modules/server/admin-controller.md"],
    "agents-md.md": ["AGENTS.md"],
    "architecture-docs.md": ["docs/ARCHITECTURE.md"],
    "codebase-map.md": ["docs/CODEBASE_MAP.md"],
    "component-cache-docs.md": ["docs/modules/server/component-cache.md"],
    "credential-storage-docs.md": ["docs/modules/utils/credential-store.md"],
    "credential-storage-guide.md": ["docs/CREDENTIAL_STORAGE.md"],
    "llm-client-docs.md": ["docs/modules/llm/client.md"],
    "llm-factory-docs.md": ["docs/modules/llm/factory.md"],
    "llm-pipeline-docs.md": ["docs/architecture/llm-pipeline.md"],
    "llm-provider-docs.md": [os.path.join("docs/modules/llm/providers", f) for f in os.listdir("docs/modules/llm/providers") if f.endswith(".md")],
    "macos-app-docs.md": ["docs/macos-app.md"],
    "notarization-docs.md": ["docs/NOTARIZATION.md"],
    "rest-api-controller-docs.md": ["docs/modules/server/rest-api-controller.md"],
    "runtime-config-docs.md": ["docs/modules/config/runtime-config.md"],
    "server-core-docs.md": ["docs/modules/server/server.md"],
    "session-lifecycle-docs.md": ["docs/architecture/session-lifecycle.md"],
    "session-store-docs.md": ["docs/modules/server/session-store.md"],
    "token-optimization-docs.md": ["docs/architecture/token-optimization.md"],
    "transition-ux-docs.md": ["docs/architecture/transition-ux.md"],
    "virtual-rest-api-docs.md": ["docs/architecture/virtual-rest-api.md"]
}

base_dir = "/Users/torben/VSCode/serve-llm"
rules_dir = os.path.join(base_dir, ".agent/rules")

COMMON_FRONTMATTER = """---
trigger: always_on
globs: **/*
---
"""

def split_content(text, limit):
    chunks = []
    while len(text) > limit:
        split_idx = text.rfind("\n", 0, limit)
        if split_idx == -1:
            split_idx = limit
        chunks.append(text[:split_idx])
        text = text[split_idx:]
    chunks.append(text)
    return chunks

print(f"Processing {len(mapping)} rules...")

for rule_file, doc_files in mapping.items():
    rule_path = os.path.join(rules_dir, rule_file)
    print(f"Processing {rule_file}...")
    
    frontmatter = COMMON_FRONTMATTER

    full_doc_content = ""
    for doc_file in doc_files:
        doc_path = os.path.join(base_dir, doc_file)
        if os.path.exists(doc_path):
            with open(doc_path, "r") as f:
                doc_text = f.read()
            if "ARCHITECTURE.md" in doc_file or rule_file == "read-architecture-docs.md":
                doc_text = doc_text.replace("](docs/", "](../../docs/")
            full_doc_content += f"\n# Content from {doc_file}\n\n{doc_text}\n"
        else:
            print(f"Warning: Doc file {doc_file} not found")

    chunk_size = MAX_CHARS - len(frontmatter) - 100
    chunks = split_content(full_doc_content, chunk_size)

    base_name = os.path.splitext(rule_file)[0]
    ext = os.path.splitext(rule_file)[1]

    for i, chunk in enumerate(chunks):
        if len(chunks) > 1:
            filename = f"{base_name}-part{i+1}{ext}"
        else:
            filename = rule_file
        
        out_path = os.path.join(rules_dir, filename)
        with open(out_path, "w") as f:
            f.write(frontmatter + "\n" + chunk)
        print(f"Written {filename} ({len(chunk)} chars)")

print("Copying AGENTS.md and ARCHITECTURE.md...")
shutil.copy(os.path.join(base_dir, "AGENTS.md"), os.path.join(rules_dir, "AGENTS.md"))
shutil.copy(os.path.join(base_dir, "docs/ARCHITECTURE.md"), os.path.join(rules_dir, "ARCHITECTURE.md"))

arch_rule_path = os.path.join(rules_dir, "ARCHITECTURE.md")
with open(arch_rule_path, "r") as f:
    arch_content = f.read()
arch_content = arch_content.replace("](docs/", "](../../docs/")
with open(arch_rule_path, "w") as f:
    f.write(arch_content)

print("Done.")
