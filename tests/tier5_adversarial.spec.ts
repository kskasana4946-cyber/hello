// tests/tier5_adversarial.spec.ts
// Milestone M7: Tier 5 Adversarial & Chaos Hardening Suite
// Verifies extreme physical edge cases, boundary safety, numerical stability,
// rapid sector eviction under load, stress resilience, and economy boundaries:
// 1. Extreme 485 KPH wall scrapes & Lateral Tangent Barrier Projection preservation
// 2. Overrevving (15,000+ RPM) and audio Nyquist boundary safety
// 3. Out-of-range inputs, NaN, negative values across physics, spline, and audio
// 4. Rapid 500-step sector streaming LRU cache eviction under load (resident sectors <= 12)
// 5. Knockout elimination sequence and ghost car recording/replay under stress
// 6. Early CR purchase boundary (cost - 1 vs cost) and non-destructive sandbox toggle restoration

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DefaultAnalyticalSplineProvider,
  RapierVehicleWorld,
} from '../src/physics/RapierVehicleWorld';
import { SplineTrackStreamer } from '../src/tracks/SplineTrackStreamer';
import { TacticalRamps } from '../src/tracks/TacticalRamps';
import { GranularSynthEngine } from '../src/audio/GranularSynthEngine';
import {
  RacingAIDirector,
  AI_DIFFICULTY_SPECS,
  RACE_FORMAT_SPECS,
} from '../src/ai/RacingAIDirector';
import {
  ProgressionManager,
  TIER_0_STARTER_IDS,
} from '../src/career/ProgressionManager';
import { PakStreamer } from '../src/streaming/PakStreamer';
import {
  VEHICLE_ROSTER,
  getVehicleById,
} from '../src/vehicles/VehicleRoster';
import { VehicleSpec } from '../src/core/types';

describe('Milestone M7: Tier 5 Adversarial & Chaos Hardening Suite', () => {
  // ==========================================================================
  // 1. Extreme 485 KPH Wall Scrapes & Lateral Tangent Barrier Projection
  // ==========================================================================
  describe('1. Extreme 485 KPH Wall Scrapes & Lateral Tangent Barrier Projection', () => {
    let world: RapierVehicleWorld;
    let splineStreamer: SplineTrackStreamer;
    let pakStreamer: PakStreamer;
    let jetSpec: VehicleSpec;

    beforeEach(async () => {
      pakStreamer = new PakStreamer();
      splineStreamer = new SplineTrackStreamer(5.0, 'track_golden_gp', pakStreamer);
      world = await RapierVehicleWorld.create(splineStreamer);

      const found = getVehicleById('jet_thrust');
      expect(found).toBeDefined();
      jetSpec = found!;
      world.addVehicle('jet_player', jetSpec, 1000.0, 0.0);
    });

    it('preserves alongOffset during extreme 485 KPH barrier impact and prevents backward teleportation', () => {
      const stateBefore = world.getVehicleState('jet_player')!;
      expect(stateBefore).toBeDefined();
      expect(stateBefore.alongOffset).toBe(1000.0);

      // Slap vehicle directly into guardrail at 485 KPH with 0.25 rad angle into the wall
      world.setVehicleSpeedAndHeading('jet_player', 485.0, 0.25, 12.0);

      // Execute 1 sub-step of physics
      world.step(1 / 240);

      const stateAfter = world.getVehicleState('jet_player')!;
      // Along-offset must have advanced forward monotonically (not yanked backward or reset)
      expect(stateAfter.alongOffset).toBeGreaterThanOrEqual(1000.0);
      expect(Number.isFinite(stateAfter.alongOffset)).toBe(true);

      // Lateral offset must be strictly clamped to dMax (roadWidth 20m / 2 - 1m = 9.0m)
      expect(stateAfter.lateralOffset).toBeCloseTo(9.0, 1);
      expect(Math.abs(stateAfter.lateralOffset)).toBeLessThanOrEqual(9.05);

      // Barrier contact must be active and emitting sparks
      expect(stateAfter.barrierContact).toBe(true);
      expect(stateAfter.barrierSparks.barrierContact).toBe(true);
      expect(stateAfter.barrierSparks.barrierSide).toBe('RIGHT');
      expect(stateAfter.barrierSparks.scrapeSpeedKph).toBeGreaterThan(400.0);
      expect(stateAfter.barrierSparks.sparkIntensity).toBe(1.0);
      expect(stateAfter.barrierSparks.sparkCount).toBeGreaterThanOrEqual(60);
    });

    it('maintains continuous 485 KPH high-speed forward glide without vertex sticking across 240 sub-steps (1.0s)', () => {
      const startS = world.getVehicleState('jet_player')!.alongOffset;
      world.setVehicleSpeedAndHeading('jet_player', 485.0, 0.1, 9.5);
      world.setControlInput('jet_player', { throttle: 1.0, brake: 0.0, steer: 0.1 });

      let prevS = startS;
      // Step through 240 sub-steps (1 full second of simulation at 240Hz)
      for (let i = 0; i < 240; i++) {
        world.step(1 / 240);
        const st = world.getVehicleState('jet_player')!;
        expect(st.alongOffset).toBeGreaterThanOrEqual(prevS);
        expect(Number.isFinite(st.alongOffset)).toBe(true);
        expect(Number.isFinite(st.speedKph)).toBe(true);
        expect(st.lateralOffset).toBeLessThanOrEqual(9.01);
        prevS = st.alongOffset;
      }

      const finalState = world.getVehicleState('jet_player')!;
      // At ~485 KPH (~134.7 m/s), 1 second should cover ~130 meters forward
      const deltaS = finalState.alongOffset - startS;
      expect(deltaS).toBeGreaterThan(100.0);
      expect(deltaS).toBeLessThan(160.0);
      // Vehicle speed must remain high despite wall scrape (wallGlideFactor 0.9996 prevents dead-stop sticking)
      expect(finalState.speedKph).toBeGreaterThan(350.0);
    });

    it('strips outward binormal velocity while preserving forward spline tangent momentum', () => {
      // Direct hard lateral velocity into left wall (d = -15m, angle = -0.35 rad)
      world.setVehicleSpeedAndHeading('jet_player', 485.0, -0.35, -15.0);
      world.step(1 / 240);

      const state = world.getVehicleState('jet_player')!;
      expect(state.barrierContact).toBe(true);
      expect(state.barrierSparks.barrierSide).toBe('LEFT');
      expect(state.lateralOffset).toBeCloseTo(-9.0, 1);

      // Check velocity alignment with spline tangent frame
      const frame = splineStreamer.getFrameAtArcLength(state.alongOffset);
      const dotTangent =
        state.forward[0] * frame.tangent[0] +
        state.forward[1] * frame.tangent[1] +
        state.forward[2] * frame.tangent[2];
      expect(dotTangent).toBeGreaterThan(0.99); // Nearly perfectly aligned with tangent
    });
  });

  // ==========================================================================
  // 2. Overrevving (15,000+ RPM) & Audio Nyquist Boundary Safety
  // ==========================================================================
  describe('2. Overrevving (15,000+ RPM) & Audio Nyquist Boundary Safety', () => {
    let synth: GranularSynthEngine;

    beforeEach(() => {
      synth = new GranularSynthEngine();
    });

    it('clamps 15,000 RPM (Formula 1 / Jet Thrust) below the Nyquist threshold', () => {
      const f1Spec = getVehicleById('f1')!;
      expect(f1Spec.redlineRpm).toBe(15000);

      const nyquist = synth.sampleRate / 2; // 24,000 Hz at 48kHz
      const telemetry = synth.updateEngineAudio(f1Spec, 15000, 1.0);

      expect(telemetry.clampedRpm).toBe(15000);
      expect(telemetry.fundamentalFreqHz).toBeLessThan(nyquist);
      expect(telemetry.fundamentalFreqHz).toBeLessThanOrEqual(nyquist - 100);
      expect(telemetry.fundamentalFreqHz).toBeGreaterThan(20);
      expect(telemetry.harmonicFormantCutoffHz).toBeLessThan(nyquist);
      expect(telemetry.grainPlaybackRate).toBeCloseTo(15.0, 2);
    });

    it('resiliently handles extreme overrevving (50,000 RPM) without aliasing or exceeding Nyquist', () => {
      const jetSpec = getVehicleById('jet_thrust')!;
      const nyquist = synth.sampleRate / 2;
      const telemetry = synth.updateEngineAudio(jetSpec, 50000, 1.0);

      // Clamped to vehicle's maximum redline (15,000 RPM)
      expect(telemetry.clampedRpm).toBeLessThanOrEqual(15000);
      expect(telemetry.fundamentalFreqHz).toBeLessThanOrEqual(nyquist - 100);
      expect(Number.isFinite(telemetry.fundamentalFreqHz)).toBe(true);
      expect(Number.isFinite(telemetry.harmonicFormantCutoffHz)).toBe(true);
    });

    it('safely handles engine audio updates across diverse powertrain archetypes', () => {
      const testCases = [
        { id: 'lambo', expectedArch: 'italian_na_v12' },
        { id: 'jdm_rotary', expectedArch: 'twin_rotor' },
        { id: 'muscle', expectedArch: 'supercharged_v8' },
        { id: 'ev_proto', expectedArch: 'quad_motor_ev' },
        { id: 'fan_car', expectedArch: 'cosworth_v12_fan' },
      ];

      for (const tc of testCases) {
        const spec = getVehicleById(tc.id)!;
        const res = synth.updateEngineAudio(spec, spec.redlineRpm * 0.9, 0.8);
        expect(res.vehicleId).toBe(tc.id);
        expect(res.fundamentalFreqHz).toBeGreaterThan(20);
        expect(res.fundamentalFreqHz).toBeLessThan(synth.sampleRate / 2);
      }
    });
  });

  // ==========================================================================
  // 3. Out-of-Range Inputs, NaN, & Negative Values Across Physics, Splines & Audio
  // ==========================================================================
  describe('3. Out-of-Range Inputs, NaN, & Negative Values Robustness', () => {
    let world: RapierVehicleWorld;
    let streamer: SplineTrackStreamer;
    let synth: GranularSynthEngine;

    beforeEach(async () => {
      streamer = new SplineTrackStreamer(5.0, 'track_golden_gp');
      world = await RapierVehicleWorld.create(streamer);
      synth = new GranularSynthEngine();

      const roadster = getVehicleById('roadster')!;
      world.addVehicle('tester', roadster, 500.0, 0.0);
    });

    it('safely handles NaN, negative, and infinite dt in physics simulation', () => {
      const stepsBefore = world.getTotalSubstepsExecuted();

      // Passing NaN dt must not advance substeps or corrupt accumulator
      const stepsNan = world.step(NaN);
      expect(stepsNan).toBe(0);
      expect(world.getTotalSubstepsExecuted()).toBe(stepsBefore);

      // Passing negative dt must not corrupt accumulator
      const stepsNeg = world.step(-0.5);
      expect(stepsNeg).toBe(0);
      expect(world.getTotalSubstepsExecuted()).toBe(stepsBefore);

      // Passing excessive dt (100.0s) is safely clamped by maxSubSteps
      const stepsCapped = world.step(100.0, 480);
      expect(stepsCapped).toBeLessThanOrEqual(480);
      expect(world.getTotalSubstepsExecuted()).toBe(stepsBefore + stepsCapped);
    });

    it('safely handles NaN, negative, and out-of-range control inputs', () => {
      // Feed NaN / garbage control inputs
      world.setControlInput('tester', {
        throttle: NaN,
        brake: -5.0,
        steer: Infinity,
      });

      world.step(1 / 240);
      const state = world.getVehicleState('tester')!;
      expect(Number.isFinite(state.position[0])).toBe(true);
      expect(Number.isFinite(state.position[1])).toBe(true);
      expect(Number.isFinite(state.position[2])).toBe(true);
      expect(Number.isFinite(state.speedKph)).toBe(true);
    });

    it('safely handles negative, NaN, and excessive arc-length queries on the spline streamer', () => {
      const totalLen = streamer.getTotalLength();

      // Negative s (-500m) should wrap smoothly into [0, L)
      const frameNeg = streamer.getFrameAtArcLength(-500);
      expect(frameNeg).toBeDefined();
      expect(Number.isFinite(frameNeg.position[0])).toBe(true);
      expect(Number.isFinite(frameNeg.tangent[0])).toBe(true);
      const lenT = Math.hypot(frameNeg.tangent[0], frameNeg.tangent[1], frameNeg.tangent[2]);
      expect(lenT).toBeCloseTo(1.0, 3);

      // NaN s should fallback to 0.0 without throwing
      const frameNan = streamer.getFrameAtArcLength(NaN);
      expect(frameNan).toBeDefined();
      expect(Number.isFinite(frameNan.position[0])).toBe(true);

      // Astronomical s (10^8 meters) should wrap safely
      const frameHuge = streamer.getFrameAtArcLength(100_000_000);
      expect(frameHuge).toBeDefined();
      expect(Number.isFinite(frameHuge.position[0])).toBe(true);

      // Invalid 3D world coordinates in getClosestSplinePoint
      const projNan = streamer.getClosestSplinePoint([NaN, NaN, NaN] as any);
      expect(projNan).toBeDefined();
      expect(Number.isFinite(projNan.alongOffset)).toBe(true);
    });

    it('safely handles NaN, negative, and invalid RPMs in GranularSynthEngine', () => {
      // NaN RPM falls back to safe 1000 RPM idle
      const resNan = synth.updateEngineAudio('roadster', NaN, 0.5);
      expect(resNan.clampedRpm).toBe(1000);
      expect(resNan.fundamentalFreqHz).toBeGreaterThan(20);

      // Negative RPM (-5000) is clamped to minimum idle (800 RPM)
      const resNeg = synth.updateEngineAudio('roadster', -5000, -1.0);
      expect(resNeg.clampedRpm).toBe(800);
      expect(resNeg.fundamentalFreqHz).toBeGreaterThan(20);

      // Unknown vehicle ID falls back to default vehicle spec without throwing
      const resUnknown = synth.updateEngineAudio('non_existent_vehicle', 3000, 0.5);
      expect(resUnknown).toBeDefined();
      expect(resUnknown.clampedRpm).toBe(3000);
    });

    it('safely handles negative and NaN inputs in Pacejka tire lateral force calculation', () => {
      // Negative normal load produces 0 force
      expect(RapierVehicleWorld.evaluatePacejkaLateralForce(-1000, 0.1)).toBe(0);
      expect(RapierVehicleWorld.evaluatePacejkaLateralForce(0, 0.1)).toBe(0);
      expect(RapierVehicleWorld.evaluatePacejkaLateralForce(NaN, 0.1)).toBe(0);

      // NaN slip angle produces 0 force
      expect(RapierVehicleWorld.evaluatePacejkaLateralForce(5000, NaN)).toBe(0);

      // Valid load and slip angle produce finite, non-zero force
      const validForce = RapierVehicleWorld.evaluatePacejkaLateralForce(5000, 0.08);
      expect(Number.isFinite(validForce)).toBe(true);
      expect(validForce).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 4. Rapid 500-Step Sector Streaming LRU Cache Eviction Under Load
  // ==========================================================================
  describe('4. Rapid 500-Step Sector Streaming LRU Cache Eviction Under Load', () => {
    let streamer: SplineTrackStreamer;
    let pakStreamer: PakStreamer;

    beforeEach(() => {
      pakStreamer = new PakStreamer();
      // Configure 50.0 KM circuit (100 sectors of 500m each)
      streamer = new SplineTrackStreamer(50.0, 'track_canyon', pakStreamer);
    });

    it('strictly bounds resident sectors <= 12 under 500 erratic and rapid delta jumps', () => {
      expect(streamer.getSectorCount()).toBe(100);
      expect(streamer.getTotalLength()).toBe(50000);

      let currentS = 0;
      // Perform 500 rapid, chaotic delta jumps across the 50,000m track
      for (let step = 0; step < 500; step++) {
        // Pseudo-random pseudo-chaotic movement: forward sprints, backward reverses, large jumps
        const jumpMode = step % 5;
        if (jumpMode === 0) {
          currentS += 100; // Normal advance
        } else if (jumpMode === 1) {
          currentS += 750; // Rapid leap crossing sector boundaries
        } else if (jumpMode === 2) {
          currentS -= 250; // Reversal
        } else if (jumpMode === 3) {
          currentS += 12500; // Massive teleport jump across half the circuit
        } else {
          currentS += 49950; // Jump right around the lap closure boundary
        }

        const res = streamer.streamLookaheadWindow(currentS);

        // Core invariant: residentSectorCount MUST NEVER exceed maxResidentSectors (12)
        expect(res.residentSectorCount).toBeLessThanOrEqual(streamer.maxResidentSectors);
        expect(streamer.getResidentSectorCount()).toBeLessThanOrEqual(12);

        // Active lookahead window must be properly populated
        expect(res.activeSectorIndices.length).toBeGreaterThanOrEqual(9); // -2 behind, +6 ahead = 9 sectors

        // Center sector must be in active set
        expect(res.activeSectorIndices).toContain(res.centerSectorIndex);
      }

      // Final sanity check: resident sector list matches internal size and cap
      const finalIndices = streamer.getResidentSectorIndices();
      expect(finalIndices.length).toBeLessThanOrEqual(12);
      expect(finalIndices.length).toBe(streamer.getResidentSectorCount());
    });
  });

  // ==========================================================================
  // 5. Knockout Elimination Sequence & Solo Time Attack Ghost Car Stress
  // ==========================================================================
  describe('5. Knockout Elimination Sequence & Solo Time Attack Ghost Car Stress', () => {
    let director: RacingAIDirector;
    let streamer: SplineTrackStreamer;
    let synth: GranularSynthEngine;

    beforeEach(() => {
      streamer = new SplineTrackStreamer(5.0, 'track_golden_gp');
      synth = new GranularSynthEngine();
      director = new RacingAIDirector(streamer, synth);
    });

    it('executes sequential knockout elimination down to 1 winner with audio boom triggers', () => {
      director.configure('HARD', 'KNOCKOUT_ELIMINATION');
      expect(director.racers.length).toBe(6);

      // Stagger racer distances so elimination is deterministic
      for (let i = 0; i < director.racers.length; i++) {
        director.racers[i].totalDistance = 5000 + i * 200; // racer 0 is last place
      }

      const initialBoomCount = synth.sfxCounters.knockoutExplosion;

      // 1st elimination -> eliminates racer 0
      const e1 = director.eliminateLastPlaceRacer();
      expect(e1.eliminatedRacerId).toBe(director.racers[0].id);
      expect(e1.activeRacersRemaining).toBe(5);
      expect(e1.explosionTriggered).toBe(true);
      expect(synth.sfxCounters.knockoutExplosion).toBe(initialBoomCount + 1);

      // Eliminate next 4 racers sequentially
      for (let remaining = 4; remaining >= 1; remaining--) {
        const ev = director.eliminateLastPlaceRacer();
        expect(ev.activeRacersRemaining).toBe(remaining);
        expect(ev.explosionTriggered).toBe(true);
      }

      // Exactly 1 racer remains active (the champion)
      const finalActive = director.racers.filter((r) => r.status === 'ACTIVE');
      expect(finalActive.length).toBe(1);

      // Attempting to eliminate when only 1 remains must return null event
      const finalTry = director.eliminateLastPlaceRacer();
      expect(finalTry.eliminatedRacerId).toBeNull();
      expect(finalTry.activeRacersRemaining).toBe(1);
      expect(finalTry.explosionTriggered).toBe(false);
    });

    it('records Solo Time Attack Lap 1 ghost telemetry and executes smooth replay on Lap 2', () => {
      director.configure('HARD', 'SOLO_TIME_ATTACK');
      expect(director.racers.length).toBe(1);

      // Lap 1: Record progress at checkpoints
      director.recordTimeAttackProgress(0.1, 6.0);
      director.recordTimeAttackProgress(0.35, 21.0); // crosses Sector 1 (>= 33.3%)
      expect(director.sectorCheckpointsPassed[0]).toBe(true);
      expect(director.sectorSplits[0]).toBe(21.0);

      director.recordTimeAttackProgress(0.70, 42.5); // crosses Sector 2 (>= 66.7%)
      expect(director.sectorCheckpointsPassed[1]).toBe(true);

      const lap1Finish = director.recordTimeAttackProgress(1.0, 60.0); // crosses finish line
      expect(lap1Finish.completedLap).toBe(true);
      expect(lap1Finish.ghostCarActive).toBe(true);
      expect(director.ghostCarActive).toBe(true);
      expect(director.ghostRecording.length).toBe(4);
      expect(director.bestLapTimeSec).toBe(60.0);

      // Lap 2: Advance simulation and verify ghostPose is updated dynamically
      director.step(0.1, { alongOffset: 1750.0, lateralOffset: 0.0, speedKph: 280.0 });
      expect(director.ghostPose).toBeDefined();
      expect(director.ghostPose).not.toBeNull();
      expect(Number.isFinite(director.ghostPose!.s)).toBe(true);
      expect(director.ghostPose!.position).toBeDefined();
    });
  });

  // ==========================================================================
  // 6. Early CR Purchase Boundary & Non-Destructive Sandbox Toggle
  // ==========================================================================
  describe('6. Early CR Purchase Boundary & Non-Destructive Sandbox Toggle', () => {
    let memoryStorage: Map<string, string>;
    let progression: ProgressionManager;

    beforeEach(() => {
      memoryStorage = new Map<string, string>();
      progression = new ProgressionManager(memoryStorage);
    });

    it('rejects vehicle purchase at cost - 1 and accepts at exact cost with exact balance zeroing', () => {
      const rx7 = getVehicleById('jdm_rotary')!;
      expect(rx7.creditCost).toBe(25000);
      expect(progression.isVehicleUnlocked('jdm_rotary')).toBe(false);

      // Boundary 1: Exactly 1 credit below cost
      progression.credits = rx7.creditCost - 1; // 24,999 CR
      const failResult = progression.purchaseVehicleWithCR('jdm_rotary');
      expect(failResult.purchased).toBe(false);
      expect(failResult.reason).toBe('INSUFFICIENT_CREDITS');
      expect(failResult.credits).toBe(24999);
      expect(progression.isVehicleUnlocked('jdm_rotary')).toBe(false);

      // Boundary 2: Exactly at cost
      progression.credits = rx7.creditCost; // 25,000 CR
      const okResult = progression.purchaseVehicleWithCR('jdm_rotary');
      expect(okResult.purchased).toBe(true);
      expect(okResult.alreadyUnlocked).toBe(false);
      expect(okResult.deductedCredits).toBe(25000);
      expect(okResult.credits).toBe(0);
      expect(progression.credits).toBe(0);
      expect(progression.isVehicleUnlocked('jdm_rotary')).toBe(true);

      // Boundary 3: Re-purchasing an already unlocked vehicle deducts 0 CR
      progression.credits = 50000;
      const reResult = progression.purchaseVehicleWithCR('jdm_rotary');
      expect(reResult.purchased).toBe(true);
      expect(reResult.alreadyUnlocked).toBe(true);
      expect(reResult.deductedCredits).toBe(0);
      expect(progression.credits).toBe(50000);
    });

    it('toggles Sandbox Unlock-All non-destructively and cleanly restores authentic career progression', () => {
      // Initially: 0 wins, 3 starter vehicles
      expect(progression.totalWins).toBe(0);
      expect(progression.getUnlockedVehicleIds()).toEqual(['scooter', 'hot_hatch', 'roadster']);
      expect(progression.isVehicleUnlocked('jet_thrust')).toBe(false);

      // Legitimate unlock: earn 2 wins -> unlocks #4 jdm_rotary and #5 car
      progression.recordRaceCompletion({ position: 1 }); // Win 1
      progression.recordRaceCompletion({ position: 1 }); // Win 2
      expect(progression.totalWins).toBe(2);
      const authenticUnlocked = progression.getUnlockedVehicleIds();
      expect(authenticUnlocked).toContain('jdm_rotary');
      expect(authenticUnlocked).toContain('car');
      expect(progression.isVehicleUnlocked('jet_thrust')).toBe(false);

      // Toggle Sandbox ON: unlocks all 34 vehicles
      const sbOn = progression.toggleSandboxUnlockAll(true);
      expect(sbOn.sandboxUnlockedAll).toBe(true);
      expect(progression.getUnlockedVehicleIds().length).toBe(34);
      expect(progression.isVehicleUnlocked('jet_thrust')).toBe(true);
      expect(progression.isVehicleUnlocked('f1')).toBe(true);
      // Total wins and credits must remain authentic
      expect(progression.totalWins).toBe(2);

      // Toggle Sandbox OFF: cleanly restores original authentic list without corruption
      const sbOff = progression.toggleSandboxUnlockAll(false);
      expect(sbOff.sandboxUnlockedAll).toBe(false);
      expect(progression.getUnlockedVehicleIds()).toEqual(authenticUnlocked);
      expect(progression.isVehicleUnlocked('jet_thrust')).toBe(false);
      expect(progression.isVehicleUnlocked('jdm_rotary')).toBe(true);
      expect(progression.totalWins).toBe(2);
    });

    it('persists and recovers career progression across memory storage instances without sandbox leakage', () => {
      progression.recordRaceCompletion({ position: 1 }); // Win 1
      progression.credits += 25000;
      progression.purchaseVehicleWithCR('jdm_rotary');
      progression.toggleSandboxUnlockAll(true); // Turn on sandbox

      // Create a fresh ProgressionManager instance loading the same storage
      const reloaded = new ProgressionManager(memoryStorage);
      // Sandbox should default to false on reloaded session, preserving authentic career state
      expect(reloaded.sandboxUnlockedAll).toBe(false);
      expect(reloaded.totalWins).toBe(1);
      expect(reloaded.isVehicleUnlocked('jdm_rotary')).toBe(true);
      expect(reloaded.isVehicleUnlocked('jet_thrust')).toBe(false);
    });
  });
});
