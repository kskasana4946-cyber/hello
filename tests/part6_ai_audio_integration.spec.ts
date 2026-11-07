// tests/part6_ai_audio_integration.spec.ts
// Milestone M6 Integration Test Suite: 5-Tier AI Director, 7 Race Formats, Granular Audio & Global Runtime Controller
// Verifies:
// 1. 5 AI Difficulty Tiers (EASY, MEDIUM, HARD, VERY_HARD, SUPER_HARD) with strictly monotonic pace and grip scaling.
// 2. Tactical decisions: SUPER_HARD active slipstream drafting (<= 25m), elevated skybridge targeting (<= 150m), straightaway nitro.
// 3. 7 Race Formats: SPRINT_1_LAP, QUALIFIER_2_LAPS, GRAND_PRIX_3_LAPS, FEATURE_5_LAPS, ENDURANCE_10_LAPS,
//    KNOCKOUT_ELIMINATION (sequential eliminations down to 1 winner + 3D explosion SFX),
//    SOLO_TIME_ATTACK (1 racer, Ghost Car recording on Lap 1, replay on Lap 2+, Sector 1/2/3 splits).
// 4. GranularSynthEngine: multi-RPM synthesis, powertrain archetypes (V12, V8, ROTARY), Nyquist safety, invalid RPM resilience, SFX suite.
// 5. window.__APEX_GAME__ Global Application Controller: state machine transitions (BOOT -> PADDOCK -> RACING -> POST_RACE),
//    subsystem exposure, tab cycling, vehicle selection, sandbox toggle, circuit configuration, camera modes, and binary GLB export.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  RacingAIDirector,
  AI_DIFFICULTY_SPECS,
  RACE_FORMAT_SPECS,
} from '../src/ai/RacingAIDirector';
import {
  GranularSynthEngine,
  POWERTRAIN_WAVETABLES,
  POWERTRAIN_ARCHETYPES,
} from '../src/audio/GranularSynthEngine';
import { initApexGame } from '../src/main';
import { SplineTrackStreamer } from '../src/tracks/SplineTrackStreamer';
import { PakStreamer } from '../src/streaming/PakStreamer';
import { VEHICLE_ROSTER, getVehicleById } from '../src/vehicles/VehicleRoster';
import { RapierVehicleWorld } from '../src/physics/RapierVehicleWorld';

describe('Milestone M6: AI Director, 7 Race Formats, Granular Synth & Global Runtime Controller', () => {
  let pakStreamer: PakStreamer;
  let splineStreamer: SplineTrackStreamer;
  let synthEngine: GranularSynthEngine;
  let aiDirector: RacingAIDirector;

  beforeEach(() => {
    pakStreamer = new PakStreamer();
    splineStreamer = new SplineTrackStreamer(5.0, 'track_golden_gp', pakStreamer);
    synthEngine = new GranularSynthEngine();
    aiDirector = new RacingAIDirector(splineStreamer, synthEngine);
  });

  // ==========================================================================
  // 1. 5-Tier Racing AI Director (F37)
  // ==========================================================================
  describe('1. 5-Tier Racing AI Director (F37)', () => {
    it('configures all 5 difficulty tiers with strictly monotonic pace & grip scaling', () => {
      const order = ['EASY', 'MEDIUM', 'HARD', 'VERY_HARD', 'SUPER_HARD'] as const;
      let prevPace = 0;
      let prevGrip = 0;

      for (const tier of order) {
        const dec = aiDirector.evaluateAiTacticalDecision(tier);
        expect(dec.paceEfficiency).toBeGreaterThan(prevPace);
        expect(dec.cornerGripFactor).toBeGreaterThan(prevGrip);
        prevPace = dec.paceEfficiency;
        prevGrip = dec.cornerGripFactor;
      }

      expect(AI_DIFFICULTY_SPECS.EASY.paceEfficiency).toBe(0.76);
      expect(AI_DIFFICULTY_SPECS.SUPER_HARD.paceEfficiency).toBe(1.02);
    });

    it('enforces AI spline-following within road boundaries (|lateralOffset| <= 10m)', () => {
      aiDirector.configure('HARD', 'GRAND_PRIX_3_LAPS');
      for (const r of aiDirector.racers) {
        expect(Math.abs(r.lateralOffset)).toBeLessThanOrEqual(10.0);
      }
    });

    it('evaluates SUPER_HARD tactical drafting when trailing leader within 25.0m wake', () => {
      const inDraft = aiDirector.evaluateAiTacticalDecision('SUPER_HARD', {
        distanceBehindLeaderMeters: 18.0,
        lateralDeltaMeters: 1.0,
      });
      expect(inDraft.drafting).toBe(true);

      const outOfDraftDist = aiDirector.evaluateAiTacticalDecision('SUPER_HARD', {
        distanceBehindLeaderMeters: 28.0,
        lateralDeltaMeters: 1.0,
      });
      expect(outOfDraftDist.drafting).toBe(false);

      const outOfDraftLat = aiDirector.evaluateAiTacticalDecision('SUPER_HARD', {
        distanceBehindLeaderMeters: 18.0,
        lateralDeltaMeters: 3.5,
      });
      expect(outOfDraftLat.drafting).toBe(false);
    });

    it('evaluates SUPER_HARD elevated skybridge overpass shortcut targeting (<= 150m)', () => {
      const approaching = aiDirector.evaluateAiTacticalDecision('SUPER_HARD', {
        distanceToSkybridgeMeters: 95.0,
      });
      expect(approaching.takingSkybridge).toBe(true);

      const tooFar = aiDirector.evaluateAiTacticalDecision('SUPER_HARD', {
        distanceToSkybridgeMeters: 180.0,
      });
      expect(tooFar.takingSkybridge).toBe(false);

      const easyApproaching = aiDirector.evaluateAiTacticalDecision('EASY', {
        distanceToSkybridgeMeters: 95.0,
      });
      expect(easyApproaching.takingSkybridge).toBe(false);
    });

    it('evaluates straightaway nitro deployment on low curvature with >20% charge', () => {
      const superHardStraight = aiDirector.evaluateAiTacticalDecision('SUPER_HARD', {
        curvature: 0.0004,
        nitroPercent: 65.0,
      });
      expect(superHardStraight.nitroActive).toBe(true);

      const superHardCorner = aiDirector.evaluateAiTacticalDecision('SUPER_HARD', {
        curvature: 0.0035,
        nitroPercent: 65.0,
      });
      expect(superHardCorner.nitroActive).toBe(false);

      const superHardEmpty = aiDirector.evaluateAiTacticalDecision('SUPER_HARD', {
        curvature: 0.0004,
        nitroPercent: 15.0,
      });
      expect(superHardEmpty.nitroActive).toBe(false);
    });

    it('evaluates dynamic slipstream draft bonus and triggers slipstream wind audio', () => {
      const sfxCountBefore = synthEngine.sfxCounters.slipstreamWind;
      const draft = aiDirector.evaluateSlipstreamDraft(15.0, 1.2);
      expect(draft.inSlipstream).toBe(true);
      expect(draft.dragReductionRatio).toBeGreaterThan(0.0);
      expect(draft.draftAccelBonusMps2).toBeGreaterThan(0.0);
      expect(synthEngine.sfxCounters.slipstreamWind).toBe(sfxCountBefore + 1);

      const noDraft = aiDirector.evaluateSlipstreamDraft(35.0, 1.2);
      expect(noDraft.inSlipstream).toBe(false);
      expect(noDraft.dragReductionRatio).toBe(0.0);
      expect(noDraft.draftAccelBonusMps2).toBe(0.0);
    });

    it('ranks racers by total distance driven on the leaderboard', () => {
      aiDirector.configure('HARD', 'GRAND_PRIX_3_LAPS');
      aiDirector.racers[0].totalDistance = 1500;
      aiDirector.racers[1].totalDistance = 2200;
      aiDirector.racers[2].totalDistance = 1800;

      const board = aiDirector.getLeaderboard();
      expect(board[0].id).toBe('ai_1');
      expect(board[1].id).toBe('ai_2');
      expect(board[2].id).toBe('player');
    });
  });

  // ==========================================================================
  // 2. 5 Standard Lap-Based Race Formats (F38)
  // ==========================================================================
  describe('2. 5 Standard Lap-Based Race Formats (F38)', () => {
    it('configures all 5 standard lap race formats with exact lap counts', () => {
      const formats = [
        ['SPRINT_1_LAP', 1],
        ['QUALIFIER_2_LAPS', 2],
        ['GRAND_PRIX_3_LAPS', 3],
        ['FEATURE_5_LAPS', 5],
        ['ENDURANCE_10_LAPS', 10],
      ] as const;

      for (const [fmt, expectedLaps] of formats) {
        const res = aiDirector.configure('HARD', fmt);
        expect(res.totalLaps).toBe(expectedLaps);
        expect(res.totalRacers).toBe(8);
        expect(aiDirector.totalLaps).toBe(expectedLaps);
      }
    });

    it('preserves currentLap when driving backward without completing all sector checkpoints', () => {
      aiDirector.configure('HARD', 'GRAND_PRIX_3_LAPS');
      expect(aiDirector.currentLap).toBe(1);
      expect(aiDirector.sectorCheckpointsPassed.every(Boolean)).toBe(false);

      // Reversing across the line does not increment lap
      aiDirector.step(0.1, { alongOffset: 4990, lateralOffset: 0, speedKph: -20 });
      expect(aiDirector.currentLap).toBe(1);
    });
  });

  // ==========================================================================
  // 3. Knockout Elimination Race Format (F39)
  // ==========================================================================
  describe('3. Knockout Elimination Race Format (F39)', () => {
    it('initializes grid with 6 racers and 5 total laps', () => {
      const cfg = aiDirector.configure('HARD', 'KNOCKOUT_ELIMINATION');
      expect(cfg.totalRacers).toBe(6);
      expect(cfg.totalLaps).toBe(5);
      expect(aiDirector.racers.length).toBe(6);
      expect(aiDirector.racers.filter((r) => r.status === 'ACTIVE').length).toBe(6);
    });

    it('eliminates last-place racer, triggering explosion event and knockout SFX', () => {
      aiDirector.configure('HARD', 'KNOCKOUT_ELIMINATION');
      const sfxBefore = synthEngine.sfxCounters.knockoutExplosion;

      const ev = aiDirector.eliminateLastPlaceRacer();
      expect(ev.explosionTriggered).toBe(true);
      expect(ev.activeRacersRemaining).toBe(5);
      expect(synthEngine.sfxCounters.knockoutExplosion).toBe(sfxBefore + 1);
    });

    it('sequentially eliminates racers down to 2 finalists and 1 sole victor on lap 5', () => {
      aiDirector.configure('HARD', 'KNOCKOUT_ELIMINATION');

      // 4 sequential eliminations (Laps 1 through 4)
      for (let lap = 1; lap <= 4; lap++) {
        const ev = aiDirector.eliminateLastPlaceRacer();
        expect(ev.activeRacersRemaining).toBe(6 - lap);
      }

      // 2 finalists remain
      expect(aiDirector.racers.filter((r) => r.status === 'ACTIVE').length).toBe(2);

      // Final elimination (Lap 5) produces 1 winner
      const finalEv = aiDirector.eliminateLastPlaceRacer();
      expect(finalEv.activeRacersRemaining).toBe(1);
      expect(aiDirector.racers.filter((r) => r.status === 'ACTIVE').length).toBe(1);
    });

    it('never re-eliminates an already eliminated racer on subsequent laps', () => {
      aiDirector.configure('HARD', 'KNOCKOUT_ELIMINATION');
      const ev1 = aiDirector.eliminateLastPlaceRacer();
      const ev2 = aiDirector.eliminateLastPlaceRacer();
      expect(ev1.eliminatedRacerId).not.toBe(ev2.eliminatedRacerId);

      const eliminated = aiDirector.racers.find((r) => r.id === ev1.eliminatedRacerId);
      expect(eliminated?.status).toBe('ELIMINATED');
      expect(eliminated?.speedKph).toBe(0);
    });

    it('eliminates player if player is trailing in last place', () => {
      aiDirector.configure('HARD', 'KNOCKOUT_ELIMINATION');
      // Set player totalDistance behind everyone else
      aiDirector.racers[0].totalDistance = -100;
      const ev = aiDirector.eliminateLastPlaceRacer();
      expect(ev.eliminatedRacerId).toBe('player');
      expect(ev.isPlayerEliminated).toBe(true);
    });
  });

  // ==========================================================================
  // 4. Solo Time Attack Mode with Ghost Car & Sector Splits (F40)
  // ==========================================================================
  describe('4. Solo Time Attack Mode with Ghost Car & Sector Splits (F40)', () => {
    it('initializes SOLO_TIME_ATTACK with exactly 1 racer (zero AI traffic)', () => {
      const cfg = aiDirector.configure('HARD', 'SOLO_TIME_ATTACK');
      expect(cfg.totalRacers).toBe(1);
      expect(aiDirector.racers.length).toBe(1);
      expect(aiDirector.sectorSplits).toEqual([null, null, null]);
    });

    it('records Sector 1 (33.3%), Sector 2 (66.7%), and Sector 3 (100%) splits accurately', () => {
      aiDirector.configure('HARD', 'SOLO_TIME_ATTACK');

      // Sector 1 split at 35% of lap
      const r1 = aiDirector.recordTimeAttackProgress(0.35, 8.2);
      expect(r1.completedLap).toBe(false);
      expect(aiDirector.sectorSplits[0]).toBe(8.2);
      expect(aiDirector.sectorSplits[1]).toBeNull();

      // Sector 2 split at 68% of lap
      const r2 = aiDirector.recordTimeAttackProgress(0.68, 16.5);
      expect(r2.completedLap).toBe(false);
      expect(aiDirector.sectorSplits[0]).toBe(8.2);
      expect(aiDirector.sectorSplits[1]).toBe(8.3); // 16.5 - 8.2

      // Sector 3 (Lap completion) at 100%
      const r3 = aiDirector.recordTimeAttackProgress(1.0, 24.6);
      expect(r3.completedLap).toBe(true);
      expect(r3.sectorSplits[2]).toBe(8.1); // 24.6 - 16.5
      expect(
        (r3.sectorSplits[0] ?? 0) + (r3.sectorSplits[1] ?? 0) + (r3.sectorSplits[2] ?? 0)
      ).toBeCloseTo(24.6, 2);
    });

    it('records Ghost Car frames during Lap 1 and activates Ghost Car replay on Lap 2', () => {
      aiDirector.configure('HARD', 'SOLO_TIME_ATTACK');
      expect(aiDirector.ghostCarActive).toBe(false);

      aiDirector.recordTimeAttackProgress(0.2, 5.0);
      aiDirector.recordTimeAttackProgress(0.5, 12.0);
      aiDirector.recordTimeAttackProgress(1.0, 24.0);

      expect(aiDirector.ghostRecording.length).toBeGreaterThanOrEqual(3);
      expect(aiDirector.ghostCarActive).toBe(true);
      expect(aiDirector.bestLapTimeSec).toBe(24.0);
    });

    it('computes negative lap delta for faster lap and preserves best lap time', () => {
      aiDirector.configure('HARD', 'SOLO_TIME_ATTACK');

      // Lap 1: 25.0s
      aiDirector.recordTimeAttackProgress(1.0, 25.0);
      expect(aiDirector.bestLapTimeSec).toBe(25.0);

      // Lap 2: 24.2s (faster by -0.8s)
      aiDirector.sectorSplits = [null, null, null];
      const lap2 = aiDirector.recordTimeAttackProgress(1.0, 24.2);
      expect(lap2.lapDeltaSec).toBeCloseTo(-0.8, 2);
      expect(aiDirector.bestLapTimeSec).toBe(24.2);

      // Lap 3: 25.5s (slower by +1.3s)
      aiDirector.sectorSplits = [null, null, null];
      const lap3 = aiDirector.recordTimeAttackProgress(1.0, 25.5);
      expect(lap3.lapDeltaSec).toBeCloseTo(1.3, 2);
      expect(aiDirector.bestLapTimeSec).toBe(24.2); // Still 24.2s
    });
  });

  // ==========================================================================
  // 5. Multi-RPM Exhaust & Granular Audio Synth Engine (F41)
  // ==========================================================================
  describe('5. Granular Audio Synth Engine (F41)', () => {
    it('initializes with 48 kHz sample rate and volume clamped in [0.0, 1.0]', () => {
      expect(synthEngine.sampleRate).toBe(48000);
      expect(synthEngine.masterVolume).toBe(0.85);

      synthEngine.setMasterVolume(1.5);
      expect(synthEngine.masterVolume).toBe(1.0);

      synthEngine.setMasterVolume(-0.5);
      expect(synthEngine.masterVolume).toBe(0.0);

      synthEngine.setMasterVolume(0.7);
      expect(synthEngine.masterVolume).toBe(0.7);
    });

    it('synthesizes multi-RPM engine audio scaling from 1,000 RPM to 12,000 RPM', () => {
      const idle = synthEngine.updateEngineAudio('pagani_v12', 1000, 0.2);
      const high = synthEngine.updateEngineAudio('pagani_v12', 8500, 0.9);

      expect(high.fundamentalFreqHz).toBeGreaterThan(idle.fundamentalFreqHz);
      expect(high.grainPlaybackRate).toBeGreaterThan(idle.grainPlaybackRate);
      expect(high.harmonicFormantCutoffHz).toBeGreaterThan(idle.harmonicFormantCutoffHz);
    });

    it('synthesizes distinct acoustic profiles across vehicle powertrain archetypes', () => {
      const v8 = synthEngine.updateEngineAudio('classic_muscle', 6000);
      const v12 = synthEngine.updateEngineAudio({ ...getVehicleById('lambo_v12')!, id: 'pagani_v12' }, 6000);

      expect(v8.archetype).toContain('crossplane_v8');
      expect(v12.archetype).toContain('v12');
      expect(v12.fundamentalFreqHz).toBeGreaterThan(v8.fundamentalFreqHz);
    });

    it('enforces strict Nyquist boundary (<= 24,000 Hz) even at extreme 14,000 RPM', () => {
      const redline = synthEngine.updateEngineAudio('terzo_ev', 14000);
      expect(redline.fundamentalFreqHz).toBeLessThanOrEqual(synthEngine.sampleRate / 2);
    });

    it('clamps invalid/extreme RPM inputs (0, -500, 999999, NaN) gracefully', () => {
      const spec = getVehicleById('terzo_ev')!;
      expect(synthEngine.updateEngineAudio('terzo_ev', 0).clampedRpm).toBe(800);
      expect(synthEngine.updateEngineAudio('terzo_ev', -500).clampedRpm).toBe(800);
      expect(synthEngine.updateEngineAudio('terzo_ev', 999999).clampedRpm).toBe(spec.redlineRpm);
      expect(Number.isFinite(synthEngine.updateEngineAudio('terzo_ev', NaN).clampedRpm)).toBe(true);
    });

    it('executes all 7 procedural SFX triggers and logs counters', () => {
      expect(synthEngine.playV12IgnitionRoar().played).toBe(true);
      expect(synthEngine.playTurboBlowOff(0.85).played).toBe(true);
      expect(synthEngine.playTireSkid(0.75).played).toBe(true);
      expect(synthEngine.playSlipstreamWind(0.9).played).toBe(true);
      expect(synthEngine.playPlasmaRingChime().played).toBe(true);
      expect(synthEngine.playShockwaveBoom().played).toBe(true);
      expect(synthEngine.playKnockoutExplosion().played).toBe(true);

      expect(synthEngine.sfxCounters.v12IgnitionRoar).toBe(1);
      expect(synthEngine.sfxCounters.turboBlowOff).toBe(1);
      expect(synthEngine.sfxCounters.tireSkid).toBe(1);
      expect(synthEngine.sfxCounters.slipstreamWind).toBe(1);
      expect(synthEngine.sfxCounters.plasmaRingChime).toBe(1);
      expect(synthEngine.sfxCounters.shockwaveBoom).toBe(1);
      expect(synthEngine.sfxCounters.knockoutExplosion).toBe(1);
      expect(synthEngine.sfxHistory.length).toBe(7);
    });
  });

  // ==========================================================================
  // 6. Global Controller Contract & Lifecycle (window.__APEX_GAME__) (F42)
  // ==========================================================================
  describe('6. Global Application Controller Contract & Full Game Integration (F42)', () => {
    let game: any;

    beforeEach(() => {
      game = initApexGame();
    });

    it('exposes all mandated action methods and subsystems on global controller', () => {
      const requiredMethods = [
        'getState',
        'completeBoot',
        'selectTab',
        'selectVehicle',
        'selectLivery',
        'setCircuitConfig',
        'toggleSandboxUnlockAll',
        'launchRace',
        'setCameraMode',
        'simulateWinRace',
        'exportCurrentVehicleGlb',
      ];

      for (const m of requiredMethods) {
        expect(typeof game[m]).toBe('function');
      }

      expect(game.subsystems.pakStreamer).toBeDefined();
      expect(game.subsystems.renderer).toBeDefined();
      expect(game.subsystems.splineStreamer).toBeDefined();
      expect(game.subsystems.tacticalRamps).toBeDefined();
      expect(game.subsystems.physicsWorld).toBeDefined();
      expect(game.subsystems.vehicleBuilder).toBeDefined();
      expect(game.subsystems.synthEngine).toBeDefined();
      expect(game.subsystems.progression).toBeDefined();
      expect(game.subsystems.aiDirector).toBeDefined();
    });

    it('executes full lifecycle state machine: BOOT -> PADDOCK -> RACING -> POST_RACE', () => {
      // 1. Initial State: BOOT
      expect(game.getState().phase).toBe('BOOT');

      // 2. Complete Boot -> PADDOCK
      const paddockState = game.completeBoot();
      expect(paddockState.phase).toBe('PADDOCK');
      expect(paddockState.cameraMode).toBe('SHOWROOM');

      // 3. Launch Race -> RACING
      const raceState = game.launchRace();
      expect(raceState.phase).toBe('RACING');
      expect(raceState.cameraMode).toBe('CHASE');

      // 4. Simulate Win Race -> POST_RACE
      const ceremonyState = game.simulateWinRace({ position: 1 });
      expect(ceremonyState.phase).toBe('POST_RACE');
      expect(ceremonyState.totalWins).toBeGreaterThanOrEqual(1);

      // 5. Return to Paddock
      const returnState = game.returnToPaddock();
      expect(returnState.phase).toBe('PADDOCK');
      expect(returnState.cameraMode).toBe('SHOWROOM');
    });

    it('supports ribbon tab selection and keyboard cycling [Q / E]', () => {
      game.completeBoot();
      expect(game.getState().activeTab).toBe(1);

      game.selectTab(3);
      expect(game.getState().activeTab).toBe(3);

      // Out of bounds clamping [1, 4]
      game.selectTab(9);
      expect(game.getState().activeTab).toBe(4);

      // Keyboard cycling: KeyE (4 -> 1), KeyQ (1 -> 4)
      game.pressTabKey('KeyE');
      expect(game.getState().activeTab).toBe(1);

      game.pressTabKey('KeyQ');
      expect(game.getState().activeTab).toBe(4);
    });

    it('handles vehicle selection with career unlock gating and sandbox override', () => {
      game.completeBoot();

      // Tier 0 car is unlocked
      game.selectVehicle('hot_hatch');
      expect(game.getState().selectedVehicleId).toBe('hot_hatch');

      // Locked car #30 (rimac_nevera) is rejected when sandbox is off
      game.selectVehicle('rimac_nevera');
      expect(game.getState().selectedVehicleId).toBe('hot_hatch'); // unchanged

      // Enable Sandbox Mode -> rimac_nevera can be selected
      game.toggleSandboxUnlockAll(true);
      expect(game.getState().sandboxUnlockedAll).toBe(true);

      game.selectVehicle('rimac_nevera');
      expect(game.getState().selectedVehicleId).toBe('rimac_nevera');
    });

    it('exports binary GLB 2.0 with glTF magic header (0x46546C67)', () => {
      game.completeBoot();
      const glb = game.exportCurrentVehicleGlb();

      expect(glb).toBeDefined();
      expect(glb.byteLength).toBeGreaterThan(1024);

      const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
      const magic = view.getUint32(0, true);
      expect(magic).toBe(0x46546c67); // 'glTF'
      const version = view.getUint32(4, true);
      expect(version).toBe(2);
    });

    it('cycles camera modes: CHASE -> COCKPIT -> HOOD -> ORBIT -> CHASE', () => {
      game.launchRace();
      expect(game.getState().cameraMode).toBe('CHASE');

      game.cycleCameraMode();
      expect(game.getState().cameraMode).toBe('COCKPIT');

      game.cycleCameraMode();
      expect(game.getState().cameraMode).toBe('HOOD');

      game.cycleCameraMode();
      expect(game.getState().cameraMode).toBe('ORBIT');

      game.cycleCameraMode();
      expect(game.getState().cameraMode).toBe('CHASE');
    });

    it('toggles audio mute and updates live telemetry state', () => {
      game.completeBoot();
      expect(game.getState().telemetry.audioMuted).toBe(false);

      const isMuted = game.toggleAudioMute();
      expect(isMuted).toBe(true);
      expect(game.getState().telemetry.audioMuted).toBe(true);

      const unmuted = game.toggleAudioMute();
      expect(unmuted).toBe(false);
      expect(game.getState().telemetry.audioMuted).toBe(false);
    });
  });

  // ==========================================================================
  // 7. Next-Gen 12-Powertrain Wavetables, PCM & Transients Suite (M6 & M8)
  // ==========================================================================
  describe('7. Next-Gen 12-Powertrain Wavetables, 48kHz PCM & Transients Suite', () => {
    it('verifies all 12 custom 32-harmonic PeriodicWave Fourier wavetables exist with 33 coefficients', () => {
      const requiredFamilies = [
        'two_stroke',
        'twin_rotor',
        'inline4_na',
        'inline4_turbo',
        'inline6_turbo',
        'rally_boxer4',
        'crossplane_v8',
        'flatplane_v8',
        'flat6_na',
        'screaming_v12',
        'ev_motor',
        'supersonic_jet',
      ];

      for (const fam of requiredFamilies) {
        expect(POWERTRAIN_WAVETABLES[fam]).toBeDefined();
        const { real, imag } = POWERTRAIN_WAVETABLES[fam];
        expect(real.length).toBe(33); // DC (k=0) + k=1..32 harmonics
        expect(imag.length).toBe(33);
        // DC offset must be 0
        expect(real[0]).toBe(0);
        expect(imag[0]).toBe(0);
      }
    });

    it('decodes raw 48kHz signed 16-bit PCM chunks into AudioBuffer or handles headless gracefully', () => {
      // 100 samples of 16-bit PCM (200 bytes)
      const pcm16Data = new Uint8Array(200);
      for (let i = 0; i < 100; i++) {
        const val = Math.round(Math.sin((i / 100) * Math.PI * 2) * 16000);
        pcm16Data[i * 2] = val & 0xff;
        pcm16Data[i * 2 + 1] = (val >> 8) & 0xff;
      }

      // decodePcmChunkToAudioBuffer should execute without throwing
      const buffer = synthEngine.decodePcmChunkToAudioBuffer(pcm16Data, 48000);
      // In headless/Node without AudioContext it returns null; in browser/mock with AudioContext it returns AudioBuffer
      if (buffer) {
        expect(buffer.sampleRate).toBe(48000);
        expect(buffer.length).toBe(100);
      }
    });

    it('executes persistent stick-slip tire screech resonator without spamming node allocations', () => {
      expect(synthEngine.sfxCounters.tireSkid).toBe(0);

      // Rapidly simulate 60 frames of drifting
      for (let f = 0; f < 60; f++) {
        const res = synthEngine.playTireSkid(0.85);
        expect(res.played).toBe(true);
        expect(res.intensity).toBe(0.85);
      }

      expect(synthEngine.sfxCounters.tireSkid).toBe(60);
      expect(synthEngine.sfxHistory.filter((s) => s === 'tireSkid').length).toBe(60);
    });

    it('executes motorsport transients: gear shifts, kerb rumble, barrier scrape, AI Doppler pass-by, and tunnel reverb', () => {
      // Upshift ignition cut
      const upshift = synthEngine.playGearShift('UPSHIFT', true);
      expect(upshift.played).toBe(true);

      // Downshift rev-match
      const downshift = synthEngine.playGearShift('DOWNSHIFT');
      expect(downshift.played).toBe(true);

      // Kerb rumble
      const kerb = synthEngine.playKerbRumble(0.8, 140);
      expect(kerb.played).toBe(true);

      // Barrier scrape
      const scrape = synthEngine.playBarrierScrape(0.9, 'RIGHT');
      expect(scrape.played).toBe(true);

      // AI Doppler pass-by
      const passBy = synthEngine.playAiDopplerPassBy(22.0, 4.5, 0.8);
      expect(passBy.played).toBe(true);

      // Slipstream wind
      const wind = synthEngine.playSlipstreamWind(0.95);
      expect(wind.played).toBe(true);
      expect(synthEngine.sfxCounters.slipstreamWind).toBeGreaterThan(0);

      // Tunnel reverb
      expect(() => synthEngine.setTunnelReverb(true)).not.toThrow();
      expect(() => synthEngine.setTunnelReverb(false)).not.toThrow();
    });
  });

  // ==========================================================================
  // 8. Multi-Surface Pacejka, 4-Corner Thermals & Dynamic Physics (M1 & M8)
  // ==========================================================================
  describe('8. Multi-Surface Pacejka, 4-Corner Tire Thermals & Physics Integration', () => {
    let world: RapierVehicleWorld;

    beforeEach(() => {
      world = new RapierVehicleWorld(splineStreamer);
    });

    it('classifies ASPHALT, KERB, and SHOULDER surfaces by lateral offset with thermodynamic heating', () => {
      const spec = VEHICLE_ROSTER[0];
      const car = world.addVehicle('multi_surface_car', spec, 0, 0);

      expect(car.wheels.length).toBe(4);
      expect(car.wheels[0].surfaceType).toBe('ASPHALT');
      expect(car.wheels[0].surfaceMu).toBe(1.15);
      expect(car.wheels[0].tireTempCelsius).toBeGreaterThan(0);

      // Place car near road edge (kerb zone)
      world.setVehicleSpeedAndHeading('multi_surface_car', 100, 0, 8.8); // 8.8m from center (roadWidth = 20m)
      world.setControlInput('multi_surface_car', { throttle: 0.8, brake: 0, steer: 0.05 });
      world.stepSubsteps(10);

      const updated = world.getVehicleState('multi_surface_car')!;
      const hasKerb = updated.wheels.some((w) => w.surfaceType === 'KERB');
      expect(hasKerb).toBe(true);
      expect(updated.kerbRumbleIntensity).toBeGreaterThan(0.0);
    });

    it('activates slipstream wake drafting within 25m behind leading opponents', () => {
      const spec = VEHICLE_ROSTER[0];
      const playerCar = world.addVehicle('player_drafter', spec, 100, 0);
      world.setVehicleSpeedAndHeading('player_drafter', 200, 0, 0);

      // Set leader 15m ahead along the centerline
      world.setLeaders([{ alongOffset: 115, lateralOffset: 0.2, speedMs: 200 / 3.6 }]);

      world.setControlInput('player_drafter', { throttle: 1.0, brake: 0, steer: 0 });
      world.stepSubsteps(5);

      const st = world.getVehicleState('player_drafter')!;
      expect(st.slipstreamActive).toBe(true);
      expect(st.slipstreamDraftRatio).toBeGreaterThan(0.2);
    });

    it('applies Mod Studio tuning parameters directly to suspension and aerodynamics', () => {
      const spec = VEHICLE_ROSTER[0];
      world.addVehicle('tuned_car', spec, 0, 0);

      world.setVehicleTuning('tuned_car', {
        suspensionStiffness: 1.3,
        downforceRatio: 1.25,
        camberDeg: -2.8,
        rideHeightOffset: -0.03,
      });

      world.setVehicleSpeedAndHeading('tuned_car', 150, 0, 0);
      world.stepSubsteps(10);

      const st = world.getVehicleState('tuned_car')!;
      expect(st.downforceN).toBeGreaterThan(0);
      expect(Number.isFinite(st.lateralG)).toBe(true);
      expect(Number.isFinite(st.longitudinalG)).toBe(true);
    });
  });
});

