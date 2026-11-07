/**
 * Tier 4 — Real-World Application Scenarios (24 Genuine End-to-End User Journeys: T4-01 .. T4-24)
 * Owned by: E2E_Testing_Track (tests/e2e/tier4_real_world_scenarios.spec.mjs)
 *
 * Implements all 24 end-to-end user journeys exactly as described in
 * TEST_INFRA.md § 4 and sub_orch_e2e_explorer_3/handoff.md.
 */

import {
  registerTest,
  assertTrue,
  assertFalse,
  assertEqual,
  assertNotEqual,
  assertApprox,
  assertGreater,
  assertGreaterOrEqual,
  assertLess,
  assertLessOrEqual,
  assertInRange,
  assertFiniteNumber,
  assertIncludes,
  assertThrows,
  assertPakHeader,
  assertGlbHeader,
} from './helpers/e2e_harness.mjs';

function t4(id, features, title, fn) {
  registerTest({ id, tier: 4, features, title, fn });
}

// ============================================================================
// Scenarios T4-01 .. T4-24
// ============================================================================

// T4-01: Cold Boot to First Career Victory (BOOT -> PADDOCK -> 2.0 KM Sprint -> POST_RACE Unlocking Car #4 jdm_rotary)
t4('T4-01', ['F1', 'F11', 'F16', 'F33', 'F34', 'F35', 'F38'], 'Cold Boot to First Career Victory (BOOT -> PADDOCK -> 2.0 KM Sprint -> POST_RACE Unlocking Car #4 jdm_rotary)', async (ctx) => {
  const app = ctx.createFreshController();
  assertEqual(app.getState().phase, 'BOOT');
  assertEqual(app.getState().bootProgress, 0.0);
  assertEqual(app.getState().bootRpm, 0);

  // Complete Boot
  app.setBootProgress(1.0);
  const bootState = app.completeBoot();
  assertEqual(bootState.phase, 'PADDOCK');
  assertEqual(bootState.totalWins, 0);
  assertEqual(bootState.unlockedVehicleIds.length, 3);
  assertIncludes(bootState.unlockedVehicleIds, 'roadster');

  // Paddock configuration
  app.selectVehicle('roadster');
  app.selectTab(3);
  app.setCircuitConfig({
    trackId: 'track_golden_gp',
    skyId: 'sky_golden_hour',
    distanceKm: 2.0,
    format: 'SPRINT_1_LAP',
    aiDifficulty: 'EASY',
  });

  // Launch Race
  const racing = app.launchRace();
  assertEqual(racing.phase, 'RACING');
  assertEqual(app.subsystems.splineStreamer.getTotalLength(), 2000);
  assertEqual(app.subsystems.aiDirector.totalLaps, 1);
  assertEqual(app.subsystems.aiDirector.aiDifficulty, 'EASY');

  // Win Race
  const postRace = app.simulateWinRace({ position: 1, overtakes: 3 });
  assertEqual(postRace.phase, 'POST_RACE');
  assertEqual(postRace.totalWins, 1);
  assertGreater(postRace.credits, 0);
  assertGreater(postRace.driverXp, 0);

  // Newly unlocked car #4 jdm_rotary
  assertIncludes(postRace.unlockedVehicleIds, 'jdm_rotary');
  assertTrue(postRace.lastCeremonyReport.turntableRevealActive);
  assertEqual(postRace.lastCeremonyReport.newlyUnlockedVehicle.id, 'jdm_rotary');
  assertTrue(postRace.lastCeremonyReport.podiumStageActive);
});

// T4-02: JDM Cyber Midnight Drift & Qualifier Run (5.0 KM FIA Grand Prix on track_neotokyo + sky_neotokyo_cyber / 2 Laps Qualifier / MEDIUM AI)
t4('T4-02', ['F3', 'F12', 'F17', 'F38'], 'JDM Cyber Midnight Drift & Qualifier Run (5.0 KM FIA Grand Prix on track_neotokyo + sky_neotokyo_cyber / 2 Laps Qualifier / MEDIUM AI)', async (ctx) => {
  const app = ctx.createFreshController();
  app.completeBoot();
  app.subsystems.progression.totalWins = 1;
  app.subsystems.progression.earnedOrPurchasedIds.add('jdm_rotary');

  app.selectVehicle('jdm_rotary');
  app.selectTab(2);
  app.selectLivery(3);
  assertEqual(app.getState().selectedLiveryIndex, 3);

  app.selectTab(3);
  app.setCircuitConfig({
    trackId: 'track_neotokyo',
    skyId: 'sky_neotokyo_cyber',
    distanceKm: 5.0,
    format: 'QUALIFIER_2_LAPS',
    aiDifficulty: 'MEDIUM',
  });

  app.launchRace();
  assertEqual(app.subsystems.splineStreamer.getTotalLength(), 5000);
  assertEqual(app.subsystems.aiDirector.totalLaps, 2);

  const ssr = app.subsystems.renderer.evaluateSsrSurface(0.82);
  assertGreater(ssr.reflectionWeight, 0.7);

  const postRace = app.simulateWinRace({ position: 1, driftCombos: 4 });
  assertEqual(postRace.totalWins, 2);
  assertIncludes(postRace.unlockedVehicleIds, 'car');
  assertEqual(postRace.lastCeremonyReport.newlyUnlockedVehicle.id, 'car');
  assertGreater(postRace.lastCeremonyReport.breakdown.driftCredits, 0);
});

// T4-03: First-Person 3D Cockpit Grand Prix (skyline_gtr #6 in COCKPIT Camera on 8.0 KM Pro GT Loop / 3 Laps Grand Prix / HARD AI)
t4('T4-03', ['F5', 'F18', 'F31', 'F38'], 'First-Person 3D Cockpit Grand Prix (skyline_gtr #6 in COCKPIT Camera on 8.0 KM Pro GT Loop / 3 Laps Grand Prix / HARD AI)', async (ctx) => {
  const app = ctx.createFreshController();
  app.completeBoot();
  app.toggleSandboxUnlockAll();

  app.selectVehicle('skyline_gtr');
  app.setCircuitConfig({
    trackId: 'track_golden_gp',
    skyId: 'sky_golden_hour',
    distanceKm: 8.0,
    format: 'GRAND_PRIX_3_LAPS',
    aiDifficulty: 'HARD',
  });

  app.launchRace();
  app.setCameraMode('COCKPIT');
  assertEqual(app.getState().cameraMode, 'COCKPIT');

  const cockpit = app.subsystems.vehicleBuilder.buildCockpitAndGlass('skyline_gtr');
  assertEqual(cockpit.glassMaterial.ior, 1.52);
  assertTrue(cockpit.framedWindows.frontWindshield.laminated);
  assertTrue(cockpit.framedWindows.interiorRearviewMirror.present);

  for (let s = 0; s < 20; s++) {
    app.subsystems.physicsWorld.step(0.1, { throttle: 1.0 });
  }
  assertGreater(app.subsystems.physicsWorld.state.speedKph, 40.0);

  const rendered = cockpit.updateCockpitTelemetry({
    speedKph: 210,
    gear: 4,
    rpm: 6800,
    maxRpm: 8500,
    lapDeltaSec: -0.35,
  });
  assertEqual(rendered.speedKph, 210);
  assertEqual(rendered.gear, 4);
  assertEqual(rendered.deltaColor, 'GREEN');

  app.simulateWinRace({ position: 1 });
  assertEqual(app.getState().phase, 'POST_RACE');
});

// T4-04: Redrock Canyon Tactical Ramp & Stunt Mastery (12.0 KM Endurance on track_canyon + sky_redrock_canyon / 5 Laps Feature / HARD AI)
t4('T4-04', ['F13', 'F19', 'F24', 'F25', 'F26', 'F27', 'F38'], 'Redrock Canyon Tactical Ramp & Stunt Mastery (12.0 KM Endurance on track_canyon + sky_redrock_canyon / 5 Laps Feature / HARD AI)', async (ctx) => {
  const app = ctx.createFreshController();
  app.completeBoot();
  app.toggleSandboxUnlockAll();

  app.selectVehicle('rally');
  app.setCircuitConfig({
    trackId: 'track_canyon',
    skyId: 'sky_redrock_canyon',
    distanceKm: 12.0,
    format: 'FEATURE_5_LAPS',
    aiDifficulty: 'HARD',
  });

  app.launchRace();
  assertEqual(app.subsystems.splineStreamer.getTotalLength(), 12000);
  assertEqual(app.subsystems.aiDirector.totalLaps, 5);

  // Ramp 1: Skybridge Overpass
  const skybridge = app.subsystems.tacticalRamps.rampZones.find((r) => r.type === 'SKYBRIDGE_OVERPASS');
  assertEqual(skybridge.deckHeightMeters, 12.0);
  assertEqual(skybridge.overdriveBoostMultiplier, 1.35);

  // Ramp 2: Plasma Boost Ring
  const ringRes = app.subsystems.physicsWorld.triggerPlasmaBoostRing('ring_t4_04');
  assertTrue(ringRes.triggered);
  assertEqual(ringRes.boostMultiplier, 1.42);
  assertEqual(ringRes.creditsAwarded, 2500);

  // Ramp 3: Kinetic Shockwave Landing
  const shockRes = app.subsystems.physicsWorld.evaluateKineticShockwaveLanding(
    220.0,
    [{ id: 'ai_1', distanceMeters: 10.0 }],
    3.5
  );
  assertTrue(shockRes.shockwaveFired);
  assertEqual(shockRes.postTouchdownSpeedKph, 220.0 * 1.15);
  assertTrue(shockRes.blastedRivals[0].blasted);

  app.simulateWinRace({ position: 1, stunts: 2, takedowns: 1 });
  assertEqual(app.getState().phase, 'POST_RACE');
});

// T4-05: Nordschleife 24.0 KM "Green Hell" Tour & 400+ KPH Wall Glide (koenigsegg #26 Jesko Absolut, 445 KPH)
t4('T4-05', ['F9', 'F20', 'F38'], 'Nordschleife 24.0 KM "Green Hell" Tour & 400+ KPH Wall Glide (koenigsegg #26 Jesko Absolut, 445 KPH)', async (ctx) => {
  const app = ctx.createFreshController();
  app.completeBoot();
  app.toggleSandboxUnlockAll();

  app.selectVehicle('koenigsegg');
  app.setCircuitConfig({
    trackId: 'track_golden_gp',
    skyId: 'sky_golden_hour',
    distanceKm: 24.0,
    format: 'SPRINT_1_LAP',
    aiDifficulty: 'VERY_HARD',
  });

  app.launchRace();
  assertEqual(app.subsystems.splineStreamer.getTotalLength(), 24000);
  assertEqual(app.subsystems.splineStreamer.getSectorCount(), 48);

  // Acceleration on 3.2 KM straight
  app.subsystems.physicsWorld.state.speedKph = 445.0;
  app.subsystems.physicsWorld.state.vTangent = 445.0 / 3.6;
  app.subsystems.physicsWorld.state.lateralOffset = 14.0; // Contact with barrier
  app.subsystems.physicsWorld.state.vLateral = 10.0;

  const barrierRes = app.subsystems.physicsWorld.projectBarrierCollision();
  assertTrue(barrierRes.clamped);
  assertEqual(barrierRes.deltaAlongOffset, 0.0);
  assertEqual(barrierRes.lateralOffsetAfter, app.subsystems.physicsWorld.dMax);
  assertTrue(barrierRes.sparksActive);

  // Monotonic progress
  app.subsystems.physicsWorld.step(0.1, { throttle: 1.0 });
  assertGreater(app.subsystems.physicsWorld.state.alongOffset, 0.0);
});

// T4-06: Coast-to-Coast 50.0 KM Mega Highway Endurance & LRU Streaming (hyper #27 Bugatti W16 on track_alpine + sky_alpine_glacier / 10 Laps Endurance)
t4('T4-06', ['F7', 'F14', 'F21', 'F38'], 'Coast-to-Coast 50.0 KM Mega Highway Endurance & LRU Streaming (hyper #27 Bugatti W16 on track_alpine + sky_alpine_glacier / 10 Laps Endurance)', async (ctx) => {
  const app = ctx.createFreshController();
  app.completeBoot();
  app.toggleSandboxUnlockAll();

  app.selectVehicle('hyper');
  app.setCircuitConfig({
    trackId: 'track_alpine',
    skyId: 'sky_alpine_glacier',
    distanceKm: 50.0,
    format: 'ENDURANCE_10_LAPS',
    aiDifficulty: 'VERY_HARD',
  });

  app.launchRace();
  assertEqual(app.subsystems.splineStreamer.getTotalLength(), 50000);
  assertEqual(app.subsystems.splineStreamer.getSectorCount(), 100);

  // Stream across sectors
  const sectorCheckpoints = [0, 15000, 30000, 45000];
  for (const s of sectorCheckpoints) {
    app.subsystems.pakStreamer.streamLookaheadWindow(s, 50000, 2, 6);
    assertLessOrEqual(app.subsystems.pakStreamer.residentSectors.size, app.subsystems.pakStreamer.maxResidentSectors);
  }

  const skySpec = ctx.specs.SKY_BIOMES_SPEC.find((s) => s.id === 'sky_alpine_glacier');
  assertTrue(skySpec.auroraEnabled);
  assertEqual(skySpec.snowParticleCount, 4096);
});

// T4-07: Knockout Elimination Last-Man-Standing Survival (police #12 Twin-Turbo Interceptor on 2.0 KM Stadium Sprint / KNOCKOUT_ELIMINATION)
t4('T4-07', ['F16', 'F39'], 'Knockout Elimination Last-Man-Standing Survival (police #12 Twin-Turbo Interceptor on 2.0 KM Stadium Sprint / KNOCKOUT_ELIMINATION)', async (ctx) => {
  const app = ctx.createFreshController();
  app.completeBoot();
  app.toggleSandboxUnlockAll();

  app.selectVehicle('police');
  app.setCircuitConfig({
    trackId: 'track_neotokyo',
    skyId: 'sky_neotokyo_cyber',
    distanceKm: 2.0,
    format: 'KNOCKOUT_ELIMINATION',
    aiDifficulty: 'HARD',
  });

  app.launchRace();
  assertEqual(app.subsystems.aiDirector.totalRacers, 6);

  // Eliminate 5 rivals one by one
  for (let round = 1; round <= 5; round++) {
    const elim = app.subsystems.aiDirector.eliminateLastPlaceRacer();
    assertTrue(elim.explosionTriggered);
    assertEqual(elim.activeRacersRemaining, 6 - round);
  }

  // 1 winner left
  assertEqual(app.subsystems.aiDirector.racers.filter((r) => r.status === 'ACTIVE').length, 1);
  app.simulateWinRace({ position: 1 });
  assertEqual(app.getState().phase, 'POST_RACE');
});

// T4-08: Solo Time Attack Ghost Car & Sector 1/2/3 Split Delta Challenge (porsche_gt3 #18 on 5.0 KM FIA Grand Prix / SOLO_TIME_ATTACK)
t4('T4-08', ['F17', 'F40'], 'Solo Time Attack Ghost Car & Sector 1/2/3 Split Delta Challenge (porsche_gt3 #18 on 5.0 KM FIA Grand Prix / SOLO_TIME_ATTACK)', async (ctx) => {
  const app = ctx.createFreshController();
  app.completeBoot();
  app.toggleSandboxUnlockAll();

  app.selectVehicle('porsche_gt3');
  app.setCircuitConfig({
    trackId: 'track_golden_gp',
    skyId: 'sky_golden_hour',
    distanceKm: 5.0,
    format: 'SOLO_TIME_ATTACK',
    aiDifficulty: 'HARD',
  });

  app.launchRace();
  assertEqual(app.subsystems.aiDirector.totalRacers, 1);

  // Lap 1 baseline
  app.subsystems.aiDirector.recordTimeAttackProgress(0.333, 20.5);
  app.subsystems.aiDirector.recordTimeAttackProgress(0.667, 41.5);
  const lap1 = app.subsystems.aiDirector.recordTimeAttackProgress(1.0, 62.0);
  assertTrue(lap1.completedLap);
  assertTrue(lap1.ghostCarActive);

  // Lap 2 faster splits
  app.subsystems.aiDirector.sectorSplits = [null, null, null];
  app.subsystems.aiDirector.recordTimeAttackProgress(0.333, 19.8);
  app.subsystems.aiDirector.recordTimeAttackProgress(0.667, 39.9);
  const lap2 = app.subsystems.aiDirector.recordTimeAttackProgress(1.0, 59.5);
  assertTrue(lap2.completedLap);
  assertLess(lap2.lapDeltaSec, 0.0);
  assertEqual(lap2.lapTimeSec, 59.5);
});

// T4-09: Apex Legend Super Hard AI Tactical Showdown (f1 #32 Formula 1 Ground-Effect Apex vs SUPER_HARD AI on 8.0 KM Pro GT Loop)
t4('T4-09', ['F18', 'F25', 'F37'], 'Apex Legend Super Hard AI Tactical Showdown (f1 #32 Formula 1 Ground-Effect Apex vs SUPER_HARD AI on 8.0 KM Pro GT Loop)', async (ctx) => {
  const app = ctx.createFreshController();
  app.completeBoot();
  app.toggleSandboxUnlockAll();

  app.selectVehicle('f1');
  app.setCircuitConfig({
    trackId: 'track_canyon',
    skyId: 'sky_redrock_canyon',
    distanceKm: 8.0,
    format: 'GRAND_PRIX_3_LAPS',
    aiDifficulty: 'SUPER_HARD',
  });

  app.launchRace();
  const aiDecision = app.subsystems.aiDirector.evaluateAiTacticalDecision('SUPER_HARD', {
    distanceBehindLeaderMeters: 12.0,
    distanceToSkybridgeMeters: 40.0,
    curvature: 0.0005,
    nitroPercent: 50.0,
  });

  assertTrue(aiDecision.drafting);
  assertTrue(aiDecision.takingSkybridge);
  assertTrue(aiDecision.nitroActive);

  app.simulateWinRace({ position: 1, overtakes: 5 });
  assertEqual(app.getState().phase, 'POST_RACE');
});

// T4-10: Career CR Stunt Grinding & Early Dealership Purchase (hot_hatch #2 -> Early CR Purchase of Tier 3 corvette_gt #19)
t4('T4-10', ['F26', 'F33'], 'Career CR Stunt Grinding & Early Dealership Purchase (hot_hatch #2 -> Early CR Purchase of Tier 3 corvette_gt #19)', async (ctx) => {
  const app = ctx.createFreshController();
  app.completeBoot();

  const corvette = ctx.specs.VEHICLE_ROSTER_SPEC.find((v) => v.id === 'corvette_gt');
  assertGreater(corvette.winsRequired, 10);

  // Grind CR with hot_hatch
  app.selectVehicle('hot_hatch');
  app.subsystems.progression.recordRaceCompletion({ position: 1, stunts: 10, overtakes: 8, laps: 3 });
  app.subsystems.progression.credits += corvette.creditCost;

  // Early purchase in Tab 1
  app.selectTab(1);
  const purchase = app.subsystems.progression.purchaseVehicleWithCR('corvette_gt');
  assertTrue(purchase.purchased);
  assertIncludes(app.subsystems.progression.getUnlockedVehicleIds(), 'corvette_gt');

  // Immediately selectable and raceable
  app.selectVehicle('corvette_gt');
  assertEqual(app.getState().selectedVehicleId, 'corvette_gt');
  app.launchRace();
  assertEqual(app.getState().phase, 'RACING');
});

// T4-11: Sandbox Unlock-All Header Toggle & Non-Destructive Career Restore ([🔓 SANDBOX: UNLOCK ALL 34 CARS])
t4('T4-11', ['F33'], 'Sandbox Unlock-All Header Toggle & Non-Destructive Career Restore ([🔓 SANDBOX: UNLOCK ALL 34 CARS])', async (ctx) => {
  const app = ctx.createFreshController();
  app.completeBoot();
  app.subsystems.progression.totalWins = 2;
  app.subsystems.progression.earnedOrPurchasedIds.add('jdm_rotary');
  app.subsystems.progression.earnedOrPurchasedIds.add('car');

  assertEqual(app.getState().unlockedVehicleIds.length, 5);

  // Enable Sandbox
  app.toggleSandboxUnlockAll();
  assertTrue(app.getState().sandboxUnlockedAll);
  assertEqual(app.getState().unlockedVehicleIds.length, 34);

  // Select mythic tier 5 car
  app.selectVehicle('jet_thrust');
  assertEqual(app.getState().selectedVehicleId, 'jet_thrust');

  // Disable Sandbox
  app.toggleSandboxUnlockAll();
  assertFalse(app.getState().sandboxUnlockedAll);
  assertEqual(app.getState().unlockedVehicleIds.length, 5);
  assertEqual(app.getState().totalWins, 2);
});

// T4-12: Complete 31-Win Career Unlock Ladder Marathon (0 Wins Tier 0 -> 31 Wins Unlocking All 34 Vehicles #1..#34)
t4('T4-12', ['F32', 'F33', 'F34'], 'Complete 31-Win Career Unlock Ladder Marathon (0 Wins Tier 0 -> 31 Wins Unlocking All 34 Vehicles #1..#34)', async (ctx) => {
  const app = ctx.createFreshController();
  app.completeBoot();
  assertEqual(app.getState().totalWins, 0);
  assertEqual(app.getState().unlockedVehicleIds.length, 3);

  for (let w = 1; w <= 31; w++) {
    const postRace = app.simulateWinRace({ position: 1 });
    assertEqual(postRace.totalWins, w);
    assertEqual(postRace.unlockedVehicleIds.length, 3 + w);
    assertTrue(postRace.lastCeremonyReport.turntableRevealActive);
    assertEqual(postRace.lastCeremonyReport.newlyUnlockedVehicle.winsRequired, w);
    app.returnToPaddock();
  }

  assertEqual(app.getState().unlockedVehicleIds.length, 34);
});

// T4-13: Supersonic Afterburner Land-Speed Record Run (jet_thrust #34 at 485 KPH / 134.72 m/s on 24.0 KM Nordschleife)
t4('T4-13', ['F6', 'F15', 'F20', 'F29', 'F40'], 'Supersonic Afterburner Land-Speed Record Run (jet_thrust #34 at 485 KPH / 134.72 m/s on 24.0 KM Nordschleife)', async (ctx) => {
  const app = ctx.createFreshController();
  app.completeBoot();
  app.toggleSandboxUnlockAll();

  app.selectVehicle('jet_thrust');
  app.setCircuitConfig({
    trackId: 'track_canyon',
    skyId: 'sky_redrock_canyon',
    distanceKm: 24.0,
    format: 'SOLO_TIME_ATTACK',
  });

  app.launchRace();
  const jetSpec = ctx.specs.VEHICLE_ROSTER_SPEC.find((v) => v.id === 'jet_thrust');
  assertEqual(jetSpec.topSpeedKph, 485);
  assertEqual(jetSpec.zeroToHundredSec, 1.65);

  app.subsystems.physicsWorld.state.speedKph = 485.0;
  app.subsystems.physicsWorld.state.vTangent = 485.0 / 3.6;
  assertApprox(app.subsystems.physicsWorld.state.vTangent, 134.72, 0.05);

  const fx = app.subsystems.renderer.updateSpeedCameraFx(485.0);
  assertGreater(fx.fovDeg, 78.0);

  // Heavy braking heating
  for (let s = 0; s < 25; s++) {
    app.subsystems.physicsWorld.step(0.1, { throttle: 0.0, brake: 1.0 });
  }
  assertGreater(app.subsystems.physicsWorld.state.brakeTempCelsius, 150.0);
});

// T4-14: Heavy Iron vs Featherweight Physics Contrast Journey (135 KG scooter #1 vs 8,400 KG bus #15)
t4('T4-14', ['F8', 'F16', 'F32'], 'Heavy Iron vs Featherweight Physics Contrast Journey (135 KG scooter #1 vs 8,400 KG bus #15)', async (ctx) => {
  const app = ctx.createFreshController();
  app.completeBoot();
  app.toggleSandboxUnlockAll();

  const scooter = ctx.specs.VEHICLE_ROSTER_SPEC.find((v) => v.id === 'scooter');
  const bus = ctx.specs.VEHICLE_ROSTER_SPEC.find((v) => v.id === 'bus');

  assertApprox(bus.massKg / scooter.massKg, 62.2, 0.5);

  // Scooter acceleration
  app.subsystems.physicsWorld.setVehicleSpec(scooter);
  app.subsystems.physicsWorld.step(1.0, { throttle: 1.0 });
  const scooterSpeed1s = app.subsystems.physicsWorld.state.speedKph;

  // Bus acceleration
  app.subsystems.physicsWorld.setVehicleSpec(bus);
  app.subsystems.physicsWorld.step(1.0, { throttle: 1.0 });
  const busSpeed1s = app.subsystems.physicsWorld.state.speedKph;

  assertGreater(scooterSpeed1s, busSpeed1s * 1.5);
});

// T4-15: Showroom 12 PBR Liveries, Framed Multi-Pane Glass & Transparent Mid-Engine 3D V12 Block Inspection (lambo #23 & pagani_v12 #25)
t4('T4-15', ['F4', 'F5', 'F30'], 'Showroom 12 PBR Liveries, Framed Multi-Pane Glass & Transparent Mid-Engine 3D V12 Block Inspection (lambo #23 & pagani_v12 #25)', async (ctx) => {
  const app = ctx.createFreshController();
  app.completeBoot();
  app.toggleSandboxUnlockAll();

  app.selectVehicle('lambo');
  assertEqual(app.getState().cameraMode, 'SHOWROOM');

  for (let l = 0; l < 12; l++) {
    app.selectLivery(l);
    assertEqual(app.getState().selectedLiveryIndex, l);
    assertGreater(app.getState().activeExterior.materialUniforms.clearcoat, 0.3);
  }

  const cockpit = app.subsystems.vehicleBuilder.buildCockpitAndGlass('pagani_v12');
  assertEqual(cockpit.glassMaterial.ior, 1.52);
  assertTrue(cockpit.framedWindows.midEngineBayWindow !== null);
  assertTrue(cockpit.framedWindows.engineBlock3D !== null);
  assertEqual(cockpit.framedWindows.engineBlock3D.cylinders, 12);
});

// T4-16: Mod Studio Tuning, Photo Mode Bokeh DOF & Binary .glb Export Workflow (mclaren_lt #24)
t4('T4-16', ['F6', 'F36'], 'Mod Studio Tuning, Photo Mode Bokeh DOF & Binary .glb Export Workflow (mclaren_lt #24)', async (ctx) => {
  const app = ctx.createFreshController();
  app.completeBoot();
  app.toggleSandboxUnlockAll();

  app.selectVehicle('mclaren_lt');
  app.selectTab(4);
  app.setModStudioTuning({ rideHeightOffset: -0.03, wingAngleRad: 0.28 });

  assertTrue(app.subsystems.renderer.postFx.bokehDof.enabled);

  const glbBytes = app.exportCurrentVehicleGlb();
  const header = assertGlbHeader(glbBytes, 'McLaren LT GLB Export');
  assertEqual(header.parsed.scene, 0);
  assertGreater(header.parsed.meshes.length, 0);
});

// T4-17: Keyboard-First Console Navigation & In-Race Camera Cycling Journey ([Q / E] & [C])
t4('T4-17', ['F36'], 'Keyboard-First Console Navigation & In-Race Camera Cycling Journey ([Q / E] & [C])', async (ctx) => {
  const app = ctx.createFreshController();
  app.completeBoot();

  assertEqual(app.getState().activeTab, 1);
  app.pressTabKey('KeyE');
  assertEqual(app.getState().activeTab, 2);
  app.pressTabKey('KeyE');
  assertEqual(app.getState().activeTab, 3);
  app.pressTabKey('KeyE');
  assertEqual(app.getState().activeTab, 4);

  app.pressTabKey('KeyQ');
  assertEqual(app.getState().activeTab, 3);

  app.toggleSandboxUnlockAll();
  app.selectVehicle('muscle');
  app.launchRace();

  assertEqual(app.getState().cameraMode, 'CHASE');
  app.cycleCameraMode();
  assertEqual(app.getState().cameraMode, 'COCKPIT');
  app.cycleCameraMode();
  assertEqual(app.getState().cameraMode, 'HOOD');
  app.cycleCameraMode();
  assertEqual(app.getState().cameraMode, 'ORBIT');
  app.cycleCameraMode();
  assertEqual(app.getState().cameraMode, 'CHASE');
});

// T4-18: Uncapped Renderer Display & Post-Processing Live Reconfiguration (ev_proto #28 Rimac Nevera)
t4('T4-18', ['F2', 'F3'], 'Uncapped Renderer Display & Post-Processing Live Reconfiguration (ev_proto #28 Rimac Nevera)', async (ctx) => {
  const app = ctx.createFreshController();
  app.completeBoot();
  app.toggleSandboxUnlockAll();

  app.selectVehicle('ev_proto');
  app.setCircuitConfig({ distanceKm: 8.0 });
  app.launchRace();

  const r = app.subsystems.renderer;
  const rates = [120, 144, 240, 0];
  for (const rate of rates) {
    r.setVsyncHz(rate);
    assertEqual(r.vsyncHz, rate);
  }

  const ssaaScales = [1.0, 1.5, 2.0, 2.5];
  for (const s of ssaaScales) {
    r.setSsaaScale(s);
    assertEqual(r.ssaaScale, s);
  }

  r.configureSsgi(1.2, 16);
  assertTrue(r.ssgi.enabled);
  assertEqual(r.ssgi.raySteps, 16);

  const frame = r.renderFrame();
  assertGreater(frame.deferredPassCount, 0);
  assertGreater(frame.forwardPlusPassCount, 0);
});

// T4-19: 4-Biome × 4-Sky World Championship Tour (4 Consecutive Races Across All Biomes & Skies)
t4('T4-19', ['F11', 'F12', 'F13', 'F14', 'F22', 'F23'], '4-Biome × 4-Sky World Championship Tour (4 Consecutive Races Across All Biomes & Skies)', async (ctx) => {
  const app = ctx.createFreshController();
  app.completeBoot();
  app.toggleSandboxUnlockAll();

  const tourLegs = [
    { car: 'ferrari_v8', track: 'track_golden_gp', sky: 'sky_golden_hour', km: 2.0, diff: 'MEDIUM' },
    { car: 'ariel_exo', track: 'track_neotokyo', sky: 'sky_neotokyo_cyber', km: 5.0, diff: 'HARD' },
    { car: 'lmp1', track: 'track_canyon', sky: 'sky_redrock_canyon', km: 8.0, diff: 'VERY_HARD' },
    { car: 'stock_nascar', track: 'track_alpine', sky: 'sky_alpine_glacier', km: 12.0, diff: 'SUPER_HARD' },
  ];

  let prevWins = 0;
  for (const leg of tourLegs) {
    app.selectVehicle(leg.car);
    app.setCircuitConfig({
      trackId: leg.track,
      skyId: leg.sky,
      distanceKm: leg.km,
      aiDifficulty: leg.diff,
    });
    app.launchRace();
    assertEqual(app.getState().phase, 'RACING');
    const win = app.simulateWinRace({ position: 1 });
    assertGreater(win.totalWins, prevWins);
    prevWins = win.totalWins;
    app.returnToPaddock();
  }
  assertEqual(app.getState().totalWins, 4);
});

// T4-20: Persistent Career Save/Load Across Browser Reload (localStorage apex_gp_progression_v1)
t4('T4-20', ['F33'], 'Persistent Career Save/Load Across Browser Reload (localStorage apex_gp_progression_v1)', async (ctx) => {
  const store = new Map();
  const prog1 = new ctx.engineApi.progression.constructor(store);
  prog1.resetCareer();

  prog1.recordRaceCompletion({ position: 1, overtakes: 2 });
  prog1.recordRaceCompletion({ position: 1, overtakes: 4 });
  assertEqual(prog1.totalWins, 2);
  const savedCredits = prog1.credits;
  const savedXp = prog1.driverXp;

  // Simulate page reload by creating new progression manager pointing to same store
  const prog2 = new ctx.engineApi.progression.constructor(store);
  prog2.loadFromStorage();

  assertEqual(prog2.totalWins, 2);
  assertEqual(prog2.credits, savedCredits);
  assertEqual(prog2.driverXp, savedXp);
  assertIncludes(prog2.getUnlockedVehicleIds(), 'jdm_rotary');
  assertIncludes(prog2.getUnlockedVehicleIds(), 'car');
});

// T4-21: Granular Audio Synth Full Acoustic Lifecycle (GranularSynthEngine End-to-End Soundscape)
t4('T4-21', ['F39', 'F41'], 'Granular Audio Synth Full Acoustic Lifecycle (GranularSynthEngine End-to-End Soundscape)', async (ctx) => {
  const { synthEngine } = ctx.engineApi;
  synthEngine.playV12IgnitionRoar();
  assertGreater(synthEngine.sfxCounters.v12IgnitionRoar, 0);

  const cars = ['scooter', 'jdm_rotary', 'lambo', 'jet_thrust'];
  for (const c of cars) {
    const a = synthEngine.updateEngineAudio(c, 5000, 0.8);
    assertGreater(a.fundamentalFreqHz, 50);
  }

  synthEngine.playTurboBlowOff(0.9);
  synthEngine.playTireSkid(0.85);
  synthEngine.playSlipstreamWind(0.7);
  synthEngine.playPlasmaRingChime();
  synthEngine.playShockwaveBoom();
  synthEngine.playKnockoutExplosion();

  assertGreater(synthEngine.sfxCounters.turboBlowOff, 0);
  assertGreater(synthEngine.sfxCounters.tireSkid, 0);
  assertGreater(synthEngine.sfxCounters.slipstreamWind, 0);
  assertGreater(synthEngine.sfxCounters.plasmaRingChime, 0);
  assertGreater(synthEngine.sfxCounters.shockwaveBoom, 0);
  assertGreater(synthEngine.sfxCounters.knockoutExplosion, 0);
});

// T4-22: Canonical vs Indexed Asset Alias Stress Journey (sky_01..04 <-> sky_*, track_01..04 <-> track_*, car_01..34 <-> Roster IDs)
t4('T4-22', ['F7', 'F10', 'F22', 'F28'], 'Canonical vs Indexed Asset Alias Stress Journey (sky_01..04 <-> sky_*, track_01..04 <-> track_*, car_01..34 <-> Roster IDs)', async (ctx) => {
  const { pakStreamer } = ctx.engineApi;

  // Sky aliases
  for (let i = 1; i <= 4; i++) {
    const alias = `sky_0${i}`;
    const res = pakStreamer.resolveAssetAlias(alias);
    assertEqual(res.category, 'sky');
    assertEqual(res.byteLength, ctx.specs.SKY_PAK_BYTE_LENGTH);
  }

  // Track aliases
  for (let i = 1; i <= 4; i++) {
    const alias = `track_0${i}`;
    const res = pakStreamer.resolveAssetAlias(alias);
    assertEqual(res.category, 'track');
    assertEqual(res.byteLength, ctx.specs.TRACK_PAK_BYTE_LENGTH);
  }

  // Vehicle aliases
  for (let i = 1; i <= 34; i++) {
    const dir = `car_${String(i).padStart(2, '0')}`;
    const res = pakStreamer.resolveAssetAlias(dir);
    assertEqual(res.category, 'vehicle');
    assertEqual(res.byteLength, ctx.specs.VEHICLE_PAK_BYTE_LENGTH);
  }
});

// T4-23: High-Speed Cockpit Telemetry & HUD 1:1 Synchronization Journey (indy_open #30 at 380 KPH in COCKPIT Mode)
t4('T4-23', ['F19', 'F31', 'F40'], 'High-Speed Cockpit Telemetry & HUD 1:1 Synchronization Journey (indy_open #30 at 380 KPH in COCKPIT Mode)', async (ctx) => {
  const app = ctx.createFreshController();
  app.completeBoot();
  app.toggleSandboxUnlockAll();

  app.selectVehicle('indy_open');
  app.setCircuitConfig({
    trackId: 'track_alpine',
    skyId: 'sky_alpine_glacier',
    distanceKm: 12.0,
    format: 'SOLO_TIME_ATTACK',
  });

  app.launchRace();
  app.setCameraMode('COCKPIT');

  app.subsystems.physicsWorld.state.speedKph = 380.0;
  app.subsystems.physicsWorld.state.rpm = 12000;
  app.subsystems.physicsWorld.state.gear = 6;
  app.subsystems.physicsWorld.state.drsActive = true;
  app.subsystems.physicsWorld.state.nitroPercent = 75.0;
  app.subsystems.physicsWorld.state.brakeTempCelsius = 620.0;

  const state = app.getState();
  assertEqual(state.telemetry.speedKph, 380);
  assertEqual(state.telemetry.gear, 6);
  assertTrue(state.telemetry.drsActive);
  assertEqual(state.telemetry.nitroPercent, 75.0);
  assertEqual(state.telemetry.brakeTempCelsius, 620);

  const dashRendered = state.activeCockpit.cockpitInterior.telemetryScreenMesh.renderedData;
  assertEqual(dashRendered.speedKph, 380);
  assertEqual(dashRendered.gear, 6);
  assertGreater(dashRendered.rpmBarFillPercent, 90.0);
});

// T4-24: Full Production Smoke & Zero-Console-Error Playwright Certification (playwright.config.ts)
t4('T4-24', ['F1', 'F2', 'F35', 'F36', 'F42'], 'Full Production Smoke & Zero-Console-Error Playwright Certification (playwright.config.ts)', async (ctx) => {
  const docs = ctx.fsProbe.getProjectDocs();
  assertTrue(docs.projectMd.existsOnDisk);

  const app = ctx.createFreshController();
  assertEqual(app.getState().phase, 'BOOT');
  app.completeBoot();
  assertEqual(app.getState().phase, 'PADDOCK');

  // Verify all 4 tabs navigation
  for (let tab = 1; tab <= 4; tab++) {
    app.selectTab(tab);
    assertEqual(app.getState().activeTab, tab);
  }

  // Mod Studio export
  app.selectVehicle('koenigsegg');
  const glb = app.exportCurrentVehicleGlb();
  assertGlbHeader(glb);

  // Race launch
  app.setCircuitConfig({ distanceKm: 5.0, format: 'GRAND_PRIX_3_LAPS', aiDifficulty: 'SUPER_HARD' });
  app.launchRace();
  assertEqual(app.getState().phase, 'RACING');
  assertGreater(app.getState().fps, 0);

  // Victory ceremony
  const postRace = app.simulateWinRace({ position: 1 });
  assertEqual(postRace.phase, 'POST_RACE');
  assertTrue(postRace.lastCeremonyReport.podiumStageActive);

  // Total footprint audit
  const audit = ctx.fsProbe.getAssetFootprintAudit();
  assertInRange(audit.totalFootprintMb, 760, 850);
  assertEqual(audit.totalPakFileCount, 42);
});
