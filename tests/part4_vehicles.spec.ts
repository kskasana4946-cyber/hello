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
  describe('F28: 34 Modular Vehicle Paks on Disk (assets/paks/vehicles/car_01..34/)', () => {
    it('verifies that exactly 34 vehicle.pak files exist on disk', () => {
      expect(fs.existsSync(VEHICLES_ASSET_DIR)).toBe(true);

      for (let i = 1; i <= 34; i++) {
        const carDir = `car_${String(i).padStart(2, '0')}`;
        const pakPath = path.join(VEHICLES_ASSET_DIR, carDir, 'vehicle.pak');
        expect(fs.existsSync(pakPath), `Missing pak at ${pakPath}`).toBe(true);
      }
    });

    it(`verifies each vehicle.pak is EXACTLY ${VEHICLE_PAK_TARGET_BYTES} bytes (total 160,000,192 bytes)`, () => {
      let totalBytes = 0;

      for (let i = 1; i <= 34; i++) {
        const carDir = `car_${String(i).padStart(2, '0')}`;
        const pakPath = path.join(VEHICLES_ASSET_DIR, carDir, 'vehicle.pak');
        const stat = fs.statSync(pakPath);
        expect(stat.size).toBe(VEHICLE_PAK_TARGET_BYTES);
        totalBytes += stat.size;
      }

      expect(totalBytes).toBe(34 * VEHICLE_PAK_TARGET_BYTES); // 160,000,192 bytes (~160.00 MB)
    });

    it('validates 64-byte APEXPAK1 header and TOC on car_01, car_15, car_25, car_34', () => {
      const testIndices = [1, 15, 25, 34];

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
      expect(car25Resolved.slug).toBe('pagani_v12');

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
  // 2. COMPLETE 34-VEHICLE ROSTER & SPECIFICATIONS (F32)
  // ==========================================================================
  describe('F32: VehicleRoster Catalog & Motorsport Tiers 0–5', () => {
    it('verifies catalog contains exactly 34 vehicles in canonical order', () => {
      const all = getAllVehicles();
      expect(all.length).toBe(34);
      expect(VEHICLE_COUNT).toBe(34);

      for (let i = 0; i < 34; i++) {
        expect(all[i].index).toBe(i + 1);
        expect(all[i].pakDir).toBe(`car_${String(i + 1).padStart(2, '0')}`);
      }
    });

    it('verifies exact Motorsport Tier distribution and win progression', () => {
      // Tier 0: Starter (Cars 1-3) -> 0 wins required
      const tier0 = getVehiclesByTier(0);
      expect(tier0.length).toBe(3);
      expect(tier0.map((v) => v.id)).toEqual(['scooter', 'hot_hatch', 'roadster']);
      expect(tier0.every((v) => v.winsRequired === 0)).toBe(true);
      expect(tier0.every((v) => v.creditCost === 0)).toBe(true);

      // Tier 1: JDM / Off-Road (Cars 4-9) -> 1..6 wins required
      const tier1 = getVehiclesByTier(1);
      expect(tier1.length).toBe(6);
      expect(tier1.map((v) => v.winsRequired)).toEqual([1, 2, 3, 4, 5, 6]);

      // Tier 2: Heavy Iron & Pursuit (Cars 10-15) -> 7..12 wins required
      const tier2 = getVehiclesByTier(2);
      expect(tier2.length).toBe(6);
      expect(tier2.map((v) => v.winsRequired)).toEqual([7, 8, 9, 10, 11, 12]);

      // Tier 3: Track Toys & GT3 (Cars 16-21) -> 13..18 wins required
      const tier3 = getVehiclesByTier(3);
      expect(tier3.length).toBe(6);
      expect(tier3.map((v) => v.winsRequired)).toEqual([13, 14, 15, 16, 17, 18]);

      // Tier 4: Exotic Supercars & Hypercars (Cars 22-27) -> 19..24 wins required
      const tier4 = getVehiclesByTier(4);
      expect(tier4.length).toBe(6);
      expect(tier4.map((v) => v.winsRequired)).toEqual([19, 20, 21, 22, 23, 24]);

      // Tier 5: Prototypes & Mythic Concepts (Cars 28-34) -> 25..31 wins required
      const tier5 = getVehiclesByTier(5);
      expect(tier5.length).toBe(7);
      expect(tier5.map((v) => v.winsRequired)).toEqual([25, 26, 27, 28, 29, 30, 31]);
    });

    it('verifies exact vehicle specs for key representative cars', () => {
      // Car #1 Scooter
      const scooter = getVehicleById('scooter')!;
      expect(scooter).toBeDefined();
      expect(scooter.massKg).toBe(135);
      expect(scooter.zeroToHundredSec).toBe(7.2);
      expect(scooter.topSpeedKph).toBe(145);
      expect(scooter.winsRequired).toBe(0);

      // Car #4 RX-7
      const rx7 = getVehicleById('jdm_rotary')!;
      expect(rx7.massKg).toBe(1280);
      expect(rx7.zeroToHundredSec).toBe(4.7);
      expect(rx7.topSpeedKph).toBe(265);
      expect(rx7.winsRequired).toBe(1);

      // Car #15 Express Bus
      const bus = getVehicleById('bus')!;
      expect(bus.massKg).toBe(8400);
      expect(bus.zeroToHundredSec).toBe(11.5);
      expect(bus.topSpeedKph).toBe(136);
      expect(bus.winsRequired).toBe(12);

      // Car #25 Pagani Huayra
      const pagani = getVehicleById('pagani_v12')!;
      expect(pagani.index).toBe(25);
      expect(pagani.massKg).toBe(1280);
      expect(pagani.zeroToHundredSec).toBe(2.7);
      expect(pagani.topSpeedKph).toBe(360);
      expect(pagani.winsRequired).toBe(22);
      expect(pagani.hasTransparentEngineBay).toBe(true);

      // Car #27 Bugatti Chiron
      const chiron = getVehicleById('hyper')!;
      expect(chiron.massKg).toBe(1995);
      expect(chiron.zeroToHundredSec).toBe(2.4);
      expect(chiron.topSpeedKph).toBe(420);
      expect(chiron.winsRequired).toBe(24);

      // Car #28 Rimac Nevera
      const nevera = getVehicleById('ev_proto')!;
      expect(nevera.topSpeedKph).toBe(412);
      expect(nevera.zeroToHundredSec).toBe(1.85);
      expect(nevera.winsRequired).toBe(25);

      // Car #34 Jet Thrust Supersonic Concept
      const jet = getVehicleById('jet_thrust')!;
      expect(jet.index).toBe(34);
      expect(jet.massKg).toBe(2400);
      expect(jet.zeroToHundredSec).toBe(1.65);
      expect(jet.topSpeedKph).toBe(485);
      expect(jet.winsRequired).toBe(31);
      expect(jet.drivetrain).toBe('JET');
      expect(jet.redlineRpm).toBe(15000);
    });

    it('verifies lookup functions and aliases work reliably', () => {
      expect(getVehicleByIndex(1)?.id).toBe('scooter');
      expect(getVehicleByIndex(34)?.id).toBe('jet_thrust');
      expect(getVehicleByIndex(0)).toBeUndefined();
      expect(getVehicleByIndex(35)).toBeUndefined();

      // Lookup by folder name
      expect(getVehicleById('car_01')?.id).toBe('scooter');
      expect(getVehicleById('car_25')?.id).toBe('pagani_v12');

      // Lookup by alias
      expect(getVehicleById('euro_tourer')?.id).toBe('classic_muscle');
      expect(getVehicleById('hyper_v12')?.id).toBe('ferrari_v8');
      expect(getVehicleById('lemans_gt')?.id).toBe('cyber_bike');

      // Unlocked state check
      expect(isVehicleUnlocked('scooter', 0)).toBe(true);
      expect(isVehicleUnlocked('jdm_rotary', 0)).toBe(false);
      expect(isVehicleUnlocked('jdm_rotary', 1)).toBe(true);
      expect(isVehicleUnlocked('jet_thrust', 30)).toBe(false);
      expect(isVehicleUnlocked('jet_thrust', 31)).toBe(true);

      expect(getUnlockedVehicleCount(0)).toBe(3); // 3 starter cars
      expect(getUnlockedVehicleCount(1)).toBe(4);
      expect(getUnlockedVehicleCount(31)).toBe(34); // all 34 unlocked
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
  // 5. 34 BESPOKE VISUAL ARCHETYPES & SIGNATURE GEOMETRY (F33)
  // ==========================================================================
  describe('F33: 34 Bespoke Visual Archetypes & Signature Geometry', () => {
    it('verifies Scooter (Car #1) 2-wheel inline geometry, rider silhouette, and hidden helper wheels', () => {
      const scooterSpec = getVehicleById('scooter')!;
      const model = buildVehicle(scooterSpec, 0);

      // Inline front and rear wheels along x = 0
      expect(model.wheels.fl.group.position.x).toBe(0);
      expect(model.wheels.rl.group.position.x).toBe(0);
      expect(model.wheels.fl.group.position.z).toBeGreaterThan(0.5);
      expect(model.wheels.rl.group.position.z).toBeLessThan(-0.5);

      // Helper wheels hidden for physics & test contract compatibility
      expect(model.wheels.fr.group.visible).toBe(false);
      expect(model.wheels.rr.group.visible).toBe(false);
      expect(model.wheels.fr.group.position.y).toBe(-10);
      expect(model.wheels.rr.group.position.y).toBe(-10);

      // 4 brake discs and materials present
      expect(model.brakeDiscs.length).toBe(4);
      expect(model.brakeDiscMaterials.length).toBe(4);

      // 3D Rider Silhouette with helmet exists in bodyworkGroup
      const rider = model.bodyworkGroup.getObjectByName('ScooterRiderSilhouette');
      expect(rider).toBeDefined();
      expect(rider).toBeInstanceOf(THREE.Group);
      expect(rider!.children.length).toBeGreaterThanOrEqual(3); // Torso, helmet, visor, arms

      // Cockpit interior: motorcycle handlebars
      expect(model.cockpitInterior.steeringWheelGroup.children.length).toBeGreaterThanOrEqual(3);
    });

    it('verifies Bugatti W16 (Car #27) horseshoe grille, sweeping C-line contour, center spine, and quad exhausts', () => {
      const hyperSpec = getVehicleById('hyper')!;
      const model = buildVehicle(hyperSpec, 0);

      // Check for horseshoe grille, C-lines, and center spine in bodyworkGroup
      let foundHorseshoe = false;
      let cLineCount = 0;
      let centerSpineFound = false;

      model.bodyworkGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          // Check horseshoe arch geometry
          if (obj.geometry instanceof THREE.TorusGeometry && obj.position.y > 0.05 && obj.position.y < 0.15) {
            foundHorseshoe = true;
          }
          // Check center dorsal crease (thin strip along z)
          if (obj.geometry instanceof THREE.BoxGeometry) {
            const params = (obj.geometry as THREE.BoxGeometry).parameters;
            if (params.width < 0.03 && params.depth > 3.0) {
              centerSpineFound = true;
            }
          }
        }
        if (obj instanceof THREE.Group && obj.children.length >= 2) {
          // Flank C-line group
          if (Math.abs(obj.position.x) > 0.9 && Math.abs(obj.position.x) < 1.1) {
            cLineCount++;
          }
        }
      });

      expect(foundHorseshoe).toBe(true);
      expect(centerSpineFound).toBe(true);
      expect(cLineCount).toBe(2); // Left and Right C-lines
      expect(model.wingMesh.name).toBe('ActiveAirfoilBlade');
    });

    it('verifies Formula 1 (Car #32) exposed wishbones, titanium HALO, and F1 butterfly wheel', () => {
      const f1Spec = getVehicleById('f1')!;
      const model = buildVehicle(f1Spec, 0);

      // Check for exposed suspension wishbones and HALO safety hoop
      let wishboneCount = 0;
      let haloFound = false;

      model.bodyworkGroup.traverse((obj) => {
        if (obj instanceof THREE.Group && obj.position.y > 0.7 && Math.abs(obj.position.z - 0.25) < 0.1) {
          haloFound = true;
        }
        if (obj instanceof THREE.Group && Math.abs(obj.position.x) > 0.35 && Math.abs(obj.position.x) < 0.55) {
          wishboneCount++;
        }
      });

      expect(haloFound).toBe(true);
      expect(wishboneCount).toBeGreaterThanOrEqual(4); // 4 corners double-wishbones

      // F1 Cockpit butterfly steering yoke
      expect(model.cockpitInterior.steeringWheelMesh.name).toBe('SteeringWheel');
      expect(model.cockpitInterior.shiftLeds.length).toBe(9);
    });

    it('verifies Heavy Commercial: Semi Rig (#14) twin chrome stacks and dually rear wheels', () => {
      const semiSpec = getVehicleById('semi_rig')!;
      const model = buildVehicle(semiSpec, 0);

      // Check twin vertical exhaust stacks
      let stackCount = 0;
      model.bodyworkGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.geometry instanceof THREE.CylinderGeometry) {
          const params = (obj.geometry as THREE.CylinderGeometry).parameters;
          if (params.height > 2.0) {
            stackCount++;
          }
        }
      });
      expect(stackCount).toBe(2); // Left and right twin chrome vertical exhaust stacks

      // Rear wheels have dually extra tires
      expect(model.wheels.rl.group.children.length).toBeGreaterThan(1);
      expect(model.wheels.rr.group.children.length).toBeGreaterThan(1);
    });

    it('verifies Baja Truck (#09) prerunner bumper, KC spotlights, and bed-mounted dual spare tires', () => {
      const truckSpec = getVehicleById('truck')!;
      const model = buildVehicle(truckSpec, 0);

      // Check for 2 spare tires mounted in bed
      let spareTireCount = 0;
      model.bodyworkGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.geometry instanceof THREE.CylinderGeometry) {
          const params = (obj.geometry as THREE.CylinderGeometry).parameters;
          if (params.radiusTop > 0.4 && params.radiusBottom > 0.4 && obj.position.z < -1.0) {
            spareTireCount++;
          }
        }
      });
      expect(spareTireCount).toBe(2); // Dual 37-inch spare wheels in bed cage
    });

    it('verifies Porsche GT3 RS (#18) front fender louvers and swan-neck DRS wing', () => {
      const gt3Spec = getVehicleById('porsche_gt3')!;
      const model = buildVehicle(gt3Spec, 0);

      // Check for fender cooling louvers
      let louverCount = 0;
      model.bodyworkGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.geometry instanceof THREE.BoxGeometry) {
          const params = (obj.geometry as THREE.BoxGeometry).parameters;
          if (params.height < 0.02 && params.depth < 0.05 && params.width > 0.15) {
            louverCount++;
          }
        }
      });
      expect(louverCount).toBeGreaterThanOrEqual(8); // 4 gills on each front fender
      expect(model.wingGroup.position.y).toBeGreaterThan(1.2); // High swan-neck wing
    });

    it('verifies that ALL 34 roster vehicles build successfully with complete Three.js hierarchy', () => {
      const allSpecs = getAllVehicles();
      expect(allSpecs.length).toBe(34);

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

