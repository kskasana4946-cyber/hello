#!/usr/bin/env node
/**
 * tools/ensure_paks.mjs
 * Apex Grand Prix: Uncapped Next-Gen Edition
 *
 * Cross-platform runner to ensure the ~800 MB .PAK asset bundles (760,402,304 B)
 * are generated and verified on disk.
 *
 * Supports Windows, macOS, and Linux by automatically detecting python3, python, or py -3.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

export const PAK_TARGETS = {
  sky: {
    dir: path.join(REPO_ROOT, 'assets', 'paks', 'sky'),
    files: [
      'sky_golden_hour.pak',
      'sky_neotokyo_cyber.pak',
      'sky_redrock_canyon.pak',
      'sky_alpine_glacier.pak',
    ],
    aliases: ['sky_01.pak', 'sky_02.pak', 'sky_03.pak', 'sky_04.pak'],
    expectedBytes: 26_214_400, // 25.00 MiB (4 × 25 MiB = 100.00 MiB = 104,857,600 B)
    script: 'tools/build_sky_paks.py',
  },
  tracks: {
    dir: path.join(REPO_ROOT, 'assets', 'paks', 'tracks'),
    files: [
      'track_golden_gp.pak',
      'track_neotokyo.pak',
      'track_canyon.pak',
      'track_alpine.pak',
    ],
    aliases: ['track_01.pak', 'track_02.pak', 'track_03.pak', 'track_04.pak'],
    expectedBytes: 83_886_080, // 80.00 MiB (4 × 80 MiB = 320.00 MiB = 335,544,320 B)
    script: 'tools/build_track_paks.py',
  },
  vehicles: {
    dir: path.join(REPO_ROOT, 'assets', 'paks', 'vehicles'),
    carCount: 34,
    expectedBytes: 9_411_776, // ~9.412 MB (34 × 9,411,776 = 320,000,384 B)
    script: 'tools/build_vehicle_paks.py',
  },
};

export const EXPECTED_CANONICAL_TOTAL_BYTES = 760_402_304;

export function detectPython() {
  const candidates =
    process.platform === 'win32'
      ? ['py -3', 'python', 'python3']
      : ['python3', 'python'];

  for (const cmd of candidates) {
    try {
      execSync(`${cmd} --version`, { stdio: 'ignore', timeout: 5000 });
      return cmd;
    } catch {
      // try next candidate
    }
  }
  throw new Error(
    'Python 3 not found on PATH! Please install Python 3 (or ensure python3/python/py is available).'
  );
}

export function checkAllPaks(force = false) {
  if (force) return false;

  // Check Sky
  for (const f of PAK_TARGETS.sky.files) {
    const p = path.join(PAK_TARGETS.sky.dir, f);
    if (!fs.existsSync(p)) return false;
    try {
      if (fs.statSync(p).size !== PAK_TARGETS.sky.expectedBytes) return false;
    } catch {
      return false;
    }
  }
  for (const a of PAK_TARGETS.sky.aliases) {
    const p = path.join(PAK_TARGETS.sky.dir, a);
    if (!fs.existsSync(p)) return false;
    try {
      if (fs.statSync(p).size !== PAK_TARGETS.sky.expectedBytes) return false;
    } catch {
      return false;
    }
  }

  // Check Tracks
  for (const f of PAK_TARGETS.tracks.files) {
    const p = path.join(PAK_TARGETS.tracks.dir, f);
    if (!fs.existsSync(p)) return false;
    try {
      if (fs.statSync(p).size !== PAK_TARGETS.tracks.expectedBytes) return false;
    } catch {
      return false;
    }
  }
  for (const a of PAK_TARGETS.tracks.aliases) {
    const p = path.join(PAK_TARGETS.tracks.dir, a);
    if (!fs.existsSync(p)) return false;
    try {
      if (fs.statSync(p).size !== PAK_TARGETS.tracks.expectedBytes) return false;
    } catch {
      return false;
    }
  }

  // Check Vehicles (car_01 .. car_34)
  for (let i = 1; i <= PAK_TARGETS.vehicles.carCount; i++) {
    const carDir = `car_${String(i).padStart(2, '0')}`;
    const p = path.join(PAK_TARGETS.vehicles.dir, carDir, 'vehicle.pak');
    if (!fs.existsSync(p)) return false;
    try {
      if (fs.statSync(p).size !== PAK_TARGETS.vehicles.expectedBytes) return false;
    } catch {
      return false;
    }
  }

  return true;
}

export function ensurePaks(force = false) {
  if (checkAllPaks(force)) {
    console.log(
      `[ensure_paks] All 42 canonical .pak files (${EXPECTED_CANONICAL_TOTAL_BYTES.toLocaleString()} B) verified on disk.`
    );
    return;
  }

  const py = detectPython();
  console.log(`[ensure_paks] Generating ~800 MB .pak assets using ${py}...`);

  const scripts = [
    PAK_TARGETS.sky.script,
    PAK_TARGETS.tracks.script,
    PAK_TARGETS.vehicles.script,
  ];

  for (const script of scripts) {
    console.log(`[ensure_paks] Executing ${script}...`);
    execSync(`${py} ${script}`, { stdio: 'inherit', cwd: REPO_ROOT });
  }

  if (!checkAllPaks(false)) {
    throw new Error('[ensure_paks] Verification failed after running asset generation scripts!');
  }

  console.log(
    `[ensure_paks] All .pak files successfully built and verified (${EXPECTED_CANONICAL_TOTAL_BYTES.toLocaleString()} B total).`
  );
}

// Direct CLI invocation
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const force = process.argv.includes('--force');
  try {
    ensurePaks(force);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
