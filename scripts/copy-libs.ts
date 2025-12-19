import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';

// ... existing code ...

const NPM_MAPPING: Record<string, string> = {
  // Core & UI
  'alpine.js': 'alpinejs/dist/cdn.min.js',
  'anime.min.js': 'animejs/dist/bundles/anime.umd.min.js', // Removed, handled by bundleLib
  'animate.min.css': 'animate.css/animate.min.css',
  'aos.js': 'aos/dist/aos.js',
  'aos.css': 'aos/dist/aos.css',
  'cleave.min.js': 'cleave.js/dist/cleave.min.js',
  'confetti.browser.min.js': 'canvas-confetti/dist/confetti.browser.js',
  'driver.min.js': 'driver.js/dist/driver.js.iife.js',
  'driver.min.css': 'driver.js/dist/driver.css',
  'FileSaver.min.js': 'file-saver/dist/FileSaver.min.js',
  'flatpickr.min.js': 'flatpickr/dist/flatpickr.min.js',
  'flatpickr.min.css': 'flatpickr/dist/flatpickr.min.css',
  'hammer.min.js': 'hammerjs/hammer.min.js',
  'hint.min.css': 'hint.css/hint.min.css',
  'hotkeys.min.js': 'hotkeys-js/dist/hotkeys-js.min.js',
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
  'sortable.min.js': 'sortablejs/Sortable.min.js',
  'swiper-element.min.js': 'swiper/swiper-element-bundle.min.js',
  'tippy.min.js': 'tippy.js/dist/tippy-bundle.umd.min.js',
  'typewriter.js': 'typewriter-effect/dist/core.js',
  'winbox.bundle.min.js': 'winbox/dist/winbox.bundle.min.js',
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

function copyFolderSync(from: string, to: string): void {
  ensureDir(to);
  fs.readdirSync(from).forEach((element) => {
    const sourcePath = path.join(from, element);
    const targetPath = path.join(to, element);
    const stat = fs.lstatSync(sourcePath);
    if (stat.isFile()) {
      fs.copyFileSync(sourcePath, targetPath);
    } else if (stat.isDirectory()) {
      copyFolderSync(sourcePath, targetPath);
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

async function downloadTailwind(targetPath: string): Promise<void> {
  const tailwindVersion = '3.4.1';
  libVersions.tailwind = tailwindVersion;
  if (fs.existsSync(targetPath)) {
    return;
  }

  try {
    const response = await fetch('https://cdn.tailwindcss.com/3.4.1');
    if (!response.ok || !response.body) {
      throw new Error(`Failed to download Tailwind CDN build: ${response.status} ${response.statusText}`);
    }

    const fileStream = fs.createWriteStream(targetPath);
    await finished(Readable.fromWeb(response.body as any).pipe(fileStream));
  } catch (error) {
    console.warn('⚠️ Could not download Tailwind CDN build, writing stub instead.', error);
    fs.writeFileSync(
      targetPath,
      `// Tailwind CDN build unavailable during copy. Version ${tailwindVersion} expected.\n`
    );
  }
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

  const tailwindPath = path.join(DEST_DIR, 'tailwind.js');
  await downloadTailwind(tailwindPath);

  // Special bundling for GeoPattern (no browser build in package)
  // Dynamic versioning handled inside bundleLib
  await bundleLib('geopattern', 'geopattern.js', 'geopattern.min.js', 'GeoPattern');

  // Special bundling for ms (CJS only)
  await bundleLib('ms', 'index.js', 'ms.js', 'ms');

  // Bundle AnimeJS (UMD build is flaky in browser)
  await bundleLib('animejs', 'dist/bundles/anime.esm.js', 'anime.min.js', 'anime');

  // Special copy for Three.js (needs full build dir for relative imports)
  const threeVer = getPackageVersion('three').version;
  libVersions['three'] = threeVer;
  ensureDir(path.join(DEST_DIR, 'three', threeVer));
  copyFolderSync(path.join(MODULES_DIR, 'three/build'), path.join(DEST_DIR, 'three', threeVer));

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
      const fontName = destName.replace('font-', '');
      copyFolderSync(fullSrc, versionedDestDir);
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
