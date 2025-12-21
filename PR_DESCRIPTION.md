# ✨ Download Tour: Export Sessions as Interactive Clickthrough Prototypes

## Summary

Adds a new "Download Tour" feature that exports your VaporVibe session as a **self-contained HTML file** with an embedded **Driver.js walkthrough**. The tour replays the user's exact journey with typing animations, simulated button clicks, and view transitions—all bundled into a single shareable file.

Perfect for stakeholder demos or handing off to designers who want to experience the UX flow without running the server.

---

## 🎯 Features

### Clickthrough Prototype Export
- **One-click export** from the History tab in the Admin Console
- **Self-contained HTML** — runs offline, no server required
- **Driver.js integration** — guided step-by-step walkthrough
- **Typing animations** — replays exact user input character-by-character
- **Simulated interactions** — button clicks, form submissions, view transitions
- **Visual fidelity** — preserves exact CSS classes, layout, and AI-generated images

### Improved Export UI
- Redesigned History Snapshot Controls with card-based layout
- Featured "Clickthrough Tour" export option with loading state
- Cleaner import/export section organization

### Setup Wizard Reordering
- Brief step now comes **before** Provider step
- Users describe what they want to build first, then configure their LLM provider

---

## 🔧 Technical Changes

### Backend
- **`src/llm/messages.ts`** — New `tourMode` prompt branch with SPA consolidation rules
- **`src/utils/html-export-transform.ts`** — CDN mapping for `/libs/*` paths to jsDelivr/unpkg
- **`src/utils/image-reencoder.ts`** — Smart image recompression using Sharp:
  - Converts non-alpha images to JPEG (target: <200KB each)
  - Detects and preserves actual transparency in PNGs
  - Logs compression savings (typically 40-70% reduction)
- **`src/utils/extract-ai-images.ts`** — Extracts `<ai-image>` tags from generated HTML
- **`src/image-gen/retry.ts`** — Exponential backoff retry for image generation APIs
- **`src/server/admin-controller.ts`** — New `/api/project/:id/generate-tour` endpoint
- **`src/config/runtime-config.ts`** — Exported `lookupEnvApiKey` helper

### Frontend
- **`frontend/src/api/admin.ts`** — `downloadClickthroughPrototype()` function
- **`frontend/src/components/HistorySnapshotControls.tsx`** — Redesigned export cards UI
- **`frontend/src/pages/AdminDashboard.tsx`** — Tour download handler, setup step reordering
- **`frontend/src/api/types.ts`** — Added `primarySessionId` and `exportTourUrl` to state

### Documentation
- **`docs/architecture/download-tour.md`** — Comprehensive feature guide (500+ lines)
- **`AGENTS.md`** — Updated with tour mode documentation
- **`README.md`** — Feature highlight added
- **`scripts/update-rules.ts`** — Added download-tour and standard-library rule configs

### Scripts
- **`scripts/verify-cdn-urls.ts`** — Validate CDN URL mappings
- **`scripts/verify-cdn-content.ts`** — Compare local libs with CDN content

### Dependencies
- Added `sharp` for image processing (used for JPEG recompression)

---

## 📸 Screenshots

*(Add screenshots of the new export cards UI and a sample tour in action)*

---

## 🧪 Testing

- [ ] Manual: Export a session as clickthrough tour
- [ ] Manual: Open exported HTML offline, verify tour plays
- [ ] Manual: Verify typing animations and button clicks work
- [ ] Manual: Test setup wizard with Brief → Provider order
- [ ] `npm test` passes
- [ ] `npm run build` succeeds

---

## 📋 Checklist

- [x] Documentation updated (`AGENTS.md`, `README.md`, architecture docs)
- [x] Codebase map regenerated
- [x] Agent rules updated
- [x] Frontend builds successfully
- [x] No TypeScript errors
