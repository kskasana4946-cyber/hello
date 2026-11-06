// tests/part1_core.spec.ts
import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  APEX_PAK_MAGIC,
  CIRCUIT_LENGTHS_KM,
  PakChunkType,
  PakType,
  SKY_BIOME_ALIASES,
  TRACK_BIOME_ALIASES,
  VehicleSpec,
} from '../src/core/types';
import {
  AUTOMOTIVE_PAINT_LIVERIES,
  LIVERY_PBR_PRESETS,
  UncappedRenderer,
  createAutomotivePaintMaterial,
  createRefractiveGlassMaterial,
} from '../src/core/UncappedRenderer';
import {
  PAK_MAGIC,
  PakStreamer,
  buildSyntheticPakBuffer,
  parsePakBundle,
  parsePakHeader,
  resolveSkyPakPath,
  resolveTrackPakPath,
  resolveVehiclePakDir,
} from '../src/streaming/PakStreamer';
import {
  DefaultAnalyticalSplineProvider,
  RapierVehicleWorld,
} from '../src/physics/RapierVehicleWorld';

const ROOT_DIR = path.resolve(__dirname, '..');

const TEST_PAGANI_SPEC: VehicleSpec = {
  index: 25,
  pakDir: 'car_25',
  id: 'pagani_v12',
  name: 'Huayra / Zonda R AMG V12',
  tier: 4,
  tierName: 'Tier 4 — Exotic Supercars & Hypercars',
  winsRequired: 22,
  creditCost: 320000,
  zeroToHundredSec: 2.7,
  topSpeedKph: 360,
  massKg: 1280,
  archetype: 'HYPERCAR_PROTOTYPE',
  drivetrain: 'RWD',
  redlineRpm: 9000,
  gears: 7,
  hasTransparentEngineBay: true,
  defaultPrimaryColor: 0xd4af37,
  defaultAccentColor: 0x111111,
};

const TEST_JET_THRUST_SPEC: VehicleSpec = {
  index: 34,
  pakDir: 'car_34',
  id: 'jet_thrust',
  name: 'Supersonic Afterburner Land-Speed Concept',
  tier: 5,
  tierName: 'Tier 5 — Prototypes, Open-Wheel & Mythic Concepts',
  winsRequired: 31,
  creditCost: 750000,
  zeroToHundredSec: 1.65,
  topSpeedKph: 485,
  massKg: 2400,
  archetype: 'SUPERSONIC_CONCEPT',
  drivetrain: 'JET',
  redlineRpm: 15000,
  gears: 1,
  hasTransparentEngineBay: true,
  defaultPrimaryColor: 0x00f0ff,
  defaultAccentColor: 0xff3300,
};

describe('Part 1 Core Engine, Shaders, .PAK Streamer & 240Hz Physics Verification (F1–F9)', () => {
  describe('F1: Planning Documents & Core Shared Types', () => {
    it('verifies task.md, implementation_plan.md, and PROJECT.md exist and cover Parts 1–6 & ~400 MB budget', () => {
      const taskMd = fs.readFileSync(path.join(ROOT_DIR, 'task.md'), 'utf8');
      const planMd = fs.readFileSync(path.join(ROOT_DIR, 'implementation_plan.md'), 'utf8');
      const projectMd = fs.readFileSync(path.join(ROOT_DIR, 'PROJECT.md'), 'utf8');

      expect(taskMd).toContain('Part 1');
      expect(taskMd).toContain('Part 6');
      expect(planMd).toContain('400 MB');
      expect(projectMd).toContain('RapierVehicleWorld');
    });

    it('verifies 6 true physical circuit lengths and dual sky/track alias maps in src/core/types.ts', () => {
      expect(CIRCUIT_LENGTHS_KM).toEqual([2.0, 5.0, 8.0, 12.0, 24.0, 50.0]);
      expect(SKY_BIOME_ALIASES['sky_01']).toBe('sky_golden_hour');
      expect(SKY_BIOME_ALIASES['sky_04']).toBe('sky_alpine_glacier');
      expect(TRACK_BIOME_ALIASES['track_01']).toBe('track_golden_gp');
      expect(TRACK_BIOME_ALIASES['track_04']).toBe('track_alpine');
    });
  });

  describe('F4 & F5: Automotive Clearcoat Metallic Flake & Refractive Glass Shaders', () => {
    it('validates src/shaders/AutomotivePaint.glsl dual-layer clearcoat, metallic flake, anisotropic GGX & 1000C brake glow', () => {
      const paintGlsl = fs.readFileSync(
        path.join(ROOT_DIR, 'src/shaders/AutomotivePaint.glsl'),
        'utf8'
      );
      expect(paintGlsl).toContain('uClearcoat');
      expect(paintGlsl).toContain('CLEARCOAT_F0 = 0.04');
      expect(paintGlsl).toContain('evaluateMetallicFlakes');
      expect(paintGlsl).toContain('uFlakeScale');
      expect(paintGlsl).toContain('distributionGGXAnisotropic');
      expect(paintGlsl).toContain('uAnisotropy');
      expect(paintGlsl).toContain('evaluateCarbonTwillWeave');
      expect(paintGlsl).toContain('evaluateBrakeBlackbodyGlow');
      expect(paintGlsl).toContain('uBrakeTempCelsius');
      expect(AUTOMOTIVE_PAINT_LIVERIES.length).toBe(12);
      expect(LIVERY_PBR_PRESETS.length).toBe(12);

      for (let i = 0; i < 12; i++) {
        const mat = createAutomotivePaintMaterial(i, { brakeTempCelsius: 950, isBrakeRotor: true });
        expect(mat.userData.shaderType).toBe('AUTOMOTIVE_PAINT');
        expect(mat.userData.clearcoatF0).toBe(0.04);
        expect(mat.uniforms.uBrakeTempCelsius.value).toBe(950);
        expect(mat.vertexShader.length).toBeGreaterThan(100);
        expect(mat.fragmentShader.length).toBeGreaterThan(500);
      }
    });

    it('validates src/shaders/RefractiveGlass.glsl ior: 1.52, chromatic dispersion & dual wiper-sweep mask', () => {
      const glassGlsl = fs.readFileSync(
        path.join(ROOT_DIR, 'src/shaders/RefractiveGlass.glsl'),
        'utf8'
      );
      expect(glassGlsl).toContain('1.52');
      expect(glassGlsl).toContain('uChromaticDispersion');
      expect(glassGlsl).toContain('evaluateDualWiperMask');
      expect(glassGlsl).toContain('uWiperAngleRad');

      const glassMat = createRefractiveGlassMaterial();
      expect(glassMat.uniforms.uIor.value).toBeCloseTo(1.52, 4);
      expect(glassMat.userData.fresnelF0).toBeCloseTo(0.04258, 5);
      expect(glassMat.uniforms.uChromaticDispersion.value).toBeGreaterThan(0);
    });
  });

  describe('F2, F3 & F6: UncappedRenderer VSync, SSAA, 4-Cascade CSM/PCSS, SSGI/SSR & Post-Processing', () => {
    it('configures VSync (120/144/240Hz/UNCAPPED), SSAA (1.0x–2.5x), 4-cascade 4096 CSM + PCSS, SSGI/SSR, ACES & FOV warp', () => {
      const renderer = new UncappedRenderer({ width: 1920, height: 1080, headless: true });

      renderer.setVSyncHz(120);
      expect(renderer.getTargetFrameIntervalMs()).toBeCloseTo(1000 / 120, 2);
      renderer.setVSyncHz(144);
      expect(renderer.getTargetFrameIntervalMs()).toBeCloseTo(1000 / 144, 2);
      renderer.setVSyncMode(240);
      expect(renderer.getConfig().vsyncHz).toBe(240);
      expect(renderer.getTargetFrameIntervalMs()).toBeCloseTo(1000 / 240, 2);
      renderer.setVSyncHz('UNCAPPED');
      expect(renderer.getTargetFrameIntervalMs()).toBe(0);

      expect(renderer.setSSAAScale(0.5)).toBe(1.0);
      expect(renderer.setSSAAScale(2.5)).toBe(2.5);
      expect(renderer.setSSAAScale(4.0)).toBe(2.5);
      expect(renderer.getInternalRenderResolution()).toEqual({
        width: 4800,
        height: 2700,
        ssaaScale: 2.5,
      });

      const cascades = renderer.getCSMCascades();
      expect(cascades.length).toBe(4);
      expect(renderer.getCSMConfig().cascades).toBe(4);
      expect(renderer.getCSMConfig().shadowMapSize).toBe(4096);
      expect(renderer.getCSMConfig().pcssContactHardening).toBe(true);
      for (let i = 0; i < cascades.length; i++) {
        expect(cascades[i].resolution).toEqual([4096, 4096]);
        expect(cascades[i].farDistance).toBeGreaterThan(cascades[i].nearDistance);
      }

      const penumbraNear = renderer.computePCSSPenumbraWidth(10.5, 10.0, 0.06);
      const penumbraFar = renderer.computePCSSPenumbraWidth(25.0, 10.0, 0.06);
      expect(penumbraFar).toBeGreaterThan(penumbraNear);

      const ssConfig = renderer.getScreenSpaceConfig();
      expect(ssConfig.ssgiEnabled).toBe(true);
      expect(ssConfig.ssrEnabled).toBe(true);

      const acesBlack = renderer.applyACESToneMapping([0, 0, 0]);
      const acesBright = renderer.applyACESToneMapping([10, 10, 10]);
      expect(acesBlack).toEqual([0, 0, 0]);
      expect(acesBright[0]).toBeGreaterThan(0.9);
      expect(acesBright[0]).toBeLessThanOrEqual(1.0);

      const fovAtRest = renderer.computeSpeedDrivenFov(0);
      const fovAt360 = renderer.computeSpeedDrivenFov(360);
      const fovAt485 = renderer.computeSpeedDrivenFov(485);
      expect(fovAtRest).toBeCloseTo(62.0, 1);
      expect(fovAt360).toBeGreaterThan(fovAtRest);
      expect(fovAt485).toBeGreaterThan(fovAt360);

      renderer.setCameraMode('SHOWROOM', true);
      expect(renderer.updateSpeedFovWarp(300)).toBe(42.0);
      expect(renderer.getPostProcessingConfig().bokehDofEnabled).toBe(true);
      expect(renderer.computeBokehCircleOfConfusionPx(15.0)).toBeGreaterThan(0);
    });
  });

  describe('F7: Asynchronous WebWorker .PAK & Octree Sector Streamer with LRU Eviction', () => {
    it('parses APEXPAK1 binary headers/TOC, resolves bidirectional aliases, and enforces LRU VRAM cache eviction', async () => {
      expect(resolveSkyPakPath('sky_01')).toBe('assets/paks/sky/sky_golden_hour.pak');
      expect(resolveSkyPakPath('sky_04')).toBe('assets/paks/sky/sky_alpine_glacier.pak');
      expect(resolveTrackPakPath('track_01')).toBe('assets/paks/tracks/track_golden_gp.pak');
      expect(resolveTrackPakPath('track_04')).toBe('assets/paks/tracks/track_alpine.pak');
      expect(resolveVehiclePakDir('scooter').pakPath).toBe('assets/paks/vehicles/car_01/vehicle.pak');
      expect(resolveVehiclePakDir('car_34').slug).toBe('jet_thrust');
      expect(resolveVehiclePakDir(34).carDir).toBe('car_34');

      // Test corrupt magic header rejection
      const corruptBuf = new ArrayBuffer(64);
      expect(() => parsePakHeader(corruptBuf)).toThrow(/Invalid PAK magic header/);

      // Test synthetic APEXPAK1 binary roundtrip
      const metaBytes = new TextEncoder().encode(JSON.stringify({ test: 'roundtrip', sectors: 100 }));
      const rawBuf = buildSyntheticPakBuffer({
        pakType: PakType.TRACK,
        assetId: 'track_golden_gp',
        sectorCount: 100,
        chunks: [
          { name: 'json_meta', chunkType: PakChunkType.JSON_META, payload: metaBytes },
          { name: 'sector_000', chunkType: PakChunkType.SECTOR_F32, payload: new Uint8Array(256) },
        ],
      });
      const parsedBundle = parsePakBundle(rawBuf);
      expect(parsedBundle.header.magic).toBe(APEX_PAK_MAGIC);
      expect(parsedBundle.header.sectorCount).toBe(100);
      expect(parsedBundle.toc.length).toBe(2);
      expect(parsedBundle.metadata?.test).toBe('roundtrip');

      // Test LRU VRAM eviction
      const streamer = new PakStreamer({ maxVramBytes: 1024 * 1024 }); // 1 MiB cap for test
      expect(streamer.resolveAssetPath('sky_01')).toContain('sky_golden_hour.pak');
      expect(streamer.resolveAssetPath('track_02')).toContain('track_neotokyo.pak');
      expect(streamer.resolveAssetPath('car_01')).toContain('car_01');

      const pakBufA = PakStreamer.createSyntheticPakBuffer('test_asset_a', 1, 400 * 1024);
      const pakBufB = PakStreamer.createSyntheticPakBuffer('test_asset_b', 1, 400 * 1024);
      const pakBufC = PakStreamer.createSyntheticPakBuffer('test_asset_c', 1, 400 * 1024);

      const parsedA = streamer.loadFromBuffer('test_asset_a', pakBufA);
      expect(parsedA.header.magic).toBe(PAK_MAGIC);
      expect(parsedA.header.version).toBe(1);

      streamer.loadFromBuffer('test_asset_b', pakBufB);
      // Touch A so B becomes least-recently-used
      streamer.getResidentAsset('test_asset_a');
      streamer.loadFromBuffer('test_asset_c', pakBufC);

      expect(streamer.getUsedVramBytes()).toBeLessThanOrEqual(1024 * 1024);
      expect(streamer.hasResidentAsset('test_asset_a')).toBe(true);
      expect(streamer.hasResidentAsset('test_asset_c')).toBe(true);
      expect(streamer.hasResidentAsset('test_asset_b')).toBe(false); // Evicted by LRU!

      // Test 500m spatial sector window streaming across 24.0 KM Nordschleife (48 sectors)
      const sectorStreamer = new PakStreamer({ maxVramBytes: 256 * 1024 * 1024 });
      const win0 = sectorStreamer.streamTrackSectorWindow('track_01', 0, 24000, 2, 6);
      expect(win0.totalSectorsInCircuit).toBe(48);
      expect(win0.activeSectorIndices).toEqual([46, 47, 0, 1, 2, 3, 4, 5, 6]);
    });
  });

  describe('F8 & F9: RapierVehicleWorld 240Hz Raycast Suspension, Pacejka, 1:1 Scale & Barrier Projection', () => {
    let world: RapierVehicleWorld;

    beforeAll(async () => {
      world = await RapierVehicleWorld.create(new DefaultAnalyticalSplineProvider(20000, 20));
    });

    it('initializes @dimforge/rapier3d-compat WASM and steps at exact 240Hz (dt = 1/240s)', () => {
      expect(world.isRapierInitialized()).toBe(true);
      const beforeSteps = world.getTotalSubstepsExecuted();
      const ran = world.step(1.0);
      expect(ran).toBe(240);
      expect(world.getTotalSubstepsExecuted() - beforeSteps).toBe(240);
    });

    it('evaluates Pacejka Magic Formula tire-slip curve and quadratic aerodynamic downforce', () => {
      const fZero = RapierVehicleWorld.evaluatePacejkaLateralForce(4000, 0);
      const fSmall = RapierVehicleWorld.evaluatePacejkaLateralForce(4000, 0.05);
      const fPeak = RapierVehicleWorld.evaluatePacejkaLateralForce(4000, 0.16);
      const fDoubleLoad = RapierVehicleWorld.evaluatePacejkaLateralForce(8000, 0.16);

      expect(fZero).toBeCloseTo(0, 5);
      expect(fSmall).toBeGreaterThan(1500);
      expect(fPeak).toBeGreaterThan(fSmall);
      expect(fDoubleLoad).toBeCloseTo(fPeak * 2, 2);

      const df100 = RapierVehicleWorld.evaluateAerodynamicDownforce(TEST_PAGANI_SPEC, 100 / 3.6);
      const df200 = RapierVehicleWorld.evaluateAerodynamicDownforce(TEST_PAGANI_SPEC, 200 / 3.6);
      expect(df200).toBeCloseTo(df100 * 4, 1);
    });

    it('simulates weight transfer pitch/roll, active DRS/airbrake wing, and 1,000C brake disc heating', () => {
      world.addVehicle('pagani_test', TEST_PAGANI_SPEC, 100, 0);
      world.setControlInput('pagani_test', { throttle: 1.0, brake: 0, steer: 0 });
      world.step(2.7); // Accelerate to ~100 KPH in ~2.7s

      const accelState = world.getVehicleState('pagani_test')!;
      expect(accelState.speedKph).toBeGreaterThan(95);
      expect(accelState.speedKph).toBeLessThan(106);
      expect(accelState.pitchRad).toBeGreaterThan(0); // Nose-up under acceleration
      expect(accelState.wheels[2].normalLoadN + accelState.wheels[3].normalLoadN).toBeGreaterThan(
        accelState.wheels[0].normalLoadN + accelState.wheels[1].normalLoadN
      );

      // Now boost to 300 KPH and slam the brakes
      world.setVehicleSpeedAndHeading('pagani_test', 300, 0, 0);
      world.setControlInput('pagani_test', { throttle: 0, brake: 1.0, steer: 0 });
      world.step(1.5);

      const brakeState = world.getVehicleState('pagani_test')!;
      expect(brakeState.pitchRad).toBeLessThan(0); // Nose-down under braking
      expect(brakeState.wingAngleRad).toBeCloseTo(0.96, 2); // 55 deg airbrake deployed
      expect(brakeState.brakeTempCelsius).toBeGreaterThan(400);
      expect(brakeState.brakeTempCelsius).toBeLessThanOrEqual(1000);
    });

    it('enforces True 1:1 Physical World Calibration: at 360 KPH (100 m/s), advances 100 meters in 1.0s', () => {
      world.addVehicle('scale_car', TEST_PAGANI_SPEC, 1000, 0);
      world.setVehicleSpeedAndHeading('scale_car', 360, 0, 0);
      // Maintain top speed with full throttle
      world.setControlInput('scale_car', { throttle: 1.0, brake: 0, steer: 0 });
      world.stepSubsteps(240); // Exact 1.000000 second at 240Hz

      const state = world.getVehicleState('scale_car')!;
      const distanceAdvancedMeters = state.alongOffset - 1000;
      expect(distanceAdvancedMeters).toBeGreaterThan(99.2);
      expect(distanceAdvancedMeters).toBeLessThan(100.8);
    });

    it('executes Lateral Tangent Barrier Projection at 485 KPH with ZERO backward teleporting and parallel velocity', () => {
      world.addVehicle('jet_wall_scrape', TEST_JET_THRUST_SPEC, 2000, 8.8);
      // Point vehicle 20 degrees outward into the right guardrail at 485 KPH!
      world.setVehicleSpeedAndHeading('jet_wall_scrape', 485, (20 * Math.PI) / 180, 8.8);
      world.setControlInput('jet_wall_scrape', { throttle: 1.0, brake: 0, steer: 0.25 });

      let prevAlong = 2000;
      let sawBarrierSparks = false;

      for (let step = 0; step < 120; step++) {
        world.stepSubsteps(1);
        const st = world.getVehicleState('jet_wall_scrape')!;
        // 1. alongOffset is NEVER yanked backward
        expect(st.alongOffset).toBeGreaterThanOrEqual(prevAlong);
        prevAlong = st.alongOffset;

        // 2. lateralOffset is strictly clamped to guardrail boundary (roadWidth/2 - carHalfWidth = 9.0m)
        expect(Math.abs(st.lateralOffset)).toBeLessThanOrEqual(9.0001);

        if (st.barrierContact) {
          sawBarrierSparks = true;
          // 3. Velocity vector is projected parallel to spline tangent T (0, 0, 1)
          const vNormZ = st.velocity[2] / Math.max(1e-6, st.speedMs);
          const vNormX = st.velocity[0] / Math.max(1e-6, st.speedMs);
          expect(vNormZ).toBeGreaterThan(0.999);
          expect(Math.abs(vNormX)).toBeLessThan(1e-4);
          expect(st.barrierSparks.sparkIntensity).toBeCloseTo(1.0, 2);
          expect(st.barrierSparks.scrapeSpeedKph).toBeGreaterThan(400);
        }
      }

      expect(sawBarrierSparks).toBe(true);
      expect(prevAlong).toBeGreaterThan(2050); // Glided smoothly >50m along the wall in 0.5s!
    });

    it('supports Tactical Ramp hooks: Skybridge (+12m, 1.35x), Plasma Ring (+80% Nitro, 1.42x), and Shockwave Landing (>180 KPH)', () => {
      world.addVehicle('stunt_player', TEST_PAGANI_SPEC, 500, 0);
      world.addVehicle('ai_rival_near', TEST_PAGANI_SPEC, 505, 3.0); // Within 15m
      world.addVehicle('ai_rival_far', TEST_PAGANI_SPEC, 530, 3.0);  // Outside 15m (25m away)

      const player = world.getVehicleState('stunt_player')!;
      player.nitroPercent = 10;

      // 1. Skybridge Overpass (+12m, 1.35x)
      world.enterSkybridgeOverpass('stunt_player', 300, 12.0);
      expect(player.onSkybridgeDeck).toBe(true);
      expect(player.position[1]).toBeGreaterThan(12.0);
      expect(player.activeSpeedMultiplier).toBeCloseTo(1.35, 2);

      // 2. Mid-Air Plasma Boost Ring (+80% Nitro, 1.42x for 4.0s, +2,500 CR)
      world.triggerPlasmaBoostRing('stunt_player');
      expect(player.nitroPercent).toBe(90);
      expect(player.plasmaSurgeRemainingSec).toBe(4.0);
      expect(player.activeSpeedMultiplier).toBeCloseTo(1.42, 2);
      expect(player.stuntCreditsEarned).toBe(2500);

      // 3. Kinetic Shockwave Landing at 240 KPH (>180 KPH threshold)
      world.setVehicleSpeedAndHeading('stunt_player', 240, 0, 0);
      const shockwave = world.evaluateTouchdown('stunt_player');
      expect(shockwave).not.toBeNull();
      expect(shockwave!.triggered).toBe(true);
      expect(player.speedKph).toBeCloseTo(240 * 1.15, 1); // Zero slowdown + 15% forward boost
      expect(shockwave!.blastedRivalIds).toContain('ai_rival_near');
      expect(shockwave!.blastedRivalIds).not.toContain('ai_rival_far');
    });
  });
});
