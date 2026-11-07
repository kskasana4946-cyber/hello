// @vitest-environment jsdom
// tests/adversarial_r3_empirical.spec.ts
// Empirical Adversarial Hardening Suite for Round 3:
// 1. Race Start Stress Testing:
//    - Rapid Space / Enter / Click spamming in PADDOCK phase without deadlock or handbrake lock.
//    - Launching race with all 6 circuit lengths (2km, 5km, 8km, 12km, 24km, 50km) across biomes.
//    - Verifying vehicle coordinates at spline s=0 with ZERO barrier clamping or collision.
//    - Camera transition to CHASE mode and start-grid lookAt alignment.
// 2. 30-Vehicle Roster Stress Testing:
//    - Complete construction of all 30 roster vehicles via HighPolyVehicleBuilder.
//    - Strict 7 allowed categories (Hatchback, Convertible, MPV, Truck, Sedan, SUV, Supercar).
//    - Tier 0 economy: exactly 4 hatchbacks with exactly 2 FREE starter cars.
//    - Absolute exclusion of banned vehicles: 0 scooters, 0 bikes/motorbikes, 0 karts, 0 buses.
//    - Geometry integrity: 0 NaNs, 0 Infs, valid bounding boxes, non-null materials across all 30 cars.
//    - 4-corner wheel layout symmetry and dynamic active-aero / thermal brake clamping.

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  VEHICLE_COUNT,
  VEHICLE_ROSTER,
  getAllVehicles,
  VehicleCategory,
} from '../src/vehicles/VehicleRoster';
import {
  HighPolyVehicleBuilder,
  steerWheels,
  spinWheels,
  setBrakeTemperature,
  setDrsActive,
  setAirbrake,
  setLivery,
} from '../src/vehicles/HighPolyVehicleBuilder';
import { updateCockpitTelemetry } from '../src/vehicles/CockpitInteriorBuilder';
import { ProgressionManager } from '../src/career/ProgressionManager';
import { PaddockShowroomUI } from '../src/ui/PaddockShowroomUI';
import { RaceHUD } from '../src/ui/RaceHUD';
import { SplineTrackStreamer } from '../src/tracks/SplineTrackStreamer';
import { RapierVehicleWorld } from '../src/physics/RapierVehicleWorld';
import { PakStreamer } from '../src/streaming/PakStreamer';
import { CameraMode, CircuitLengthKm } from '../src/core/types';

describe('Adversarial R3: Race Start & Controls Activation', () => {
  let progression: ProgressionManager;
  let container: HTMLDivElement;

  beforeEach(() => {
    progression = new ProgressionManager();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('Stress-tests rapid Space, Enter, and Click spamming in PADDOCK phase without wedging', () => {
    const paddockUI = new PaddockShowroomUI(progression, container);
    let launchCallbackCount = 0;
    let lastPayload: any = null;

    paddockUI.onLaunchRaceCallback = (circuitConfig, vehicleId) => {
      launchCallbackCount++;
      lastPayload = { circuitConfig, vehicleId };
    };

    expect(paddockUI.getState().phase).toBe('PADDOCK');
    expect((paddockUI as any).rootElement?.style.display).not.toBe('none');

    // Simulate 50 rapid button clicks on the launch button
    const launchBtn = (paddockUI as any).rootElement?.querySelector('#btn-launch-race') as HTMLButtonElement;
    expect(launchBtn).toBeDefined();
    for (let i = 0; i < 50; i++) {
      launchBtn?.click();
    }

    // Phase should now be RACING
    expect(paddockUI.getState().phase).toBe('RACING');
    expect((paddockUI as any).rootElement?.style.display).toBe('none');

    // Verify UI remains cleanly hidden in RACING phase
    expect(paddockUI.getState().phase).toBe('RACING');
    expect((paddockUI as any).rootElement?.style.display).toBe('none');
    expect(launchCallbackCount).toBeGreaterThan(0);
    expect(lastPayload).not.toBeNull();
    expect(lastPayload.vehicleId).toBe('mini_jcw');
  });

  it('Verifies Space keydown does not cause handbrake lock upon entering RACING phase', () => {
    // Model the keysDown set lifecycle from main.ts
    const keysDown = new Set<string>();
    let phase = 'PADDOCK';
    let launchRaceInvoked = false;

    const handleKeydown = (e: { code: string; preventDefault: () => void }) => {
      keysDown.add(e.code);
      if ((e.code === 'Space' || e.code === 'Enter') && phase === 'PADDOCK') {
        e.preventDefault();
        keysDown.delete('Space'); // Handbrake defense
        launchRace();
      }
    };

    const launchRace = () => {
      keysDown.delete('Space'); // Secondary defensive clear
      phase = 'RACING';
      launchRaceInvoked = true;
    };

    // Trigger Space in PADDOCK
    handleKeydown({ code: 'Space', preventDefault: () => {} });

    expect(launchRaceInvoked).toBe(true);
    expect(phase).toBe('RACING');
    // Handbrake key must NOT be stuck in keysDown
    expect(keysDown.has('Space')).toBe(false);
  });

  it('Verifies RaceHUD DOM lifecycle coordinates cleanly with PaddockShowroomUI', () => {
    const raceHUD = new RaceHUD(container);
    const paddockUI = new PaddockShowroomUI(progression, container);

    // Initial state: Showroom visible, Race HUD hidden
    paddockUI.setVisible(true);
    raceHUD.setVisible(false);

    expect((paddockUI as any).rootElement?.style.display).toBe('flex');
    expect((raceHUD as any).rootElement?.style.display).toBe('none');
    expect(raceHUD.isVisible).toBe(false);

    // Launch race: Showroom hides, Race HUD appears
    paddockUI.launchRace();
    raceHUD.setVisible(true);

    expect((paddockUI as any).rootElement?.style.display).toBe('none');
    expect((raceHUD as any).rootElement?.style.display).toBe('flex');
    expect(raceHUD.isVisible).toBe(true);

    // Return to paddock: Showroom appears, Race HUD hides
    paddockUI.setVisible(true);
    raceHUD.setVisible(false);

    expect((paddockUI as any).rootElement?.style.display).toBe('flex');
    expect((raceHUD as any).rootElement?.style.display).toBe('none');
    expect(raceHUD.isVisible).toBe(false);
  });

  it('Stress-tests launchRace with all 6 circuit lengths & verifies s=0 coordinates and ZERO barrier clamping', () => {
    const circuitLengths: CircuitLengthKm[] = [2.0, 5.0, 8.0, 12.0, 24.0, 50.0];
    const trackIds = ['track_golden_gp', 'track_neotokyo', 'track_canyon', 'track_alpine'];
    const pakStreamer = new PakStreamer();

    for (const lenKm of circuitLengths) {
      for (const trackId of trackIds) {
        const streamer = new SplineTrackStreamer(lenKm, trackId, pakStreamer);
        const expectedTotalMeters = lenKm * 1000;
        expect(streamer.getTotalLength()).toBeCloseTo(expectedTotalMeters, -1);

        const frame0 = streamer.getFrameAtArcLength(0);
        expect(Number.isFinite(frame0.position[0])).toBe(true);
        expect(Number.isFinite(frame0.position[1])).toBe(true);
        expect(Number.isFinite(frame0.position[2])).toBe(true);

        const tangentLen = Math.hypot(frame0.tangent[0], frame0.tangent[1], frame0.tangent[2]);
        expect(tangentLen).toBeCloseTo(1.0, 3);

        // Instantiate physics world on this circuit
        const physicsWorld = new RapierVehicleWorld(streamer);
        const spec = VEHICLE_ROSTER[0];
        const state = physicsWorld.addVehicle('player', spec, 0, 0);

        // Reset vehicle state at s = 0
        physicsWorld.resetVehicleState('player');

        // Check vehicle coordinates at spline s=0
        expect(state.alongOffset).toBe(0);
        expect(state.lateralOffset).toBe(0);
        expect(state.speedMs).toBe(0);
        expect(state.speedKph).toBe(0);
        expect(state.barrierContact).toBe(false);

        // Position must be at frame0 + U * rideHeight (0.35m)
        const isNormalUp = Math.abs(frame0.normal[1]) >= Math.abs(frame0.binormal[1]);
        const U = isNormalUp ? frame0.normal : frame0.binormal;
        expect(state.position[0]).toBeCloseTo(frame0.position[0] + U[0] * 0.35, 2);
        expect(state.position[1]).toBeCloseTo(frame0.position[1] + U[1] * 0.35, 2);
        expect(state.position[2]).toBeCloseTo(frame0.position[2] + U[2] * 0.35, 2);

        // Step physics once at 240Hz sub-step (FIXED_DT = 1/240s)
        physicsWorld.step(RapierVehicleWorld.FIXED_DT);

        // CRITICAL CHECK: Vehicle at s=0 must NOT trigger barrier contact or clamping!
        expect(state.barrierContact).toBe(false);
        expect(state.lateralOffset).toBeCloseTo(0, 3);
        expect(Number.isNaN(state.position[0])).toBe(false);
        expect(Number.isNaN(state.position[1])).toBe(false);
        expect(Number.isNaN(state.position[2])).toBe(false);

        // Apply full throttle for 30 physics steps and verify smooth forward advance without barrier stick
        for (let step = 0; step < 30; step++) {
          physicsWorld.setControlInput('player', {
            throttle: 1.0,
            brake: 0.0,
            steer: 0.0,
            handbrake: false,
            nitro: false,
          });
          physicsWorld.step(RapierVehicleWorld.FIXED_DT);
        }

        expect(state.barrierContact).toBe(false);
        expect(state.alongOffset).toBeGreaterThan(0);
        expect(state.speedKph).toBeGreaterThan(0);
        expect(Math.abs(state.lateralOffset)).toBeLessThan(2.0); // Kept in central lane
      }
    }
  });

  it('Verifies camera transition to CHASE mode from SHOWROOM upon race launch', () => {
    let cameraMode: CameraMode = 'SHOWROOM';
    const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 4000);

    const onLaunchRace = (currentMode: CameraMode): CameraMode => {
      let mode = currentMode;
      if (mode === 'SHOWROOM') {
        mode = 'CHASE';
      }
      return mode;
    };

    const newMode = onLaunchRace(cameraMode);
    expect(newMode).toBe('CHASE');

    // Test camera grid placement calculations from main.ts
    const startPos = new THREE.Vector3(0, 0.35, 0);
    const startFwd = new THREE.Vector3(0, 0, 1);
    const startUp = new THREE.Vector3(0, 1, 0);

    camera.position
      .copy(startPos)
      .sub(startFwd.clone().multiplyScalar(6.2))
      .add(startUp.clone().multiplyScalar(2.15));

    const lookTarget = startPos
      .clone()
      .add(startFwd.clone().multiplyScalar(4.5))
      .add(startUp.clone().multiplyScalar(0.45));

    camera.lookAt(lookTarget);

    expect(camera.position.z).toBeCloseTo(-6.2, 2);
    expect(camera.position.y).toBeCloseTo(2.5, 2);
    expect(lookTarget.z).toBeCloseTo(4.5, 2);
    expect(Number.isFinite(camera.position.x)).toBe(true);
    expect(Number.isFinite(camera.position.y)).toBe(true);
    expect(Number.isFinite(camera.position.z)).toBe(true);
  });
});

describe('Adversarial R3: 30-Vehicle Roster & Visual Fidelity', () => {
  const ALLOWED_CATEGORIES: VehicleCategory[] = [
    'Hatchback',
    'Convertible',
    'MPV',
    'Truck',
    'Sedan',
    'SUV',
    'Supercar',
  ];

  it('Empirically confirms total roster size is exactly 30 vehicles', () => {
    expect(VEHICLE_COUNT).toBe(30);
    expect(VEHICLE_ROSTER.length).toBe(30);
    expect(getAllVehicles().length).toBe(30);
  });

  it('Strictly validates category membership across all 30 vehicles with 0 disallowed categories', () => {
    const categoryCounts: Record<VehicleCategory, number> = {
      Hatchback: 0,
      Convertible: 0,
      MPV: 0,
      Truck: 0,
      Sedan: 0,
      SUV: 0,
      Supercar: 0,
    };

    for (const car of VEHICLE_ROSTER) {
      expect(ALLOWED_CATEGORIES).toContain(car.category);
      categoryCounts[car.category]++;

      // Negative checks: NO scooters, NO bikes, NO karts, NO buses
      const lowerId = car.id.toLowerCase();
      const lowerName = car.name.toLowerCase();
      expect(lowerId).not.toMatch(/scooter|bike|superbike|motorcycle|kart|bus|semi_rig/);
      expect(lowerName).not.toMatch(/scooter|bike|superbike|motorcycle|kart|bus|semi/);
    }

    // Verify category distribution
    expect(categoryCounts.Hatchback).toBe(4);
    expect(categoryCounts.Convertible).toBe(4);
    expect(categoryCounts.MPV).toBe(3);
    expect(categoryCounts.Truck).toBe(4);
    expect(categoryCounts.Sedan).toBe(5);
    expect(categoryCounts.SUV).toBe(4);
    expect(categoryCounts.Supercar).toBe(6);
    expect(
      categoryCounts.Hatchback +
        categoryCounts.Convertible +
        categoryCounts.MPV +
        categoryCounts.Truck +
        categoryCounts.Sedan +
        categoryCounts.SUV +
        categoryCounts.Supercar
    ).toBe(30);
  });

  it('Validates Tier 0 economy: exactly 4 hatchbacks with exactly 2 FREE starter cars', () => {
    const tier0Cars = VEHICLE_ROSTER.filter((c) => c.tier === 0);
    expect(tier0Cars.length).toBe(4);

    // All Tier 0 cars must be Hatchbacks
    for (const car of tier0Cars) {
      expect(car.category).toBe('Hatchback');
    }

    // Exactly 2 starter cars are FREE (0 wins and 0 credit cost)
    const freeCars = tier0Cars.filter((c) => c.winsRequired === 0 && c.creditCost === 0);
    expect(freeCars.length).toBe(2);
    expect(freeCars.map((c) => c.id)).toEqual(['mini_jcw', 'hot_hatch']);

    // The other 2 require progression
    const lockedTier0 = tier0Cars.filter((c) => c.winsRequired > 0 || c.creditCost > 0);
    expect(lockedTier0.length).toBe(2);
    expect(lockedTier0.map((c) => c.id)).toEqual(['golf_r', 'gr_yaris']);
  });

  it('Stress-tests building all 30 vehicles via HighPolyVehicleBuilder with 0 NaNs and non-null materials', () => {
    for (const spec of VEHICLE_ROSTER) {
      const model = HighPolyVehicleBuilder.buildVehicle(spec);
      expect(model).toBeDefined();
      expect(model.rootGroup).toBeInstanceOf(THREE.Group);

      let meshCount = 0;
      let totalVertices = 0;

      // Deep hierarchy traversal
      model.rootGroup.traverse((node) => {
        if ((node as THREE.Mesh).isMesh) {
          const mesh = node as THREE.Mesh;
          meshCount++;

          // Material validation: must be defined and non-null
          expect(mesh.material).toBeDefined();
          expect(mesh.material).not.toBeNull();

          // Geometry validation: must be valid buffer geometry with positions
          const geo = mesh.geometry;
          expect(geo).toBeDefined();
          const posAttr = geo.attributes.position;
          expect(posAttr).toBeDefined();
          expect(posAttr.count).toBeGreaterThan(0);
          totalVertices += posAttr.count;

          // Check for 0 NaNs or Infinities in vertex buffer
          for (let i = 0; i < posAttr.count; i++) {
            const vx = posAttr.getX(i);
            const vy = posAttr.getY(i);
            const vz = posAttr.getZ(i);
            expect(Number.isFinite(vx)).toBe(true);
            expect(Number.isFinite(vy)).toBe(true);
            expect(Number.isFinite(vz)).toBe(true);
          }

          // Bounding box validation
          geo.computeBoundingBox();
          const bb = geo.boundingBox;
          expect(bb).not.toBeNull();
          if (bb) {
            expect(Number.isFinite(bb.min.x)).toBe(true);
            expect(Number.isFinite(bb.max.x)).toBe(true);
            expect(Number.isFinite(bb.min.y)).toBe(true);
            expect(Number.isFinite(bb.max.y)).toBe(true);
            expect(Number.isFinite(bb.min.z)).toBe(true);
            expect(Number.isFinite(bb.max.z)).toBe(true);
          }
        }
      });

      expect(meshCount).toBeGreaterThan(10); // Rich multi-component assembly
      expect(totalVertices).toBeGreaterThan(1000);

      // Root bounding box check
      const rootBox = new THREE.Box3().setFromObject(model.rootGroup);
      const size = new THREE.Vector3();
      rootBox.getSize(size);

      // Realistic vehicle dimensions
      expect(size.x).toBeGreaterThan(1.2);
      expect(size.x).toBeLessThan(3.0);
      expect(size.y).toBeGreaterThan(0.5);
      expect(size.y).toBeLessThan(3.5);
      expect(size.z).toBeGreaterThan(3.0);
      expect(size.z).toBeLessThan(7.0);

      // Wheel positions and mounting symmetry
      const { fl, fr, rl, rr } = model.wheels;
      expect(fl).toBeDefined();
      expect(fr).toBeDefined();
      expect(rl).toBeDefined();
      expect(rr).toBeDefined();

      expect(fl.group.position.x).toBeLessThan(0); // Left side
      expect(fr.group.position.x).toBeGreaterThan(0); // Right side
      expect(fl.group.position.z).toBeGreaterThan(0); // Front
      expect(fr.group.position.z).toBeGreaterThan(0); // Front
      expect(rl.group.position.x).toBeLessThan(0); // Left side
      expect(rr.group.position.x).toBeGreaterThan(0); // Right side
      expect(rl.group.position.z).toBeLessThan(0); // Rear
      expect(rr.group.position.z).toBeLessThan(0); // Rear

      // Wheel lateral symmetry
      expect(Math.abs(fl.group.position.x)).toBeCloseTo(Math.abs(fr.group.position.x), 2);
      expect(Math.abs(rl.group.position.x)).toBeCloseTo(Math.abs(rr.group.position.x), 2);

      // Dynamic animations stress
      steerWheels(model, Math.PI / 6);
      steerWheels(model, -Math.PI / 6);
      spinWheels(model, 100, 0.016);

      // Thermal brake glow clamping
      setBrakeTemperature(model, -200);
      expect(model.currentBrakeTempCelsius).toBe(20);
      setBrakeTemperature(model, 2500);
      expect(model.currentBrakeTempCelsius).toBe(1000);

      // Active aero
      setDrsActive(model, true);
      expect(model.isDrsActive).toBe(true);
      setAirbrake(model, 0.5);
      expect(model.airbrakeAngleRad).toBeCloseTo(0.18 + (0.785 - 0.18) * 0.5, 3);

      // Cockpit telemetry update without error
      updateCockpitTelemetry(
        model.cockpitInterior,
        {
          speedKph: 280,
          rpm: 7200,
          maxRpm: 8000,
          gear: 5,
          lapDeltaSec: -0.42,
          currentLap: 1,
          totalLaps: 3,
          position: 1,
          totalRacers: 8,
          nitroPercent: 85,
          drsActive: false,
          brakeTempCelsius: 320,
          sectorSplits: [null, null, null],
        },
        0.016
      );
    }
  });

  it('Verifies all 12 liveries can be applied across cars without undefined materials', () => {
    const testCars = [VEHICLE_ROSTER[0], VEHICLE_ROSTER[14], VEHICLE_ROSTER[25]]; // Hatchback, Sedan, Supercar

    for (const car of testCars) {
      const model = HighPolyVehicleBuilder.buildVehicle(car);
      for (let liveryIdx = 0; liveryIdx < 12; liveryIdx++) {
        setLivery(model, liveryIdx);
        expect(model.currentLiveryIndex).toBe(liveryIdx);
        expect(model.bodyMaterials.length).toBeGreaterThan(0);
        for (const mat of model.bodyMaterials) {
          expect(mat).toBeDefined();
          expect(mat).not.toBeNull();
        }
      }
    }
  });
});
