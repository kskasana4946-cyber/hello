// tests/part2_sky.spec.ts
// Apex Grand Prix: Uncapped Next-Gen Edition
// Part 2 / Milestone M2: Sky, Volumetric Cloud & HDRI Atmosphere Paks Test Suite (F10–F14)

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as THREE from 'three';
import {
  APEX_PAK_MAGIC,
  APEX_PAK_VERSION,
  CanonicalSkyBiomeId,
  PakChunkType,
  PakType,
  SKY_BIOME_ALIASES,
  SKY_PAK_TARGET_BYTES,
  SkyBiomeId,
} from '../src/core/types';
import {
  PAK_MAGIC,
  PakStreamer,
  parsePakBundle,
  parsePakHeader,
  parsePakToc,
  resolveSkyCanonicalId,
  resolveSkyPakPath,
} from '../src/streaming/PakStreamer';
import {
  SkyAtmosphereParams,
  SkyAtmosphereSystem,
} from '../src/environment/SkyAtmosphereSystem';

const ROOT_DIR = path.resolve(__dirname, '..');
const SKY_PAKS_DIR = path.join(ROOT_DIR, 'assets', 'paks', 'sky');

const CANONICAL_SKIES: CanonicalSkyBiomeId[] = [
  'sky_golden_hour',
  'sky_neotokyo_cyber',
  'sky_redrock_canyon',
  'sky_alpine_glacier',
];

const ALIASES: Record<string, CanonicalSkyBiomeId> = {
  sky_01: 'sky_golden_hour',
  sky_02: 'sky_neotokyo_cyber',
  sky_03: 'sky_redrock_canyon',
  sky_04: 'sky_alpine_glacier',
};

describe('Part 2 Sky, Volumetric Cloud & HDRI Atmosphere Paks (F10–F14)', () => {
  describe('F10: Python Asset Builder & APEXPAK1 Sky Containers on Disk', () => {
    it('verifies tools/build_sky_paks.py exists and uses numpy/PIL without scipy', () => {
      const scriptPath = path.join(ROOT_DIR, 'tools', 'build_sky_paks.py');
      expect(fs.existsSync(scriptPath)).toBe(true);
      const content = fs.readFileSync(scriptPath, 'utf8');

      expect(content).toContain('numpy');
      expect(content).toContain('PIL');
      expect(content).not.toMatch(/import\s+scipy/);
      expect(content).not.toMatch(/from\s+scipy/);
      expect(content).toContain('TARGET_PAK_BYTES = 26_214_400');
    });

    it('verifies all 4 canonical sky .pak files exist with EXACTLY 26,214,400 bytes each', () => {
      let totalCanonicalBytes = 0;

      for (const skyId of CANONICAL_SKIES) {
        const filePath = path.join(SKY_PAKS_DIR, `${skyId}.pak`);
        expect(fs.existsSync(filePath), `Expected file ${filePath} to exist`).toBe(true);

        const stats = fs.statSync(filePath);
        expect(stats.size).toBe(SKY_PAK_TARGET_BYTES); // Exactly 26,214,400 bytes (25.00 MiB)
        totalCanonicalBytes += stats.size;
      }

      // Total canonical footprint = exactly 104,857,600 bytes (100.00 MiB)
      expect(totalCanonicalBytes).toBe(104_857_600);
    });

    it('verifies all 4 sky aliases (sky_01.pak .. sky_04.pak) exist and resolve to 26,214,400 bytes', () => {
      for (const alias of ['sky_01', 'sky_02', 'sky_03', 'sky_04']) {
        const aliasPath = path.join(SKY_PAKS_DIR, `${alias}.pak`);
        expect(fs.existsSync(aliasPath), `Expected alias ${aliasPath} to exist`).toBe(true);

        const stats = fs.statSync(aliasPath);
        expect(stats.size).toBe(SKY_PAK_TARGET_BYTES);
      }
    });

    it('verifies APEXPAK1 binary header and TOC structure across all 4 sky paks', () => {
      for (const skyId of CANONICAL_SKIES) {
        const filePath = path.join(SKY_PAKS_DIR, `${skyId}.pak`);
        const nodeBuf = fs.readFileSync(filePath);
        const arrayBuf = nodeBuf.buffer.slice(
          nodeBuf.byteOffset,
          nodeBuf.byteOffset + nodeBuf.byteLength
        );

        // Header check
        const header = parsePakHeader(arrayBuf);
        expect(header.magic).toBe(APEX_PAK_MAGIC);
        expect(header.version).toBe(APEX_PAK_VERSION);
        expect(header.pakType).toBe(PakType.SKY);
        expect(header.totalByteLength).toBe(SKY_PAK_TARGET_BYTES);
        expect(header.entryCount).toBe(6);
        expect(header.sectorCount).toBe(0);
        expect(header.assetId).toBe(skyId);

        // TOC check
        const toc = parsePakToc(arrayBuf, header.entryCount);
        expect(toc.length).toBe(6);

        const chunkNames = toc.map((t) => t.name);
        expect(chunkNames).toContain('json_meta');
        expect(chunkNames).toContain('hdri_equirect_rgbe');
        expect(chunkNames).toContain('cloud_noise_3d');
        expect(chunkNames).toContain('scattering_lut');
        expect(chunkNames).toContain('pmrem_cubemap_mips');
        expect(chunkNames).toContain('weather_ambience_pcm16');

        // All TOC entries must be 64-byte aligned
        for (const entry of toc) {
          expect(entry.byteOffset % 64).toBe(0);
          expect(entry.byteLength).toBeGreaterThan(0);
          expect(entry.byteOffset + entry.byteLength).toBeLessThanOrEqual(SKY_PAK_TARGET_BYTES);
        }

        // Full bundle parsing
        const bundle = parsePakBundle(arrayBuf);
        expect(bundle.header.assetId).toBe(skyId);
        expect(bundle.metadata).toBeDefined();
        expect(typeof bundle.metadata).toBe('object');
        expect((bundle.metadata as { assetId: string }).assetId).toBe(skyId);
        expect(bundle.chunks.has('hdri_equirect_rgbe')).toBe(true);
        expect(bundle.chunks.has('cloud_noise_3d')).toBe(true);
        expect(bundle.chunks.has('weather_ambience_pcm16')).toBe(true);
      }
    });
  });

  describe('F11: Golden Hour Sky Pak & Atmosphere (sky_golden_hour / sky_01)', () => {
    let atmosphere: SkyAtmosphereSystem;
    let scene: THREE.Scene;

    beforeEach(() => {
      scene = new THREE.Scene();
      atmosphere = new SkyAtmosphereSystem();
      atmosphere.initialize(scene);
    });

    afterEach(() => {
      atmosphere.dispose();
    });

    it('loads sky_golden_hour via alias sky_01 and sets up warm 2.4x sun shafts and cumulus clouds', async () => {
      const bundle = await atmosphere.loadSky('sky_01');
      expect(bundle).toBeDefined();
      expect(atmosphere.getActiveSkyId()).toBe('sky_golden_hour');

      const params = atmosphere.getAtmosphereParams();
      expect(params.sunIntensity).toBe(2.4);
      expect(params.specialEffects.sunShafts).toBe(true);
      expect(params.cloudCover).toBeGreaterThan(0.3);

      const sunLight = atmosphere.getSunLight();
      expect(sunLight).toBeDefined();
      expect(sunLight?.intensity).toBe(2.4);
      expect(sunLight?.castShadow).toBe(true);

      const sunShafts = atmosphere.getSunShaftsGroup();
      expect(sunShafts.visible).toBe(true);

      const cloudMesh = atmosphere.getCloudMesh();
      expect(cloudMesh).toBeDefined();
      expect(cloudMesh?.position.y).toBe(params.cloudAltitude);
    });
  });

  describe('F12: Neo-Tokyo Cyber Sky Pak & Atmosphere (sky_neotokyo_cyber / sky_02)', () => {
    let atmosphere: SkyAtmosphereSystem;
    let scene: THREE.Scene;

    beforeEach(() => {
      scene = new THREE.Scene();
      atmosphere = new SkyAtmosphereSystem();
      atmosphere.initialize(scene);
    });

    afterEach(() => {
      atmosphere.dispose();
    });

    it('loads sky_neotokyo_cyber, sets midnight lighting, and triggers dynamic lightning flashes', async () => {
      await atmosphere.loadSky('sky_02');
      expect(atmosphere.getActiveSkyId()).toBe('sky_neotokyo_cyber');

      const params = atmosphere.getAtmosphereParams();
      expect(params.timeOfDay).toBe('00:30');
      expect(params.specialEffects.lightning).toBe(true);
      expect(params.specialEffects.neonHolograms).toBe(true);

      const sunLight = atmosphere.getSunLight();
      expect(sunLight?.intensity).toBe(params.sunIntensity);

      // Trigger lightning strike and verify intensity surge and decay
      atmosphere.triggerLightning(3.0);
      expect(atmosphere.getLightningIntensity()).toBeGreaterThanOrEqual(3.0);

      // Light intensity should spike above base intensity during strike
      atmosphere.update(0.016, [0, 0, 0]);
      expect(sunLight!.intensity).toBeGreaterThan(params.sunIntensity);

      // Update over 1 second (stepped across frames): lightning intensity should decay back to zero
      for (let step = 0; step < 15; step++) {
        atmosphere.update(0.1, [0, 0, 0]);
      }
      expect(atmosphere.getLightningIntensity()).toBe(0.0);
      expect(sunLight!.intensity).toBe(params.sunIntensity);
    });
  });

  describe('F13: Redrock Canyon Sky Pak & Atmosphere (sky_redrock_canyon / sky_03)', () => {
    let atmosphere: SkyAtmosphereSystem;
    let scene: THREE.Scene;

    beforeEach(() => {
      scene = new THREE.Scene();
      atmosphere = new SkyAtmosphereSystem();
      atmosphere.initialize(scene);
    });

    afterEach(() => {
      atmosphere.dispose();
    });

    it('loads sky_redrock_canyon, configures crimson-violet dusk, and enables warm desert dust particles', async () => {
      await atmosphere.loadSky('sky_03');
      expect(atmosphere.getActiveSkyId()).toBe('sky_redrock_canyon');

      const params = atmosphere.getAtmosphereParams();
      expect(params.specialEffects.dustHaze).toBe(true);

      const dustParticles = atmosphere.getDustParticles();
      expect(dustParticles).toBeDefined();
      expect(dustParticles?.visible).toBe(true);

      // Update with vehicle translation and verify dust particles remain active
      atmosphere.update(0.05, [250, 0, 800]);
      expect(dustParticles?.visible).toBe(true);
    });
  });

  describe('F14: Alpine Glacier Sky Pak & Atmosphere (sky_alpine_glacier / sky_04)', () => {
    let atmosphere: SkyAtmosphereSystem;
    let scene: THREE.Scene;

    beforeEach(() => {
      scene = new THREE.Scene();
      atmosphere = new SkyAtmosphereSystem();
      atmosphere.initialize(scene);
    });

    afterEach(() => {
      atmosphere.dispose();
    });

    it('loads sky_alpine_glacier, activates aurora borealis, and simulates blowing snow sheets', async () => {
      await atmosphere.loadSky('sky_04');
      expect(atmosphere.getActiveSkyId()).toBe('sky_alpine_glacier');

      const params = atmosphere.getAtmosphereParams();
      expect(params.specialEffects.aurora).toBe(true);
      expect(params.specialEffects.snow).toBe(true);

      const snowParticles = atmosphere.getSnowParticles();
      expect(snowParticles).toBeDefined();
      expect(snowParticles?.visible).toBe(true);

      // Position car at high coordinate and verify particle buffer updates without crashing
      atmosphere.update(0.033, [1000, 15, 3000]);
      expect(snowParticles?.visible).toBe(true);
    });
  });

  describe('SkyAtmosphereSystem Lifecycle, Dynamic Sun, and Disposal', () => {
    it('initializes, transitions across all 4 biomes sequentially, updates, and disposes cleanly', async () => {
      const scene = new THREE.Scene();
      const atmosphere = new SkyAtmosphereSystem();
      atmosphere.initialize(scene);

      for (const skyId of CANONICAL_SKIES) {
        const bundle = await atmosphere.loadSky(skyId);
        expect(bundle.header.magic).toBe(APEX_PAK_MAGIC);
        expect(atmosphere.getActiveSkyId()).toBe(skyId);

        // Run several update steps
        atmosphere.update(0.016, [100, 0, 200]);
        atmosphere.update(0.016, [110, 0, 220]);
      }

      // Test dynamic sun repositioning
      atmosphere.setSunDirection([0.2, 0.9, 0.4]);
      const sun = atmosphere.getSunLight();
      expect(sun).toBeDefined();

      // Dispose and ensure scene cleanup
      atmosphere.dispose();
      expect(scene.children.length).toBe(0);
    });
  });
});
