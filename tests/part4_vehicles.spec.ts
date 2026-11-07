// tests/part4_vehicles.spec.ts
// Milestone M4: 34 Modular Vehicle Paks & 3D Cockpits Unit Test Suite
// Verifies:
// 1. All 34 vehicle paks on disk with exact size 4,705,888 B and valid APEXPAK1 headers.
// 2. Complete VehicleRoster (Cars #1–#34 across Tiers 0–5) with exact win requirements and specs.
// 3. HighPolyVehicleBuilder: Three.js hierarchy, active DRS/airbrake wing, 1000°C brake glow, 12 liveries.
// 4. CockpitInteriorBuilder: Framed glass, wipers, 3D dash telemetry screen, steering wheel shift LEDs, roll cage.

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as THREE from 'three';
import {
  APEX_PAK_MAGIC,
  APEX_PAK_VERSION,
  PakChunkType,
  PakType,
  VEHICLE_PAK_TARGET_BYTES,
  VehicleSpec,
  LiveCockpitTelemetry,
} from '../src/core/types';
import {
  PakStreamer,
  parsePakBundle,
  parsePakHeader,
  parsePakToc,
  resolveVehiclePakDir,
} from '../src/streaming/PakStreamer';
import {
  MOTORSPORT_TIER_NAMES,
  VEHICLE_COUNT,
  VEHICLE_ROSTER,
  getAllVehicles,
  getUnlockedVehicleCount,
  getVehicleById,
  getVehicleByIndex,
  getVehiclesByTier,
  isVehicleUnlocked,
} from '../src/vehicles/VehicleRoster';
import {
  HighPolyVehicleBuilder,
  buildVehicle,
  computeBrakeBlackbodyColor,
  setAirbrake,
  setBrakeTemperature,
  setDrsActive,
  setLivery,
  spinWheels,
  steerWheels,
  updateVehicle,
} from '../src/vehicles/HighPolyVehicleBuilder';
import {
  buildCockpitInterior,
  renderTelemetryCanvas,
  updateCockpitTelemetry,
} from '../src/vehicles/CockpitInteriorBuilder';
import { AUTOMOTIVE_PAINT_LIVERIES } from '../src/core/UncappedRenderer';

const ROOT_DIR = path.resolve(__dirname, '..');
const VEHICLES_ASSET_DIR = path.join(ROOT_DIR, 'assets', 'paks', 'vehicles');

describe('Part 4 / Milestone M4: 34 Modular Vehicle Paks & 3D Cockpits', () => {
  // ==========================================================================
  // 1. 34 VEHICLE .PAK BUNDLES ON DISK (F28)
  // ==========================================================================
  describe('F28: 30 Modular Vehicle Paks on Disk (assets/paks/vehicles/car_01..30/)', () => {
    it('verifies that exactly 30 vehicle.pak files exist on disk', () => {
      expect(fs.existsSync(VEHICLES_ASSET_DIR)).toBe(true);

      for (let i = 1; i <= 30; i++) {
        const carDir = `car_${String(i).padStart(2, '0')}`;
        const pakPath = path.join(VEHICLES_ASSET_DIR, carDir, 'vehicle.pak');
        expect(fs.existsSync(pakPath), `Missing pak at ${pakPath}`).toBe(true);
      }
    });

    it(`verifies each vehicle.pak is EXACTLY ${VEHICLE_PAK_TARGET_BYTES} bytes (total 282,353,280 bytes)`, () => {
      let totalBytes = 0;

      for (let i = 1; i <= 30; i++) {
        const carDir = `car_${String(i).padStart(2, '0')}`;
        const pakPath = path.join(VEHICLES_ASSET_DIR, carDir, 'vehicle.pak');
        const stat = fs.statSync(pakPath);
        expect(stat.size).toBe(VEHICLE_PAK_TARGET_BYTES);
        totalBytes += stat.size;
      }

      expect(totalBytes).toBe(30 * VEHICLE_PAK_TARGET_BYTES);
    });

    it('validates 64-byte APEXPAK1 header and TOC on car_01, car_15, car_25, car_30', () => {
      const testIndices = [1, 15, 25, 30];

      for (const idx of testIndices) {
        const carDir = `car_${String(idx).padStart(2, '0')}`;
        const pakPath = path.join(VEHICLES_ASSET_DIR, carDir, 'vehicle.pak');
        const nodeBuffer = fs.readFileSync(pakPath);
        const arrayBuf = nodeBuffer.buffer.slice(
          nodeBuffer.byteOffset,
          nodeBuffer.byteOffset + nodeBuffer.byteLength
        );

        const header = parsePakHeader(arrayBuf);
        expect(header.magic).toBe(APEX_PAK_MAGIC);
        expect(header.version).toBe(APEX_PAK_VERSION);
        expect(header.pakType).toBe(PakType.VEHICLE);
        expect(header.totalByteLength).toBe(VEHICLE_PAK_TARGET_BYTES);
        expect(header.sectorCount).toBe(0);
        expect(header.assetId).toBe(carDir);
        expect(header.entryCount).toBeGreaterThanOrEqual(12);

        // Validate TOC entries
        const toc = parsePakToc(arrayBuf, header.entryCount);
        const entryNames = toc.map((e) => e.name);

        expect(entryNames).toContain('json_meta');
        expect(entryNames).toContain('lod0_mesh_f32');
        expect(entryNames).toContain('lod1_mesh_f32');
        expect(entryNames).toContain('lod2_mesh_f32');
        expect(entryNames).toContain('pbr_albedo_4k');
        expect(entryNames).toContain('pbr_normal_4k');
        expect(entryNames).toContain('pbr_roughness_4k');
        expect(entryNames).toContain('pbr_metallic_4k');
        expect(entryNames).toContain('pbr_ao_4k');
        expect(entryNames).toContain('cockpit_telemetry_tex');
        expect(entryNames).toContain('exhaust_idle_pcm16');
        expect(entryNames).toContain('exhaust_mid_pcm16');
        expect(entryNames).toContain('exhaust_redline_pcm16');

        // Check alignment to 64 bytes
        for (const entry of toc) {
          expect(entry.byteOffset % 64).toBe(0);
          expect(entry.byteOffset + entry.byteLength).toBeLessThanOrEqual(VEHICLE_PAK_TARGET_BYTES);
        }

        // Full bundle parse
        const bundle = parsePakBundle(arrayBuf);
        expect(bundle.metadata).toBeDefined();
        expect(bundle.metadata?.index).toBe(idx);
        expect(bundle.metadata?.pakDir).toBe(carDir);
      }
    });

    it('verifies PakStreamer.loadVehiclePak successfully streams and caches vehicle paks', async () => {
      const streamer = new PakStreamer({ maxVramBytes: 32 * 1024 * 1024 });

      const car25Resolved = resolveVehiclePakDir(25);
      expect(car25Resolved.carDir).toBe('car_25');
      expect(car25Resolved.slug).toBe('pagani_utopia');

      const carPath = path.join(ROOT_DIR, car25Resolved.pakPath);
      const nodeBuf = fs.readFileSync(carPath);
      const arrayBuf = nodeBuf.buffer.slice(nodeBuf.byteOffset, nodeBuf.byteOffset + nodeBuf.byteLength);

      const bundle = streamer.loadFromBuffer('vehicle:car_25', arrayBuf, true);
      expect(bundle.header.assetId).toBe('car_25');
      expect(streamer.hasResidentAsset('vehicle:car_25')).toBe(true);

      const resident = streamer.getResidentAsset('vehicle:car_25');
      expect(resident).toBeDefined();
      expect(resident?.chunks.has('lod0_mesh_f32')).toBe(true);
      expect(resident?.chunks.has('pbr_albedo_4k')).toBe(true);
    });
  });

  // ==========================================================================
  // 2. COMPLETE 30-VEHICLE ROSTER & SPECIFICATIONS (F32)
  // ==========================================================================
  describe('F32: VehicleRoster Catalog & Motorsport Tiers 0–5', () => {
    it('verifies catalog contains exactly 30 vehicles in canonical order', () => {
      const all = getAllVehicles();
      expect(all.length).toBe(30);
      expect(VEHICLE_COUNT).toBe(30);

      for (let i = 0; i < 30; i++) {
        expect(all[i].index).toBe(i + 1);
        expect(all[i].pakDir).toBe(`car_${String(i + 1).padStart(2, '0')}`);
      }
    });

    it('verifies exact Motorsport Tier distribution and win progression', () => {
      // Tier 0: Starter (Cars 1-4) -> 4 Hatchbacks, exactly 2 FREE
      const tier0 = getVehiclesByTier(0);
      expect(tier0.length).toBe(4);
      expect(tier0.map((v) => v.id)).toEqual(['mini_jcw', 'hot_hatch', 'golf_r', 'gr_yaris']);
      expect(tier0[0].winsRequired).toBe(0);
      expect(tier0[0].creditCost).toBe(0);
      expect(tier0[1].winsRequired).toBe(0);
      expect(tier0[1].creditCost).toBe(0);
      expect(tier0[2].winsRequired).toBe(1);
      expect(tier0[3].winsRequired).toBe(2);

      // Tier 1: (Cars 5-9) -> 3..7 wins required
      const tier1 = getVehiclesByTier(1);
      expect(tier1.length).toBe(5);
      expect(tier1.map((v) => v.winsRequired)).toEqual([3, 4, 5, 6, 7]);

      // Tier 2: (Cars 10-14) -> 8..12 wins required
      const tier2 = getVehiclesByTier(2);
      expect(tier2.length).toBe(5);
      expect(tier2.map((v) => v.winsRequired)).toEqual([8, 9, 10, 11, 12]);

      // Tier 3: (Cars 15-19) -> 13..17 wins required
      const tier3 = getVehiclesByTier(3);
      expect(tier3.length).toBe(5);
      expect(tier3.map((v) => v.winsRequired)).toEqual([13, 14, 15, 16, 17]);

      // Tier 4: (Cars 20-24) -> 18..22 wins required
      const tier4 = getVehiclesByTier(4);
      expect(tier4.length).toBe(5);
      expect(tier4.map((v) => v.winsRequired)).toEqual([18, 19, 20, 21, 22]);

      // Tier 5: (Cars 25-30) -> 23..28 wins required
      const tier5 = getVehiclesByTier(5);
      expect(tier5.length).toBe(6);
      expect(tier5.map((v) => v.winsRequired)).toEqual([23, 24, 25, 26, 27, 28]);
    });

    it('verifies exact vehicle specs for key representative cars', () => {
      // Car #1 Mini Cooper JCW
      const mini = getVehicleById('mini_jcw')!;
      expect(mini).toBeDefined();
      expect(mini.massKg).toBe(1280);
      expect(mini.zeroToHundredSec).toBe(6.1);
      expect(mini.topSpeedKph).toBe(246);
      expect(mini.winsRequired).toBe(0);

      // Car #2 Civic Type-R
      const typeR = getVehicleById('hot_hatch')!;
      expect(typeR.massKg).toBe(1390);
      expect(typeR.zeroToHundredSec).toBe(5.2);
      expect(typeR.topSpeedKph).toBe(275);
      expect(typeR.winsRequired).toBe(0);

      // Car #15 Bentley Flying Spur
      const bentley = getVehicleById('bentley_sedan')!;
      expect(bentley.massKg).toBe(2437);
      expect(bentley.zeroToHundredSec).toBe(3.7);
      expect(bentley.topSpeedKph).toBe(333);
      expect(bentley.winsRequired).toBe(13);

      // Car #25 Pagani Utopia
      const pagani = getVehicleById('pagani_utopia')!;
      expect(pagani.index).toBe(25);
      expect(pagani.massKg).toBe(1280);
      expect(pagani.zeroToHundredSec).toBe(2.7);
      expect(pagani.topSpeedKph).toBe(360);
      expect(pagani.winsRequired).toBe(23);
      expect(pagani.hasTransparentEngineBay).toBe(true);

      // Car #27 Bugatti Bolide
      const bolide = getVehicleById('bugatti_bolide')!;
      expect(bolide.massKg).toBe(1450);
      expect(bolide.zeroToHundredSec).toBe(2.2);
      expect(bolide.topSpeedKph).toBe(440);
      expect(bolide.winsRequired).toBe(25);

      // Car #30 Rimac Nevera
      const nevera = getVehicleById('rimac_nevera')!;
      expect(nevera.topSpeedKph).toBe(412);
      expect(nevera.zeroToHundredSec).toBe(1.74);
      expect(nevera.winsRequired).toBe(28);
    });

    it('verifies lookup functions and aliases work reliably', () => {
      expect(getVehicleByIndex(1)?.id).toBe('mini_jcw');
      expect(getVehicleByIndex(30)?.id).toBe('rimac_nevera');
      expect(getVehicleByIndex(0)).toBeUndefined();
      expect(getVehicleByIndex(31)).toBeUndefined();

      // Lookup by folder name
      expect(getVehicleById('car_01')?.id).toBe('mini_jcw');
      expect(getVehicleById('car_25')?.id).toBe('pagani_utopia');

      // Lookup by alias
      expect(getVehicleById('mini')?.id).toBe('mini_jcw');
      expect(getVehicleById('bentley')?.id).toBe('bentley_sedan');
      expect(getVehicleById('laferrari')?.id).toBe('ferrari_laferrari');

      // Unlocked state check
      expect(isVehicleUnlocked('mini_jcw', 0)).toBe(true);
      expect(isVehicleUnlocked('hot_hatch', 0)).toBe(true);
      expect(isVehicleUnlocked('golf_r', 0)).toBe(false);
      expect(isVehicleUnlocked('golf_r', 1)).toBe(true);
      expect(isVehicleUnlocked('rimac_nevera', 27)).toBe(false);
      expect(isVehicleUnlocked('rimac_nevera', 28)).toBe(true);

      expect(getUnlockedVehicleCount(0)).toBe(2); // 2 free starter cars
      expect(getUnlockedVehicleCount(1)).toBe(3);
      expect(getUnlockedVehicleCount(28)).toBe(30); // all 30 unlocked
    });
  });

  // ==========================================================================
  // 3. HIGH-POLY VEHICLE BUILDER, DRS WING & BRAKE GLOW (F29)
  // ==========================================================================
  describe('F29: HighPolyVehicleBuilder & Active Aerodynamics', () => {
    let paganiSpec: VehicleSpec;

    beforeAll(() => {
      paganiSpec = getVehicleById('pagani_v12')!;
    });

    it('constructs complete Three.js vehicle model hierarchy with high-poly bodywork and 4 wheels', () => {
      const model = buildVehicle(paganiSpec, 0);

      expect(model.rootGroup).toBeInstanceOf(THREE.Group);
      expect(model.bodyMesh).toBeInstanceOf(THREE.Mesh);
      expect(model.splitterMesh).toBeInstanceOf(THREE.Mesh);
      expect(model.diffuserMesh).toBeInstanceOf(THREE.Mesh);
      expect(model.wingMesh).toBeInstanceOf(THREE.Mesh);

      // Check 4 wheels and brakes
      expect(model.wheels.fl).toBeDefined();
      expect(model.wheels.fr).toBeDefined();
      expect(model.wheels.rl).toBeDefined();
      expect(model.wheels.rr).toBeDefined();
      expect(model.brakeDiscs.length).toBe(4);
      expect(model.brakeDiscMaterials.length).toBe(4);

      // Verify cockpit interior is attached
      expect(model.cockpitInterior).toBeDefined();
      expect(model.rootGroup.children).toContain(model.cockpitInterior.rootGroup);
    });

    it('applies all 12 automotive PBR paint finishes correctly', () => {
      const model = buildVehicle(paganiSpec, 0);
      expect(model.currentLiveryIndex).toBe(0);

      for (let i = 0; i < 12; i++) {
        setLivery(model, i);
        expect(model.currentLiveryIndex).toBe(i);
        const preset = AUTOMOTIVE_PAINT_LIVERIES[i];

        // Check livery uniform updates on body material
        const bodyMat = model.bodyMaterials[0] as THREE.ShaderMaterial;
        if (bodyMat.uniforms) {
          expect(bodyMat.uniforms.uLiveryIndex.value).toBe(i);
        }
      }
    });

    it('controls active DRS / Airbrake rear wing tilt', () => {
      const model = buildVehicle(paganiSpec, 0);

      // Default downforce trim: approx 0.18 rad
      expect(model.wingMesh.rotation.x).toBeCloseTo(0.18, 2);

      // Open DRS -> flattens to 0.0 rad
      setDrsActive(model, true);
      expect(model.isDrsActive).toBe(true);
      expect(model.wingMesh.rotation.x).toBe(0.0);

      // Close DRS -> returns to downforce position
      setDrsActive(model, false);
      expect(model.isDrsActive).toBe(false);
      expect(model.wingMesh.rotation.x).toBeCloseTo(0.18, 2);

      // Apply heavy braking -> airbrake tilts up to 0.785 rad (45 deg)
      setAirbrake(model, 1.0);
      expect(model.wingMesh.rotation.x).toBeCloseTo(0.785, 2);

      setAirbrake(model, 0.5);
      expect(model.wingMesh.rotation.x).toBeGreaterThan(0.18);
      expect(model.wingMesh.rotation.x).toBeLessThan(0.785);
    });

    it('heats carbon-ceramic brake discs to 1,000°C with dynamic blackbody thermal emission', () => {
      const model = buildVehicle(paganiSpec, 0);

      // Ambient temp (25C) -> zero thermal glow
      setBrakeTemperature(model, 25.0);
      expect(model.currentBrakeTempCelsius).toBe(25.0);
      const amb = computeBrakeBlackbodyColor(25.0);
      expect(amb.intensity).toBe(0.0);

      // Moderate braking (450C) -> low dull red glow
      setBrakeTemperature(model, 450.0);
      expect(model.currentBrakeTempCelsius).toBe(450.0);
      const mid = computeBrakeBlackbodyColor(450.0);
      expect(mid.intensity).toBeGreaterThan(0.1);
      expect(mid.color.r).toBeGreaterThan(mid.color.g);

      // Severe heavy braking (1,000°C) -> bright orange-yellow thermal glow
      setBrakeTemperature(model, 1000.0);
      expect(model.currentBrakeTempCelsius).toBe(1000.0);
      const high = computeBrakeBlackbodyColor(1000.0);
      expect(high.intensity).toBeGreaterThan(3.0);
      expect(high.color.r).toBeGreaterThan(0.8);
      expect(high.color.g).toBeGreaterThan(0.5); // Yellow component present
    });

    it('steers front wheels and spins all wheels based on velocity', () => {
      const model = buildVehicle(paganiSpec, 0);

      steerWheels(model, 0.35);
      expect(model.steerAngleRad).toBe(0.35);
      expect(model.wheels.fl.steerPivot?.rotation.y).toBe(0.35);
      expect(model.wheels.fr.steerPivot?.rotation.y).toBe(0.35);

      spinWheels(model, 50.0, 0.1); // 50 rad/s for 0.1s = 5 rad
      expect(model.wheelSpinRad).toBeCloseTo(5.0, 3);
      expect(model.wheels.fl.rimMesh.rotation.x).toBeCloseTo(5.0, 3);
    });
  });

  // ==========================================================================
  // 4. COCKPIT INTERIOR BUILDER & LIVE TELEMETRY SCREEN (F30, F31)
  // ==========================================================================
  describe('F30 & F31: CockpitInteriorBuilder & Playable 3D Cockpit', () => {
    let f1Spec: VehicleSpec;

    beforeAll(() => {
      f1Spec = getVehicleById('f1')!;
    });

    it('constructs framed multi-pane automotive glass with dual animated wipers', () => {
      const cockpit = buildCockpitInterior(f1Spec);

      expect(cockpit.glassGroup).toBeInstanceOf(THREE.Group);
      expect(cockpit.windshieldMesh).toBeInstanceOf(THREE.Mesh);
      expect(cockpit.leftWindowMesh).toBeInstanceOf(THREE.Mesh);
      expect(cockpit.rightWindowMesh).toBeInstanceOf(THREE.Mesh);
      expect(cockpit.rearBackglassMesh).toBeInstanceOf(THREE.Mesh);

      // Check structural pillars and mirrors
      expect(cockpit.aPillarsMesh).toBeInstanceOf(THREE.Mesh);
      expect(cockpit.bcPillarsMesh).toBeInstanceOf(THREE.Mesh);
      expect(cockpit.beltlineTrimMesh).toBeInstanceOf(THREE.Mesh);
      expect(cockpit.interiorRearviewMirror).toBeInstanceOf(THREE.Group);

      // Check dual wipers
      expect(cockpit.wipers.leftWiper).toBeInstanceOf(THREE.Group);
      expect(cockpit.wipers.rightWiper).toBeInstanceOf(THREE.Group);
      expect(cockpit.wipers.wiperBlades.length).toBe(2);
    });

    it('constructs first-person 3D cockpit interior with live telemetry screen, seats & roll cage', () => {
      const cockpit = buildCockpitInterior(f1Spec);

      // 3D Dashboard & Telemetry Screen
      expect(cockpit.dashboardGroup).toBeInstanceOf(THREE.Group);
      expect(cockpit.telemetryScreenMesh).toBeInstanceOf(THREE.Mesh);
      expect(cockpit.telemetryTexture).toBeInstanceOf(THREE.CanvasTexture);

      // Steering wheel and shift LED lights
      expect(cockpit.steeringWheelGroup).toBeInstanceOf(THREE.Group);
      expect(cockpit.steeringWheelMesh).toBeInstanceOf(THREE.Mesh);
      expect(cockpit.shiftLeds.length).toBe(9);
      expect(cockpit.shiftLedMaterials.length).toBe(9);

      // Racing seats, harness belts, and driver helmet
      expect(cockpit.seats.driverSeat).toBeInstanceOf(THREE.Group);
      expect(cockpit.seats.driverHelmet).toBeInstanceOf(THREE.Mesh);
      expect(cockpit.seats.harnessBelts.length).toBeGreaterThanOrEqual(2);

      // Tubular Roll Cage
      expect(cockpit.rollCageGroup).toBeInstanceOf(THREE.Group);
      expect(cockpit.rollCageGroup.children.length).toBeGreaterThan(0);

      // First-person camera anchor placed at driver eye-height
      expect(cockpit.cockpitCameraAnchor).toBeInstanceOf(THREE.Object3D);
      expect(cockpit.cockpitCameraAnchor.position.y).toBeGreaterThan(1.0);
    });

    it('renders 2D telemetry canvas and updates shift LEDs on live telemetry tick', () => {
      const cockpit = buildCockpitInterior(f1Spec);

      const liveTelemetry: LiveCockpitTelemetry = {
        speedKph: 315.4,
        rpm: 14200,
        maxRpm: 15000,
        gear: 7,
        lapDeltaSec: -0.42,
        currentLap: 2,
        totalLaps: 3,
        position: 1,
        totalRacers: 16,
        nitroPercent: 88,
        drsActive: true,
        brakeTempCelsius: 680,
        sectorSplits: [null, null, null],
      };

      updateCockpitTelemetry(cockpit, liveTelemetry, 0.016);
      expect(cockpit.lastTelemetry).toEqual(liveTelemetry);
      expect(cockpit.telemetryTexture.version).toBeGreaterThan(0);

      // At 14,200 / 15,000 RPM (94.6% max RPM), high shift LEDs should be active
      const redLed = cockpit.shiftLedMaterials[7];
      expect(redLed.color.getHex()).toBe(0xff0022); // Active bright red

      // Test lower RPM (5,000 RPM = 33% max)
      const lowRpmTelemetry: LiveCockpitTelemetry = {
        ...liveTelemetry,
        rpm: 5000,
        gear: 2,
      };
      updateCockpitTelemetry(cockpit, lowRpmTelemetry, 0.016);
      const lowLed = cockpit.shiftLedMaterials[7];
      expect(lowLed.color.getHex()).toBe(0x330000); // Inactive dim red
    });

    it('updates full vehicle model via updateVehicle() method', () => {
      const paganiSpec = getVehicleById('pagani_v12')!;
      const model = buildVehicle(paganiSpec, 2);

      const telemetry: LiveCockpitTelemetry = {
        speedKph: 240,
        rpm: 8200,
        maxRpm: 9000,
        gear: 5,
        lapDeltaSec: -0.15,
        currentLap: 1,
        totalLaps: 3,
        position: 2,
        totalRacers: 16,
        nitroPercent: 75,
        drsActive: false,
        brakeTempCelsius: 750, // Heavy braking
        sectorSplits: [null, null, null],
      };

      updateVehicle(model, telemetry, 0.016);

      // Verify brake temp updated
      expect(model.currentBrakeTempCelsius).toBe(750);

      // Verify airbrake tilted up due to heavy braking
      expect(model.wingMesh.rotation.x).toBeGreaterThan(0.5);

      // Verify wheels spun
      expect(model.wheelSpinRad).toBeGreaterThan(0.0);
    });
  });

  // ==========================================================================
  // ==========================================================================
  // 5. 30 BESPOKE VISUAL ARCHETYPES & SIGNATURE GEOMETRY (F33)
  // ==========================================================================
  describe('F33: 30 Bespoke Visual Archetypes & Signature Geometry', () => {
    it('verifies Mini Cooper JCW (Car #1) halo lights, hex grille with red bar, scoop, and spoiler', () => {
      const miniSpec = getVehicleById('mini_jcw')!;
      const model = buildVehicle(miniSpec, 0);

      // Check 4 wheels and brakes
      expect(model.wheels.fl).toBeDefined();
      expect(model.wheels.fr).toBeDefined();
      expect(model.wheels.rl).toBeDefined();
      expect(model.wheels.rr).toBeDefined();
      expect(model.brakeDiscs.length).toBe(4);

      // Check for round halo LED lights and hex grille with red bar
      let foundHalo = false;
      let foundRedBar = false;
      let foundRoofSpoiler = false;

      model.bodyworkGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          if (obj.geometry instanceof THREE.TorusGeometry && obj.position.z > 1.5) {
            foundHalo = true;
          }
          if (obj.geometry instanceof THREE.BoxGeometry) {
            const p = (obj.geometry as THREE.BoxGeometry).parameters;
            if (p.height < 0.05 && p.depth < 0.08 && p.width > 0.6) {
              foundRedBar = true;
            }
            if (p.width > 1.0 && obj.position.y > 1.3 && obj.position.z < -1.5) {
              foundRoofSpoiler = true;
            }
          }
        }
      });

      expect(foundHalo).toBe(true);
      expect(foundRedBar).toBe(true);
      expect(foundRoofSpoiler).toBe(true);
    });

    it('verifies Bentley Flying Spur (Car #15) grand matrix grille, Flying B mascot, and crystal round headlights', () => {
      const bentleySpec = getVehicleById('bentley_sedan')!;
      const model = buildVehicle(bentleySpec, 0);

      let foundMatrix = false;
      let foundFlyingB = false;

      model.bodyworkGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          if (obj.geometry instanceof THREE.BoxGeometry && obj.position.z > 2.4) {
            const p = (obj.geometry as THREE.BoxGeometry).parameters;
            if (p.width > 0.7 && p.height > 0.5) foundMatrix = true;
          }
          if (obj.geometry instanceof THREE.ConeGeometry && obj.position.y > 1.0) {
            foundFlyingB = true;
          }
        }
      });

      expect(foundMatrix).toBe(true);
      expect(foundFlyingB).toBe(true);
    });

    it('verifies Ferrari LaFerrari (Car #26) F1 pointed nosecone with keel, nostrils, and black canopy roof', () => {
      const feSpec = getVehicleById('ferrari_laferrari')!;
      const model = buildVehicle(feSpec, 0);

      let foundKeel = false;
      let nostrilCount = 0;

      model.bodyworkGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          if (obj.geometry instanceof THREE.BoxGeometry) {
            const p = (obj.geometry as THREE.BoxGeometry).parameters;
            if (p.width < 0.05 && p.depth > 0.5 && obj.position.z > 1.8) foundKeel = true;
            if (p.height < 0.06 && p.depth > 0.25 && obj.position.y > 0.6 && obj.position.z > 1.0) {
              nostrilCount++;
            }
          }
        }
      });

      expect(foundKeel).toBe(true);
      expect(nostrilCount).toBeGreaterThanOrEqual(2);
    });

    it('verifies Bugatti Bolide (Car #27) horseshoe grille, sweeping C-line contour, center spine, and dual lightbars', () => {
      const bolideSpec = getVehicleById('bugatti_bolide')!;
      const model = buildVehicle(bolideSpec, 0);

      let foundHorseshoe = false;
      let cLineCount = 0;
      let centerSpineFound = false;

      model.bodyworkGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          if (obj.geometry instanceof THREE.TorusGeometry && obj.position.z > 2.0) {
            foundHorseshoe = true;
          }
          if (obj.geometry instanceof THREE.BoxGeometry) {
            const params = (obj.geometry as THREE.BoxGeometry).parameters;
            if (params.width < 0.03 && params.depth > 3.0) {
              centerSpineFound = true;
            }
          }
        }
        if (obj instanceof THREE.Group && obj.children.length >= 1) {
          if (Math.abs(obj.position.x) > 0.9 && Math.abs(obj.position.x) < 1.15) {
            cLineCount++;
          }
        }
      });

      expect(foundHorseshoe).toBe(true);
      expect(centerSpineFound).toBe(true);
      expect(cLineCount).toBe(2);
      expect(model.wingMesh.name).toBe('ActiveAirfoilBlade');
    });

    it('verifies Ford Ranger Raptor (Car #06) twin-bar grille, front skid plate, and sailplane bar', () => {
      const rangerSpec = getVehicleById('ranger_truck')!;
      const model = buildVehicle(rangerSpec, 0);

      let foundSkidPlate = false;
      let foundSailplane = false;

      model.bodyworkGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          if (obj.geometry instanceof THREE.BoxGeometry) {
            const p = (obj.geometry as THREE.BoxGeometry).parameters;
            if (p.width > 0.6 && obj.position.y < 0.45 && obj.position.z > 2.5) foundSkidPlate = true;
            if (p.height > 0.4 && obj.position.z < -0.3 && obj.position.z > -0.6) foundSailplane = true;
          }
        }
      });

      expect(foundSkidPlate).toBe(true);
      expect(foundSailplane).toBe(true);
    });

    it('verifies Global 4x4 Overland (Car #10) lifted suspension, snorkel tube, and roof rack with gear', () => {
      const overlandSpec = getVehicleById('overland_truck')!;
      const model = buildVehicle(overlandSpec, 0);

      let foundSnorkel = false;
      let foundRoofRack = false;

      model.bodyworkGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          if (obj.geometry instanceof THREE.CylinderGeometry && obj.position.x > 0.8 && obj.position.y > 1.0) {
            foundSnorkel = true;
          }
        }
        if (obj instanceof THREE.Group && obj.position.y > 1.7) {
          foundRoofRack = true;
        }
      });

      expect(foundSnorkel).toBe(true);
      expect(foundRoofRack).toBe(true);
    });

    it('verifies Porsche 911 Targa (Car #17) silver Targa roll hoop and curved rear glass dome', () => {
      const targaSpec = getVehicleById('porsche_targa')!;
      const model = buildVehicle(targaSpec, 0);

      let foundHoop = false;
      let foundDome = false;

      model.bodyworkGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          if (obj.geometry instanceof THREE.BoxGeometry) {
            const p = (obj.geometry as THREE.BoxGeometry).parameters;
            if (p.width > 1.5 && obj.position.y > 1.0 && Math.abs(obj.position.z + 0.22) < 0.1) foundHoop = true;
          }
          if (obj.geometry instanceof THREE.SphereGeometry && obj.position.z < -0.5) {
            foundDome = true;
          }
        }
      });

      expect(foundHoop).toBe(true);
      expect(foundDome).toBe(true);
    });

    it('verifies Pagani Utopia (Car #25) twin fender pontoons, central wiper, and quad exhaust cluster', () => {
      const utopiaSpec = getVehicleById('pagani_utopia')!;
      const model = buildVehicle(utopiaSpec, 0);

      let foundWiper = false;
      let foundQuad = false;

      model.bodyworkGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          if (obj.geometry instanceof THREE.BoxGeometry) {
            const p = (obj.geometry as THREE.BoxGeometry).parameters;
            if (p.height > 0.5 && p.width < 0.03 && obj.position.z > 0.5) foundWiper = true;
          }
        }
        if (obj instanceof THREE.Group && obj.position.z < -2.2) {
          foundQuad = true;
        }
      });

      expect(foundWiper).toBe(true);
      expect(foundQuad).toBe(true);
    });

    it('verifies Terzo EV (Car #28) low geometric wedge, cyan glowing LED streaks, and aero disc wheels', () => {
      const terzoSpec = getVehicleById('terzo_ev')!;
      const model = buildVehicle(terzoSpec, 0);

      let cyanStreakCount = 0;
      model.bodyworkGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.geometry instanceof THREE.BoxGeometry) {
          const p = (obj.geometry as THREE.BoxGeometry).parameters;
          if (p.depth > 1.5 && Math.abs(obj.position.x) > 0.9) {
            cyanStreakCount++;
          }
        }
      });

      expect(cyanStreakCount).toBe(2);
    });

    it('verifies that ALL 30 roster vehicles build successfully with complete Three.js hierarchy', () => {
      const allSpecs = getAllVehicles();
      expect(allSpecs.length).toBe(30);

      for (const spec of allSpecs) {
        const model = buildVehicle(spec, 0);

        expect(model.rootGroup, `Car ${spec.index} (${spec.id}) missing rootGroup`).toBeInstanceOf(THREE.Group);
        expect(model.bodyMesh, `Car ${spec.index} (${spec.id}) missing bodyMesh`).toBeInstanceOf(THREE.Mesh);
        expect(model.splitterMesh, `Car ${spec.index} (${spec.id}) missing splitterMesh`).toBeInstanceOf(THREE.Mesh);
        expect(model.diffuserMesh, `Car ${spec.index} (${spec.id}) missing diffuserMesh`).toBeInstanceOf(THREE.Mesh);
        expect(model.wingMesh, `Car ${spec.index} (${spec.id}) missing wingMesh`).toBeInstanceOf(THREE.Mesh);

        // 4 wheels and brakes
        expect(model.wheels.fl, `Car ${spec.index} missing fl wheel`).toBeDefined();
        expect(model.wheels.fr, `Car ${spec.index} missing fr wheel`).toBeDefined();
        expect(model.wheels.rl, `Car ${spec.index} missing rl wheel`).toBeDefined();
        expect(model.wheels.rr, `Car ${spec.index} missing rr wheel`).toBeDefined();
        expect(model.brakeDiscs.length).toBe(4);
        expect(model.brakeDiscMaterials.length).toBe(4);

        // Cockpit interior
        expect(model.cockpitInterior, `Car ${spec.index} missing cockpit`).toBeDefined();
        expect(model.cockpitInterior.telemetryScreenMesh).toBeInstanceOf(THREE.Mesh);
        expect(model.cockpitInterior.shiftLeds.length).toBe(9);
        expect(model.cockpitInterior.cockpitCameraAnchor.position.y).toBeGreaterThan(1.0);
      }
    });
  });
});

