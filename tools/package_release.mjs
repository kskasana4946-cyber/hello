#!/usr/bin/env node
// tools/package_release.mjs
// Compiles production client and packages standalone offline distribution zip archives.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const RELEASE_DIR = path.join(ROOT_DIR, 'release');
const OFFLINE_STAGE = path.join(RELEASE_DIR, 'stage-offline');
const PWA_STAGE = path.join(RELEASE_DIR, 'stage-pwa');

console.log('🏎️ Apex Grand Prix: Standalone Packaging & Release Generator');
console.log('=============================================================');

// 1. Build Production Client Bundle
console.log('📦 Step 1/4: Compiling production client with Vite...');
execSync('npm run build', { cwd: ROOT_DIR, stdio: 'inherit' });

// 2. Prepare Release Staging
console.log('🧹 Step 2/4: Preparing release staging directories...');
if (fs.existsSync(RELEASE_DIR)) {
  fs.rmSync(RELEASE_DIR, { recursive: true, force: true });
}
fs.mkdirSync(OFFLINE_STAGE, { recursive: true });
fs.mkdirSync(PWA_STAGE, { recursive: true });

// Offline README text
const offlineReadme = `APEX GRAND PRIX: UNCAPPED NEXT-GEN EDITION - STANDALONE OFFLINE
===================================================================

Thank you for downloading Apex Grand Prix!
No installation, terminal commands, or Node.js are required to play.

HOW TO PLAY ON YOUR COMPUTER:
-----------------------------
- WINDOWS:
  Double-click "play-windows.bat".
  Your default web browser (Edge, Chrome, Brave, etc.) will open
  automatically at http://localhost:8080 and the game starts immediately!

- MACOS:
  Double-click "play-mac.command".
  The game launches automatically in Safari or Chrome.

- LINUX:
  Double-click or run "./play-linux.sh" in your terminal.

ON MOBILE PHONES & TABLETS:
---------------------------
Visit https://kskasana4946-cyber.github.io/hello/ in Safari or Chrome,
then tap "Add to Home Screen" or "Install App" to play offline with
full-screen touch steering and pedals!
`;

// Helper: Copy Launchers and Documentation
function copyLaunchers(destDir) {
  const launchers = ['play-windows.bat', 'play-mac.command', 'play-linux.sh'];
  for (const launcher of launchers) {
    const src = path.join(ROOT_DIR, launcher);
    if (fs.existsSync(src)) {
      const dest = path.join(destDir, launcher);
      fs.copyFileSync(src, dest);
      try {
        fs.chmodSync(dest, 0o755);
      } catch {}
    }
  }
  fs.writeFileSync(path.join(destDir, 'README.txt'), offlineReadme, 'utf-8');
}

// 3. Assemble Offline Full Bundle
console.log('📂 Step 3/4: Assembling bundles...');

// A. Assemble PWA Lightweight Bundle (~5 MB)
console.log('  -> Assembling Lightweight Web PWA bundle...');
fs.cpSync(DIST_DIR, PWA_STAGE, { recursive: true });
copyLaunchers(PWA_STAGE);

// B. Assemble Full Offline Bundle (~700 MB with .pak assets)
console.log('  -> Assembling Full Offline Standalone bundle with .pak assets...');
fs.cpSync(DIST_DIR, OFFLINE_STAGE, { recursive: true });
copyLaunchers(OFFLINE_STAGE);

const assetsPakSrc = path.join(ROOT_DIR, 'assets', 'paks');
const assetsPakDest = path.join(OFFLINE_STAGE, 'assets', 'paks');
if (fs.existsSync(assetsPakSrc)) {
  console.log('  -> Bundling modular assets from assets/paks into offline release...');
  fs.mkdirSync(path.dirname(assetsPakDest), { recursive: true });
  fs.cpSync(assetsPakSrc, assetsPakDest, { recursive: true, dereference: true });
}

// Helper: Compress Directory into ZIP Archive Cross-Platform
function compressArchive(sourceDir, zipFilePath) {
  try {
    execSync(`zip -q -r "${zipFilePath}" .`, { cwd: sourceDir, stdio: 'ignore' });
    if (fs.existsSync(zipFilePath) && fs.statSync(zipFilePath).size > 0) return;
  } catch {}

  // Standard Python zipfile script fallback (universal across Windows, macOS, Linux)
  const py = process.platform === 'win32' ? 'python' : 'python3';
  const zipScript = path.join(ROOT_DIR, 'tools', 'zip_dir.py');
  execSync(`${py} "${zipScript}" "${zipFilePath}" "${sourceDir}"`, { stdio: 'inherit' });
}

// 4. Compress Release Zip Archives
console.log('🗜️ Step 4/4: Compressing release ZIP archives...');

// A. Create apex-grand-prix-web-pwa.zip
const pwaZipPath = path.join(RELEASE_DIR, 'apex-grand-prix-web-pwa.zip');
console.log('  -> Compressing apex-grand-prix-web-pwa.zip...');
compressArchive(PWA_STAGE, pwaZipPath);
const pwaStats = fs.statSync(pwaZipPath);
console.log(`     ✓ Created: apex-grand-prix-web-pwa.zip (${(pwaStats.size / (1024 * 1024)).toFixed(2)} MB)`);

// B. Create apex-grand-prix-offline.zip
const offlineZipPath = path.join(RELEASE_DIR, 'apex-grand-prix-offline.zip');
console.log('  -> Compressing apex-grand-prix-offline.zip (with full asset library)...');
compressArchive(OFFLINE_STAGE, offlineZipPath);
const offlineStats = fs.statSync(offlineZipPath);
console.log(`     ✓ Created: apex-grand-prix-offline.zip (${(offlineStats.size / (1024 * 1024)).toFixed(2)} MB)`);

// Cleanup Staging Directories
fs.rmSync(OFFLINE_STAGE, { recursive: true, force: true });
fs.rmSync(PWA_STAGE, { recursive: true, force: true });

console.log('=============================================================');
console.log('🎉 Packaging completed successfully!');
console.log(`   1. ${offlineZipPath} [${(offlineStats.size / (1024 * 1024)).toFixed(2)} MB]`);
console.log(`   2. ${pwaZipPath} [${(pwaStats.size / (1024 * 1024)).toFixed(2)} MB]`);
console.log('=============================================================');
