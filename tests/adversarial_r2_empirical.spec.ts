// tests/adversarial_r2_empirical.spec.ts
// Empirical Adversarial Hardening Suite for Round 2 Implementations:
// 1. All 34 Roster Vehicles geometry construction, NaN/Inf immunity, bounding box validation, and archetype signatures.
// 2. Exact 760,402,304 B on-disk .pak validation across all 42 files, header/TOC integrity, and chunk decoding.
// 3. 240Hz sub-stepped physics stepping at 500 KPH, extreme steering, 3D kerbs, and barrier scrapes.

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as THREE from 'three';
import {
  APEX_PAK_HEADER_BYTES,
  APEX_PAK_MAGIC,
  APEX_PAK_TOC_ENTRY_BYTES,
  APEX_PAK_VERSION,
  PakChunkType,
  PakType,
  SKY_PAK_TARGET_BYTES,
  TRACK_PAK_TARGET_BYTES,
  VEHICLE_PAK_TARGET_BYTES,
  VehicleSpec,
} from '../src/core/types';
import {
  PakStreamer,
  parsePakBundle,
  parsePakHeader,
  parsePakToc,
  buildSyntheticPakBuffer,
} from '../src/streaming/PakStreamer';
import {
  VEHICLE_ROSTER,
  getAllVehicles,
  getVehicleById,
} from '../src/vehicles/VehicleRoster';
import {
  HighPolyVehicleBuilder,
  buildVehicle,
  steerWheels,
  spinWheels,
  setBrakeTemperature,
  setDrsActive,
  setAirbrake,
  setLivery,
  updateVehicle,
} from '../src/vehicles/HighPolyVehicleBuilder';
import {
  updateCockpitTelemetry,
} from '../src/vehicles/CockpitInteriorBuilder';
import {
  DefaultAnalyticalSplineProvider,
  RapierVehicleWorld,
} from '../src/physics/RapierVehicleWorld';
import { SplineTrackStreamer } from '../src/tracks/SplineTrackStreamer';

const ROOT_DIR = path.resolve(__dirname, '..');
const SKY_DIR = path.join(ROOT_DIR, 'assets', 'paks', 'sky');
const TRACK_DIR = path.join(ROOT_DIR, 'assets', 'paks', 'tracks');
const VEHICLE_DIR = path.join(ROOT_DIR, 'assets', 'paks', 'vehicles');

describe('Empirical Adversarial Testing: Round 2 Verification', () => {

  // ==========================================================================
  // MANDATE 1: 34-VEHICLE GEOMETRY ADVERSARIAL STRESS TEST
  // ==========================================================================
  describe('Mandate 1: Vehicle Builder Geometry & Stress Verification (All 34 Vehicles)', () => {
    it('verifies that VehicleRoster contains exactly 34 unique vehicles with valid specs', () => {
      const roster = getAllVehicles();
      expect(roster.length).toBe(34);
      const ids = new Set<string>();
      for (const spec of roster) {
        expect(spec.id).toBeDefined();
        expect(spec.name).toBeDefined();
        expect(spec.index).toBeGreaterThanOrEqual(1);
        expect(spec.index).toBeLessThanOrEqual(34);
        expect(spec.topSpeedKph).toBeGreaterThan(100);
        expect(spec.zeroToHundredSec).toBeGreaterThan(1.0);
        expect(spec.massKg).toBeGreaterThan(100);
        expect(ids.has(spec.id)).toBe(false);
        ids.add(spec.id);
      }
    });

    it('builds all 34 vehicles via buildVehicle() and confirms zero NaN in transforms, bounds, or vertex buffers', () => {
      const roster = getAllVehicles();
      expect(roster.length).toBe(34);

      for (const spec of roster) {
        const instance = buildVehicle(spec);
        expect(instance).toBeDefined();
        expect(instance.rootGroup).toBeInstanceOf(THREE.Group);
        expect(instance.bodyMesh).toBeInstanceOf(THREE.Mesh);
        expect(instance.wingGroup).toBeInstanceOf(THREE.Group);
        expect(instance.wheels).toBeDefined();
        expect(instance.wheels.fl).toBeDefined();
        expect(instance.wheels.fr).toBeDefined();
        expect(instance.wheels.rl).toBeDefined();
        expect(instance.wheels.rr).toBeDefined();
        expect(instance.cockpitInterior).toBeDefined();

        // Compute full object bounding box
        instance.rootGroup.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(instance.rootGroup);

        expect(box.isEmpty()).toBe(false);
        expect(Number.isFinite(box.min.x), `${spec.id}: min.x is NaN/Inf`).toBe(true);
        expect(Number.isFinite(box.min.y), `${spec.id}: min.y is NaN/Inf`).toBe(true);
        expect(Number.isFinite(box.min.z), `${spec.id}: min.z is NaN/Inf`).toBe(true);
        expect(Number.isFinite(box.max.x), `${spec.id}: max.x is NaN/Inf`).toBe(true);
        expect(Number.isFinite(box.max.y), `${spec.id}: max.y is NaN/Inf`).toBe(true);
        expect(Number.isFinite(box.max.z), `${spec.id}: max.z is NaN/Inf`).toBe(true);

        expect(box.max.x).toBeGreaterThan(box.min.x);
        expect(box.max.y).toBeGreaterThan(box.min.y);
        expect(box.max.z).toBeGreaterThan(box.min.z);

        // Check cockpit camera anchor
        const anchor = instance.cockpitInterior.cockpitCameraAnchor;
        expect(anchor).toBeDefined();
        expect(Number.isFinite(anchor.position.x)).toBe(true);
        expect(Number.isFinite(anchor.position.y)).toBe(true);
        expect(Number.isFinite(anchor.position.z)).toBe(true);
        expect(anchor.position.y).toBeGreaterThanOrEqual(1.0);

        // Deep traversal: inspect EVERY mesh geometry vertex buffer for NaN/Inf
        let meshCount = 0;
        instance.rootGroup.traverse((child) => {
          expect(Number.isFinite(child.position.x)).toBe(true);
          expect(Number.isFinite(child.position.y)).toBe(true);
          expect(Number.isFinite(child.position.z)).toBe(true);
          expect(Number.isFinite(child.rotation.x)).toBe(true);
          expect(Number.isFinite(child.rotation.y)).toBe(true);
          expect(Number.isFinite(child.rotation.z)).toBe(true);
          expect(Number.isFinite(child.scale.x)).toBe(true);
          expect(Number.isFinite(child.scale.y)).toBe(true);
          expect(Number.isFinite(child.scale.z)).toBe(true);

          if ((child as THREE.Mesh).isMesh) {
            meshCount++;
            const mesh = child as THREE.Mesh;
            const geom = mesh.geometry;
            expect(geom).toBeDefined();

            const posAttr = geom.getAttribute('position');
            expect(posAttr).toBeDefined();
            const posArray = posAttr.array;
            for (let i = 0; i < posArray.length; i++) {
              expect(Number.isFinite(posArray[i]), `${spec.id}: vertex pos[${i}] is NaN/Inf`).toBe(true);
            }

            const normalAttr = geom.getAttribute('normal');
            if (normalAttr) {
              const normArray = normalAttr.array;
              for (let i = 0; i < normArray.length; i++) {
                expect(Number.isFinite(normArray[i]), `${spec.id}: vertex normal[${i}] is NaN/Inf`).toBe(true);
              }
            }

            geom.computeBoundingSphere();
            expect(geom.boundingSphere).toBeDefined();
            expect(Number.isFinite(geom.boundingSphere!.radius)).toBe(true);
            expect(geom.boundingSphere!.radius).toBeGreaterThan(0);
          }
        });

        expect(meshCount).toBeGreaterThanOrEqual(15);
      }
    });

    it('verifies bespoke archetype signatures: Scooter, Bugatti, F1, Semi Rig, Coach Bus, Baja Truck', () => {
      // 1. Scooter (Car #1)
      const scooterSpec = getVehicleById('scooter')!;
      const scooter = buildVehicle(scooterSpec);
      // Inline 2-wheel geometry: fl and rl at x=0
      expect(Math.abs(scooter.wheels.fl.group.position.x)).toBeLessThan(0.01);
      expect(Math.abs(scooter.wheels.rl.group.position.x)).toBeLessThan(0.01);
      // Hidden stabilizer helper wheels at y=-10, visible=false
      expect(scooter.wheels.fr.group.position.y).toBeLessThan(-5.0);
      expect(scooter.wheels.fr.group.visible).toBe(false);
      expect(scooter.wheels.rr.group.position.y).toBeLessThan(-5.0);
      expect(scooter.wheels.rr.group.visible).toBe(false);

      // Find handlebar and rider silhouette
      let hasRider = false;
      let hasHandlebars = false;
      scooter.bodyworkGroup.traverse((obj) => {
        if (obj.name.includes('Rider') || obj.name.includes('rider')) hasRider = true;
        if (obj instanceof THREE.Group && Math.abs(obj.position.y - 0.88) < 0.05 && Math.abs(obj.position.z - 0.52) < 0.05) {
          hasHandlebars = true;
        }
      });
      expect(hasRider).toBe(true);
      expect(hasHandlebars).toBe(true);
      expect(scooter.cockpitInterior.steeringWheelGroup.children.length).toBeGreaterThanOrEqual(3);

      // 2. Bugatti Chiron (Car #27 / hyper)
      const bugattiSpec = getVehicleById('hyper')!;
      const bugatti = buildVehicle(bugattiSpec);
      let hasHorseshoe = false;
      let hasCLine = false;
      let hasCenterSpine = false;
      bugatti.rootGroup.traverse((obj) => {
        if (obj.name.includes('Horseshoe') || obj.name.includes('horseshoe')) hasHorseshoe = true;
        if (obj.name.includes('CLine') || obj.name.includes('cline') || obj.name.includes('Contour')) hasCLine = true;
        if (obj.name.includes('Spine') || obj.name.includes('spine')) hasCenterSpine = true;
      });
      // Also check geometry check for horseshoe
      bugatti.bodyworkGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.geometry instanceof THREE.TorusGeometry && obj.position.y > 0.05 && obj.position.y < 0.15) {
          hasHorseshoe = true;
        }
        if (obj instanceof THREE.Mesh && obj.geometry instanceof THREE.BoxGeometry) {
          const params = (obj.geometry as THREE.BoxGeometry).parameters;
          if (params.width < 0.03 && params.depth > 3.0) {
            hasCenterSpine = true;
          }
        }
        if (obj instanceof THREE.Group && Math.abs(obj.position.x) > 0.9 && Math.abs(obj.position.x) < 1.1) {
          hasCLine = true;
        }
      });
      expect(hasHorseshoe).toBe(true);
      expect(hasCLine).toBe(true);
      expect(hasCenterSpine).toBe(true);

      // 3. Formula 1 (Car #32 / f1)
      const f1Spec = getVehicleById('f1')!;
      const f1 = buildVehicle(f1Spec);
      let hasHalo = false;
      let hasWishbones = false;
      f1.bodyworkGroup.traverse((obj) => {
        if (obj instanceof THREE.Group && obj.position.y > 0.7 && Math.abs(obj.position.z - 0.25) < 0.1) {
          hasHalo = true;
        }
        if (obj instanceof THREE.Group && Math.abs(obj.position.x) > 0.35 && Math.abs(obj.position.x) < 0.55) {
          hasWishbones = true;
        }
      });
      expect(hasHalo).toBe(true);
      expect(hasWishbones).toBe(true);

      // 4. Semi Rig (Car #14 / semi_rig)
      const semiSpec = getVehicleById('semi_rig')!;
      const semi = buildVehicle(semiSpec);
      let hasStacks = false;
      let hasDually = false;
      semi.bodyworkGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.geometry instanceof THREE.CylinderGeometry) {
          const params = (obj.geometry as THREE.CylinderGeometry).parameters;
          if (params.height > 2.0 && obj.position.y > 1.2) hasStacks = true;
        }
      });
      if (semi.wheels.rl.group.children.length > 1 && semi.wheels.rr.group.children.length > 1) {
        hasDually = true;
      }
      expect(hasStacks).toBe(true);
      expect(hasDually).toBe(true);

      // 5. Coach Bus (Car #15 / bus)
      const busSpec = getVehicleById('bus')!;
      const bus = buildVehicle(busSpec);
      const busBox = new THREE.Box3().setFromObject(bus.rootGroup);
      expect(busBox.max.z - busBox.min.z).toBeGreaterThan(6.0); // > 6m length
      expect(busBox.max.y - busBox.min.y).toBeGreaterThan(2.0); // > 2m height

      // 6. Baja Truck (Car #09 / truck)
      const truckSpec = getVehicleById('truck')!;
      const truck = buildVehicle(truckSpec);
      let hasPrerunnerBumper = false;
      let spareTireCount = 0;
      truck.bodyworkGroup.traverse((obj) => {
        if (obj.name.includes('Prerunner') || obj.name.includes('prerunner') || obj.name.includes('SkidPlate')) hasPrerunnerBumper = true;
        if (obj instanceof THREE.Mesh && obj.geometry instanceof THREE.CylinderGeometry) {
          const params = (obj.geometry as THREE.CylinderGeometry).parameters;
          if (params.radiusTop > 0.4 && params.radiusBottom > 0.4 && obj.position.z < -1.0) {
            spareTireCount++;
          }
        }
      });
      expect(spareTireCount).toBe(2);
    });

    it('stress tests vehicle dynamics methods with extreme/out-of-range inputs across all 34 vehicles', () => {
      const roster = getAllVehicles();

      for (const spec of roster) {
        const instance = buildVehicle(spec);

        // 1. Extreme steering angles
        steerWheels(instance, -Math.PI);
        steerWheels(instance, Math.PI);
        steerWheels(instance, 100.0);
        steerWheels(instance, -100.0);
        expect(Number.isFinite(instance.steerAngleRad)).toBe(true);

        // 2. Extreme wheel spin with valid deltaSec
        spinWheels(instance, 10000.0, 1 / 60);
        spinWheels(instance, -10000.0, 1 / 60);
        expect(Number.isFinite(instance.wheelSpinRad)).toBe(true);

        // 3. Extreme brake temperature (verifies clamping to [20, 1000])
        setBrakeTemperature(instance, -100);
        expect(instance.currentBrakeTempCelsius).toBe(20);
        setBrakeTemperature(instance, 500);
        expect(instance.currentBrakeTempCelsius).toBe(500);
        setBrakeTemperature(instance, 1500);
        expect(instance.currentBrakeTempCelsius).toBe(1000);

        // 4. DRS and Airbrake overdrive
        setDrsActive(instance, true);
        expect(instance.isDrsActive).toBe(true);
        setDrsActive(instance, false);
        setAirbrake(instance, 0.0);
        setAirbrake(instance, 1.0);
        setAirbrake(instance, 5.0); // overdrive
        expect(Number.isFinite(instance.airbrakeAngleRad)).toBe(true);

        // 5. All 12 liveries
        for (let l = 0; l < 12; l++) {
          setLivery(instance, l);
          expect(instance.currentLiveryIndex).toBe(l);
        }

        // 6. Cockpit telemetry with wild values
        updateCockpitTelemetry(instance.cockpitInterior, {
          speedKph: 999.9,
          rpm: 25000,
          maxRpm: 18000,
          gear: 8,
          lapDeltaSec: -12.34,
          currentLap: 5,
          totalLaps: 10,
          position: 1,
          totalRacers: 12,
          nitroPercent: 150,
          drsActive: true,
          brakeTempCelsius: 1200,
          sectorSplits: [14.2, 28.5, null],
        }, 1 / 60);

        // Verify transforms remain non-NaN
        expect(Number.isFinite(instance.rootGroup.position.x)).toBe(true);
        expect(Number.isFinite(instance.rootGroup.rotation.x)).toBe(true);
      }
    });
  });

  // ==========================================================================
  // MANDATE 2: .PAK INTEGRITY, TOC & EXACT 760,402,304 B FOOTPRINT AUDIT
  // ==========================================================================
  describe('Mandate 2: .PAK Reading, Streaming & Exact 760,402,304 B Disk Audit', () => {
    it('verifies exactly 4 Sky Paks, 4 Track Paks, and 34 Vehicle Paks on disk', () => {
      expect(fs.existsSync(SKY_DIR)).toBe(true);
      expect(fs.existsSync(TRACK_DIR)).toBe(true);
      expect(fs.existsSync(VEHICLE_DIR)).toBe(true);

      const skyFiles = ['sky_golden_hour.pak', 'sky_neotokyo_cyber.pak', 'sky_redrock_canyon.pak', 'sky_alpine_glacier.pak'];
      for (const f of skyFiles) {
        expect(fs.existsSync(path.join(SKY_DIR, f)), `Missing sky pak ${f}`).toBe(true);
      }

      const trackFiles = ['track_golden_gp.pak', 'track_neotokyo.pak', 'track_canyon.pak', 'track_alpine.pak'];
      for (const f of trackFiles) {
        expect(fs.existsSync(path.join(TRACK_DIR, f)), `Missing track pak ${f}`).toBe(true);
      }

      for (let i = 1; i <= 34; i++) {
        const carDir = `car_${String(i).padStart(2, '0')}`;
        const pakPath = path.join(VEHICLE_DIR, carDir, 'vehicle.pak');
        expect(fs.existsSync(pakPath), `Missing vehicle pak ${pakPath}`).toBe(true);
      }
    });

    it('empirically verifies exact byte sizes of all 42 files summing to exactly 760,402,304 B', () => {
      let totalSkyBytes = 0;
      let totalTrackBytes = 0;
      let totalVehicleBytes = 0;

      // 1. Sky paks: 26,214,400 B each
      const skyFiles = ['sky_golden_hour.pak', 'sky_neotokyo_cyber.pak', 'sky_redrock_canyon.pak', 'sky_alpine_glacier.pak'];
      for (const f of skyFiles) {
        const stat = fs.statSync(path.join(SKY_DIR, f));
        expect(stat.size, `${f} size`).toBe(SKY_PAK_TARGET_BYTES); // 26,214,400
        totalSkyBytes += stat.size;
      }
      expect(totalSkyBytes).toBe(4 * 26_214_400); // 104,857,600 B (100.00 MiB)

      // 2. Track paks: 83,886,080 B each
      const trackFiles = ['track_golden_gp.pak', 'track_neotokyo.pak', 'track_canyon.pak', 'track_alpine.pak'];
      for (const f of trackFiles) {
        const stat = fs.statSync(path.join(TRACK_DIR, f));
        expect(stat.size, `${f} size`).toBe(TRACK_PAK_TARGET_BYTES); // 83,886,080
        totalTrackBytes += stat.size;
      }
      expect(totalTrackBytes).toBe(4 * 83_886_080); // 335,544,320 B (320.00 MiB)

      // 3. Vehicle paks: 9,411,776 B each
      for (let i = 1; i <= 34; i++) {
        const carDir = `car_${String(i).padStart(2, '0')}`;
        const pakPath = path.join(VEHICLE_DIR, carDir, 'vehicle.pak');
        const stat = fs.statSync(pakPath);
        expect(stat.size, `${carDir} vehicle.pak size`).toBe(VEHICLE_PAK_TARGET_BYTES); // 9,411,776
        totalVehicleBytes += stat.size;
      }
      expect(totalVehicleBytes).toBe(34 * 9_411_776); // 320,000,384 B (~320.00 MB)

      // 4. Exact grand total: 760,402,304 B
      const grandTotalBytes = totalSkyBytes + totalTrackBytes + totalVehicleBytes;
      expect(grandTotalBytes).toBe(760_402_304);
    });

    it('parses headers, validates 64-byte TOC alignment, and verifies chunks across all 42 .pak files', () => {
      const allPakPaths: Array<{ path: string; expectedType: number; expectedSize: number; expectedSectors: number }> = [];

      // Add Skies
      for (const f of ['sky_golden_hour.pak', 'sky_neotokyo_cyber.pak', 'sky_redrock_canyon.pak', 'sky_alpine_glacier.pak']) {
        allPakPaths.push({
          path: path.join(SKY_DIR, f),
          expectedType: PakType.SKY,
          expectedSize: SKY_PAK_TARGET_BYTES,
          expectedSectors: 0,
        });
      }
      // Add Tracks
      for (const f of ['track_golden_gp.pak', 'track_neotokyo.pak', 'track_canyon.pak', 'track_alpine.pak']) {
        allPakPaths.push({
          path: path.join(TRACK_DIR, f),
          expectedType: PakType.TRACK,
          expectedSize: TRACK_PAK_TARGET_BYTES,
          expectedSectors: 100,
        });
      }
      // Add Vehicles
      for (let i = 1; i <= 34; i++) {
        const carDir = `car_${String(i).padStart(2, '0')}`;
        allPakPaths.push({
          path: path.join(VEHICLE_DIR, carDir, 'vehicle.pak'),
          expectedType: PakType.VEHICLE,
          expectedSize: VEHICLE_PAK_TARGET_BYTES,
          expectedSectors: 0,
        });
      }

      expect(allPakPaths.length).toBe(42);

      for (const item of allPakPaths) {
        const nodeBuf = fs.readFileSync(item.path);
        const arrayBuf = nodeBuf.buffer.slice(
          nodeBuf.byteOffset,
          nodeBuf.byteOffset + nodeBuf.byteLength
        );

        // Header check
        const header = parsePakHeader(arrayBuf);
        expect(header.magic).toBe(APEX_PAK_MAGIC);
        expect(header.version).toBe(APEX_PAK_VERSION);
        expect(header.pakType).toBe(item.expectedType);
        expect(header.totalByteLength).toBe(item.expectedSize);
        expect(header.sectorCount).toBe(item.expectedSectors);
        expect(header.entryCount).toBeGreaterThanOrEqual(5);

        // TOC check
        const toc = parsePakToc(arrayBuf, header.entryCount);
        expect(toc.length).toBe(header.entryCount);

        for (const entry of toc) {
          expect(entry.name.length).toBeGreaterThan(0);
          expect(entry.byteLength).toBeGreaterThan(0);
          expect(entry.byteOffset).toBeGreaterThanOrEqual(APEX_PAK_HEADER_BYTES + header.entryCount * APEX_PAK_TOC_ENTRY_BYTES);
          // 64-byte alignment
          expect(entry.byteOffset % 64, `TOC entry ${entry.name} offset ${entry.byteOffset} not 64-byte aligned`).toBe(0);
          expect(entry.byteOffset + entry.byteLength).toBeLessThanOrEqual(header.totalByteLength);
        }

        // Bundle parse check
        const parsed = parsePakBundle(arrayBuf);
        expect(parsed.chunks.size).toBe(header.entryCount);

        if (item.expectedType === PakType.VEHICLE) {
          // Verify presence of PCM audio banks
          const audioChunk = parsed.chunks.get('exhaust_rpm_pcm16') || parsed.chunks.get('exhaust_idle_pcm16');
          expect(audioChunk, `Missing PCM audio bank in ${item.path}`).toBeDefined();
          expect(audioChunk!.byteLength).toBeGreaterThan(500_000);
          expect(audioChunk!.byteLength % 2).toBe(0); // 16-bit PCM samples
        }
      }
    });

    it('tests corrupted buffer handling and error resilience on PakStreamer', () => {
      // 1. Buffer too short
      const shortBuf = new ArrayBuffer(32);
      expect(() => parsePakHeader(shortBuf)).toThrow(/Invalid PAK buffer/);

      // 2. Corrupted magic
      const badMagicBuf = new ArrayBuffer(64);
      const u8 = new Uint8Array(badMagicBuf);
      new TextEncoder().encodeInto('BADMAGIC', u8);
      expect(() => parsePakHeader(badMagicBuf)).toThrow(/Invalid PAK magic/);
    });
  });

  // ==========================================================================
  // MANDATE 3: 240Hz PHYSICS STEPPING AT 500 KPH, KERBS & BARRIER SCRAPES
  // ==========================================================================
  describe('Mandate 3: 240Hz Physics Stepping at Extreme Speed (500 KPH), Kerbs & Barrier Scrapes', () => {
    let streamer: SplineTrackStreamer;
    let pakStreamer: PakStreamer;

    beforeAll(() => {
      pakStreamer = new PakStreamer();
      streamer = new SplineTrackStreamer(5.0, 'track_golden_gp', pakStreamer);
    });

    it('steps 240Hz physics at 500 KPH for 1,200 sub-steps (5.0s) with zero NaN or physics explosions', async () => {
      const world = await RapierVehicleWorld.create(streamer);
      const jetSpec = getVehicleById('jet_thrust')!;
      const state = world.addVehicle('jet_player', jetSpec, 1000.0, 0.0);

      // Launch vehicle at 500 KPH (138.89 m/s)
      world.setVehicleSpeedAndHeading('jet_player', 500.0, 0.0, 0.0);
      world.setControlInput('jet_player', { throttle: 1.0, brake: 0.0, steer: 0.0 });

      let prevS = state.alongOffset;
      for (let step = 0; step < 1200; step++) {
        world.step(1 / 240);
        const current = world.getVehicleState('jet_player')!;

        // Bounded & Finite assertions
        expect(Number.isFinite(current.speedKph)).toBe(true);
        expect(Number.isFinite(current.alongOffset)).toBe(true);
        expect(Number.isFinite(current.lateralOffset)).toBe(true);
        expect(Number.isFinite(current.position[0])).toBe(true);
        expect(Number.isFinite(current.position[1])).toBe(true);
        expect(Number.isFinite(current.position[2])).toBe(true);
        expect(Number.isFinite(current.velocity[0])).toBe(true);
        expect(Number.isFinite(current.velocity[1])).toBe(true);
        expect(Number.isFinite(current.velocity[2])).toBe(true);
        expect(Number.isFinite(current.yawRad)).toBe(true);
        expect(Number.isFinite(current.pitchRad)).toBe(true);
        expect(Number.isFinite(current.rollRad)).toBe(true);

        // Vehicle advances forward along spline
        expect(current.alongOffset).toBeGreaterThanOrEqual(prevS);
        prevS = current.alongOffset;

        // Wheels state finite
        for (const w of current.wheels) {
          expect(Number.isFinite(w.compression)).toBe(true);
          expect(Number.isFinite(w.springForceN)).toBe(true);
          expect(Number.isFinite(w.tireTempCelsius)).toBe(true);
        }
      }

      expect(world.getTotalSubstepsExecuted()).toBe(1200);
      expect(state.speedKph).toBeGreaterThan(350.0);
      expect(state.alongOffset).toBeGreaterThan(1500.0); // Advanced >500m down spline
    });

    it('endures extreme steering oscillation and out-of-range inputs at 500 KPH without capsizing', async () => {
      const world = await RapierVehicleWorld.create(streamer);
      const f1Spec = getVehicleById('f1')!;
      world.addVehicle('f1_player', f1Spec, 500.0, 0.0);
      world.setVehicleSpeedAndHeading('f1_player', 500.0, 0.0, 0.0);

      // Rapidly oscillate steering between extreme -1.0 and +1.0 (and overdriven +/- 2.5)
      for (let cycle = 0; cycle < 40; cycle++) {
        const steerVal = cycle % 2 === 0 ? 2.5 : -2.5; // overdriven input
        world.setControlInput('f1_player', { throttle: 1.0, brake: 0.0, steer: steerVal });

        for (let sub = 0; sub < 12; sub++) {
          world.step(1 / 240);
          const st = world.getVehicleState('f1_player')!;

          expect(Number.isFinite(st.lateralOffset)).toBe(true);
          expect(Number.isFinite(st.speedKph)).toBe(true);
          expect(Number.isFinite(st.yawRad)).toBe(true);
          expect(Number.isFinite(st.pitchRad)).toBe(true);
          expect(Number.isFinite(st.rollRad)).toBe(true);

          // Lateral offset strictly confined within barrier boundaries (-9.5m .. +9.5m)
          expect(Math.abs(st.lateralOffset)).toBeLessThanOrEqual(9.5);

          for (const w of st.wheels) {
            expect(Number.isFinite(w.lateralForceN)).toBe(true);
            expect(Number.isFinite(w.slipAngleRad)).toBe(true);
          }
        }
      }
    });

    it('verifies 3D FIA sawtooth kerb vertical excitation and rumble telemetry', async () => {
      const world = await RapierVehicleWorld.create(streamer);
      const muscleSpec = getVehicleById('muscle')!;
      world.addVehicle('muscle_player', muscleSpec, 200.0, 8.8); // Position in right kerb band

      world.setVehicleSpeedAndHeading('muscle_player', 180.0, 0.0, 8.8);
      world.setControlInput('muscle_player', { throttle: 0.8, brake: 0.0, steer: 0.0 });

      let kerbEncountered = false;
      for (let i = 0; i < 240; i++) {
        world.step(1 / 240);
        const st = world.getVehicleState('muscle_player')!;

        expect(Number.isFinite(st.kerbRumbleIntensity)).toBe(true);
        expect(st.kerbRumbleIntensity).toBeGreaterThanOrEqual(0.0);
        expect(st.kerbRumbleIntensity).toBeLessThanOrEqual(1.0);

        // Check if any wheel detected KERB
        for (const w of st.wheels) {
          if (w.surfaceType === 'KERB') {
            kerbEncountered = true;
            expect(w.surfaceMu).toBeCloseTo(1.05, 2);
          }
        }
      }

      expect(kerbEncountered, 'Vehicle should have made contact with KERB surface').toBe(true);
    });

    it('verifies Lateral Tangent Barrier Projection at 500 KPH with continuous wall glide and sparks', async () => {
      const world = await RapierVehicleWorld.create(streamer);
      const jetSpec = getVehicleById('jet_thrust')!;
      world.addVehicle('jet_scraper', jetSpec, 2000.0, 8.5);

      // Force vehicle violently into right barrier at 500 KPH
      world.setVehicleSpeedAndHeading('jet_scraper', 500.0, 0.30, 9.8);
      world.setControlInput('jet_scraper', { throttle: 1.0, brake: 0.0, steer: 0.3 });

      let prevS = 2000.0;
      let sparksObserved = false;

      // Scrape along barrier for 480 sub-steps (2.0s)
      for (let i = 0; i < 480; i++) {
        world.step(1 / 240);
        const st = world.getVehicleState('jet_scraper')!;

        // ZERO BACKWARD TELEPORTATION: strictly monotonic forward advancement
        expect(st.alongOffset).toBeGreaterThanOrEqual(prevS);
        prevS = st.alongOffset;

        // Lateral clamping strictly applied to guardrail
        expect(st.lateralOffset).toBeLessThanOrEqual(9.05);

        // Barrier scrape active
        if (st.barrierContact) {
          sparksObserved = true;
          expect(st.barrierSparks.barrierSide).toBe('RIGHT');
          expect(st.barrierSparks.scrapeSpeedKph).toBeGreaterThan(400.0);
          expect(st.barrierSparks.sparkIntensity).toBeGreaterThan(0.5);
          expect(st.barrierSparks.sparkCount).toBeGreaterThanOrEqual(40);
          expect(Number.isFinite(st.barrierSparks.contactPointWorld[0])).toBe(true);
        }
      }

      expect(sparksObserved, 'Barrier scrape sparks should have been triggered').toBe(true);
    });

    it('verifies multi-surface tire thermals and puddle hydroplaning dynamics', async () => {
      const world = await RapierVehicleWorld.create(streamer);
      const roadsterSpec = getVehicleById('roadster')!;
      world.addVehicle('roadster_test', roadsterSpec, 100.0, 0.0);

      // Heavy acceleration & braking cycle to test tire thermal dynamics
      world.setVehicleSpeedAndHeading('roadster_test', 220.0, 0.0, 0.0);
      world.setControlInput('roadster_test', { throttle: 0.0, brake: 1.0, steer: 0.0 }); // heavy braking

      for (let i = 0; i < 240; i++) {
        world.step(1 / 240);
        const st = world.getVehicleState('roadster_test')!;

        for (const w of st.wheels) {
          expect(Number.isFinite(w.tireTempCelsius)).toBe(true);
          // Thermodynamic temperature must stay in reasonable motorsport range (20C .. 150C)
          expect(w.tireTempCelsius).toBeGreaterThanOrEqual(20.0);
          expect(w.tireTempCelsius).toBeLessThanOrEqual(150.0);
        }
      }
    });
  });
});
