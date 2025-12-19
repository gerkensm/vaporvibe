# VaporVibe Standard Library

VaporVibe includes a "Standard Library" of ~30 popular UI and utility libraries that are available offline. These libraries are automatically managed, version-detected, and injected into the LLM's system prompt to ensure consistent and high-quality generation.

## How it Works

1. **Build Time**: The `scripts/copy-libs.ts` script runs. It copies assets from `node_modules` into `frontend/public/libs` and extracts the installed version numbers.
2. **Version Mapping**: It generates `src/config/generated-lib-versions.ts` with a map of package names to versions.
3. **Manifest**: `src/config/library-manifest.ts` defines the metadata for each library (description, tags, injection rule).
4. **Injection**: When generating a page, the server iterates through the manifest and includes the library definitions (including versions) in the system prompt.
5. **Serving**: The backend handles the `/libs/*` route to serve these assets with correct MIME types and caching headers.

## Library Catalog

The following libraries are included:

- **Core & Reactivity**: Tailwind CSS (CDN standalone), Alpine.js.
- **UI & Interaction**: AOS (Animate on Scroll), Anime.js, Animate.css, Cleave.js, Canvas Confetti, Driver.js, Flatpickr, GeoPattern, Hammer.js, Hint.css, Hotkeys.js, Lucide Icons, Minidenticons, NES.css, Normalize.css, Pico.css, Popper.js, Rellax, Rough Notation, Sortable.js, Swiper, Tippy.js, Typewriter-effect, WinBox.
- **Data & Charts**: Chart.js, Day.js, FileSaver.js, Grid.js, Mermaid.js, ms, Numeral.js, Prism.js, Tone.js, Three.js, Zdog, Kaboom.js.
- **Complex Assets**: Leaflet (Maps), KaTeX (Math).
- **Fonts**: Inter, JetBrains Mono, Press Start 2P, Playfair Display, Roboto, Poppins, Fira Code.

## Adding a New Library

To add a library to the Standard Library:

1. **Install with NPM**: Run `npm install --prefix frontend <package-name>`.
2. **Update Copy Script**: Add the library to `NPM_MAPPING` in `scripts/copy-libs.ts`.
   - If it needs subfolders (like images/fonts), add a special case in the `main` function.
3. **Update Manifest**: Add the library entry to `VAPORVIBE_LIBRARIES` in `src/config/library-manifest.ts`.
4. **Rebuild**: Run `npm run copy:libs`.

## Offline Usage

All libraries are served from the local `/libs/` route. This ensures VaporVibe works entirely offline (once models are cached or if using a local provider) and prevents dependency on external CDNs for the generated apps.

## LLM Awareness

The LLM is explicitly informed of the *exact* library versions installed. This prevents the model from hallucinating API methods that don't exist in the current version or using outdated patterns.
