---
trigger: glob
globs: **/src/config/library-manifest.ts, **/src/config/generated-lib-versions.ts, **/scripts/copy-libs.ts, **/frontend/public/libs/**
---

All libraries are served from the local `/libs/` route. This ensures VaporVibe works entirely offline (once models are cached or if using a local provider) and prevents dependency on external CDNs for the generated apps.

## LLM Awareness

The LLM is explicitly informed of the *exact* library versions installed. This prevents the model from hallucinating API methods that don't exist in the current version or using outdated patterns.

## Key Design Decisions

### DaisyUI as Primary CSS Framework

**DaisyUI v4** is the recommended component library because:
- It provides semantic component classes (`btn`, `card`, `modal`) that keep HTML clean
- It pairs perfectly with the **Tailwind CSS** script for utility classes (`flex`, `p-4`)
- It offers a rich set of pre-designed components without enforcing a specific JS framework
- It simplifies creating modern, responsive interfaces quickly

### Phaser Instead of Kaboom/Kaplay

**Phaser v3** replaced Kaboom/Kaplay for game development because:
- Phaser's API has been **stable since ~2018**—LLMs know it perfectly
- Kaboom v3000 introduced breaking API changes that LLMs often hallucinate incorrectly
- Phaser generates **almost always correct code** with minimal hallucination
- Ships as a single browser-ready file (`phaser.min.js`)

