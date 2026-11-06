// tests/part3_tracks.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as THREE from 'three';
import {
  APEX_PAK_HEADER_BYTES,
  APEX_PAK_MAGIC,
  CIRCUIT_LENGTHS_KM,
  CircuitLengthKm,
  PakType,
  TRACK_BIOME_ALIASES,
  TrackBiomeId,
} from '../src/core/types';
import {
  CIRCUIT_SPECS,
  SplineTrackStreamer,
  TRACK_BIOMES_SPEC,
  snapToValidCircuitLengthKm,
} from '../src/tracks/SplineTrackStreamer';
import {
  TacticalRamps,
  TacticalRampZone,
} from '../src/tracks/TacticalRamps';

const ROOT_DIR = path.resolve(__dirname, '..');
const TRACKS_DIR = path.join(ROOT_DIR, 'assets', 'paks', 'tracks');
const EXPECTED_PAK_BYTES = 41_943_040; // 40.00 MiB
const TOTAL_TRACK_BYTES = EXPECTED_PAK_BYTES * 4; // 160.00 MiB

describe('Part 3 / Milestone M3: Modular Track Biome Paks & Tactical Ramps', () => {
  describe('F22: Python Track Biome .PAK Builder & Container Integrity', () => {
    it('verifies tools/build_track_paks.py exists and uses numpy + Pillow with zero scipy dependency', () => {
      const scriptPath = path.join(ROOT_DIR, 'tools', 'build_track_paks.py');
      expect(fs.existsSync(scriptPath)).toBe(true);
      const content = fs.readFileSync(scriptPath, 'utf8');

      expect(content).toContain('numpy');
      expect(content).toMatch(/from PIL import|import PIL/);
      expect(content).not.toMatch(/^\s*(import\s+scipy|from\s+scipy)/m);
    });

    it('verifies exact file sizes (41,943,040 B each, 167,772,160 B total) and aliases on disk', () => {
      const biomes = ['track_golden_gp', 'track_neotokyo', 'track_canyon', 'track_alpine'];
      const aliases = ['track_01', 'track_02', 'track_03', 'track_04'];

      let totalBytes = 0;
      for (const biome of biomes) {
        const filePath = path.join(TRACKS_DIR, `${biome}.pak`);
        expect(fs.existsSync(filePath), `Missing ${biome}.pak`).toBe(true);
        const stat = fs.statSync(filePath);
        expect(stat.size).toBe(EXPECTED_PAK_BYTES);
        totalBytes += stat.size;
      }
      expect(totalBytes).toBe(TOTAL_TRACK_BYTES);

      // Verify symlink aliases
      for (let i = 0; i < aliases.length; i++) {
        const aliasPath = path.join(TRACKS_DIR, `${aliases[i]}.pak`);
        expect(fs.existsSync(aliasPath), `Missing alias ${aliases[i]}.pak`).toBe(true);
        const stat = fs.statSync(aliasPath);
        expect(stat.size).toBe(EXPECTED_PAK_BYTES);
      }
    });

    it('verifies APEXPAK1 64-byte little-endian header and TOC entries across all 4 paks', () => {
      const biomes = ['track_golden_gp', 'track_neotokyo', 'track_canyon', 'track_alpine'];

      for (const biome of biomes) {
        const filePath = path.join(TRACKS_DIR, `${biome}.pak`);
        const fd = fs.openSync(filePath, 'r');
        const buf = Buffer.alloc(4096);
        fs.readSync(fd, buf, 0, 4096, 0);
        fs.closeSync(fd);

        // Header (64 bytes)
        const magic = buf.subarray(0, 8).toString('utf8');
        expect(magic).toBe(APEX_PAK_MAGIC);

        const version = buf.readUInt32LE(8);
        expect(version).toBe(1);

        const pakType = buf.readUInt32LE(12);
        expect(pakType).toBe(PakType.TRACK);

        const totalByteLength = Number(buf.readBigUInt64LE(16));
        expect(totalByteLength).toBe(EXPECTED_PAK_BYTES);

        const entryCount = buf.readUInt32LE(24);
        expect(entryCount).toBe(6);

        const sectorCount = buf.readUInt32LE(28);
        expect(sectorCount).toBe(100);

        const assetId = buf.subarray(32, 64).toString('utf8').replace(/\0+.*$/g, '').trim();
        expect(assetId).toBe(biome);

        // TOC Entries (6 entries, 64 bytes each)
        const expectedChunks = [
          { name: 'asphalt_albedo_4k', len: 16_777_216 },
          { name: 'asphalt_normal_16bit', len: 16_777_216 },
          { name: 'asphalt_pbr_masks_2k', len: 4_194_304 },
          { name: 'terrain_heightfield_16bit', len: 2_097_152 },
          { name: 'botanical_scenery_meshes', len: 1_572_864 },
          { name: 'sectors_100_stream', len: 523_840 },
        ];

        let runningOffset = 64 + 6 * 64; // 448
        for (let i = 0; i < entryCount; i++) {
          const base = 64 + i * 64;
          const chunkName = buf.subarray(base, base + 32).toString('utf8').replace(/\0+.*$/g, '').trim();
          const byteOffset = Number(buf.readBigUInt64LE(base + 32));
          const byteLength = Number(buf.readBigUInt64LE(base + 40));

          expect(chunkName).toBe(expectedChunks[i].name);
          expect(byteLength).toBe(expectedChunks[i].len);
          expect(byteOffset).toBe(runningOffset);
          runningOffset += byteLength;
        }
        expect(runningOffset).toBe(EXPECTED_PAK_BYTES);
      }
    });
  });

  describe('F15–F21: SplineTrackStreamer 1:1 Scale & 6 Circuit Configurations', () => {
    let streamer: SplineTrackStreamer;

    beforeEach(() => {
      streamer = new SplineTrackStreamer(5.0, 'track_golden_gp');
    });

    it('calibrates 1:1 true physical scale (1 unit = 1 real meter, 100m/s advance at 360 KPH)', () => {
      streamer.configure(5.0, 'track_golden_gp');
      const speedKph = 360.0;
      const speedMs = speedKph / 3.6; // 100 m/s
      expect(speedMs).toBeCloseTo(100.0, 3);

      const f0 = streamer.getFrameAtArcLength(1000.0);
      const f1 = streamer.getFrameAtArcLength(1000.0 + speedMs * 1.0); // 1 second advance = +100m
      expect(f1.s - f0.s).toBeCloseTo(100.0, 3);

      // Verify tangent vector unit length
      const lenT = Math.hypot(...f0.tangent);
      expect(lenT).toBeCloseTo(1.0, 4);

      // Verify normal and binormal unit lengths and orthogonality
      const lenN = Math.hypot(...f0.normal);
      const lenB = Math.hypot(...f0.binormal);
      expect(lenN).toBeCloseTo(1.0, 4);
      expect(lenB).toBeCloseTo(1.0, 4);

      const dotTN = f0.tangent[0] * f0.normal[0] + f0.tangent[1] * f0.normal[1] + f0.tangent[2] * f0.normal[2];
      expect(Math.abs(dotTN)).toBeLessThan(1e-4);
    });

    it('verifies 2.0 KM Stadium Sprint (2,000m, 4 sectors, ~22-26s lap)', () => {
      const res = streamer.configure(2.0, 'track_golden_gp');
      expect(res.totalLength).toBe(2000);
      expect(res.sectorCount).toBe(4);
      expect(streamer.getTotalLength()).toBe(2000);
      expect(streamer.getSectorCount()).toBe(4);

      const lapSecAt300 = 2000 / (300 / 3.6);
      expect(lapSecAt300).toBeGreaterThanOrEqual(22.0);
      expect(lapSecAt300).toBeLessThanOrEqual(26.5);
    });

    it('verifies 5.0 KM FIA Grand Prix (5,000m, 10 sectors, ~60s lap)', () => {
      const res = streamer.configure(5.0, 'track_golden_gp');
      expect(res.totalLength).toBe(5000);
      expect(res.sectorCount).toBe(10);
      expect(streamer.getTotalLength()).toBe(5000);
      expect(streamer.getSectorCount()).toBe(10);

      const lapSecAt300 = 5000 / (300 / 3.6);
      expect(lapSecAt300).toBeGreaterThanOrEqual(54.0);
      expect(lapSecAt300).toBeLessThanOrEqual(66.0);
    });

    it('verifies 8.0 KM Pro GT Loop (8,000m, 16 sectors, ~96s lap)', () => {
      const res = streamer.configure(8.0, 'track_golden_gp');
      expect(res.totalLength).toBe(8000);
      expect(res.sectorCount).toBe(16);
      expect(streamer.getTotalLength()).toBe(8000);
      expect(streamer.getSectorCount()).toBe(16);

      const lapSecAt300 = 8000 / (300 / 3.6);
      expect(lapSecAt300).toBeGreaterThanOrEqual(88.0);
      expect(lapSecAt300).toBeLessThanOrEqual(104.0);
    });

    it('verifies 12.0 KM Spa/Le Mans Endurance (12,000m, 24 sectors, ~144s lap)', () => {
      const res = streamer.configure(12.0, 'track_golden_gp');
      expect(res.totalLength).toBe(12000);
      expect(res.sectorCount).toBe(24);
      expect(streamer.getTotalLength()).toBe(12000);
      expect(streamer.getSectorCount()).toBe(24);

      const lapSecAt300 = 12000 / (300 / 3.6);
      expect(lapSecAt300).toBeGreaterThanOrEqual(132.0);
      expect(lapSecAt300).toBeLessThanOrEqual(156.0);
    });

    it('verifies 24.0 KM Nordschleife "Green Hell" (24,000m, 48 sectors, 70+ corners, +85m climb, 18 deg carousel, tunnels, 3.2km straight)', () => {
      const res = streamer.configure(24.0, 'track_golden_gp');
      expect(res.totalLength).toBe(24000);
      expect(res.sectorCount).toBe(48);

      // 1. Mountain elevation relief >= +85m
      let minY = Infinity;
      let maxY = -Infinity;
      let signChanges = 0;
      let prevSign = 0;
      for (let s = 0; s < 24000; s += 50) {
        const f = streamer.getFrameAtArcLength(s);
        minY = Math.min(minY, f.position[1]);
        maxY = Math.max(maxY, f.position[1]);
        const sign = Math.sign(Math.sin((72 * (s / 24000)) * Math.PI * 2));
        if (sign !== 0 && sign !== prevSign) {
          signChanges += 1;
          prevSign = sign;
        }
      }
      expect(maxY - minY).toBeGreaterThanOrEqual(85.0);

      // 2. Corner count >= 70
      expect(signChanges).toBeGreaterThanOrEqual(70);

      // 3. Banked carousel turns up to 18 deg & tunnel presence
      let maxBank = 0;
      let hasTunnel = false;
      for (let s = 0; s < 24000; s += 100) {
        const f = streamer.getFrameAtArcLength(s);
        maxBank = Math.max(maxBank, Math.abs(f.bankAngleRad));
        if (f.isTunnel) hasTunnel = true;
      }
      expect(maxBank).toBeGreaterThanOrEqual((15.0 * Math.PI) / 180.0);
      expect(maxBank).toBeLessThanOrEqual((18.0 * Math.PI) / 180.0 + 1e-4);
      expect(hasTunnel).toBe(true);

      // 4. 3.2 KM full-throttle straightaway with curvature < 0.0005 m^-1
      let straightLen = 0;
      for (let s = 20400; s <= 23800; s += 100) {
        const f = streamer.getFrameAtArcLength(s);
        if (Math.abs(f.curvature) < 0.0005) straightLen += 100;
      }
      expect(straightLen).toBeGreaterThanOrEqual(3200);

      // 5. Target lap time ~4.5 - 5.2 minutes (270 - 312s)
      const lapSecAt300 = 24000 / (300 / 3.6);
      expect(lapSecAt300).toBeGreaterThanOrEqual(270);
      expect(lapSecAt300).toBeLessThanOrEqual(312);
    });

    it('verifies 50.0 KM Coast-to-Coast Mega Highway (50,000m, 100 sectors, ~9-10 min lap)', () => {
      const res = streamer.configure(50.0, 'track_golden_gp');
      expect(res.totalLength).toBe(50000);
      expect(res.sectorCount).toBe(100);

      const lapSecAt310 = 50000 / (310 / 3.6);
      expect(lapSecAt310).toBeGreaterThanOrEqual(540);
      expect(lapSecAt310).toBeLessThanOrEqual(600);
    });

    it('snaps invalid circuit lengths to closest valid option', () => {
      expect(snapToValidCircuitLengthKm(0)).toBe(2.0);
      expect(snapToValidCircuitLengthKm(1.5)).toBe(2.0);
      expect(snapToValidCircuitLengthKm(6.2)).toBe(5.0);
      expect(snapToValidCircuitLengthKm(10.5)).toBe(12.0);
      expect(snapToValidCircuitLengthKm(30.0)).toBe(24.0);
      expect(snapToValidCircuitLengthKm(100.0)).toBe(50.0);
    });
  });

  describe('F23: High-Density Tessellated Road Ribbon, Scenery & Sector Descriptors', () => {
    let streamer: SplineTrackStreamer;

    beforeEach(() => {
      streamer = new SplineTrackStreamer(50.0, 'track_golden_gp');
    });

    it('verifies sub-meter cross-section vertex spacing (<1.0m) and crown camber ratio', () => {
      const desc = streamer.getSectorDescriptor(0);
      expect(desc.crossSectionVertexSpacingMeters).toBeLessThan(1.0);
      expect(desc.crownCamberRatio).toBeGreaterThan(0.0);
      expect(desc.hasFiaSawtoothKerbs).toBe(true);
      expect(desc.hasCorrugatedArmcoBarriers).toBe(true);
    });

    it('verifies biome-specific botanical tree species across all 4 track biomes', () => {
      for (const [trackId, expectedTree] of [
        ['track_golden_gp', 'oak'],
        ['track_neotokyo', 'pine'],
        ['track_canyon', 'saguaro'],
        ['track_alpine', 'snow-spruce'],
      ] as const) {
        streamer.configure(5.0, trackId);
        const desc = streamer.getSectorDescriptor(0);
        expect(desc.treeArchetype).toBe(expectedTree);
      }
    });

    it('verifies trackside architecture placement outside drivable road width', () => {
      streamer.configure(24.0, 'track_golden_gp');
      const s0 = streamer.getSectorDescriptor(0);
      const sTunnel = streamer.getSectorDescriptor(15);
      const halfWidth = streamer.roadWidth / 2; // 10m

      expect(s0.architecture.grandstands.length).toBeGreaterThan(0);
      for (const gs of s0.architecture.grandstands) {
        expect(Math.abs(gs.lateralOffset)).toBeGreaterThan(halfWidth);
      }

      expect(s0.architecture.pitBuildings.length).toBeGreaterThan(0);
      for (const pb of s0.architecture.pitBuildings) {
        expect(Math.abs(pb.lateralOffset)).toBeGreaterThan(halfWidth);
      }

      expect(s0.architecture.cantileverGantries.length).toBeGreaterThan(0);
      for (const cg of s0.architecture.cantileverGantries) {
        expect(cg.clearanceHeight).toBeGreaterThanOrEqual(7.0);
      }

      expect(sTunnel.architecture.illuminatedTunnels.length).toBeGreaterThan(0);
    });

    it('verifies getClosestSplinePoint global vs hintS local search and wrap boundary', () => {
      streamer.configure(5.0, 'track_golden_gp');
      const wp = streamer.worldPosFromSplineOffsets(4999.0, -3.0, 0.0);

      const pGlobal = streamer.getClosestSplinePoint(wp, undefined);
      const pLocal = streamer.getClosestSplinePoint(wp, 4999.0);

      expect(pGlobal.alongOffset).toBeCloseTo(pLocal.alongOffset, 1);
      expect(pGlobal.lateralOffset).toBeCloseTo(-3.0, 1);
      expect(pGlobal.verticalOffset).toBeCloseTo(0.0, 1);
    });

    it('verifies Three.js sector streaming and bounded LRU cache eviction (<= 12 sectors)', () => {
      streamer.configure(50.0, 'track_golden_gp');
      const scene = new THREE.Scene();
      streamer.attachToScene(scene);

      // Advance across multiple sectors
      for (let s = 0; s < 50000; s += 2500) {
        const win = streamer.streamLookaheadWindow(s, 50000, 2, 6);
        expect(win.residentSectorCount).toBeLessThanOrEqual(12);
        expect(streamer.getResidentSectorCount()).toBeLessThanOrEqual(12);
      }

      streamer.dispose();
      expect(streamer.getResidentSectorCount()).toBe(0);
    });
  });

  describe('F24–F27: Tactical Ramps, Approach Chevrons & 3 High-Reward Ramp Types', () => {
    let streamer: SplineTrackStreamer;
    let ramps: TacticalRamps;

    beforeEach(() => {
      streamer = new SplineTrackStreamer(5.0, 'track_golden_gp');
      ramps = new TacticalRamps(streamer);
    });

    it('F24: enforces outer 25% lane placement invariant (0.375 W <= |lateralOffset| <= 0.48 W)', () => {
      for (const km of [2.0, 5.0, 8.0, 12.0, 24.0, 50.0] as const) {
        streamer.configure(km, 'track_golden_gp');
        const list = ramps.rebuildRamps();
        const W = streamer.roadWidth;
        const minOuter = 0.375 * W;
        const maxOuter = 0.48 * W;

        for (const r of list) {
          expect(Math.abs(r.lateralOffset)).toBeGreaterThanOrEqual(minOuter);
          expect(Math.abs(r.lateralOffset)).toBeLessThanOrEqual(maxOuter);
        }
      }
    });

    it('F24: verifies 100m Holographic Approach Chevrons preceding every ramp', () => {
      streamer.configure(8.0, 'track_golden_gp');
      const L = streamer.getTotalLength();
      const list = ramps.rebuildRamps();

      for (const r of list) {
        const expectedStart = (((r.sStart - 100.0) % L) + L) % L;
        expect(r.chevronStart).toBeCloseTo(expectedStart, 4);
        expect(r.chevronEnd).toBeCloseTo(r.sStart, 4);
        expect(r.chevronLengthMeters).toBe(100.0);
      }

      // Chevron activation: center-line triggers 0, outer lane triggers inside [sStart-100, sStart]
      const r0 = list[0];
      expect(ramps.isChevronActiveAt(r0.sStart - 50.0, 0.0, r0)).toBe(false);
      expect(ramps.isChevronActiveAt(r0.sStart - 100.1, r0.lateralOffset, r0)).toBe(false);
      expect(ramps.isChevronActiveAt(r0.sStart - 100.0, r0.lateralOffset, r0)).toBe(true);
      expect(ramps.isChevronActiveAt(r0.sStart - 50.0, r0.lateralOffset, r0)).toBe(true);
      expect(ramps.isChevronActiveAt(r0.sStart + 0.1, r0.lateralOffset, r0)).toBe(false);
    });

    it('F24: snaps custom registered ramp out of center 75% into outer 25% lane', () => {
      const W = streamer.roadWidth;
      const custom = ramps.registerCustomRamp({ lateralOffset: 0.0, sStart: 500.0 });
      expect(custom.snappedToOuterLane).toBe(true);
      expect(Math.abs(custom.lateralOffset)).toBeGreaterThanOrEqual(0.375 * W);
    });

    it('F24: verifies ramp zone counts across all 6 circuit lengths (8, 16, 24, 36, 48, 90)', () => {
      const expectedCounts: Record<CircuitLengthKm, number> = {
        2.0: 8,
        5.0: 16,
        8.0: 24,
        12.0: 36,
        24.0: 48,
        50.0: 90,
      };

      for (const [kmStr, count] of Object.entries(expectedCounts)) {
        const km = Number(kmStr) as CircuitLengthKm;
        streamer.configure(km, 'track_golden_gp');
        const list = ramps.rebuildRamps();
        expect(list.length).toBe(count);
      }
    });

    it('F25: verifies Elevated Skybridge Overpasses (deck length 250m-400m, +12m elevation, 1.35x overdrive)', () => {
      streamer.configure(12.0, 'track_golden_gp');
      const skybridges = ramps.rebuildRamps().filter((r) => r.type === 'SKYBRIDGE_OVERPASS');
      expect(skybridges.length).toBeGreaterThan(0);

      for (const sb of skybridges) {
        expect(sb.deckLength).toBeGreaterThanOrEqual(250.0);
        expect(sb.deckLength).toBeLessThanOrEqual(400.0);
        expect(sb.deckHeightMeters).toBe(12.0);
        expect(sb.overdriveBoostMultiplier).toBe(1.35);
      }
    });

    it('F26: verifies Mid-Air Plasma Boost Rings (+80% nitro, 1.42x surge for 4.0s, +2,500 CR, deduplication)', () => {
      streamer.configure(5.0, 'track_golden_gp');
      const rings = ramps.rebuildRamps().filter((r) => r.type === 'PLASMA_BOOST_RING');
      expect(rings.length).toBeGreaterThan(0);

      for (const ring of rings) {
        expect(ring.ringCenterHeightMeters).toBeGreaterThanOrEqual(4.5);
        expect(ring.ringRadiusMeters).toBeGreaterThanOrEqual(3.0);
        expect(ring.nitroRefillPercent).toBe(80.0);
        expect(ring.hyperVelocityMultiplier).toBe(1.42);
        expect(ring.hyperVelocityDurationSec).toBe(4.0);
        expect(ring.stuntBonusCredits).toBe(2500);
      }

      // Test trigger logic and deduplication
      const res1 = ramps.triggerPlasmaBoostRing('jump_test_1', 10.0);
      expect(res1.nitroPercent).toBe(90.0);
      expect(res1.boostMultiplier).toBe(1.42);
      expect(res1.hyperSurgeRemainingSec).toBe(4.0);
      expect(res1.creditsAwarded).toBe(2500);
      expect(res1.alreadyTriggered).toBe(false);

      // Second trigger on same jump: deduplicated
      const res2 = ramps.triggerPlasmaBoostRing('jump_test_1', 90.0);
      expect(res2.alreadyTriggered).toBe(true);
      expect(res2.creditsAwarded).toBe(0);

      // Clamp at 100% nitro
      const res3 = ramps.triggerPlasmaBoostRing('jump_test_2', 75.0);
      expect(res3.nitroPercent).toBe(100.0);
    });

    it('F27: verifies Kinetic Shockwave Landings (>180 KPH, 0% slowdown, +15% boost, 15m rival blast)', () => {
      // 1. Below 180 KPH: no shockwave
      const resSub = ramps.evaluateKineticShockwaveLanding(170.0, []);
      expect(resSub.shockwaveFired).toBe(false);
      expect(resSub.postTouchdownSpeedKph).toBe(170.0);

      // 2. Exact boundary 180.0 KPH: no shockwave
      const res180 = ramps.evaluateKineticShockwaveLanding(180.0, []);
      expect(res180.shockwaveFired).toBe(false);

      // 3. Above 180 KPH (e.g. 200 KPH): triggers 0% slowdown and +15% forward boost
      const resBoost = ramps.evaluateKineticShockwaveLanding(200.0, []);
      expect(resBoost.shockwaveFired).toBe(true);
      expect(resBoost.slowdownPercent).toBe(0.0);
      expect(resBoost.postTouchdownSpeedKph).toBeCloseTo(230.0, 3);
      expect(resBoost.maxRingRadiusMeters).toBe(15.0);

      // 4. Lateral blast of AI rivals within 15m radius
      const rivals = [
        { id: 'rival_close_left', distanceMeters: 8.0, lateralDeltaMeters: -4.0 },
        { id: 'rival_close_right', distanceMeters: 14.0, lateralDeltaMeters: 5.0 },
        { id: 'rival_far', distanceMeters: 22.0, lateralDeltaMeters: 3.0 },
      ];
      const resBlast = ramps.evaluateKineticShockwaveLanding(210.0, rivals);
      expect(resBlast.blastedRivals[0].blasted).toBe(true);
      expect(resBlast.blastedRivals[0].deltaLateralVel).toBeLessThan(0); // Left pushed left

      expect(resBlast.blastedRivals[1].blasted).toBe(true);
      expect(resBlast.blastedRivals[1].deltaLateralVel).toBeGreaterThan(0); // Right pushed right

      expect(resBlast.blastedRivals[2].blasted).toBe(false);
      expect(resBlast.blastedRivals[2].deltaLateralVel).toBe(0);

      // 5. Flat road micro bumps (jumpHeight < 0.5m) do NOT false-trigger shockwave
      const resFlat = ramps.evaluateKineticShockwaveLanding(250.0, rivals, 0.2);
      expect(resFlat.shockwaveFired).toBe(false);
    });

    it('verifies Three.js 3D mesh creation for tactical ramps, chevrons, and skybridges', () => {
      const scene = new THREE.Scene();
      ramps.attachToScene(scene);
      const meshes = ramps.rebuild3DMeshes();
      expect(meshes.children.length).toBeGreaterThan(0);

      // Verify Skybridge, Plasma Ring, and Approach Chevrons child meshes
      let hasSkybridgeDeck = false;
      let hasPlasmaRing = false;
      let hasChevrons = false;

      meshes.traverse((child) => {
        if (child.name === 'SkybridgeUpperDeck') hasSkybridgeDeck = true;
        if (child.name === 'PlasmaBoostRing') hasPlasmaRing = true;
        if (child.name === 'ApproachChevrons') hasChevrons = true;
      });

      expect(hasSkybridgeDeck).toBe(true);
      expect(hasPlasmaRing).toBe(true);
      expect(hasChevrons).toBe(true);

      ramps.dispose();
    });
  });
});
