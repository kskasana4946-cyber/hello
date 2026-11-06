// tests/part5_career_ui.spec.ts
// Milestone M5 Unit Test Suite: Career Unlock Ladder, Dyno Boot Screen & 4-Tab Paddock UI
// Verifies:
// 1. Win-by-Win Career Unlock Ladder 0..31 wins (1 Win = +1 New Car).
// 2. Early CR vehicle purchase boundary (cost - 1 vs cost).
// 3. Non-destructive [🔓 SANDBOX: UNLOCK ALL 34 CARS] toggle and restore.
// 4. BootLoadingScreen 0–12,000 RPM dyno tachometer & ~400 MB subsystem streamer.
// 5. PaddockShowroomUI 4-tab ribbon navigation ([Q / E]), vehicle selection & binary .glb export (0x46546C67).
// 6. PostRaceRewardCeremony 3D podium, turntable reveal (0.65 rad/s) & itemized CR/XP breakdown.
// 7. RaceHUD live cockpit telemetry updates & brake temperature glow.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ProgressionManager,
  TIER_0_STARTER_IDS,
} from '../src/career/ProgressionManager';
import {
  BootLoadingScreen,
  SUBSYSTEM_MAX_MB,
} from '../src/ui/BootLoadingScreen';
import {
  PaddockShowroomUI,
  PBR_LIVERY_PRESETS,
} from '../src/ui/PaddockShowroomUI';
import { PostRaceRewardCeremony } from '../src/ui/PostRaceRewardCeremony';
import { RaceHUD } from '../src/ui/RaceHUD';
import {
  VEHICLE_ROSTER,
  VEHICLE_COUNT,
  getVehicleById,
  getVehicleByIndex,
} from '../src/vehicles/VehicleRoster';
import { LiveCockpitTelemetry } from '../src/core/types';

describe('Milestone M5: Career Unlock Ladder, Dyno Boot Screen & 4-Tab Paddock UI', () => {
  let memoryStorage: Map<string, string>;
  let progression: ProgressionManager;

  beforeEach(() => {
    memoryStorage = new Map<string, string>();
    progression = new ProgressionManager(memoryStorage);
  });

  // ==========================================================================
  // 1. Win-by-Win Career Unlock Ladder (0..31 Wins & Overflow)
  // ==========================================================================
  describe('1. Win-by-Win Career Unlock Ladder', () => {
    it('initializes at 0 wins with exactly 3 Tier 0 starter cars unlocked', () => {
      const state = progression.getState();
      expect(state.totalWins).toBe(0);
      expect(state.credits).toBe(0);
      expect(state.driverXp).toBe(0);
      expect(state.sandboxUnlockedAll).toBe(false);
      expect(state.unlockedVehicleIds).toEqual(['scooter', 'hot_hatch', 'roadster']);
      expect(progression.isVehicleUnlocked('scooter')).toBe(true);
      expect(progression.isVehicleUnlocked('hot_hatch')).toBe(true);
      expect(progression.isVehicleUnlocked('roadster')).toBe(true);
      expect(progression.isVehicleUnlocked('jdm_rotary')).toBe(false);
      expect(progression.isVehicleUnlocked('jet_thrust')).toBe(false);
    });

    it('unlocks cars sequentially from win 1 (jdm_rotary) through win 31 (jet_thrust)', () => {
      // 1 Win = +1 New Car
      for (let w = 1; w <= 31; w++) {
        const report = progression.recordRaceResult({ position: 1 });
        expect(progression.totalWins).toBe(w);
        expect(progression.getUnlockedVehicleIds().length).toBe(3 + w);

        const expectedCar = VEHICLE_ROSTER[2 + w]; // index 3 is car #4
        expect(report.newlyUnlockedVehicle).not.toBeNull();
        expect(report.newlyUnlockedVehicle!.id).toBe(expectedCar.id);
        expect(report.turntableRevealActive).toBe(true);
        expect(report.turntableAngularVelRadSec).toBe(0.65);
        expect(progression.isVehicleUnlocked(expectedCar.id)).toBe(true);
      }

      expect(progression.getUnlockedVehicleIds().length).toBe(34);
      expect(progression.isVehicleUnlocked('jet_thrust')).toBe(true);
    });

    it('handles win 32+ without car #35 overflow (newlyUnlockedVehicle === null)', () => {
      // Advance to 31 wins
      for (let w = 1; w <= 31; w++) {
        progression.recordRaceResult({ position: 1 });
      }
      expect(progression.totalWins).toBe(31);
      expect(progression.getUnlockedVehicleIds().length).toBe(34);

      // 32nd win
      const report32 = progression.recordRaceResult({ position: 1 });
      expect(progression.totalWins).toBe(32);
      expect(progression.getUnlockedVehicleIds().length).toBe(34);
      expect(report32.newlyUnlockedVehicle).toBeNull();
      expect(report32.turntableRevealActive).toBe(false);
      expect(report32.podiumStageActive).toBe(true);
    });

    it('awards CR and Driver XP for 2nd and 3rd place finishes without incrementing totalWins', () => {
      const initialWins = progression.totalWins;
      const initialUnlocked = progression.getUnlockedVehicleIds().length;

      const report2nd = progression.recordRaceResult({ position: 2, overtakes: 4, driftCombos: 2 });
      expect(progression.totalWins).toBe(initialWins);
      expect(progression.getUnlockedVehicleIds().length).toBe(initialUnlocked);
      expect(report2nd.podiumStageActive).toBe(true);
      expect(report2nd.turntableRevealActive).toBe(false);
      expect(report2nd.newlyUnlockedVehicle).toBeNull();
      expect(report2nd.breakdown.podiumCredits).toBe(6000);
      expect(progression.credits).toBeGreaterThan(6000);
      expect(progression.driverXp).toBeGreaterThan(0);

      const report3rd = progression.recordRaceResult({ position: 3, overtakes: 1 });
      expect(progression.totalWins).toBe(initialWins);
      expect(report3rd.podiumStageActive).toBe(true);
      expect(report3rd.breakdown.podiumCredits).toBe(3500);

      const report4th = progression.recordRaceResult({ position: 4 });
      expect(report4th.podiumStageActive).toBe(false);
      expect(report4th.breakdown.podiumCredits).toBe(1000);
    });

    it('accurately calculates itemized economy rewards across all 6 categories including +2,500 CR stunts', () => {
      const rep = progression.recordRaceResult({
        position: 1,
        overtakes: 3,        // 3 * 450 = 1350
        slipstreamSec: 4.0,  // 4 * 300 = 1200
        driftCombos: 2,      // 2 * 600 = 1200
        stunts: 3,           // 3 * 2500 = 7500
        takedowns: 2,        // 2 * 1200 = 2400
        laps: 2,             // 10000 * 2 = 20000
      });

      expect(rep.breakdown.podiumCredits).toBe(20000);
      expect(rep.breakdown.overtakeCredits).toBe(1350);
      expect(rep.breakdown.slipstreamCredits).toBe(1200);
      expect(rep.breakdown.driftCredits).toBe(1200);
      expect(rep.breakdown.stuntCredits).toBe(7500);
      expect(rep.breakdown.takedownCredits).toBe(2400);

      const expectedTotal = 20000 + 1350 + 1200 + 1200 + 7500 + 2400; // 33,650 CR
      expect(rep.totalEarnedCredits).toBe(expectedTotal);
      expect(rep.totalEarnedXp).toBe(Math.round(expectedTotal * 0.25));
      expect(progression.credits).toBe(expectedTotal);
      expect(progression.driverXp).toBe(Math.round(expectedTotal * 0.25));
    });
  });

  // ==========================================================================
  // 2. Early CR Car Purchase Boundary Validation
  // ==========================================================================
  describe('2. Early CR Vehicle Purchase Boundary Validation', () => {
    it('rejects purchase at boundary credits = creditCost - 1', () => {
      const target = getVehicleById('jdm_rotary')!;
      const cost = target.creditCost;
      expect(cost).toBeGreaterThan(0);

      // Set credits to cost - 1
      progression.credits = cost - 1;
      const res = progression.purchaseVehicleWithCredits('jdm_rotary');
      expect(res.purchased).toBe(false);
      expect(res.reason).toBe('INSUFFICIENT_CREDITS');
      expect(res.requiredCredits).toBe(cost);
      expect(progression.credits).toBe(cost - 1);
      expect(progression.isVehicleUnlocked('jdm_rotary')).toBe(false);
    });

    it('accepts purchase at boundary credits = creditCost, leaves 0 credits, and unlocks car', () => {
      const target = getVehicleById('jdm_rotary')!;
      const cost = target.creditCost;

      // Set credits to exact cost
      progression.credits = cost;
      const res = progression.purchaseVehicleWithCredits('jdm_rotary');
      expect(res.purchased).toBe(true);
      expect(res.alreadyUnlocked).toBe(false);
      expect(res.deductedCredits).toBe(cost);
      expect(progression.credits).toBe(0);
      expect(progression.isVehicleUnlocked('jdm_rotary')).toBe(true);
      expect(progression.getUnlockedVehicleIds()).toContain('jdm_rotary');
    });

    it('deducts 0 CR when re-purchasing an already unlocked vehicle', () => {
      progression.credits = 100000;
      progression.purchaseVehicleWithCredits('jdm_rotary');
      const creditsAfterFirst = progression.credits;

      const dupRes = progression.purchaseVehicleWithCredits('jdm_rotary');
      expect(dupRes.purchased).toBe(true);
      expect(dupRes.alreadyUnlocked).toBe(true);
      expect(dupRes.deductedCredits).toBe(0);
      expect(progression.credits).toBe(creditsAfterFirst);
    });

    it('rejects purchase of non-existent vehicle ID', () => {
      progression.credits = 500000;
      const res = progression.purchaseVehicleWithCredits('space_shuttle_99');
      expect(res.purchased).toBe(false);
      expect(res.reason).toBe('UNKNOWN_VEHICLE');
      expect(progression.credits).toBe(500000);
    });
  });

  // ==========================================================================
  // 3. Non-Destructive [🔓 SANDBOX: UNLOCK ALL 34 CARS] Toggle & Restore
  // ==========================================================================
  describe('3. [🔓 SANDBOX: UNLOCK ALL 34 CARS] Toggle & Restore', () => {
    it('non-destructively unlocks all 34 cars and cleanly restores career progression on toggle OFF', () => {
      // Simulate 2 career wins (5 cars unlocked)
      progression.recordRaceResult({ position: 1 });
      progression.recordRaceResult({ position: 1 });
      expect(progression.totalWins).toBe(2);
      expect(progression.getUnlockedVehicleIds().length).toBe(5);
      const creditsBefore = progression.credits;

      // Toggle Sandbox ON
      const onState = progression.toggleSandboxUnlockAll();
      expect(onState.sandboxUnlockedAll).toBe(true);
      expect(onState.unlockedVehicleIds.length).toBe(34);
      expect(progression.isVehicleUnlocked('jet_thrust')).toBe(true);
      expect(progression.isVehicleUnlocked('f1')).toBe(true);
      // Total wins and credits remain untouched
      expect(progression.totalWins).toBe(2);
      expect(progression.credits).toBe(creditsBefore);

      // Toggle Sandbox OFF
      const offState = progression.toggleSandboxUnlockAll();
      expect(offState.sandboxUnlockedAll).toBe(false);
      expect(offState.unlockedVehicleIds.length).toBe(5);
      expect(progression.totalWins).toBe(2);
      expect(progression.credits).toBe(creditsBefore);
      expect(progression.isVehicleUnlocked('jet_thrust')).toBe(false);
      expect(progression.isVehicleUnlocked('hot_hatch')).toBe(true);
      expect(progression.isVehicleUnlocked('jdm_rotary')).toBe(true);
      expect(progression.isVehicleUnlocked('car')).toBe(true);
    });
  });

  // ==========================================================================
  // 4. Persistence & Corrupted Data Resilience
  // ==========================================================================
  describe('4. Persistence & Storage Resilience', () => {
    it('persists and restores state accurately across reload', () => {
      progression.recordRaceResult({ position: 1 });
      progression.purchaseVehicleWithCredits('skyline_gtr');
      const st1 = progression.getState();

      const newProg = new ProgressionManager(memoryStorage);
      const st2 = newProg.getState();
      expect(st2.totalWins).toBe(st1.totalWins);
      expect(st2.credits).toBe(st1.credits);
      expect(st2.driverXp).toBe(st1.driverXp);
      expect(st2.unlockedVehicleIds).toEqual(st1.unlockedVehicleIds);
    });

    it('gracefully resets to defaults when encountering corrupted or negative JSON', () => {
      const resBad = progression.loadFromStorage('not_json{{');
      expect(resBad.totalWins).toBe(0);
      expect(resBad.unlockedVehicleIds).toEqual(['scooter', 'hot_hatch', 'roadster']);

      const resNeg = progression.loadFromStorage(JSON.stringify({ totalWins: -10, credits: -500 }));
      expect(resNeg.totalWins).toBe(0);
      expect(resNeg.credits).toBe(0);
      expect(resNeg.unlockedVehicleIds.length).toBe(3);
    });
  });

  // ==========================================================================
  // 5. BootLoadingScreen: Dyno Tachometer & Subsystem Streamer
  // ==========================================================================
  describe('5. BootLoadingScreen: Dyno Tachometer & Subsystem Streamer', () => {
    let bootScreen: BootLoadingScreen;

    beforeEach(() => {
      bootScreen = new BootLoadingScreen();
    });

    it('accurately sweeps the 0–12,000 RPM Dyno tachometer across 0%, 25%, 50%, 75%, 100%', () => {
      const p0 = bootScreen.setBootProgress(0.0);
      expect(p0.bootProgress).toBe(0.0);
      expect(p0.bootRpm).toBe(0);

      const p25 = bootScreen.setBootProgress(0.25);
      expect(p25.bootProgress).toBe(0.25);
      expect(p25.bootRpm).toBe(3000);

      const p50 = bootScreen.setBootProgress(0.5);
      expect(p50.bootProgress).toBe(0.5);
      expect(p50.bootRpm).toBe(6000);

      const p75 = bootScreen.setBootProgress(0.75);
      expect(p75.bootProgress).toBe(0.75);
      expect(p75.bootRpm).toBe(9000);

      const p100 = bootScreen.setBootProgress(1.0);
      expect(p100.bootProgress).toBe(1.0);
      expect(p100.bootRpm).toBe(12000);
    });

    it('clamps boot progress strictly within [0.0, 1.0] and RPM to [0, 12,000]', () => {
      const pNeg = bootScreen.setBootProgress(-0.5);
      expect(pNeg.bootProgress).toBe(0.0);
      expect(pNeg.bootRpm).toBe(0);

      const pOver = bootScreen.setBootProgress(1.8);
      expect(pOver.bootProgress).toBe(1.0);
      expect(pOver.bootRpm).toBe(12000);
    });

    it('scales live subsystem progress bars up to the exact ~400 MB asset pool footprint', () => {
      const pFull = bootScreen.setBootProgress(1.0);
      expect(pFull.subsystems.vehiclesMb).toBe(SUBSYSTEM_MAX_MB.vehicles); // 160.0 MB
      expect(pFull.subsystems.tracksMb).toBe(SUBSYSTEM_MAX_MB.tracks);     // 160.0 MB
      expect(pFull.subsystems.skyMb).toBe(SUBSYSTEM_MAX_MB.sky);           // 50.0 MB
      expect(pFull.subsystems.coreMb).toBe(SUBSYSTEM_MAX_MB.core);         // 30.0 MB

      const totalMb =
        pFull.subsystems.vehiclesMb +
        pFull.subsystems.tracksMb +
        pFull.subsystems.skyMb +
        pFull.subsystems.coreMb;
      expect(totalMb).toBe(400.0);
    });

    it('triggers V12 startup roar on completeBoot() and operates idempotently', () => {
      expect(bootScreen.isComplete()).toBe(false);
      const res = bootScreen.completeBoot();
      expect(res.isComplete).toBe(true);
      expect(res.bootRpm).toBe(12000);
      expect(bootScreen.v12RoarPlayedCount).toBe(1);

      // Calling completeBoot() again is an idempotent no-op
      const res2 = bootScreen.completeBoot();
      expect(res2.isComplete).toBe(true);
      expect(bootScreen.v12RoarPlayedCount).toBe(1);
    });

    it('disposes cleanly without throwing', () => {
      expect(() => bootScreen.dispose()).not.toThrow();
    });
  });

  // ==========================================================================
  // 6. PaddockShowroomUI: 4-Tab Ribbon Navigation & Binary GLB Export
  // ==========================================================================
  describe('6. PaddockShowroomUI: Ribbon Navigation, Selection & GLB Export', () => {
    let paddock: PaddockShowroomUI;

    beforeEach(() => {
      paddock = new PaddockShowroomUI(progression);
    });

    it('navigates between all 4 tabs via selectTab(1..4) and clamps out-of-range inputs', () => {
      expect(paddock.selectTab(1).activeTab).toBe(1);
      expect(paddock.selectTab(2).activeTab).toBe(2);
      expect(paddock.selectTab(3).activeTab).toBe(3);
      expect(paddock.selectTab(4).activeTab).toBe(4);

      // Clamping
      expect(paddock.selectTab(0).activeTab).toBe(1);
      expect(paddock.selectTab(5).activeTab).toBe(4);
      expect(paddock.selectTab(-99).activeTab).toBe(1);
    });

    it('cycles tabs via [Q / E] keys with proper cyclic boundary wrapping', () => {
      paddock.selectTab(1);
      expect(paddock.pressTabKey('KeyE').activeTab).toBe(2);
      expect(paddock.pressTabKey('KeyE').activeTab).toBe(3);
      expect(paddock.pressTabKey('KeyE').activeTab).toBe(4);
      expect(paddock.pressTabKey('KeyE').activeTab).toBe(1); // 4 wraps to 1

      expect(paddock.pressTabKey('KeyQ').activeTab).toBe(4); // 1 wraps to 4
      expect(paddock.pressTabKey('KeyQ').activeTab).toBe(3);
      expect(paddock.pressTabKey('KeyQ').activeTab).toBe(2);
      expect(paddock.pressTabKey('KeyQ').activeTab).toBe(1);
    });

    it('allows selection of unlocked vehicles and rejects locked vehicles when Sandbox is OFF', () => {
      expect(paddock.selectedVehicleId).toBe('scooter');
      // Select another unlocked vehicle
      expect(paddock.selectVehicle('hot_hatch').selectedVehicleId).toBe('hot_hatch');

      // Attempt to select locked vehicle
      expect(paddock.selectVehicle('jet_thrust').selectedVehicleId).toBe('hot_hatch');

      // Enable Sandbox
      paddock.toggleSandboxUnlockAll();
      expect(paddock.selectVehicle('jet_thrust').selectedVehicleId).toBe('jet_thrust');
    });

    it('selects from 12 PBR livery presets (0..11) with valid properties', () => {
      expect(PBR_LIVERY_PRESETS.length).toBe(12);
      for (let i = 0; i < 12; i++) {
        paddock.selectLivery(i);
        expect(paddock.selectedLiveryIndex).toBe(i);
        const preset = PBR_LIVERY_PRESETS[i];
        expect(preset.clearcoat).toBeGreaterThanOrEqual(0.0);
        expect(preset.metallic).toBeGreaterThanOrEqual(0.0);
        expect(preset.roughness).toBeGreaterThanOrEqual(0.0);
      }
    });

    it('configures track, sky, distance (2..50 KM), format, and AI difficulty in Tab 3', () => {
      paddock.setCircuitConfig({
        trackId: 'track_neotokyo',
        skyId: 'sky_neotokyo_cyber',
        distanceKm: 50.0,
        format: 'KNOCKOUT_ELIMINATION',
        aiDifficulty: 'SUPER_HARD',
      });

      const st = paddock.getState();
      expect(st.selectedTrackId).toBe('track_neotokyo');
      expect(st.selectedSkyId).toBe('sky_neotokyo_cyber');
      expect(st.selectedDistanceKm).toBe(50.0);
      expect(st.selectedFormat).toBe('KNOCKOUT_ELIMINATION');
      expect(st.selectedAiDifficulty).toBe('SUPER_HARD');
    });

    it('docked launch bar transitions phase from PADDOCK to RACING', () => {
      expect(paddock.phase).toBe('PADDOCK');
      paddock.launchRace();
      expect(paddock.phase).toBe('RACING');
      expect(paddock.cameraMode).toBe('CHASE');
    });

    it('generates a valid binary glTF 2.0 .glb container with magic 0x46546C67 and chunks', () => {
      paddock.selectVehicle('roadster');
      paddock.selectLivery(2);
      paddock.setModStudioTuning({ rideHeightOffset: -0.02, wingAngleRad: 0.28 });

      const glbBytes = paddock.exportCurrentVehicleGlb();
      expect(glbBytes instanceof Uint8Array).toBe(true);
      expect(glbBytes.byteLength).toBeGreaterThan(1024);

      const view = new DataView(glbBytes.buffer, glbBytes.byteOffset, glbBytes.byteLength);
      const magic = view.getUint32(0, true);
      const version = view.getUint32(4, true);
      const totalLength = view.getUint32(8, true);

      // 0x46546C67 is little-endian ASCII "glTF"
      expect(magic).toBe(0x46546c67);
      expect(version).toBe(2);
      expect(totalLength).toBe(glbBytes.byteLength);

      // JSON Chunk header
      const jsonChunkLen = view.getUint32(12, true);
      const jsonChunkType = view.getUint32(16, true);
      expect(jsonChunkType).toBe(0x4e4f534a); // "JSON"
      expect(jsonChunkLen).toBeGreaterThan(20);

      // Parse JSON chunk
      const jsonBytes = glbBytes.subarray(20, 20 + jsonChunkLen);
      const jsonStr = new TextDecoder().decode(jsonBytes).replace(/\0+$/g, '').trim();
      const parsedGltf = JSON.parse(jsonStr);
      expect(parsedGltf.asset.version).toBe('2.0');
      expect(parsedGltf.meshes.length).toBeGreaterThan(0);
      expect(parsedGltf.materials.length).toBeGreaterThan(0);
      expect(parsedGltf.nodes.length).toBeGreaterThan(0);

      // BIN Chunk header
      const binOffset = 20 + jsonChunkLen;
      const binChunkLen = view.getUint32(binOffset, true);
      const binChunkType = view.getUint32(binOffset + 4, true);
      expect(binChunkType).toBe(0x004e4942); // "BIN\0"
      expect(binOffset + 8 + binChunkLen).toBe(glbBytes.byteLength);
    });
  });

  // ==========================================================================
  // 7. PostRaceRewardCeremony: 3D Podium, Turntable Reveal & Dismissal
  // ==========================================================================
  describe('7. PostRaceRewardCeremony: Podium, Turntable Reveal & Dismissal', () => {
    let ceremony: PostRaceRewardCeremony;

    beforeEach(() => {
      ceremony = new PostRaceRewardCeremony();
    });

    it('activates 3D podium stage for top-3 finishes and turntable reveal on vehicle unlock', () => {
      const rep = progression.recordRaceResult({ position: 1 });
      ceremony.showCeremony(rep);

      expect(ceremony.activeReport).not.toBeNull();
      expect(ceremony.activeReport!.podiumStageActive).toBe(true);
      expect(ceremony.activeReport!.turntableRevealActive).toBe(true);
      expect(ceremony.turntableAngularVelRadSec).toBe(0.65);
    });

    it('smoothly rotates turntable angle and wraps at 2*pi radians', () => {
      const rep = progression.recordRaceResult({ position: 1 });
      ceremony.showCeremony(rep);

      // Update 2 seconds
      ceremony.update(2.0);
      expect(ceremony.turntableAngleRad).toBeCloseTo(1.3, 2);

      // Advance by 10 seconds -> should wrap within [0, 2*pi)
      ceremony.update(10.0);
      expect(ceremony.turntableAngleRad).toBeGreaterThanOrEqual(0.0);
      expect(ceremony.turntableAngleRad).toBeLessThan(Math.PI * 2);
    });

    it('dismisses ceremony and transitions back to Paddock Showroom', () => {
      const rep = progression.recordRaceResult({ position: 1 });
      ceremony.showCeremony(rep);

      let callbackFired = false;
      ceremony.onDismissCallback = () => {
        callbackFired = true;
      };

      const res = ceremony.dismiss();
      expect(res.phase).toBe('PADDOCK');
      expect(ceremony.isDismissed).toBe(true);
      expect(callbackFired).toBe(true);
    });
  });

  // ==========================================================================
  // 8. RaceHUD: Live Cockpit Telemetry & Brake Temperature Glow
  // ==========================================================================
  describe('8. RaceHUD: Telemetry Updates & Warning Displays', () => {
    let hud: RaceHUD;

    beforeEach(() => {
      hud = new RaceHUD();
    });

    it('accepts and stores complete live cockpit telemetry updates', () => {
      const telemetry: LiveCockpitTelemetry = {
        speedKph: 312.4,
        rpm: 8450,
        maxRpm: 9000,
        gear: 6,
        lapDeltaSec: -0.42,
        currentLap: 2,
        totalLaps: 3,
        position: 1,
        totalRacers: 8,
        nitroPercent: 85.0,
        drsActive: true,
        brakeTempCelsius: 850.0,
        sectorSplits: [24.12, 28.45, null],
      };

      hud.update(telemetry);
      expect(hud.currentTelemetry).not.toBeNull();
      expect(hud.currentTelemetry!.speedKph).toBe(312.4);
      expect(hud.currentTelemetry!.rpm).toBe(8450);
      expect(hud.currentTelemetry!.gear).toBe(6);
      expect(hud.currentTelemetry!.lapDeltaSec).toBe(-0.42);
      expect(hud.currentTelemetry!.drsActive).toBe(true);
      expect(hud.currentTelemetry!.brakeTempCelsius).toBe(850.0);
    });

    it('disposes cleanly without throwing', () => {
      expect(() => hud.dispose()).not.toThrow();
    });
  });
});
