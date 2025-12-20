import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';

// ... existing code ...

const NPM_MAPPING: Record<string, string> = {
  // Core & UI
  'alpine.js': 'alpinejs/dist/cdn.min.js',
  // 'anime.min.js' removed; handled by bundleLib explicitly to avoid UMD issues
  'animate.min.css': 'animate.css/animate.min.css',
  'aos.js': 'aos/dist/aos.js',
  'aos.css': 'aos/dist/aos.css',
  'bootstrap.min.css': 'bootstrap/dist/css/bootstrap.min.css',
  'bootstrap.bundle.min.js': 'bootstrap/dist/js/bootstrap.bundle.min.js',
  'bootstrap-icons.css': 'bootstrap-icons/font/bootstrap-icons.min.css',
  'cleave.min.js': 'cleave.js/dist/cleave.min.js',
  'confetti.browser.min.js': 'canvas-confetti/dist/confetti.browser.js',
  'flowbite': 'flowbite',
  'driver.min.js': 'driver.js/dist/driver.js.iife.js',
  'driver.min.css': 'driver.js/dist/driver.css',
  'FileSaver.min.js': 'file-saver/dist/FileSaver.min.js',
  'flatpickr.min.js': 'flatpickr/dist/flatpickr.min.js',
  'flatpickr.min.css': 'flatpickr/dist/flatpickr.min.css',
  'hammer.min.js': 'hammerjs/hammer.min.js',
  'hint.min.css': 'hint.css/hint.min.css',
  'hotkeys.min.js': 'hotkeys-js/dist/hotkeys-js.min.js',
  'materialize.min.css': 'materialize-css/dist/css/materialize.min.css',
  'materialize.min.js': 'materialize-css/dist/js/materialize.min.js',
  'material-icons.css': 'material-icons/iconfont/material-icons.css',
  'phaser.min.js': 'phaser/dist/phaser.min.js',
  'daisyui.css': 'daisyui/dist/full.css',
  'lucide.min.js': 'lucide/dist/umd/lucide.min.js',
  'minidenticons.min.js': 'minidenticons/minidenticons.min.js',
  'nes.min.css': 'nes.css/css/nes.min.css',
  'normalize.min.css': 'normalize.css/normalize.css',
  'numeral.min.js': 'numeral/min/numeral.min.js',
  'pico.min.css': '@picocss/pico/css/pico.min.css',
  'popper.min.js': '@popperjs/core/dist/umd/popper.min.js',
  'rellax.min.js': 'rellax/rellax.min.js',
  'rough-notation.iife.js': 'rough-notation/lib/rough-notation.iife.js',
  'shoelace': '@shoelace-style/shoelace', /* Special Handling */
  'spectre.min.css': 'spectre.css/dist/spectre.min.css',
  'sortable.min.js': 'sortablejs/Sortable.min.js',
  'swiper-element.min.js': 'swiper/swiper-element-bundle.min.js',
  'tippy': 'tippy.js/dist/tippy-bundle.umd.min.js',
  'typewriter.js': 'typewriter-effect/dist/core.js',
  'uikit.min.css': 'uikit/dist/css/uikit.min.css',
  'uikit.min.js': 'uikit/dist/js/uikit.min.js',
  'uikit-icons.min.js': 'uikit/dist/js/uikit-icons.min.js',
  'winbox': 'winbox/dist/winbox.bundle.min.js',
  'sweetalert2.all.min.js': 'sweetalert2/dist/sweetalert2.all.min.js',
  'bulma.min.css': 'bulma/css/bulma.min.css',
  'toastify.js': 'toastify-js/src/toastify.js',
  'toastify.css': 'toastify-js/src/toastify.css',
  'zdog.dist.min.js': 'zdog/dist/zdog.dist.min.js',

  // Data / Math / Charts
  'chart.umd.js': 'chart.js/dist/chart.umd.js',
  'dayjs.min.js': 'dayjs/dayjs.min.js',
  'gridjs.umd.js': 'gridjs/dist/gridjs.umd.js',
  'theme-mermaid.min.css': 'gridjs/dist/theme/mermaid.min.css',
  'mermaid.min.js': 'mermaid/dist/mermaid.min.js',
  'prism.js': 'prismjs/prism.js',
  'prism-tomorrow.css': 'prismjs/themes/prism-tomorrow.css',
  'Tone.js': 'tone/build/Tone.js',
  'htmx.min.js': 'htmx.org/dist/htmx.min.js',
  'hyperscript.min.js': 'hyperscript.org/dist/_hyperscript.min.js',
  'fontawesome.min.css': '@fortawesome/fontawesome-free/css/all.min.css',
  // three.module.js handled specially explicitly to copy full build dir

  // Complex Assets
  'katex': 'katex',
  'leaflet': 'leaflet',
  'font-inter': '@fontsource/inter',
  'font-jetbrains': '@fontsource/jetbrains-mono',
  'font-press-start': '@fontsource/press-start-2p',
  'font-playfair': '@fontsource/playfair-display',
  'font-roboto': '@fontsource/roboto',
  'font-poppins': '@fontsource/poppins',
  'font-fira-code': '@fontsource/fira-code',
  'font-lora': '@fontsource/lora',
  'font-merriweather': '@fontsource/merriweather',
  'font-montserrat': '@fontsource/montserrat',
  'font-oswald': '@fontsource/oswald',
  'font-raleway': '@fontsource/raleway',
  'font-dm-sans': '@fontsource/dm-sans',
  'font-manrope': '@fontsource/manrope',
  'font-space-grotesk': '@fontsource/space-grotesk',
  'font-ibm-plex-sans': '@fontsource/ibm-plex-sans',
};

const DEST_DIR = path.resolve(process.cwd(), 'frontend/public/libs');
const MODULES_DIR = path.resolve(process.cwd(), 'frontend/node_modules');
const VERSIONS_FILE = path.resolve(process.cwd(), 'src/config/generated-lib-versions.ts');
const FRONTEND_PACKAGE_JSON = path.resolve(process.cwd(), 'frontend/package.json');
const FRONTEND_PACKAGE_LOCK = path.resolve(process.cwd(), 'frontend/package-lock.json');

const libVersions: Record<string, string> = {};

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function copyFolderSync(from: string, to: string, exclude?: (name: string) => boolean): void {
  ensureDir(to);
  fs.readdirSync(from).forEach((element) => {
    if (exclude && exclude(element)) {
      return;
    }
    const sourcePath = path.join(from, element);
    const targetPath = path.join(to, element);
    const stat = fs.lstatSync(sourcePath);
    if (stat.isFile()) {
      fs.copyFileSync(sourcePath, targetPath);
    } else if (stat.isDirectory()) {
      copyFolderSync(sourcePath, targetPath, exclude);
    }
  });
}

function derivePackageName(modulePath: string): string | null {
  if (!modulePath) {
    return null;
  }
  if (modulePath.startsWith('@')) {
    const segments = modulePath.split('/');
    return segments.length >= 2 ? `${segments[0]}/${segments[1]}` : modulePath;
  }
  const [pkgName] = modulePath.split('/');
  return pkgName || null;
}

function deriveLibKey(packageName: string | null, destName: string): string {
  if (packageName) {
    const normalizedPackage = packageName
      .replace(/^@fontsource\//, '')
      .replace(/^@/, '')
      .replace(/\.js$/i, '')
      .replace(/\.css$/i, '')
      .replace(/\//g, '-');
    return normalizedPackage.toLowerCase();
  }

  return destName
    .replace(/^font-/, '')
    .replace(/\.min/gi, '')
    .replace(/\.(js|css)$/gi, '')
    .replace(/[.]/g, '-')
    .toLowerCase();
}

function getPackageVersion(modulePath: string): { version: string; packageName: string | null } {
  const packageName = derivePackageName(modulePath);
  if (!packageName) {
    return { version: 'unknown', packageName: null };
  }
  try {
    const pkgJsonPath = path.join(MODULES_DIR, packageName, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
      return { version: pkg.version ?? 'unknown', packageName };
    }
    if (fs.existsSync(FRONTEND_PACKAGE_LOCK)) {
      const packageLock = JSON.parse(fs.readFileSync(FRONTEND_PACKAGE_LOCK, 'utf-8'));
      const lockEntry = packageLock.packages?.[`node_modules/${packageName}`];
      if (lockEntry?.version) {
        return { version: lockEntry.version, packageName };
      }
    }
    if (fs.existsSync(FRONTEND_PACKAGE_JSON)) {
      const manifest = JSON.parse(fs.readFileSync(FRONTEND_PACKAGE_JSON, 'utf-8'));
      const declaredVersion =
        manifest.dependencies?.[packageName] ?? manifest.devDependencies?.[packageName];
      if (declaredVersion) {
        return { version: declaredVersion, packageName };
      }
    }
  } catch {
    return { version: 'latest', packageName };
  }
  return { version: 'unknown', packageName };
}



async function bundleLib(packageName: string, entryFile: string, destFilename: string, globalName?: string): Promise<void> {
  const { version } = getPackageVersion(packageName);
  const libKey = deriveLibKey(packageName, destFilename);
  libVersions[libKey] = version; // Store version

  const versionedDestDir = path.join(DEST_DIR, libKey, version);
  ensureDir(versionedDestDir);

  const outFile = path.join(versionedDestDir, destFilename);

  if (fs.existsSync(outFile)) {
    return;
  }

  const entryPath = path.join(MODULES_DIR, packageName, entryFile);
  if (!fs.existsSync(entryPath)) {
    console.warn(`⚠️ Skipping bundle for ${packageName}: entry ${entryPath} not found.`);
    return;
  }

  try {
    await build({
      entryPoints: [entryPath],
      outfile: outFile,
      bundle: true,
      minify: true,
      format: 'iife',
      globalName: globalName,
      platform: 'browser',
      define: {
        global: 'window', // Polyfill global for browser
      },
    });
    console.log(`📦 Bundled ${packageName} to ${path.relative(process.cwd(), outFile)}`);
  } catch (err) {
    console.error(`❌ Failed to bundle ${packageName}:`, err);
  }
}

async function main(): Promise<void> {
  ensureDir(DEST_DIR);

  /*
   * Tailwind CSS (Runtime)
   * 
   * We use v3.4.1 because v4's "Layer Trap" (putting utilities in @layer)
   * causes specificity issues when combined with unlayered resets,
   * which LLMs often fail to account for.
   * 
   * Downloaded from CDN on first build if not present in vendors/
   */
  const tailwindVersion = '3.4.1';
  libVersions.tailwind = tailwindVersion;
  const tailwindDir = path.join(DEST_DIR, 'tailwind', tailwindVersion);
  ensureDir(tailwindDir);

  const vendorDir = path.resolve(process.cwd(), 'vendors/tailwind');
  ensureDir(vendorDir);
  const tailwindVendorPath = path.join(vendorDir, `tailwind-${tailwindVersion}.js`);
  const tailwindDest = path.join(tailwindDir, 'tailwind.js');

  // Download from CDN if not already vendored
  if (!fs.existsSync(tailwindVendorPath)) {
    console.log(`📥 Downloading Tailwind CSS v${tailwindVersion} from CDN...`);
    const url = `https://cdn.tailwindcss.com/${tailwindVersion}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`❌ Failed to download Tailwind CSS from ${url}`);
      process.exit(1);
    }
    const content = await response.text();
    fs.writeFileSync(tailwindVendorPath, content);
    console.log(`✅ Saved to vendors/tailwind/`);
  }

  console.log(`📦 Copying Tailwind CSS v${tailwindVersion} from vendors/`);
  fs.copyFileSync(tailwindVendorPath, tailwindDest);

  // Special bundling for GeoPattern (no browser build in package)
  // Dynamic versioning handled inside bundleLib
  await bundleLib('geopattern', 'geopattern.js', 'geopattern.min.js', 'GeoPattern');

  // Special bundling for ms (CJS only)
  await bundleLib('ms', 'index.js', 'ms.js', 'ms');

  // Use official UMD build for AnimeJS (v4+)
  const animeVersion = getPackageVersion('animejs').version;
  libVersions['animejs'] = animeVersion;
  const animeDestDir = path.join(DEST_DIR, 'animejs', animeVersion);
  ensureDir(animeDestDir);
  const animeSrc = path.resolve(MODULES_DIR, 'animejs/dist/bundles/anime.umd.min.js');
  fs.copyFileSync(animeSrc, path.join(animeDestDir, 'anime.min.js'));

  // Special copy for Three.js (needs full build dir for relative imports)
  const threeVer = getPackageVersion('three').version;
  libVersions['three'] = threeVer;
  ensureDir(path.join(DEST_DIR, 'three', threeVer));
  copyFolderSync(path.join(MODULES_DIR, 'three/build'), path.join(DEST_DIR, 'three', threeVer));

  // Special copy for Lit and its dependencies (needed for resolution)
  const litPackages = ["lit", "lit-html", "lit-element", "@lit/reactive-element"];
  for (const pkg of litPackages) {
    try {
      const version = getPackageVersion(pkg).version;
      libVersions[pkg] = version;
      // Handle scoped packages like @lit/reactive-element -> @lit/reactive-element/version
      // path.join with package name works fine
      const pkgSrc = path.join(MODULES_DIR, ...pkg.split("/"));
      const pkgDest = path.join(DEST_DIR, ...pkg.split("/"), version);

      ensureDir(pkgDest);
      copyFolderSync(pkgSrc, pkgDest);
    } catch (e) {
      console.warn(`Warning: Could not copy ${pkg}`, e);
    }
  }

  for (const [destName, srcPath] of Object.entries(NPM_MAPPING)) {
    const fullSrc = path.join(MODULES_DIR, srcPath);
    const { version, packageName } = getPackageVersion(srcPath);
    const libKey = deriveLibKey(packageName, destName);

    if (!libVersions[libKey]) {
      libVersions[libKey] = version;
    }

    if (!fs.existsSync(fullSrc)) {
      console.warn(`⚠️ Skipping ${destName}: source ${fullSrc} not found.`);
      continue;
    }

    const versionedDestDir = path.join(DEST_DIR, libKey, version);
    ensureDir(versionedDestDir);

    if (destName.startsWith('font-')) {
      // Fontsource optimization: Only copy Latin subsets and main CSS
      const fontName = destName.replace('font-', '');
      copyFolderSync(fullSrc, versionedDestDir, (name) => {
        // Exclude non-latin font files
        if (name.endsWith('.woff2') || name.endsWith('.woff') || name.endsWith('.ttf')) {
          return !name.includes('latin');
        }
        // Exclude scss, regional css files (we only want index.css or latin-specific ones if needed)
        if (name.endsWith('.css')) {
          return name !== 'index.css' && !name.includes('latin');
        }
        // Exclude other regional metadata
        const skipDirs = ['scss', 'scripts'];
        if (skipDirs.includes(name)) return true;

        return false;
      });
      continue;
    }

    if (destName === 'tippy') {
      // tippy.js structure:
      // fullSrc points to dist/tippy-bundle.umd.min.js
      // We need:
      // - dist/tippy-bundle.umd.min.js -> tippy.min.js
      // - dist/tippy.css -> tippy.css
      // - animations/ -> animations/
      // - themes/ -> themes/

      const pkgRoot = path.resolve(fullSrc, '../../'); // Go up from dist/file.js to root

      // Copy JS
      fs.copyFileSync(fullSrc, path.join(versionedDestDir, 'tippy.min.js'));

      // Copy Core CSS
      const cssSrc = path.join(pkgRoot, 'dist/tippy.css');
      if (fs.existsSync(cssSrc)) {
        fs.copyFileSync(cssSrc, path.join(versionedDestDir, 'tippy.css'));
      }

      // Copy Animations
      const animSrc = path.join(pkgRoot, 'animations');
      if (fs.existsSync(animSrc)) {
        copyFolderSync(animSrc, path.join(versionedDestDir, 'animations'));
      }

      // Copy Themes
      const themeSrc = path.join(pkgRoot, 'themes');
      if (fs.existsSync(themeSrc)) {
        copyFolderSync(themeSrc, path.join(versionedDestDir, 'themes'));
      }
      continue;
    }

    if (destName === 'winbox') {
      // winbox.bundle.min.js is mapped (via 'winbox' key), so fullSrc is correct.
      // We just need to copy it to the right destination filename.
      fs.copyFileSync(fullSrc, path.join(versionedDestDir, 'winbox.bundle.min.js'));
      continue;
    }

    if (destName === 'leaflet') {
      fs.copyFileSync(path.join(fullSrc, 'dist/leaflet.js'), path.join(versionedDestDir, 'leaflet.js'));
      fs.copyFileSync(path.join(fullSrc, 'dist/leaflet.css'), path.join(versionedDestDir, 'leaflet.css'));
      // Leaflet expects images relative to css
      copyFolderSync(path.join(fullSrc, 'dist/images'), path.join(versionedDestDir, 'images'));
      continue;
    }

    if (destName === 'katex') {
      fs.copyFileSync(path.join(fullSrc, 'dist/katex.min.js'), path.join(versionedDestDir, 'katex.min.js'));
      fs.copyFileSync(path.join(fullSrc, 'dist/katex.min.css'), path.join(versionedDestDir, 'katex.min.css'));
      copyFolderSync(path.join(fullSrc, 'dist/fonts'), path.join(versionedDestDir, 'fonts'));
      continue;
    }

    if (destName === 'shoelace') {
      // User requested to ONLY use the cdn package
      const cdnSrc = path.join(fullSrc, 'cdn');
      if (fs.existsSync(cdnSrc)) {
        copyFolderSync(cdnSrc, versionedDestDir);
      } else {
        console.warn(`Warning: Shoelace CDN directory not found at ${cdnSrc}`);
      }
      continue;
    }

    if (destName === 'flowbite') {
      // Copy the entire dist folder for full Flowbite support
      const distSrc = path.join(fullSrc, 'dist');
      if (fs.existsSync(distSrc)) {
        copyFolderSync(distSrc, versionedDestDir);
      } else {
        console.warn(`Warning: Flowbite dist directory not found at ${distSrc}`);
      }
      continue;
    }

    if (destName === 'bootstrap-icons.css') {
      // Copy the css file
      fs.copyFileSync(fullSrc, path.join(versionedDestDir, 'bootstrap-icons.css'));
      // Copy the fonts directory (sibling to css in module)
      const fontsSrc = path.join(path.dirname(fullSrc), 'fonts');
      if (fs.existsSync(fontsSrc)) {
        copyFolderSync(fontsSrc, path.join(versionedDestDir, 'fonts'));
      }
      continue;
    }

    if (destName === 'material-icons.css') {
      // Material icons has css and woff2 files in the same dir. Copy everything.
      // But we mapped fullSrc to the css file. So get dirname.
      copyFolderSync(path.dirname(fullSrc), versionedDestDir);
      continue;
    }

    if (destName === 'fontawesome.min.css') {
      // Font Awesome needs both the CSS and the webfonts directory
      fs.copyFileSync(fullSrc, path.join(versionedDestDir, 'fontawesome.min.css'));
      const webfontsSrc = path.join(path.dirname(path.dirname(fullSrc)), 'webfonts');
      if (fs.existsSync(webfontsSrc)) {
        copyFolderSync(webfontsSrc, path.join(versionedDestDir, 'webfonts'));
      }
      continue;
    }

    // Standard single file copy
    const destFile = path.join(versionedDestDir, destName);
    fs.copyFileSync(fullSrc, destFile);
  }

  const fileContent = `// AUTO-GENERATED BY scripts/copy-libs.ts\nexport const LIB_VERSIONS: Record<string, string> = ${JSON.stringify(libVersions, null, 2)};`;
  fs.writeFileSync(VERSIONS_FILE, `${fileContent}\n`);
  console.log('✅ Libraries copied & versions generated.');
}

main().catch((error) => {
  console.error('❌ Failed to copy libraries', error);
  process.exitCode = 1;
});
