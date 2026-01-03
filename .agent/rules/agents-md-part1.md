---
trigger: always_on
globs: **/*
---

# Content from AGENTS.md

# Agent Onboarding Guide: VaporVibe

Welcome! This guide provides the high-level context, architectural details, and philosophical principles needed to understand and contribute to the `VaporVibe` repository. 🤖

> [!IMPORTANT]
> **READ THIS FIRST**: Before starting any task, you MUST read the [Architecture Guide](docs/ARCHITECTURE.md) and the [Codebase Map](docs/CODEBASE_MAP.md) to understand the system structure and core concepts.

## 📚 Documentation Index
-   **[Architecture Guide](docs/ARCHITECTURE.md)**: High-level concepts (A/B Testing, Virtual REST API, etc.).
-   **[Codebase Map](docs/CODEBASE_MAP.md)**: File structure and dependency graph.
-   **[Module Docs](docs/modules/)**: Deep-dives into specific files.

---

## 1. Core Concept & Purpose

`VaporVibe` is a "vibe non-coding" experiment where an LLM improvises an entire interactive web application on every request based on a simple, natural language **brief**.

- **Primary Goal**: To function as a "rapid-prototyping cheat code," allowing you to validate a UX flow or interaction idea without writing any frontend or backend code.
- **Core Philosophy**: It's an "intentionally unserious" and "cheeky thought experiment". The joy is in watching the model "make it up as it goes," embracing the creative chaos of generative AI.
- **Key Feature**: It supports multiple LLM providers (OpenAI, Google Gemini, Anthropic, xAI Grok, Groq, and OpenRouter), allowing you to see how different models interpret the same brief.
- **Image Generation**: It can generate images on the fly using OpenAI (DALL-E, GPT Image 1.5), Google (Imagen, Nano Banana, Nano Banana Pro), or OpenRouter (Flux, Gemini via OpenRouter) models, caching them in memory to prevent redundant costs.

---

## 2. Architecture & Request Flow

The system operates on a request-response cycle involving the backend server, a React SPA for admin/setup, and an external LLM provider for app generation.

### The Vibe-Driven App Request Cycle 🌀

This loop renders the _application_ pages once the server is configured.

```mermaid
graph TD
    subgraph Browser (User App View)
        A[User Clicks Link or Submits Form] --> B;
        H[Page Re-renders with LLM HTML] --> A;
    end

    subgraph "VaporVibe Server (Node.js)"
        B(HTTP Request Receives) --> C[Assembles Prompt<br/>- App Brief<br/>- Request Details<br/>- Session History<br/>- REST API State];
        C --> D{LLM Provider API};
        E --> F[Updates Session History];
        F --> G(Sends HTML Response with Injected Scripts);
    end

    subgraph "LLM Provider"
      D -- Sends Prompt --> LLM[OpenAI / Gemini / Anthropic / Grok / Groq / OpenRouter];
      LLM -- Generates Full HTML --> E(Receives HTML);
    end

    G --> H;
```

1.  A user action in the browser sends an HTTP request (`GET` or `POST`) to the `VaporVibe` server.
2.  The server assembles a detailed prompt (`src/llm/messages.ts`) containing the app brief, request details (method, path, query, body), relevant session history, and recent REST API interaction state.
3.  This prompt is sent to the configured LLM provider's API.
4.  The LLM generates a complete, self-contained HTML document for the requested view.
5.  The server receives the HTML, updates the session history (`src/server/session-store.ts`), injects helper scripts (`vaporvibe-interceptor.js`, `vaporvibe-instructions-panel.js`), and sends the final HTML back to the browser.

### The Setup & Configuration Flow ✨ (React SPA)

When first launched, the server guides the user through a browser-based setup wizard served by the React SPA.

1.  The CLI launches the server and opens a browser to `http://localhost:3000/__setup`.
2.  The React SPA (`frontend/src/pages/SetupWizard.tsx`) prompts the user to select a provider and enter an API key.
3.  The SPA sends the key to the backend (`POST /api/admin/provider/verify`) for verification against the provider's API.
4.  Once verified, the SPA prompts for the initial application **brief**.
5.  The SPA submits the brief to the backend (`POST /api/admin/brief`).
6.  On success, the SPA automatically opens the application root (`/`) in a **new browser tab** and displays a "launch pad" overlay. The original tab remains on the Admin Console SPA (`/vaporvibe`).

### The Admin Console Flow 🕹️ (React SPA)

The admin console at `/vaporvibe` is a **React SPA** (built in `frontend/`) serving as the control center.

- **SPA Interaction**: All interactions (viewing state, updating brief/provider/runtime settings, browsing history, importing/exporting) are handled client-side within the React application.
- **API Driven**: The SPA communicates with the backend exclusively through **JSON API endpoints** under `/api/admin/*`. The backend no longer renders any admin HTML directly.
- **Live Controls**: Tweak the global brief, manage attachments, adjust history limits, switch providers/models, and update API keys via API calls without restarting the server.
- **History Explorer**: Inspect every generated page (including REST API interactions), view token usage, raw HTML, and model reasoning traces fetched via `/api/admin/history`.
- **A/B Comparisons (Forks)**: Initiate side-by-side experiments to compare alternative instructions, review the A/B workspace, and merge or discard branches when ready.
- **Import/Export**: Download session snapshots (`GET /api/admin/history.json`) or prompt markdown (`GET /api/admin/history.md`). Upload snapshots via drag-drop (`POST /api/admin/history/import`). Certain actions (exports, purging) are temporarily disabled while a fork is in progress to avoid state conflicts.
- **Download Tour (Clickthrough Prototypes)**: Export the session as a self-contained HTML file featuring an animated Driver.js walkthrough. The LLM consolidates all history into a single-page application, replaying the user's exact click path with typing animations and simulated interactions. See [Download Tour Architecture](#download-tour-clickthrough-prototypes) for technical details.

---

## 3\. Project Philosophy & Vibe

This is not a traditional software project; it's a creative tool. The "vibe" is crucial.

### Guiding Principles ("Vibe Non-Coding")

- **Improvised & Playful**: Embrace the "chaos" of the LLM's creativity. Slight variations between renders are a feature, not a bug. Focus prompts on guiding the creative process, not enforcing rigid structures. The goal is plausible improvisation.
- **High-Fidelity Prototyping**: The generated output should look and feel like a real application, using convincing, non-placeholder data to make the experience feel complete.
- **Delightful & Modern**: The system prompt explicitly asks the LLM to craft a "gorgeous, modern UX" with "joyful" and "accessible" interactions.
- **Embrace Imperfection**: Minor inconsistencies or creative deviations by the LLM between renders are acceptable and part of the experiment.

### Visual & Interaction Design

- **Aesthetics**: The tool's own admin UI (React SPA) favors a clean, modern look. This aesthetic should inspire the generated output.
- **Latency as an Experience**: Server round-trips for LLM generation are slow (30s to 3m). The project uses entertaining loading animations and status messages (`src/views/loading-shell/`) to manage this wait.
- **Micro-interactions**: Simple in-page interactions (modals, tabs, local data filtering) should be handled with inline client-side JavaScript within the LLM-generated HTML, without server requests.
- **Major Navigations**: Any action requiring a change in core data or view logic **must** trigger a full page reload via a standard `<a>` link or `<form>` submission, which is intercepted to show the loading overlay.

---

## 4\. Style and Brand Guide 🎨 (VaporVibe Admin UI Only)

> **⚠️ IMPORTANT**: This section applies **ONLY to the VaporVibe admin UI codebase** (`frontend/`). It is **NOT** a prescription for LLM-generated apps. Generated apps should match whatever aesthetic the user's brief calls for — minimalist, brutalist, playful, corporate, retro, or any other style. The LLM has full creative freedom to interpret the user's vision.

This section defines the desired visual style, UI patterns, and overall user experience for the **VaporVibe admin console and setup wizard**. These guidelines help maintain consistency when contributing to the `frontend/` codebase.

### Overall Philosophy & Vibe

- **Feeling:** The admin UI should feel **modern, clean, intuitive, and slightly playful**. The experience should be engaging and polished. Prioritize **clarity and usability** over visual density.
- **Goal:** Create a professional, trustworthy interface for managing VaporVibe sessions.
- **Heuristics:**
  - **Simplicity First:** Start with clear layouts and essential elements.
  - **Convention over Configuration:** Use familiar web patterns (buttons, forms, cards).
  - **Accessibility Matters:** Aim for semantic HTML, keyboard navigability, sufficient contrast, and clear focus states.

### Visual Language

- **Colors:**
  - **Base:** Use a light, clean background (whites, very light grays). Text should be dark gray or black for readability.
  - **Accent:** Employ a primary accent color (like the admin UI's blue: `#1d4ed8`, `#2563eb`) for interactive elements (buttons, links, active states). Use it purposefully.
  - **Semantic:** Use conventional colors for status: green for success/confirmation, red for errors/danger, yellow/orange for warnings/pending states.
  - **Neutrals:** Use a range of grays for borders, secondary text, and disabled states (`#475569`, `#64748b`, `#94a3b8`, `#e2e8f0`).
  - _Reference:_ `frontend/src/pages/AdminDashboard.css` variables and component styles.
- **Typography:**
  - **Font:** Primarily use **system UI fonts** (`system-ui`, `-apple-system`, `Segoe UI`, `sans-serif`) for broad compatibility and a native feel. `Inter` is used in the admin UI.
  - **Hierarchy:** Establish clear visual hierarchy using font size (e.g., larger for headings) and weight (e.g., `600` or `700` for titles/buttons).
  - **Readability:** Ensure sufficient line height (e.g., `1.5` or `1.6`) and keep text lines reasonably short.
  - _Reference:_ `frontend/src/pages/AdminDashboard.css` body styles.
- **Spacing:** Use generous spacing (padding, margins) to create a breathable, uncluttered layout. Consistent spacing units are preferred.
  - _Reference:_ Padding values in `AdminDashboard.css` (e.g., `clamp(24px, 4vw, 32px)`).
- **Borders & Shadows:**
  - **Borders:** Use light gray borders (`rgba(148, 163, 184, 0.3-0.4)`) sparingly, primarily on containers (cards, inputs) or interactive elements needing definition. Dashed borders can indicate dropzones or placeholders.
  - **Rounding:** Apply consistent, medium-to-large corner rounding (`border-radius`) to containers, buttons, and inputs (e.g., `16px`, `24px`) for a softer, modern look. Use `999px` for pills/fully rounded elements.
  - **Shadows:** Use subtle box shadows (`box-shadow`) to lift elements like cards and buttons off the background, enhancing depth. Hover/active states can intensify shadows slightly.
  - _Reference:_ `admin-card`, `setup-card`, `tabbed-card`, button styles.

### Core UI Patterns

- **Layout:** Use CSS Grid or Flexbox for clean, responsive layouts. Center content within main containers.
  - _Reference:_ `admin-shell`, `model-selector__body`.
- **Containers/Cards:** Group related content within rounded panels/cards with white/light backgrounds, subtle borders, and shadows. Use padding generously inside containers.
  - _Reference:_ `.admin-card`, `.panel`, `.setup-card`.
- **Forms:**
  - **Layout:** Stack labels clearly above their corresponding inputs. Group related fields logically.